<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/CardSet.php';
require_once __DIR__ . '/../src/Review.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/helpers.php';

try {
    $sessionUser = sessionStudentUser();
    $sets = [];

    if ($sessionUser) {
        if (isAdminUser($sessionUser)) {
            $sets = CardSet::getWithCards();
        } else {
            $sets = CardSet::getWithCards();
            $accessible = Review::getAccessibleSets((int) $sessionUser['id'], $sessionUser['username'] ?? '');
            if (!empty($accessible)) {
                $sets = array_values(array_filter($sets, fn($s) => in_array((int) $s['id'], $accessible)));
            } else {
                $sets = [];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'sets' => $sets,
        'count' => count($sets),
    ]);
} catch (PDOException $e) {
    error_log('Get sets error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'A database error occurred.',
    ]);
}
