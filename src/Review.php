<?php

class Review
{
    private const MIN_EF = 1.3;
    private const INITIAL_EF = 2.5;

    public static function ensureTable(): void
    {
        $pdo = Database::getConnection();
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_card_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            card_id INT NOT NULL,
            ease_factor FLOAT DEFAULT 2.5,
            interval_days INT DEFAULT 0,
            repetitions INT DEFAULT 0,
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

        $stmt = $pdo->query("SHOW COLUMNS FROM user_card_progress LIKE 'repetitions'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE user_card_progress ADD COLUMN repetitions INT DEFAULT 0 AFTER interval_days");
        }
    }

    public static function ensureHistoryTable(): void
    {
        $pdo = Database::getConnection();
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
    }

    /**
     * SM-2 algorithm implementation.
     * Quality mapping: 0=Again(blackout), 2=Good(recalled with effort), 3=Easy(perfect)
     */
    public static function record(int $cardId, int $userId, int $quality, bool $wasCorrect): void
    {
        self::ensureTable();
        self::ensureHistoryTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, ease_factor, interval_days, repetitions, correct_streak FROM user_card_progress WHERE user_id = ? AND card_id = ?");
        $stmt->execute([$userId, $cardId]);
        $progress = $stmt->fetch();

        $today = date('Y-m-d');

        if ($wasCorrect && $quality >= 2) {
            $ef = $progress ? (float) $progress['ease_factor'] : self::INITIAL_EF;
            $rep = $progress ? (int) $progress['repetitions'] : 0;
            $prevInterval = $progress ? (int) $progress['interval_days'] : 0;

            $newEF = $ef + (0.1 - (5 - $quality) * (0.08 + (5 - $quality) * 0.02));
            if ($newEF < self::MIN_EF) $newEF = self::MIN_EF;

            if ($rep === 0) {
                $interval = 1;
            } elseif ($rep === 1) {
                $interval = 6;
            } else {
                $interval = (int) round($prevInterval * $ef);
            }

            $rep++;
            $streak = $progress ? (int) $progress['correct_streak'] + 1 : 1;
            $nextReview = date('Y-m-d', strtotime("+$interval days"));
        } else {
            $newEF = $progress ? (float) $progress['ease_factor'] : self::INITIAL_EF;
            $interval = 1;
            $rep = 0;
            $streak = 0;
            $nextReview = date('Y-m-d', strtotime('+1 day'));
        }

        if ($progress) {
            $stmt = $pdo->prepare("
                UPDATE user_card_progress
                SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review = ?,
                    last_review = ?, correct_streak = ?, was_correct = ?, total_reviews = total_reviews + 1
                WHERE user_id = ? AND card_id = ?
            ");
            $stmt->execute([$newEF, $interval, $rep, $nextReview, $today, $streak, $wasCorrect ? 1 : 0, $userId, $cardId]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO user_card_progress (user_id, card_id, ease_factor, interval_days, repetitions, next_review, last_review, correct_streak, was_correct, total_reviews)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([$userId, $cardId, $newEF, $interval, $rep, $nextReview, $today, $streak, $wasCorrect ? 1 : 0]);
        }

        $stmt = $pdo->prepare("INSERT INTO review_history (user_id, card_id, quality, was_correct) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $cardId, $quality, $wasCorrect ? 1 : 0]);
    }

    public static function resetForUser(int $userId): void
    {
        self::ensureTable();
        self::ensureHistoryTable();
        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM review_history WHERE user_id = ?")->execute([$userId]);
        $pdo->prepare("DELETE FROM user_card_progress WHERE user_id = ?")->execute([$userId]);
    }

    public static function ensureSetAccessTable(): void
    {
        $pdo = Database::getConnection();
        $pdo->exec("CREATE TABLE IF NOT EXISTS student_set_access (
            user_id INT NOT NULL,
            set_id INT NOT NULL,
            PRIMARY KEY (user_id, set_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (set_id) REFERENCES card_sets(id) ON DELETE CASCADE
        )");
    }

    public static function getAccessibleSets(int $userId): array
    {
        self::ensureSetAccessTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT set_id FROM student_set_access WHERE user_id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    public static function setAccessibleSets(int $userId, array $setIds): void
    {
        self::ensureSetAccessTable();
        $pdo = Database::getConnection();
        $pdo->prepare("DELETE FROM student_set_access WHERE user_id = ?")->execute([$userId]);
        $stmt = $pdo->prepare("INSERT INTO student_set_access (user_id, set_id) VALUES (?, ?)");
        foreach ($setIds as $setId) {
            $stmt->execute([$userId, (int) $setId]);
        }
    }

    public static function hasAccessToSet(int $userId, int $setId): bool
    {
        $sets = self::getAccessibleSets($userId);
        if (empty($sets)) return true;
        return in_array($setId, $sets);
    }

    public static function isWithin30DayCycle(int $userId): bool
    {
        self::ensureHistoryTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT MIN(reviewed_at) FROM review_history WHERE user_id = ?");
        $stmt->execute([$userId]);
        $firstReview = $stmt->fetchColumn();
        if (!$firstReview) return false;
        $daysSinceFirst = (new \DateTime())->diff(new \DateTime($firstReview))->days;
        return $daysSinceFirst < 30;
    }

    public static function checkAndResetCycle(int $userId): bool
    {
        if (!self::isWithin30DayCycle($userId)) {
            $stats = self::getStats($userId);
            if ($stats['total_reviews'] > 0) {
                self::resetForUser($userId);
                return true;
            }
        }
        return false;
    }

    public static function getStreakDays(int $userId): int
    {
        self::ensureHistoryTable();
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT DISTINCT DATE(reviewed_at) as review_date
            FROM review_history
            WHERE user_id = ?
            ORDER BY review_date DESC
        ");
        $stmt->execute([$userId]);
        $dates = $stmt->fetchAll(\PDO::FETCH_COLUMN);

        if (empty($dates)) return 0;

        $streak = 0;
        $today = new \DateTime();
        $checkDate = clone $today;

        foreach ($dates as $dateStr) {
            $date = new \DateTime($dateStr);
            $diff = (int) $checkDate->diff($date)->days;

            if ($streak === 0) {
                if ($diff <= 1) {
                    $streak = 1;
                    $checkDate = $date;
                } else {
                    break;
                }
            } else {
                if ($diff === 1) {
                    $streak++;
                    $checkDate = $date;
                } else {
                    break;
                }
            }
        }

        return $streak;
    }

    public static function getStats(int $userId): array
    {
        self::ensureTable();
        self::ensureHistoryTable();
        $pdo = Database::getConnection();

        $total = $pdo->prepare("SELECT COUNT(*) FROM review_history WHERE user_id = ?");
        $total->execute([$userId]);
        $totalReviews = (int) $total->fetchColumn();

        $correct = $pdo->prepare("SELECT COUNT(*) FROM review_history WHERE user_id = ? AND was_correct = 1");
        $correct->execute([$userId]);
        $correctCount = (int) $correct->fetchColumn();

        $distinctCards = $pdo->prepare("SELECT COUNT(DISTINCT card_id) FROM review_history WHERE user_id = ?");
        $distinctCards->execute([$userId]);
        $cardsReviewed = (int) $distinctCards->fetchColumn();

        $daily = $pdo->prepare("
            SELECT DATE(reviewed_at) as day, COUNT(*) as count
            FROM review_history
            WHERE user_id = ? AND reviewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(reviewed_at)
            ORDER BY day ASC
        ");
        $daily->execute([$userId]);
        $dailyStats = $daily->fetchAll();

        $upcoming = $pdo->prepare("SELECT COUNT(*) FROM user_card_progress WHERE user_id = ? AND next_review <= CURDATE()");
        $upcoming->execute([$userId]);
        $dueToday = (int) $upcoming->fetchColumn();

        $streak = self::getStreakDays($userId);

        $totalCards = $pdo->prepare("SELECT COUNT(*) FROM cards");
        $totalCards->execute();
        $totalCardCount = (int) $totalCards->fetchColumn();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM user_card_progress WHERE user_id = ? AND repetitions > 1");
        $stmt->execute([$userId]);
        $learnedCount = (int) $stmt->fetchColumn();

        $progress = $totalCardCount > 0 ? (int) round(($learnedCount / $totalCardCount) * 100) : 0;

        return [
            'total_reviews' => $totalReviews,
            'correct_count' => $correctCount,
            'incorrect_count' => $totalReviews - $correctCount,
            'cards_reviewed' => $cardsReviewed,
            'daily' => $dailyStats,
            'due_today' => $dueToday,
            'streak_days' => $streak,
            'learned_count' => $learnedCount,
            'total_cards' => $totalCardCount,
            'progress' => $progress,
        ];
    }
}
