-- Migration 001: Create employees and shifts tables

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL,
    max_weekly_hours NUMERIC(5, 2) NOT NULL DEFAULT 40,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    role_required VARCHAR(50) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- Index to speed up the most common query pattern: "find shifts for this employee in this time range"
CREATE INDEX idx_shifts_employee_time ON shifts(employee_id, start_time, end_time);