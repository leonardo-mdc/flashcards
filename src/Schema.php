<?php

class Schema
{
    private const TABLES = [
        'users',
        'card_sets',
        'cards',
        'user_card_progress',
        'review_history',
        'student_set_access',
    ];

    public static function createDatabaseIfMissing(): void
    {
        $config = require __DIR__ . '/../config.php';
        $db = $config['db'];
        $pdo = new PDO(
            "mysql:host={$db['host']};charset=utf8mb4",
            $db['user'],
            $db['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $dbName = str_replace('`', '', $db['name']);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName`");
    }

    public static function createAll(): void
    {
        $pdo = Database::getConnection();

        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(30) NOT NULL UNIQUE,
            full_name VARCHAR(100) NOT NULL DEFAULT '',
            password_hash VARCHAR(255) NOT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            progress INT DEFAULT 0,
            english_level VARCHAR(50) DEFAULT 'Beginner',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS card_sets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            exclusive_to VARCHAR(255) DEFAULT ''
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            set_id INT NOT NULL,
            title VARCHAR(200),
            pattern_type ENUM('usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_mcq','image_description','audio_listening') DEFAULT 'usage_cases',
            level ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
            question_text TEXT,
            content_data JSON,
            FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS user_card_progress (
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
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS review_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            card_id INT NOT NULL,
            quality INT NOT NULL,
            was_correct TINYINT(1) DEFAULT 0,
            reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS student_set_access (
            user_id INT NOT NULL,
            set_id INT NOT NULL,
            PRIMARY KEY (user_id, set_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
        )");

        User::ensureTable();
        CardSet::ensureTable();
        CardSet::ensureIndexes();
        Review::ensureTable();
        Review::ensureHistoryTable();
        Review::ensureSetAccessTable();
    }

    public static function tablesReady(): bool
    {
        try {
            $pdo = Database::getConnection();
            foreach (self::TABLES as $table) {
                $stmt = $pdo->query("SHOW TABLES LIKE '" . $table . "'");
                if (!$stmt->fetch()) {
                    return false;
                }
            }
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
