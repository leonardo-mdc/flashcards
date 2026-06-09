<?php

session_start();
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Card.php';

$adminUser = $_SESSION['admin_user'] ?? null;
$isAdmin = $adminUser !== null && ($adminUser['is_admin'] ?? false);
if (!$isAdmin) {
    header('Location: ../admin_cards.php?migrate=error');
    exit;
}

try {
    $fixed = Card::fixTruncatedPatternTypes();
    $count = count($fixed);
    $_SESSION['migrate_result'] = "Fixed {$count} card(s) with truncated pattern_type.";
    header('Location: ../admin_cards.php?migrate=done');
} catch (Exception $e) {
    $_SESSION['migrate_result'] = 'Error: ' . $e->getMessage();
    header('Location: ../admin_cards.php?migrate=error');
}
