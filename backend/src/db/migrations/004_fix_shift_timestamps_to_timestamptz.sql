-- 004_fix_shift_timestamps_to_timestamptz.sql
ALTER TABLE shifts
  ALTER COLUMN start_time TYPE timestamptz USING start_time AT TIME ZONE 'UTC',
  ALTER COLUMN end_time TYPE timestamptz USING end_time AT TIME ZONE 'UTC';