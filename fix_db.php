<?php
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/Review.php';

header('Content-Type: text/html; charset=utf-8');

$action = $_GET['action'] ?? 'check';

try {
    $pdo = Database::getConnection();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "<h2>Connected to: <code>$dbName</code></h2>";

    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

    if (empty($tables)) {
        echo "<p><strong>No tables found.</strong> Visit <a href='api/setup.php'>api/setup.php</a> to create them.</p>";
        exit;
    }

    echo "<hr><h3>Table Schemas</h3>";
    foreach ($tables as $table) {
        echo "<h4>$table</h4><table border='1' cellpadding='4' cellspacing='0' style='border-collapse:collapse;margin-bottom:12px;'>";
        echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";
        $cols = $pdo->query("SHOW FULL COLUMNS FROM `$table`")->fetchAll();
        $expected = getExpectedColumns($table);
        foreach ($cols as $col) {
            $missing = $expected && !in_array($col['Field'], $expected) ? ' style="background:#ffd700;"' : '';
            echo "<tr$missing><td>{$col['Field']}</td><td>{$col['Type']}</td><td>{$col['Null']}</td><td>{$col['Key']}</td><td>{$col['Default']}</td><td>{$col['Extra']}</td></tr>";
        }
        echo "</table>";
    }

    if ($action === 'reset') {
        echo "<hr><h3>Resetting users...</h3>";
        $pdo->exec("DELETE FROM review_history");
        $pdo->exec("DELETE FROM user_card_progress");
        $pdo->exec("DELETE FROM student_set_access");
        $pdo->exec("DELETE FROM users");
        echo "<p style='color:green;font-weight:bold;'>All users and their progress cleared.</p>";
        echo "<p>Visit <a href='admin_cards.php'>admin_cards.php</a> to create the first admin user.</p>";
    } elseif ($action === 'check') {
        echo "<hr><p><a href='?action=reset' onclick='return confirm(\"Clear all users and progress?\")' style='background:#d00;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;'>🗑 Reset Users & Progress</a></p>";
    }

} catch (Exception $e) {
    echo "<p style='color:red;'>Error: {$e->getMessage()}</p>";
}

function getExpectedColumns(string $table): ?array {
    $schemas = [
        'users' => ['id', 'username', 'full_name', 'password_hash', 'is_admin', 'progress', 'english_level', 'created_at'],
        'card_sets' => ['id', 'name', 'description'],
        'cards' => ['id', 'set_id', 'title', 'pattern_type', 'level', 'question_text', 'content_data'],
        'user_card_progress' => ['id', 'user_id', 'card_id', 'ease_factor', 'interval_days', 'repetitions', 'next_review', 'last_review', 'correct_streak', 'was_correct', 'total_reviews'],
        'review_history' => ['id', 'user_id', 'card_id', 'quality', 'was_correct', 'reviewed_at'],
        'student_set_access' => ['user_id', 'set_id'],
    ];
    return $schemas[$table] ?? null;
}
