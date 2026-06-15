<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

header('Content-Type: application/json');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Review.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/helpers.php';

$currentUser = $_SESSION['admin_user'] ?? null;
$isAdmin = $currentUser !== null && ($currentUser['is_admin'] ?? false);
if (!$isAdmin || !verifyCsrfToken($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

try {
    $pdo = Database::getConnection();
    Review::ensureTable();
    Review::ensureHistoryTable();
    User::ensureTable();

    $students = User::getAll();

    $studentStats = [];
    $totalReviewsAll = 0;
    $totalReviewsToday = 0;
    $totalReviewsWeek = 0;

    foreach ($students as $s) {
        if ($s['is_admin']) continue;
        $stats = Review::getStats((int) $s['id']);

        $daily = $stats['daily'];
        $today = date('Y-m-d');
        $weekAgo = date('Y-m-d', strtotime('-7 days'));
        $reviewsToday = 0;
        $reviewsWeek = 0;
        foreach ($daily as $d) {
            if ($d['day'] === $today) $reviewsToday = (int) $d['count'];
            if ($d['day'] >= $weekAgo) $reviewsWeek += (int) $d['count'];
        }
        $totalReviewsAll += $stats['total_reviews'];
        $totalReviewsToday += $reviewsToday;
        $totalReviewsWeek += $reviewsWeek;

        $studentStats[] = [
            'id' => (int) $s['id'],
            'username' => $s['username'],
            'full_name' => $s['full_name'] ?? '',
            'level' => $s['english_level'] ?? 'Beginner',
            'progress' => (int) ($s['progress'] ?? 0),
            'total_reviews' => $stats['total_reviews'],
            'correct_count' => $stats['correct_count'],
            'incorrect_count' => $stats['incorrect_count'],
            'cards_reviewed' => $stats['cards_reviewed'],
            'due_today' => $stats['due_today'],
            'streak_days' => $stats['streak_days'],
            'daily' => $stats['daily'],
        ];
    }

    // Count total cards
    $totalCards = (int) $pdo->query("SELECT COUNT(*) FROM cards")->fetchColumn();

    echo json_encode([
        'success' => true,
        'overview' => [
            'total_students' => count($studentStats),
            'total_cards' => $totalCards,
            'total_reviews' => $totalReviewsAll,
            'reviews_today' => $totalReviewsToday,
            'reviews_this_week' => $totalReviewsWeek,
        ],
        'students' => $studentStats,
    ]);
} catch (\Throwable $e) {
    error_log('Admin stats error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'An error occurred.',
    ]);
}
