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
            repetitions INT DEFAULT 0,
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
            $pdo->exec("ALTER TABLE user_card_progress ADD COLUMN repetitions INT DEFAULT 0 AFTER total_reviews");
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

    public static function record(int $cardId, int $userId, int $quality, bool $wasCorrect): void
    {
        self::ensureTable();
        self::ensureHistoryTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, ease_factor, interval_days, repetitions, correct_streak FROM user_card_progress WHERE user_id = ? AND card_id = ?");
        $stmt->execute([$userId, $cardId]);
        $progress = $stmt->fetch();

        $ef = $progress ? (float) $progress['ease_factor'] : 2.5;
        $interval = $progress ? (int) $progress['interval_days'] : 0;
        $reps = $progress ? (int) $progress['repetitions'] : 0;
        $streak = $progress ? (int) $progress['correct_streak'] : 0;

        $sm2Quality = match ($quality) {
            0 => 1,
            2 => 3,
            3 => 5,
            default => 3,
        };

        $newEF = max(1.3, $ef + (0.1 - (5 - $sm2Quality) * (0.08 + (5 - $sm2Quality) * 0.02)));

        [$newReps, $newInterval] = self::calculateSM2($sm2Quality, $reps, $interval, $newEF);

        if ($sm2Quality === 5) {
            $newInterval = (int) round($newInterval * 1.3);
        }

        if ($sm2Quality >= 3) {
            $streak++;
        } else {
            $streak = 0;
        }

        $nextReview = date('Y-m-d', strtotime("+$newInterval days"));
        $today = date('Y-m-d');

        if ($progress) {
            $stmt = $pdo->prepare("
                UPDATE user_card_progress
                SET next_review = ?, last_review = ?, was_correct = ?,
                    ease_factor = ?, interval_days = ?, repetitions = ?,
                    correct_streak = ?, total_reviews = total_reviews + 1
                WHERE user_id = ? AND card_id = ?
            ");
            $stmt->execute([$nextReview, $today, $wasCorrect ? 1 : 0, $newEF, $newInterval, $newReps, $streak, $userId, $cardId]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO user_card_progress (user_id, card_id, next_review, last_review, was_correct, ease_factor, interval_days, repetitions, correct_streak, total_reviews)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([$userId, $cardId, $nextReview, $today, $wasCorrect ? 1 : 0, $newEF, $newInterval, $newReps, $streak]);
        }

        $stmt = $pdo->prepare("INSERT INTO review_history (user_id, card_id, quality, was_correct) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $cardId, $quality, $wasCorrect ? 1 : 0]);
    }

    private static function calculateSM2(int $quality, int $repetitions, int $interval, float $easeFactor): array
    {
        if ($quality < 3) {
            return [0, 1];
        }

        if ($repetitions === 0) {
            return [1, 1];
        }

        if ($repetitions === 1) {
            return [2, 6];
        }

        $newInterval = (int) round($interval * $easeFactor);
        return [$repetitions + 1, $newInterval];
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

    public static function getAccessibleSets(int $userId, string $username = ''): array
    {
        self::ensureSetAccessTable();
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT set_id FROM student_set_access WHERE user_id = ?");
        $stmt->execute([$userId]);
        $allowed = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        $allowed = array_map('intval', $allowed);

        if ($username === '') {
            return $allowed;
        }

        if (empty($allowed)) {
            $stmt = $pdo->query("SELECT id FROM card_sets");
            $all = $stmt->fetchAll(\PDO::FETCH_COLUMN);
            $allowed = array_map('intval', $all);
        }

        $stmt = $pdo->query("SELECT id, exclusive_to FROM card_sets WHERE exclusive_to IS NOT NULL AND exclusive_to != ''");
        $exclusiveSets = $stmt->fetchAll();
        foreach ($exclusiveSets as $set) {
            $setId = (int) $set['id'];
            $usernames = array_map('trim', explode(',', $set['exclusive_to']));
            if (in_array($username, $usernames)) {
                if (!in_array($setId, $allowed)) {
                    $allowed[] = $setId;
                }
            } else {
                $key = array_search($setId, $allowed);
                if ($key !== false) {
                    unset($allowed[$key]);
                }
            }
        }
        $allowed = array_values($allowed);

        return $allowed;
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

        return [
            'total_reviews' => $totalReviews,
            'correct_count' => $correctCount,
            'incorrect_count' => $totalReviews - $correctCount,
            'cards_reviewed' => $cardsReviewed,
            'daily' => $dailyStats,
            'due_today' => $dueToday,
            'streak_days' => $streak,
        ];
    }
}
