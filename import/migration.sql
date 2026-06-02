-- Migration: Add full_name to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NOT NULL DEFAULT '' AFTER username;

-- Change username length from 50 to 30 (if needed)
ALTER TABLE users MODIFY username VARCHAR(30) NOT NULL;

-- Set full_name to username for existing records where full_name is empty
UPDATE users SET full_name = username WHERE full_name = '' OR full_name IS NULL;
