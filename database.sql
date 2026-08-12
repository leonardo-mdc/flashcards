-- Flashcard Studio — Full database schema
-- Run this in phpMyAdmin (or any MySQL client) once, then set config.php credentials.

-- Pick your own database name (InfinityFree will have already created one in your panel,
-- e.g. if0_41632431_flashcards). Replace 'flashcards' below with your actual DB name.
CREATE DATABASE IF NOT EXISTS `flashcards`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `flashcards`;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    progress INT DEFAULT 0,
    english_level VARCHAR(50) DEFAULT 'Beginner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS card_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    exclusive_to VARCHAR(255) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    set_id INT NOT NULL,
    title VARCHAR(200),
    pattern_type ENUM('usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_mcq','image_description','audio_listening') DEFAULT 'usage_cases',
    level ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
    question_text TEXT,
    content_data JSON,
    FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE,
    INDEX idx_level (level),
    INDEX idx_pattern_type (pattern_type),
    INDEX idx_set_id (set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_card_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INT DEFAULT 0,
    next_review DATE,
    last_review DATE,
    correct_streak INT DEFAULT 0,
    was_correct TINYINT(1) DEFAULT 1,
    total_reviews INT DEFAULT 0,
    repetitions INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_pair (user_id, card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS review_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    quality INT NOT NULL,
    was_correct TINYINT(1) DEFAULT 0,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_set_access (
    user_id INT NOT NULL,
    set_id INT NOT NULL,
    PRIMARY KEY (user_id, set_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
