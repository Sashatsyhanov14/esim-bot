-- Migration: support for human support mode and roles
-- Paste this into Supabase SQL Editor and click Run

-- 1. Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_support_mode BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_contact_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiting_order_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_note TEXT;

-- 2. Update roles check to include 'client' and 'admin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('client', 'user', 'founder', 'admin', 'manager'));

-- 3. Set default role to 'client' for new users (optional, if you want to match index.js)
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'client';
