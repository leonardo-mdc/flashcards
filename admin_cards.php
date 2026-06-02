<?php
/**
 * Admin Card Editor - Entry Point
 *
 * Handles authentication, AJAX API, and renders the admin interface.
 * All AJAX actions use the model classes in src/.
 */

session_start();

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';
require_once __DIR__ . '/src/CardSet.php';
require_once __DIR__ . '/src/Card.php';

$config = require __DIR__ . '/config.php';
$adminPassword = $config['admin']['password'];

// ── Authentication ──────────────────────────────────────────

$isLoggedIn = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

if (isset($_POST['login'])) {
    if (($_POST['password'] ?? '') === $adminPassword) {
        $_SESSION['admin_logged_in'] = true;
        $isLoggedIn = true;
    } else {
        $loginError = 'Incorrect password!';
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin_cards.php');
    exit;
}

// ── AJAX API ────────────────────────────────────────────────

$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH'])
    && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

if ($isAjax && isset($_GET['action'])) {
    header('Content-Type: application/json');

    try {
        $action = $_GET['action'];

        if ($action === 'get_cards') {
            $setId = isset($_GET['set_id']) ? (int) $_GET['set_id'] : 1;
            echo json_encode(['success' => true, 'cards' => Card::getBySet($setId)]);
        } elseif ($action === 'get_sets') {
            echo json_encode(['success' => true, 'sets' => CardSet::getAll()]);
        } elseif ($action === 'get_card') {
            $cardId = isset($_GET['card_id']) ? (int) $_GET['card_id'] : 0;
            $card = Card::getById($cardId);
            if ($card) {
                $card['content_data'] = json_decode($card['content_data'], true);
                echo json_encode(['success' => true, 'card' => $card]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Card not found']);
            }
        } elseif ($action === 'save_card') {
            $data = json_decode(file_get_contents('php://input'), true);
            $id = Card::save($data);
            echo json_encode(['success' => true, 'id' => $id]);
        } elseif ($action === 'delete_card') {
            $cardId = isset($_GET['card_id']) ? (int) $_GET['card_id'] : 0;
            Card::delete($cardId);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }

    exit;
}

// ── Login Screen ────────────────────────────────────────────

if (!$isLoggedIn) {
    require __DIR__ . '/src/templates/admin_login.php';
    exit;
}

// ── Editor Screen ───────────────────────────────────────────

$dbConnected = Database::testConnection();
$cardSets = $dbConnected ? CardSet::getAll() : [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>Admin - Card Editor | Flashcard Studio</title>
    <link href="https://fonts.cdnfonts.com/css/bubble-sans" rel="stylesheet">
    <link href="https://fonts.cdnfonts.com/css/stampatello-faceto" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="assets/css/admin.css">
</head>
<body>
<div class="admin-container">
    <div class="flex justify-between items-center mb-4">
        <a href="index.php" class="back-link">← Back to Flashcards</a>
        <a href="?logout=1" class="btn btn-logout">🚪 Logout</a>
    </div>

    <div class="whiteboard-card fixed-header">
        <div class="flex justify-between items-center flex-wrap gap-4">
            <h1 class="text-2xl marker-underline">✏️ Admin: Card Editor</h1>
            <div class="flex gap-3 flex-wrap">
                <select id="setSelector" class="form-select w-auto" style="width: 250px;">
                    <option value="">-- Choose Card Set --</option>
                    <?php foreach ($cardSets as $set): ?>
                        <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                    <?php endforeach; ?>
                </select>
                <div class="flex gap-2">
                    <button id="saveCardBtn" class="btn btn-success">💾 SAVE</button>
                    <button id="revertCardBtn" class="btn btn-warning">↺ REVERT</button>
                    <button id="newCardBtn" class="btn btn-primary">✨ NEW</button>
                    <button id="deleteCardBtn" class="btn btn-danger">🗑 DELETE</button>
                </div>
            </div>
        </div>
        <div class="flex gap-4 mt-4 flex-wrap items-center">
            <span class="font-bold">Filter by level:</span>
            <label class="flex items-center gap-1"><input type="checkbox" id="levelBeginner" value="Beginner"> Beginner</label>
            <label class="flex items-center gap-1"><input type="checkbox" id="levelIntermediate" value="Intermediate"> Intermediate</label>
            <label class="flex items-center gap-1"><input type="checkbox" id="levelAdvanced" value="Advanced"> Advanced</label>
            <button id="filterCardsBtn" class="btn btn-secondary">Apply Filter</button>
            <span class="text-xs text-gray-400 ml-auto line-break-hint">💡 Use \br to create line breaks in text</span>
        </div>
    </div>

    <div class="grid-2cols">
        <div class="whiteboard-card">
            <h2 class="text-xl marker-underline mb-3">📋 Cards in Set</h2>
            <div id="cardListContainer" class="card-list">
                <div class="text-center text-gray-500 py-8">Select a card set to load cards</div>
            </div>
        </div>

        <div>
            <div class="whiteboard-card mb-4">
                <h2 class="text-xl marker-underline mb-3">✏️ Edit Card</h2>
                <input type="hidden" id="editCardId" value="0">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold mb-1">Title / Word:</label>
                        <input type="text" id="editTitle" class="form-input" placeholder="Enter word or title">
                    </div>
                    <div>
                        <label class="block font-bold mb-1">Pattern Type:</label>
                        <select id="editPatternType" class="form-select">
                            <option value="usage_cases">📘 Pure Text - Usage Cases</option>
                            <option value="deep_dive">🧠 Pure Text - Deep Dive</option>
                            <option value="formula_table">📐 Pure Text - Formula Table</option>
                            <option value="multiple_choice">❓ Multiple Choice (Quiz)</option>
                            <option value="gap_fill">✏️ Gap Fill (Quiz)</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1">Level:</label>
                    <select id="editLevel" class="form-select">
                        <option value="Beginner">🔰 Beginner</option>
                        <option value="Intermediate">📚 Intermediate</option>
                        <option value="Advanced">🎓 Advanced</option>
                    </select>
                </div>
                <div id="editFieldsContainer">
                </div>
                <div class="help-text mt-2">
                    💡 Tip: Use <code>\br</code> in any text field to create a line break. Example: "First line\brSecond line"
                </div>
            </div>

            <div class="preview-grid">
                <div class="card-preview">
                    <div class="card-front-preview" style="position: relative; min-height: 350px;">
                        <span class="preview-label">📖 FRONT PREVIEW</span>
                        <div id="frontPreviewContent" class="flex items-center justify-center min-h-[280px]">
                            <div class="text-center text-gray-400">Edit card to see preview</div>
                        </div>
                    </div>
                </div>
                <div class="card-preview">
                    <div class="card-back-preview" style="position: relative; min-height: 350px;">
                        <span class="preview-label">🔍 BACK PREVIEW</span>
                        <div id="backPreviewContent" class="flex items-center justify-center min-h-[280px]">
                            <div class="text-center text-gray-400">Edit card to see preview</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="assets/js/admin.js"></script>
</body>
</html>
