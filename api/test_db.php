<?php

require_once __DIR__ . '/../src/session_init.php';
initSession();

$adminUser = $_SESSION['admin_user'] ?? null;
if (!$adminUser || empty($adminUser['is_admin'])) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

require_once __DIR__ . '/../src/Database.php';

try {
    $pdo = Database::getConnection();
    echo "Connected successfully!\n";
    echo "Server: " . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
} catch (PDOException $e) {
    error_log('Test DB connection failed: ' . $e->getMessage());
    echo "Connection failed.\n";
}
