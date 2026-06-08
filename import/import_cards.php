<?php
/**
 * CSV Importer for Flashcard System
 * - Reads card_sets.csv and cards.csv
 * - Inserts records into database using src/ classes
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Card.php';
require_once __DIR__ . '/../src/CardSet.php';

$setsFile = __DIR__ . '/card_sets.csv';
$cardsFile = __DIR__ . '/cards.csv';

echo '<!DOCTYPE html>
<html>
<head>
    <title>CSV Importer</title>
    <style>
        body { font-family: monospace; background: #f1f5f9; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 16px; padding: 24px; }
        .success { color: #16a34a; background: #dcfce7; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #16a34a; }
        .error { color: #dc2626; background: #fee2e2; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #dc2626; }
        .info { color: #2563eb; background: #dbeafe; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #2563eb; }
        .warning { color: #d97706; background: #fef3c7; padding: 8px 12px; margin: 4px 0; border-left: 4px solid #d97706; }
        h1 { color: #1e293b; }
        hr { margin: 20px 0; }
    </style>
</head>
<body>
<div class="container">
    <h1>📥 CSV Importer for Flashcard System</h1>
    <hr>
';

function display($msg, $type = 'info') {
    echo "<div class='$type'>$msg</div>";
    flush();
}

try {
    $pdo = Database::getConnection();
    display("✅ Connected to database", 'success');
} catch (PDOException $e) {
    display("❌ Connection failed: " . $e->getMessage(), 'error');
    exit;
}

// ============ IMPORT CARD SETS ============
display("📚 Importing card sets from: card_sets.csv", 'info');

if (!file_exists($setsFile)) {
    display("❌ File not found: card_sets.csv", 'error');
} else {
    $handle = fopen($setsFile, 'r');
    if ($handle === false) {
        display("❌ Could not open file: card_sets.csv", 'error');
    } else {
        $header = fgetcsv($handle, 0, ',', '"', '\\');
        display("Header columns: " . implode(', ', $header), 'info');

        $inserted = 0;
        $skipped = 0;

        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            if (count($row) < 3) continue;

            $id = $row[0];
            $name = $row[1];
            $description = $row[2] ?? '';

            $stmt = $pdo->prepare("SELECT id FROM card_sets WHERE id = ? OR name = ?");
            $stmt->execute([$id, $name]);
            if ($stmt->fetch()) {
                display("⏭️ Skipped (exists): ID $id - $name", 'warning');
                $skipped++;
                continue;
            }

            try {
                $stmt = $pdo->prepare("INSERT INTO card_sets (id, name, description) VALUES (?, ?, ?)");
                $stmt->execute([$id, $name, $description]);
                display("✅ Inserted: ID $id - $name", 'success');
                $inserted++;
            } catch (PDOException $e) {
                display("❌ Error: " . $e->getMessage(), 'error');
            }
        }
        fclose($handle);
        display("📊 Card sets: $inserted inserted, $skipped skipped", 'info');
    }
}

// ============ IMPORT CARDS ============
display("<hr>📇 Importing cards from: cards.csv", 'info');

if (!file_exists($cardsFile)) {
    display("❌ File not found: cards.csv", 'error');
} else {
    $handle = fopen($cardsFile, 'r');
    if ($handle === false) {
        display("❌ Could not open file: cards.csv", 'error');
    } else {
        $header = fgetcsv($handle, 0, ',', '"', '\\');
        display("Header columns: " . implode(', ', $header), 'info');

        $inserted = 0;
        $skipped = 0;
        $errors = 0;
        $lineNum = 1;

        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            $lineNum++;
            if (count($row) < 6) {
                display("⚠️ Line $lineNum: Skipped (only " . count($row) . " columns)", 'warning');
                $skipped++;
                continue;
            }

            $set_id = $row[0];
            $title = $row[1];
            $pattern_type = $row[2];
            $level = $row[3];
            $question_text = $row[4];
            $content_data = $row[5];

            if (!json_decode($content_data)) {
                $content_data = str_replace("'", '"', $content_data);
                if (!json_decode($content_data)) {
                    display("⚠️ Line $lineNum: Invalid JSON for '{$title}'", 'warning');
                    $errors++;
                    continue;
                }
            }

            $stmt = $pdo->prepare("SELECT id FROM cards WHERE set_id = ? AND title = ?");
            $stmt->execute([$set_id, $title]);
            if ($stmt->fetch()) {
                $skipped++;
                continue;
            }

            try {
                $decoded = json_decode($content_data, true) ?: [];
                Card::save([
                    'set_id' => (int) $set_id,
                    'title' => $title,
                    'pattern_type' => $pattern_type,
                    'level' => $level,
                    'question_text' => $question_text,
                    'content_data' => $decoded,
                ]);
                $inserted++;
                if ($inserted % 100 == 0) {
                    display("📈 Progress: $inserted cards inserted...", 'info');
                }
            } catch (Exception $e) {
                display("❌ Error on line $lineNum: " . $e->getMessage(), 'error');
                $errors++;
            }
        }
        fclose($handle);
        display("<hr>📊 Final results: $inserted inserted, $skipped skipped, $errors errors", 'info');
    }
}

// ============ VERIFICATION ============
display("<hr>🔍 Verification", 'info');
$setCount = $pdo->query("SELECT COUNT(*) FROM card_sets")->fetchColumn();
$cardCount = $pdo->query("SELECT COUNT(*) FROM cards")->fetchColumn();
display("📊 Database now has: $setCount card sets and $cardCount cards", 'success');

echo '</div></body></html>';
