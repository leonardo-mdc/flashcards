<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

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

    $stmt = $pdo->prepare("SELECT next_review, ease_factor, interval_days, repetitions FROM user_card_progress WHERE user_id = ? AND card_id = ?");
    $stmt->execute([$userId, $cardId]);
    $progress = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => 'Review recorded',
        'next_review' => $progress ? $progress['next_review'] : date('Y-m-d'),
        'ease_factor' => $progress ? (float) $progress['ease_factor'] : 2.5,
        'interval_days' => $progress ? (int) $progress['interval_days'] : 1,
        'repetitions' => $progress ? (int) $progress['repetitions'] : 0,
        'quality' => $quality,
        'progress' => $progressPercent,
    ]);
} catch (PDOException $e) {
    error_log('Record review error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'A database error occurred.',
    ]);
}
