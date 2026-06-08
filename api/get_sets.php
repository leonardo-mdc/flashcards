<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/CardSet.php';
require_once __DIR__ . '/../src/Review.php';

try {
    $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
    $username = isset($_GET['username']) ? trim($_GET['username']) : '';

    $sets = CardSet::getWithCards($username);

    if ($userId > 0) {
        $accessible = Review::getAccessibleSets($userId, $username);
        if (!empty($accessible)) {
            $sets = array_values(array_filter($sets, fn($s) => in_array((int) $s['id'], $accessible)));
        }
    }

    echo json_encode([
        'success' => true,
        'sets' => $sets,
        'count' => count($sets),
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
    ]);
}
