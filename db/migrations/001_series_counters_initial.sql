-- ============================================================================
-- Migration: 001_series_counters_initial.sql
-- Purpose: Auto-increment AA numbers per series/invoice_type
-- ============================================================================

-- Create series_counters table for atomic AA number generation
CREATE TABLE series_counters (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    aade_branch INT NOT NULL DEFAULT 0,
    invoice_type VARCHAR(10) NOT NULL, -- π.χ. "1.1", "2.1", "11.1", "5.1"
    series VARCHAR(50) NOT NULL,         -- π.χ. "A", "ESHOP", "POS"
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_tenant_series UNIQUE (tenant_id, aade_branch, invoice_type, series)
);

-- Insert initial counters for all invoice types with series "A"
-- These will be auto-created per tenant on first use, but we pre-seed for convenience
INSERT INTO series_counters (tenant_id, aade_branch, invoice_type, series, last_number)
VALUES 
    (1, 0, '1.1', 'A', 0),
    (1, 0, '1.2', 'A', 0),
    (1, 0, '1.3', 'A', 0),
    (1, 0, '1.4', 'A', 0),
    (1, 0, '2.1', 'A', 0),
    (1, 0, '2.2', 'A', 0),
    (1, 0, '2.3', 'A', 0),
    (1, 0, '5.1', 'A', 0),
    (1, 0, '5.2', 'A', 0),
    (1, 0, '5.3', 'A', 0),
    (1, 0, '5.4', 'A', 0),
    (1, 0, '5.5', 'A', 0),
    (1, 0, '11.1', 'A', 0),
    (1, 0, '11.2', 'A', 0),
    (1, 0, '11.3', 'A', 0),
    (1, 0, '11.4', 'A', 0),
    (1, 0, '11.5', 'A', 0);