import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

// GET /shifts - list shifts, with pagination and optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      employee_id,
      role_required,
      from,
      to
    } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (employee_id) {
      conditions.push(`s.employee_id = $${paramIndex++}`);
      params.push(employee_id as string);
    }

    if (role_required) {
      conditions.push(`s.role_required = $${paramIndex++}`);
      params.push(role_required as string);
    }

    if (from) {
      conditions.push(`s.start_time >= $${paramIndex++}`);
      params.push(from as string);
    }

    if (to) {
      conditions.push(`s.end_time <= $${paramIndex++}`);
      params.push(to as string);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM shifts s ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT s.id, s.employee_id, e.name AS employee_name, s.role_required,
             s.start_time, s.end_time, s.status
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      ${whereClause}
      ORDER BY s.start_time ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataParams = [...params, limitNum, offset];

    const dataResult = await pool.query(dataQuery, dataParams);

    res.status(200).json({
      page: pageNum,
      limit: limitNum,
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / limitNum),
      shifts: dataResult.rows
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch shifts' });
  }
});

// GET /shifts/:id - get a single shift by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.id, s.employee_id, e.name AS employee_name, s.role_required,
              s.start_time, s.end_time, s.status
       FROM shifts s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Shift not found' });
    }

    res.status(200).json({ shift: result.rows[0] });
  } catch (error) {
    console.error('Error fetching shift:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch shift' });
  }
});

export default router;