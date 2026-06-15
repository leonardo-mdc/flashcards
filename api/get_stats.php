<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Review.php';
require_once __DIR__ . '/../src/helpers.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = 0;

    if ($input && isset($input['user_id'])) {
        $userId = (int) $input['user_id'];
    }

    $currentUser = $_SESSION['admin_user'] ?? null;
    $isAdmin = $currentUser !== null && ($currentUser['is_admin'] ?? false);

    if (!$isAdmin && !requireSessionStudent($userId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        exit;
    }

    if ($isAdmin && $userId === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'user_id required for admin']);
        exit;
    }

    $stats = Review::getStats($userId);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
    ]);
} catch (PDOException $e) {
    error_log('Get stats error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'A database error occurred.',
    ]);
}
