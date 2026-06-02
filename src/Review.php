<?php
/**
 * Review model — spaced-repetition progress tracking.
 */
class Review
{
    public static function record(int $cardId, int $studentId, int $quality, bool $wasCorrect): void
    {
        $pdo = Database::getConnection();

        $daysToAdd = match ($quality) {
            0 => 1,
            2 => 3,
            3 => 7,
            default => 1,
        };

        $nextReview = date('Y-m-d', strtotime("+$daysToAdd days"));
        $today = date('Y-m-d');

        $stmt = $pdo->prepare("SELECT id FROM student_card_progress WHERE student_id = ? AND card_id = ?");
        $stmt->execute([$studentId, $cardId]);
        $exists = $stmt->fetch();

        if ($exists) {
            $stmt = $pdo->prepare("
                UPDATE student_card_progress
                SET next_review = ?, last_review = ?, was_correct = ?, total_reviews = total_reviews + 1
                WHERE student_id = ? AND card_id = ?
            ");
            $stmt->execute([$nextReview, $today, $wasCorrect ? 1 : 0, $studentId, $cardId]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO student_card_progress (student_id, card_id, next_review, last_review, was_correct, total_reviews)
                VALUES (?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([$studentId, $cardId, $nextReview, $today, $wasCorrect ? 1 : 0]);
        }
    }
}
