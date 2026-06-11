<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Card.php';
require_once __DIR__ . '/../src/helpers.php';

$adminUser = $_SESSION['admin_user'] ?? null;
$isAdmin = $adminUser !== null && ($adminUser['is_admin'] ?? false);
if (!$isAdmin) {
    header('Location: ../admin_cards.php?migrate=error');
    exit;
}

if (!verifyCsrfToken($_POST['csrf_token'] ?? null)) {
    $_SESSION['migrate_result'] = 'Invalid security token.';
    header('Location: ../admin_cards.php?migrate=error');
    exit;
}

try {
    $fixed = Card::fixTruncatedPatternTypes();
    $count = count($fixed);
    $_SESSION['migrate_result'] = "Fixed {$count} card(s) with truncated pattern_type.";
    header('Location: ../admin_cards.php?migrate=done');
} catch (Exception $e) {
    $_SESSION['migrate_result'] = 'An error occurred during migration.';
    header('Location: ../admin_cards.php?migrate=error');
}
