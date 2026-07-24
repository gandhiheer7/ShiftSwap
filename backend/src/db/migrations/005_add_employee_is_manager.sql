-- Migration 005: Add is_manager flag to employees

ALTER TABLE employees ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT FALSE;

-- Promote one seeded employee to manager for testing purposes
UPDATE employees SET is_manager = TRUE WHERE id = 1;