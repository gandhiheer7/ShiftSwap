import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { validateSwapClaim } from '../services/conflictValidator';

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

// GET /swaps/:id - get a single swap request, including its most recent claim (if any)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const swapResult = await pool.query(
      `SELECT sr.id, sr.shift_id, sr.requesting_employee_id, e.name AS requesting_employee_name,
              sr.reason, sr.status, sr.created_at,
              s.role_required, s.start_time, s.end_time
       FROM swap_requests sr
       JOIN employees e ON sr.requesting_employee_id = e.id
       JOIN shifts s ON sr.shift_id = s.id
       WHERE sr.id = $1`,
      [id]
    );

    if (swapResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found' });
    }

    const claimResult = await pool.query(
      `SELECT sc.id, sc.claiming_employee_id, ce.name AS claiming_employee_name,
              sc.validated, sc.conflict_reason, sc.created_at
       FROM swap_claims sc
       JOIN employees ce ON sc.claiming_employee_id = ce.id
       WHERE sc.swap_request_id = $1
       ORDER BY sc.created_at DESC
       LIMIT 1`,
      [id]
    );

    res.status(200).json({
      swap_request: swapResult.rows[0],
      latest_claim: claimResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch swap request' });
  }
});

// POST /swaps/:id/claim - an eligible employee claims an open swap request, validated against conflict rules
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

    const swapResult = await pool.query(
      `SELECT sr.id, sr.status, sr.requesting_employee_id, s.id AS shift_id,
              s.role_required, s.start_time, s.end_time
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const validation = await validateSwapClaim(client, claiming_employee_id, {
        employee_id: claiming_employee_id,
        start_time: swapRequest.start_time,
        end_time: swapRequest.end_time
      });

      const claimInsert = await client.query(
        `INSERT INTO swap_claims (swap_request_id, claiming_employee_id, validated, conflict_reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, swap_request_id, claiming_employee_id, validated, conflict_reason, created_at`,
        [
          id,
          claiming_employee_id,
          validation.valid,
          validation.valid ? null : validation.reasons.join('; ')
        ]
      );

      if (validation.valid) {
        await client.query(`UPDATE swap_requests SET status = 'claimed' WHERE id = $1`, [id]);
      }

      await client.query('COMMIT');

      res.status(validation.valid ? 201 : 422).json({
        swap_claim: claimInsert.rows[0],
        validation
      });
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

// POST /swaps/:id/approve - manager approves a claimed swap request, reassigning the shift
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { manager_id } = req.body;

    if (!manager_id) {
      return res.status(400).json({ status: 'error', message: 'manager_id is required' });
    }

    const managerResult = await pool.query(
      'SELECT id, is_manager FROM employees WHERE id = $1',
      [manager_id]
    );

    if (managerResult.rows.length === 0 || !managerResult.rows[0].is_manager) {
      return res.status(403).json({ status: 'error', message: 'Only a manager can approve swaps' });
    }

    const swapResult = await pool.query(
      `SELECT sr.id, sr.status, sr.shift_id
       FROM swap_requests sr
       WHERE sr.id = $1`,
      [id]
    );

    if (swapResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found' });
    }

    const swapRequest = swapResult.rows[0];

    if (swapRequest.status !== 'claimed') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot approve a swap request with status "${swapRequest.status}"`
      });
    }

    const claimResult = await pool.query(
      `SELECT id, claiming_employee_id, validated
       FROM swap_claims
       WHERE swap_request_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (claimResult.rows.length === 0 || !claimResult.rows[0].validated) {
      return res.status(400).json({
        status: 'error',
        message: 'This swap request has no validated claim to approve'
      });
    }

    const claim = claimResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE shifts SET employee_id = $1 WHERE id = $2`,
        [claim.claiming_employee_id, swapRequest.shift_id]
      );

      await client.query(
        `UPDATE swap_requests SET status = 'approved' WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');

      res.status(200).json({
        status: 'ok',
        message: 'Swap approved and shift reassigned',
        swap_request_id: id,
        new_employee_id: claim.claiming_employee_id
      });
    } catch (innerError) {
      await client.query('ROLLBACK');
      throw innerError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error approving swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to approve swap request' });
  }
});

// POST /swaps/:id/reject - manager rejects a claimed swap request, reopening it for other claimants
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { manager_id, reason } = req.body;

    if (!manager_id) {
      return res.status(400).json({ status: 'error', message: 'manager_id is required' });
    }

    const managerResult = await pool.query(
      'SELECT id, is_manager FROM employees WHERE id = $1',
      [manager_id]
    );

    if (managerResult.rows.length === 0 || !managerResult.rows[0].is_manager) {
      return res.status(403).json({ status: 'error', message: 'Only a manager can reject swaps' });
    }

    const swapResult = await pool.query(
      'SELECT id, status FROM swap_requests WHERE id = $1',
      [id]
    );

    if (swapResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Swap request not found' });
    }

    if (swapResult.rows[0].status !== 'claimed') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot reject a swap request with status "${swapResult.rows[0].status}"`
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reopen the swap request so other employees can claim it
      await client.query(`UPDATE swap_requests SET status = 'open' WHERE id = $1`, [id]);

      // Mark the existing claim as invalidated by manager rejection, freeing the partial unique index
      await client.query(
        `UPDATE swap_claims
         SET validated = FALSE, conflict_reason = $2
         WHERE swap_request_id = $1 AND validated = TRUE`,
        [id, reason || 'Rejected by manager']
      );

      await client.query('COMMIT');

      res.status(200).json({
        status: 'ok',
        message: 'Swap request rejected and reopened for other claimants',
        swap_request_id: id
      });
    } catch (innerError) {
      await client.query('ROLLBACK');
      throw innerError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error rejecting swap request:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reject swap request' });
  }
});

export default router;