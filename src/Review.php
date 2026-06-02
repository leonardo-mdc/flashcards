<?php

class Review
{
    public static function ensureTable(): void
    {
        $pdo = Database::getConnection();
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
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
            UNIQUE KEY unique_pair (user_id, card_id)
        )");

        $stmt = $pdo->query("SHOW TABLES LIKE 'user_card_progress'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE student_card_progress RENAME TO user_card_progress");
        }

        $stmt = $pdo->query("SHOW COLUMNS FROM user_card_progress LIKE 'user_id'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE user_card_progress CHANGE student_id user_id INT NOT NULL");
        }
    }

    public static function record(int $cardId, int $userId, int $quality, bool $wasCorrect): void
    {
        self::ensureTable();
        $pdo = Database::getConnection();

        $daysToAdd = match ($quality) {
            0 => 1,
            2 => 3,
            3 => 7,
            default => 1,
        };

        $nextReview = date('Y-m-d', strtotime("+$daysToAdd days"));
        $today = date('Y-m-d');

        $stmt = $pdo->prepare("SELECT id FROM user_card_progress WHERE user_id = ? AND card_id = ?");
        $stmt->execute([$userId, $cardId]);
        $exists = $stmt->fetch();

        if ($exists) {
            $stmt = $pdo->prepare("
                UPDATE user_card_progress
                SET next_review = ?, last_review = ?, was_correct = ?, total_reviews = total_reviews + 1
                WHERE user_id = ? AND card_id = ?
            ");
            $stmt->execute([$nextReview, $today, $wasCorrect ? 1 : 0, $userId, $cardId]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO user_card_progress (user_id, card_id, next_review, last_review, was_correct, total_reviews)
                VALUES (?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([$userId, $cardId, $nextReview, $today, $wasCorrect ? 1 : 0]);
        }
    }
}
