<?php
require_once __DIR__ . '/src/Database.php';

header('Content-Type: text/html; charset=utf-8');

$action = $_GET['action'] ?? 'check';

try {
    $pdo = Database::getConnection();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "<h2>Connected to: <code>$dbName</code></h2>";

    if ($action === 'migrate') {
        echo "<hr><h3>Running schema migration...</h3><pre>";

        // 1. Fix cards.pattern_type ENUM (preserves data)
        $pdo->exec("ALTER TABLE cards MODIFY pattern_type ENUM('usage_cases','deep_dive','formula_table','multiple_choice','gap_fill') DEFAULT 'usage_cases'");
        echo "✓ cards.pattern_type ENUM updated\n";

        // 2. Drop old student_progress, new one gets auto-created by Review::ensureTable()
        $pdo->exec("DROP TABLE IF EXISTS student_progress");
        echo "✓ Dropped old student_progress table (will be recreated as user_card_progress)\n";

        // 3. Fix users table — since we clear users, drop and recreate
        $pdo->exec("DROP TABLE IF EXISTS review_history");
        $pdo->exec("DROP TABLE IF EXISTS student_set_access");
        $pdo->exec("DROP TABLE IF EXISTS user_card_progress");
        $pdo->exec("DROP TABLE IF EXISTS users");
        // Recreate with correct schema
        $pdo->exec("CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(30) NOT NULL UNIQUE,
            full_name VARCHAR(100) NOT NULL DEFAULT '',
            password_hash VARCHAR(255) NOT NULL,
            is_admin TINYINT(1) DEFAULT 0,
            progress INT DEFAULT 0,
            english_level VARCHAR(50) DEFAULT 'Beginner',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");
        echo "✓ users table recreated with correct columns\n";

        echo "</pre><p style='color:green;font-weight:bold;'>Migration complete!</p>";
        echo "<p>Visit <a href='admin_cards.php'>admin_cards.php</a> to create the first admin user.</p>";
        echo "<p><a href='fix_db.php'>← Back to schema check</a></p>";
        exit;
    }

    // Schema check
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

    if (empty($tables)) {
        echo "<p><strong>No tables found.</strong> Visit <a href='api/setup.php'>api/setup.php</a> to create them.</p>";
        exit;
    }

    echo "<hr><h3>Table Schemas</h3>";
    $hasIssues = false;
    foreach ($tables as $table) {
        $expected = getExpectedColumns($table);
        echo "<h4>$table</h4><table border='1' cellpadding='4' cellspacing='0' style='border-collapse:collapse;margin-bottom:12px;'>";
        echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";
        $cols = $pdo->query("SHOW FULL COLUMNS FROM `$table`")->fetchAll();
        foreach ($cols as $col) {
            $isMissing = $expected && !in_array($col['Field'], $expected);
            $isExtra = $expected && !in_array($col['Field'], $expected) ? true : ($expected === null ? false : false);
            $style = '';
            if ($expected !== null) {
                if (!in_array($col['Field'], $expected)) {
                    $style = ' style="background:#ffd700;"'; // extra column (yellow)
                    $hasIssues = true;
                }
            }
            echo "<tr$style><td>{$col['Field']}</td><td>{$col['Type']}</td><td>{$col['Null']}</td><td>{$col['Key']}</td><td>{$col['Default']}</td><td>{$col['Extra']}</td></tr>";
        }
        // Check for missing columns
        if ($expected !== null) {
            $fieldNames = array_column($cols, 'Field');
            foreach ($expected as $expCol) {
                if (!in_array($expCol, $fieldNames)) {
                    echo "<tr style='background:#ff6b6b;'><td><strong>$expCol</strong></td><td colspan='5' style='color:#fff;'>MISSING</td></tr>";
                    $hasIssues = true;
                }
            }
        }
        echo "</table>";
    }

    if ($hasIssues) {
        echo "<hr><p style='color:#d00;font-weight:bold;'>⚠ Schema issues detected — columns in <span style='background:#ffd700;'>yellow</span> are unexpected, <span style='background:#ff6b6b;color:#fff;'>red</span> are missing.</p>";
        echo "<p><a href='?action=migrate' onclick='return confirm(\"This will reset ALL users and progress but KEEP card data. Continue?\")' style='background:#d00;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;'>🔄 Run Schema Migration</a></p>";
    } else {
        echo "<p style='color:green;font-weight:bold;'>✓ All tables have the correct columns.</p>";
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
