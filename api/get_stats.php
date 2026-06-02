<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Review.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = 0;

    if ($input && isset($input['user_id'])) {
        $userId = (int) $input['user_id'];
    } elseif (isset($_GET['user_id'])) {
        $userId = (int) $_GET['user_id'];
    }

    if ($userId <= 0) {
        echo json_encode(['success' => false, 'error' => 'Missing user_id']);
        exit;
    }

    $stats = Review::getStats($userId);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
    ]);
}
