<?php

require_once __DIR__ . '/../src/Database.php';

try {
    $pdo = Database::getConnection();
    echo "Connected successfully!\n";
    echo "Server: " . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
