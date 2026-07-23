import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db';
import employeesRouter from './routes/employees';
import shiftsRouter from './routes/shifts';
import swapsRouter from './routes/swaps';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'ShiftSwap API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/db', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.status(200).json({
      status: 'ok',
      message: 'Database connection successful',
      db_time: result.rows[0].current_time
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/employees', employeesRouter);
app.use('/shifts', shiftsRouter);
app.use('/swaps', swapsRouter);

app.listen(PORT, () => {
  console.log(`ShiftSwap backend running on http://localhost:${PORT}`);
});