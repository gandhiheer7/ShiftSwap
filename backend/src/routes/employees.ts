import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

// GET /employees - list all employees, optionally filtered by role
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role } = req.query;

    let query = 'SELECT id, name, email, role, max_weekly_hours FROM employees';
    const params: string[] = [];

    if (role) {
      query += ' WHERE role = $1';
      params.push(role as string);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);

    res.status(200).json({
      count: result.rows.length,
      employees: result.rows
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch employees' });
  }
});

// GET /employees/:id - get a single employee by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, name, email, role, max_weekly_hours FROM employees WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Employee not found' });
    }

    res.status(200).json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch employee' });
  }
});

export default router;