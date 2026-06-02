<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Review.php';
require_once __DIR__ . '/../src/User.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $cardId = isset($input['card_id']) ? (int) $input['card_id'] : 0;
    $userId = isset($input['user_id']) ? (int) $input['user_id'] : (isset($input['student_id']) ? (int) $input['student_id'] : 0);
    $quality = isset($input['quality']) ? (int) $input['quality'] : 0;
    $wasCorrect = isset($input['correct']) ? (bool) $input['correct'] : ($quality > 0);

    if ($cardId === 0 || $userId === 0) {
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
    $user = User::getById($userId);
    User::updateProgress($userId, $progressPercent, $user['english_level'] ?? 'Beginner');

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
