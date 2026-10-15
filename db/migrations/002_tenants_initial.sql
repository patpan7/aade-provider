-- ============================================================================
-- Migration: 002_tenants_initial.sql
-- Purpose: Create tenants table for multi-tenancy support
-- ============================================================================

-- Create tenants table
CREATE TABLE tenants (
    id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    trade_title VARCHAR(255),
    vat_number VARCHAR(20) UNIQUE NOT NULL,
    tax_office VARCHAR(100),
    address VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(2) DEFAULT 'GR',
    phone VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    
    -- myDATA Authorization Status
    aade_authorization_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACTIVE, REVOKED
    aade_authorized_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tenant (for existing functionality)
INSERT INTO tenants (id, company_name, vat_number, email, status)
VALUES (1, 'Default Company', '000000000', 'default@example.com', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Create index for fast lookup
CREATE INDEX idx_tenants_vat ON tenants(vat_number);
CREATE INDEX idx_tenants_status ON tenants(status);