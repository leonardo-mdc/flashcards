-- Migration: Add full_name to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NOT NULL DEFAULT '' AFTER username;

-- Change username length from 50 to 30 (if needed)
ALTER TABLE users MODIFY username VARCHAR(30) NOT NULL;

-- Set full_name to username for existing records where full_name is empty
UPDATE users SET full_name = username WHERE full_name = '' OR full_name IS NULL;

-- Create review_history table for full audit trail
CREATE TABLE IF NOT EXISTS review_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    quality INT NOT NULL,
    was_correct TINYINT(1) DEFAULT 0,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
