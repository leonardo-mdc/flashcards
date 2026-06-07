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
    $user = User::getById($userId);
    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }
    User::updateProgress($userId, $stats['progress'], $user['english_level']);

    echo json_encode([
        'success' => true,
        'message' => 'Review recorded',
        'quality' => $quality,
        'progress' => $stats['progress'],
        'english_level' => $user['english_level'],
        'streak_days' => $stats['streak_days'],
        'learned_count' => $stats['learned_count'],
        'total_cards' => $stats['total_cards'],
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
    ]);
}
