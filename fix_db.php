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

        // 2. Fix cards where pattern_type was corrupted by previous ENUM change (vocabulary/text → '')
        $pdo->exec("UPDATE cards SET pattern_type = 'usage_cases' WHERE pattern_type = '' OR pattern_type IS NULL");
        echo "✓ Cards with empty pattern_type set to 'usage_cases'\n";

        // 3. Drop old student_progress, new one gets auto-created by Review::ensureTable()
        $pdo->exec("DROP TABLE IF EXISTS student_progress");
        echo "✓ Dropped old student_progress table (will be recreated as user_card_progress)\n";

        // 4. Fix users table — since we clear users, drop and recreate
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

        // 5. Create admin user
        $adminUser = trim($_GET['admin_user'] ?? '');
        $adminPass = $_GET['admin_pass'] ?? '';
        if ($adminUser === '' || strlen($adminPass) < 6) {
            echo "</pre><p style='color:orange;font-weight:bold;'>⚠ Migration ran, but no admin was created.</p>";
            echo "<p>Use the form below to create the admin user:</p>";
            echo "<form method='get' style='margin-top:12px;'>";
            echo "<input type='hidden' name='action' value='create_admin'>";
            echo "<input type='text' name='admin_user' placeholder='Username' required style='padding:6px;margin-right:4px;'>";
            echo "<input type='password' name='admin_pass' placeholder='Password (min 6)' required style='padding:6px;margin-right:4px;'>";
            echo "<button type='submit' style='background:#15803d;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;'>➕ Create Admin</button>";
            echo "</form>";
        } else {
            $hash = password_hash($adminPass, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)");
            $stmt->execute([$adminUser, $hash]);
            echo "✓ Admin user '<strong>" . htmlspecialchars($adminUser) . "</strong>' created\n";
            echo "</pre><p style='color:green;font-weight:bold;'>Migration complete! Admin user created.</p>";
            echo "<p><a href='admin_cards.php' style='background:#1d4ed8;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;'>→ Go to Admin Panel</a></p>";
        }
        echo "<p><a href='fix_db.php'>← Back to schema check</a></p>";
        exit;
    }

    if ($action === 'create_admin') {
        require_once __DIR__ . '/src/User.php';
        echo "<hr><h3>Creating admin user...</h3><pre>";
        $adminUser = trim($_GET['admin_user'] ?? '');
        $adminPass = $_GET['admin_pass'] ?? '';
        if ($adminUser === '' || strlen($adminPass) < 6) {
            echo "ERROR: Username required and password min 6 characters.</pre>";
            echo "<p><a href='fix_db.php'>← Back</a></p>";
            exit;
        }
        $user = User::create($adminUser, $adminPass, true);
        echo "✓ Admin user '<strong>" . htmlspecialchars($user['username']) . "</strong>' created (ID: {$user['id']})\n";
        echo "</pre><p><a href='admin_cards.php' style='background:#1d4ed8;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;'>→ Go to Admin Panel</a></p>";
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
        echo "<form method='get' style='margin:12px 0;padding:12px;border:2px solid #d00;border-radius:8px;background:#fff5f5;'>";
        echo "<p style='margin:0 0 8px;font-weight:bold;'>🔄 Migrate schema & create admin user:</p>";
        echo "<input type='hidden' name='action' value='migrate'>";
        echo "<input type='text' name='admin_user' placeholder='Admin username' required style='padding:6px;margin-right:4px;border:1px solid #ccc;border-radius:4px;'>";
        echo "<input type='password' name='admin_pass' placeholder='Password (min 6)' required style='padding:6px;margin-right:4px;border:1px solid #ccc;border-radius:4px;'>";
        echo "<button type='submit' onclick='return confirm(\"This will reset ALL users and progress but KEEP card data. Continue?\")' style='background:#d00;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;'>🔄 Migrate + Create Admin</button>";
        echo "</form>";
    } else {
        echo "<p style='color:green;font-weight:bold;'>✓ All tables have the correct columns.</p>";
        echo "<hr><h3>Create Admin User</h3>";
        echo "<form method='get' style='margin:12px 0;padding:12px;border:2px solid #15803d;border-radius:8px;background:#f0fdf4;'>";
        echo "<input type='hidden' name='action' value='create_admin'>";
        echo "<input type='text' name='admin_user' placeholder='Username' required style='padding:6px;margin-right:4px;border:1px solid #ccc;border-radius:4px;'>";
        echo "<input type='password' name='admin_pass' placeholder='Password (min 6)' required style='padding:6px;margin-right:4px;border:1px solid #ccc;border-radius:4px;'>";
        echo "<button type='submit' style='background:#15803d;color:#fff;padding:6px 16px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;'>➕ Create Admin</button>";
        echo "</form>";
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
