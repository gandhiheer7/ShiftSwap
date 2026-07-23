import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

// POST /swaps - create a new swap request for a shift
router.post('/', async (req: Request, res: Response) => {
  try {
    const { shift_id, requesting_employee_id, reason } = req.body;

    if (!shift_id || !requesting_employee_id) {
      return res.status(400).json({
        status: 'error',
        message: 'shift_id and requesting_employee_id are required'
      });
    }

    const shiftResult = await pool.query(
      'SELECT id, employee_id, status FROM shifts WHERE id = $1',
      [shift_id]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Shift not found' });
    }

    const shift = shiftResult.rows[0];

    if (shift.employee_id !== requesting_employee_id) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only request a swap for your own shift'
      });
    }

    if (shift.status !== 'scheduled') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot request a swap for a shift with status "${shift.status}"`
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO swap_requests (shift_id, requesting_employee_id, reason, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, shift_id, requesting_employee_id, reason, status, created_at`,
      [shift_id, requesting_employee_id, reason || null]
    );

    res.status(201).json({ swap_request: insertResult.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'This shift already has an open swap request'
      });
    }
    console.error('Error creating swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create swap request' });
  }
});

// GET /swaps - list swap requests, filterable by status
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT sr.id, sr.shift_id, sr.requesting_employee_id, e.name AS requesting_employee_name,
             sr.reason, sr.status, sr.created_at,
             s.role_required, s.start_time, s.end_time
      FROM swap_requests sr
      JOIN employees e ON sr.requesting_employee_id = e.id
      JOIN shifts s ON sr.shift_id = s.id
    `;
    const params: string[] = [];

    if (status) {
      query += ' WHERE sr.status = $1';
      params.push(status as string);
    }

    query += ' ORDER BY sr.created_at DESC';

    const result = await pool.query(query, params);

    res.status(200).json({
      count: result.rows.length,
      swap_requests: result.rows
    });
  } catch (error) {
    console.error('Error fetching swap requests:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap requests' });
  }
});

// GET /swaps/:id - get a single swap request
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT sr.id, sr.shift_id, sr.requesting_employee_id, e.name AS requesting_employee_name,
              sr.reason, sr.status, sr.created_at,
              s.role_required, s.start_time, s.end_time
       FROM swap_requests sr
       JOIN employees e ON sr.requesting_employee_id = e.id
       JOIN shifts s ON sr.shift_id = s.id
       WHERE sr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found' });
    }

    res.status(200).json({ swap_request: result.rows[0] });
  } catch (error) {
    console.error('Error fetching swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap request' });
  }
});

// POST /swaps/:id/claim - an eligible employee claims an open swap request
router.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { claiming_employee_id } = req.body;

    if (!claiming_employee_id) {
      return res.status(400).json({
        status: 'error',
        message: 'claiming_employee_id is required'
      });
    }

    // Fetch the swap request along with the shift's required role
    const swapResult = await pool.query(
      `SELECT sr.id, sr.status, sr.requesting_employee_id, s.role_required
       FROM swap_requests sr
       JOIN shifts s ON sr.shift_id = s.id
       WHERE sr.id = $1`,
      [id]
    );

    if (swapResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found' });
    }

    const swapRequest = swapResult.rows[0];

    if (swapRequest.status !== 'open') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot claim a swap request with status "${swapRequest.status}"`
      });
    }

    if (swapRequest.requesting_employee_id === claiming_employee_id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot claim your own swap request'
      });
    }

    // Verify claiming employee exists and has the matching role
    const employeeResult = await pool.query(
      'SELECT id, role FROM employees WHERE id = $1',
      [claiming_employee_id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Claiming employee not found' });
    }

    const claimingEmployee = employeeResult.rows[0];

    if (claimingEmployee.role !== swapRequest.role_required) {
      return res.status(400).json({
        status: 'error',
        message: `This shift requires role "${swapRequest.role_required}", but you are "${claimingEmployee.role}"`
      });
    }

    // Insert the claim and mark the swap request as 'claimed', in a single transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const claimInsert = await client.query(
        `INSERT INTO swap_claims (swap_request_id, claiming_employee_id)
         VALUES ($1, $2)
         RETURNING id, swap_request_id, claiming_employee_id, validated, created_at`,
        [id, claiming_employee_id]
      );

      await client.query(
        `UPDATE swap_requests SET status = 'claimed' WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');

      res.status(201).json({ swap_claim: claimInsert.rows[0] });
    } catch (innerError) {
      await client.query('ROLLBACK');
      throw innerError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'This swap request already has a pending claim'
      });
    }
    console.error('Error claiming swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to claim swap request' });
  }
});

export default router;