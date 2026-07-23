-- Migration 003: Create swap_claims table

CREATE TABLE swap_claims (
    id SERIAL PRIMARY KEY,
    swap_request_id INTEGER NOT NULL REFERENCES swap_requests(id) ON DELETE CASCADE,
    claiming_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    validated BOOLEAN,
    conflict_reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_claim_status CHECK (
        (validated IS NULL) OR
        (validated = TRUE AND conflict_reason IS NULL) OR
        (validated = FALSE AND conflict_reason IS NOT NULL)
    )
);

-- Only one ACTIVE claim per swap request at a time (mirrors the partial unique index pattern from swap_requests)
CREATE UNIQUE INDEX idx_unique_pending_claim_per_swap
ON swap_claims(swap_request_id)
WHERE validated IS NULL;

CREATE INDEX idx_swap_claims_swap_request ON swap_claims(swap_request_id);