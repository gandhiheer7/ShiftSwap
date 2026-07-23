-- Migration 002: Create swap_requests table

CREATE TABLE swap_requests (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    requesting_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('open', 'claimed', 'approved', 'rejected', 'cancelled'))
);

-- Prevent the same shift from having more than one ACTIVE (open) swap request at a time.
-- Partial unique index: only enforces uniqueness among rows where status = 'open'.
CREATE UNIQUE INDEX idx_unique_open_swap_per_shift
ON swap_requests(shift_id)
WHERE status = 'open';

CREATE INDEX idx_swap_requests_status ON swap_requests(status);