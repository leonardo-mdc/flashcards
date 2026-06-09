<?php

session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Review.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/helpers.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $cardId = isset($input['card_id']) ? (int) $input['card_id'] : 0;
    $userId = isset($input['user_id']) ? (int) $input['user_id'] : (isset($input['student_id']) ? (int) $input['student_id'] : 0);
    $quality = isset($input['quality']) ? (int) $input['quality'] : 0;
    $wasCorrect = isset($input['correct']) ? (bool) $input['correct'] : ($quality > 0);

    if (!requireSessionStudent($userId)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Forbidden',
        ]);
        exit;
    }

    if ($cardId === 0 || $userId === 0 || $quality < 0 || $quality > 3) {
        echo json_encode([
            'success' => false,
            'error' => 'Missing card_id or user_id',
        ]);
        exit;
    }

    Review::record($cardId, $userId, $quality, $wasCorrect);

    $stats = Review::getStats($userId);
    $totalCards = 0;
    $pdo = Database::getConnection();
    $stmt = $pdo->query("SELECT COUNT(*) FROM cards");
    $totalCards = (int) $stmt->fetchColumn();
    $progressPercent = $totalCards > 0 ? min(100, (int) round(($stats['cards_reviewed'] / $totalCards) * 100)) : 0;
    User::updateProgress($userId, $progressPercent);

    $daysToAdd = match ($quality) {
        0 => 1,
        2 => 3,
        3 => 7,
        default => 1,
    };
    $nextReview = date('Y-m-d', strtotime("+$daysToAdd days"));

    echo json_encode([
        'success' => true,
        'message' => 'Review recorded',
        'next_review' => $nextReview,
        'days_added' => $daysToAdd,
        'quality' => $quality,
        'progress' => $progressPercent,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
    ]);
}
