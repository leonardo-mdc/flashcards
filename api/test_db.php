<?php
/**
 * Database Diagnostic Tool
 */
require_once __DIR__ . '/../src/Database.php';

echo "<!DOCTYPE html>
<html>
<head>
    <title>Database Test</title>
    <style>
        body { font-family: monospace; background: #f1f5f9; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 16px; padding: 24px; }
        .success { color: #16a34a; background: #dcfce7; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #16a34a; }
        .error { color: #dc2626; background: #fee2e2; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #dc2626; }
        .info { color: #2563eb; background: #dbeafe; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #2563eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background: #f1f5f9; }
    </style>
</head>
<body>
<div class='container'>
    <h1>🔍 Database Diagnostic Tool</h1>
    <hr>
";

try {
    $pdo = Database::getConnection();
    echo "<div class='success'>✅ Connected to database</div>";

    $stmt = $pdo->query("SELECT COUNT(*) FROM card_sets");
    $setCount = $stmt->fetchColumn();
    echo "<div class='info'>📚 Card Sets in database: $setCount</div>";

    if ($setCount > 0) {
        $stmt = $pdo->query("SELECT id, name FROM card_sets ORDER BY id LIMIT 20");
        $sets = $stmt->fetchAll();
        echo "<table><tr><th>ID</th><th>Name</th></tr>";
        foreach ($sets as $set) {
            echo "<tr><td>{$set['id']}</td><td>{$set['name']}</td></tr>";
        }
        echo "</table>";
    } else {
        echo "<div class='error'>⚠️ No card sets found! You need to import card_sets.csv</div>";
    }

    $stmt = $pdo->query("SELECT COUNT(*) FROM cards");
    $cardCount = $stmt->fetchColumn();
    echo "<div class='info'>🃏 Cards in database: $cardCount</div>";

    if ($cardCount > 0) {
        $stmt = $pdo->query("SELECT id, set_id, title, level, pattern_type FROM cards LIMIT 20");
        $cards = $stmt->fetchAll();
        echo "<table><tr><th>ID</th><th>Set ID</th><th>Title</th><th>Level</th><th>Pattern</th></tr>";
        foreach ($cards as $card) {
            echo "<tr><td>{$card['id']}</td><td>{$card['set_id']}</td><td>{$card['title']}</td><td>{$card['level']}</td><td>{$card['pattern_type']}</td></tr>";
        }
        echo "</table>";

        $sample = $pdo->query("SELECT content_data FROM cards LIMIT 1")->fetch();
        echo "<div class='info'>📝 Sample card content_data: " . htmlspecialchars(substr($sample['content_data'], 0, 200)) . "...</div>";
    } else {
        echo "<div class='error'>⚠️ No cards found! You need to import cards.csv</div>";
    }

    echo "<hr><h3>🧪 Testing get_cards.php query:</h3>";

    $testSetId = 1;
    $testLevels = ['Beginner', 'Intermediate', 'Advanced'];
    $placeholders = implode(',', array_fill(0, count($testLevels), '?'));

    $testSql = "
        SELECT c.id, c.set_id, c.title, c.pattern_type, c.level, c.question_text, c.content_data
        FROM cards c
        WHERE c.set_id = ?
        AND c.level IN ($placeholders)
        LIMIT 10
    ";

    $params = array_merge([$testSetId], $testLevels);
    $stmt = $pdo->prepare($testSql);
    $stmt->execute($params);
    $testResults = $stmt->fetchAll();

    echo "<div class='info'>Query for set_id=$testSetId with levels: " . implode(', ', $testLevels) . "</div>";
    echo "<div class='info'>Found: " . count($testResults) . " cards</div>";

    if (count($testResults) > 0) {
        echo "<table><tr><th>ID</th><th>Title</th><th>Level</th></tr>";
        foreach ($testResults as $row) {
            echo "<tr><td>{$row['id']}</td><td>{$row['title']}</td><td>{$row['level']}</td></tr>";
        }
        echo "</table>";
    }
} catch (PDOException $e) {
    echo "<div class='error'>❌ Database Error: " . $e->getMessage() . "</div>";
}

echo "</div></body></html>";
