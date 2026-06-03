<?php

session_start();

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';
require_once __DIR__ . '/src/User.php';
require_once __DIR__ . '/src/CardSet.php';
require_once __DIR__ . '/src/Card.php';
require_once __DIR__ . '/src/Review.php';

$currentUser = isset($_SESSION['admin_user']) ? $_SESSION['admin_user'] : null;
$isLoggedIn = $currentUser !== null && ($currentUser['is_admin'] ?? false);
$needsSetup = !User::hasAdmins();

if (isset($_POST['setup'])) {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if ($username !== '' && strlen($password) >= 6) {
        User::create($username, $password, true);
        $user = User::authenticate($username, $password);
        if ($user) {
            $_SESSION['admin_user'] = $user;
            $currentUser = $user;
            $isLoggedIn = true;
        }
    } else {
        $setupError = 'Please fill in all fields (password min 6 chars).';
    }
}

if (isset($_POST['login'])) {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $user = User::authenticate($username, $password);
    if ($user && $user['is_admin']) {
        $_SESSION['admin_user'] = $user;
        $currentUser = $user;
        $isLoggedIn = true;
    } else {
        $loginError = 'Invalid credentials or insufficient permissions.';
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin_cards.php');
    exit;
}

$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH'])
    && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

if ($isAjax && isset($_GET['action'])) {
    header('Content-Type: application/json');
    if (!$isLoggedIn) {
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }

    try {
        $action = $_GET['action'];

        if ($action === 'preview_csv') {
            if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'error' => 'CSV file required']);
                exit;
            }
            $handle = fopen($_FILES['csv']['tmp_name'], 'r');
            if (!$handle) {
                echo json_encode(['success' => false, 'error' => 'Cannot read file']);
                exit;
            }
            $header = fgetcsv($handle);
            if (!$header) {
                fclose($handle);
                echo json_encode(['success' => false, 'error' => 'Empty CSV']);
                exit;
            }
            $header = array_map('trim', $header);
            // Strip BOM from first column
            if (isset($header[0])) {
                $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
            }
            $rows = [];
            $maxRows = 100;
            while (($row = fgetcsv($handle)) !== false && count($rows) < $maxRows) {
                $row = array_slice(array_map('trim', $row), 0, count($header));
                $rows[] = array_combine($header, array_pad($row, count($header), ''));
            }
            fclose($handle);
            echo json_encode(['success' => true, 'header' => $header, 'rows' => $rows, 'total' => count($rows) >= $maxRows ? $maxRows . '+' : count($rows)]);
            exit;
        } elseif ($action === 'get_cards') {
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
        } elseif ($action === 'get_users') {
            echo json_encode(['success' => true, 'users' => User::getAll()]);
        } elseif ($action === 'create_user') {
            $data = json_decode(file_get_contents('php://input'), true);
            $username = trim($data['username'] ?? '');
            $password = $data['password'] ?? '';
            $isAdmin = !empty($data['is_admin']);
            $fullName = trim($data['full_name'] ?? '');
            $englishLevel = $data['english_level'] ?? 'Beginner';
            if ($username === '' || strlen($password) < 6) {
                echo json_encode(['success' => false, 'error' => 'Username required, password min 6 chars']);
                exit;
            }
            $user = User::create($username, $password, $isAdmin, $fullName, $englishLevel);
            echo json_encode(['success' => true, 'user' => $user]);
        } elseif ($action === 'update_user') {
            $data = json_decode(file_get_contents('php://input'), true);
            $userId = (int) ($data['id'] ?? 0);
            $username = trim($data['username'] ?? '');
            $fullName = trim($data['full_name'] ?? '');
            $englishLevel = $data['english_level'] ?? 'Beginner';
            $isAdmin = !empty($data['is_admin']);
            if ($userId <= 0 || $username === '') {
                echo json_encode(['success' => false, 'error' => 'Invalid data']);
                exit;
            }
            User::update($userId, $username, $fullName, $englishLevel, $isAdmin);
            echo json_encode(['success' => true]);
        } elseif ($action === 'reset_user_progress') {
            $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
            if ($userId <= 0) {
                echo json_encode(['success' => false, 'error' => 'Invalid user']);
                exit;
            }
            Review::resetForUser($userId);
            User::resetProgress($userId);
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete_user') {
            $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
            if ($userId === $currentUser['id']) {
                echo json_encode(['success' => false, 'error' => 'Cannot delete yourself']);
                exit;
            }
            User::delete($userId);
            echo json_encode(['success' => true]);
        } elseif ($action === 'create_set') {
            $data = json_decode(file_get_contents('php://input'), true);
            $name = trim($data['name'] ?? '');
            if ($name === '') {
                echo json_encode(['success' => false, 'error' => 'Name is required']);
                exit;
            }
            $id = CardSet::create($name);
            echo json_encode(['success' => true, 'id' => $id, 'name' => $name]);
        } elseif ($action === 'update_set') {
            $data = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($data['id'] ?? 0);
            $name = trim($data['name'] ?? '');
            if ($id <= 0 || $name === '') {
                echo json_encode(['success' => false, 'error' => 'Invalid data']);
                exit;
            }
            CardSet::update($id, $name);
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete_set') {
            $id = isset($_GET['set_id']) ? (int) $_GET['set_id'] : 0;
            if ($id <= 0) {
                echo json_encode(['success' => false, 'error' => 'Invalid set']);
                exit;
            }
            CardSet::delete($id);
            echo json_encode(['success' => true]);
        } elseif ($action === 'get_user_sets') {
            $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
            $setIds = Review::getAccessibleSets($userId);
            echo json_encode(['success' => true, 'set_ids' => $setIds]);
        } elseif ($action === 'set_user_sets') {
            $data = json_decode(file_get_contents('php://input'), true);
            $userId = (int) ($data['user_id'] ?? 0);
            $setIds = array_map('intval', $data['set_ids'] ?? []);
            if ($userId <= 0) {
                echo json_encode(['success' => false, 'error' => 'Invalid user']);
                exit;
            }
            Review::setAccessibleSets($userId, $setIds);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }

    exit;
}

if (!$isLoggedIn) {
    if ($needsSetup) {
        require __DIR__ . '/src/templates/admin_setup.php';
    } else {
        require __DIR__ . '/src/templates/admin_login.php';
    }
    exit;
}

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
    <div class="top-bar">
        <a href="index.php" class="back-link">← Back to Flashcards</a>
        <div class="flex gap-3 items-center">
            <span class="text-sm text-gray-600">👤 <?= escapeHtml($currentUser['username']) ?></span>
            <button id="toggleUsersBtn" class="btn btn-secondary btn-sm">👥 Users</button>
            <a href="?logout=1" class="btn btn-logout btn-sm">🚪 Logout</a>
        </div>
    </div>

    <div id="cardEditorSection">
        <div class="editor-toolbar">
            <div class="toolbar-row">
                <h1 class="text-xl marker-underline">✏️ Card Editor</h1>
                <div class="toolbar-group">
                    <select id="setSelector" class="form-select" style="width:220px;">
                        <option value="">-- Choose Card Set --</option>
                        <?php foreach ($cardSets as $set): ?>
                            <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button id="manageSetsBtn" class="btn btn-secondary btn-sm">⚙️</button>
                    <button id="importCsvBtn" class="btn btn-secondary btn-sm">📥 Import</button>
                    <a href="api/export_csv.php" class="btn btn-secondary btn-sm">📤 Export</a>
                </div>
                <div class="toolbar-group">
                    <button id="saveCardBtn" class="btn btn-success">💾 Save</button>
                    <button id="newCardBtn" class="btn btn-primary">✨ New</button>
                    <button id="deleteCardBtn" class="btn btn-danger">🗑</button>
                    <button id="revertCardBtn" class="btn btn-warning btn-sm">↺</button>
                </div>
            </div>
            <div class="toolbar-row">
                <div class="toolbar-group">
                    <span class="text-xs font-bold text-gray-500 mr-1">🔍</span>
                    <input type="text" id="cardSearchInput" placeholder="Search by title..." class="form-input form-input-sm" style="width:160px;">
                </div>
                <div class="toolbar-group">
                    <span class="text-xs font-bold text-gray-500">Level:</span>
                    <label class="filter-checkbox"><input type="checkbox" id="levelBeginner"> Beginner</label>
                    <label class="filter-checkbox"><input type="checkbox" id="levelIntermediate"> Intermediate</label>
                    <label class="filter-checkbox"><input type="checkbox" id="levelAdvanced"> Advanced</label>
                    <button id="filterCardsBtn" class="btn btn-secondary btn-xs">Filter</button>
                </div>
                <span class="text-xs text-gray-400 ml-auto line-break-hint">💡 Use \br for line breaks</span>
            </div>
        </div>

        <div class="editor-layout">
            <div class="card-list-panel">
                <h2 class="panel-title">📋 Cards</h2>
                <div id="cardListContainer" class="card-list">
                    <div class="text-center text-gray-500 py-8">Select a card set to load cards</div>
                </div>
            </div>

            <div class="editor-main">
                <div class="edit-card-panel">
                    <h2 class="panel-title">✏️ Edit Card</h2>
                    <input type="hidden" id="editCardId" value="0">
                    <div class="edit-grid">
                        <div>
                            <label class="field-label">Title / Word</label>
                            <input type="text" id="editTitle" class="form-input" placeholder="Enter word or title">
                        </div>
                        <div>
                            <label class="field-label">Pattern Type</label>
                            <select id="editPatternType" class="form-select">
                                <option value="usage_cases">📘 Pure Text - Usage Cases</option>
                                <option value="deep_dive">🧠 Pure Text - Deep Dive</option>
                                <option value="formula_table">📐 Pure Text - Formula Table</option>
                                <option value="multiple_choice">❓ Multiple Choice</option>
                                <option value="gap_fill">✏️ Gap Fill</option>
                            </select>
                        </div>
                        <div>
                            <label class="field-label">Level</label>
                            <select id="editLevel" class="form-select">
                                <option value="Beginner">🔰 Beginner</option>
                                <option value="Intermediate">📚 Intermediate</option>
                                <option value="Advanced">🎓 Advanced</option>
                            </select>
                        </div>
                        <div>
                            <label class="field-label">Card Set</label>
                            <select id="editSetId" class="form-select">
                                <?php foreach ($cardSets as $set): ?>
                                    <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div id="editFieldsContainer"></div>
                </div>

                <div class="preview-panel">
                    <h2 class="panel-title">📖 Preview <span class="text-xs text-gray-400 font-normal">(click to flip)</span></h2>
                    <div class="card-preview" id="previewCard">
                        <div class="card-front-preview">
                            <span class="preview-label">FRONT</span>
                            <div id="frontPreviewContent" class="flex items-center justify-center min-h-[240px]">
                                <div class="text-center text-gray-400">Edit card to see preview</div>
                            </div>
                        </div>
                        <div class="card-back-preview">
                            <span class="preview-label">BACK</span>
                            <div id="backPreviewContent" class="flex items-center justify-center min-h-[240px]">
                                <div class="text-center text-gray-400">Edit card to see preview</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="userManagementSection" class="hidden">
        <div class="editor-toolbar">
            <div class="toolbar-row">
                <h2 class="text-xl marker-underline">👥 Manage Users</h2>
                <button id="backToCardsBtn" class="btn btn-secondary btn-sm">← Back to Cards</button>
            </div>
        </div>

        <div class="user-layout">
            <div class="add-user-panel">
                <h3 class="panel-title">➕ Add User</h3>
                <label class="field-label">Username</label>
                <input type="text" id="newUserUsername" class="form-input" placeholder="Enter username" maxlength="30">
                <label class="field-label">Full Name</label>
                <input type="text" id="newUserFullName" class="form-input" placeholder="Enter full name">
                <label class="field-label">Password</label>
                <input type="password" id="newUserPassword" class="form-input" placeholder="Min 6 characters">
                <label class="field-label">English Level</label>
                <select id="newUserLevel" class="form-select">
                    <option value="Beginner">🔰 Beginner</option>
                    <option value="Intermediate">📚 Intermediate</option>
                    <option value="Advanced">🎓 Advanced</option>
                </select>
                <label class="flex items-center gap-2 mt-1 mb-3">
                    <input type="checkbox" id="newUserIsAdmin" value="1">
                    <span class="font-bold text-sm">Admin privileges</span>
                </label>
                <button id="createUserBtn" class="btn btn-success w-full">➕ Create User</button>
            </div>

            <div class="user-list-panel">
                <h3 class="panel-title">📋 User List</h3>
                <div id="userListContainer" class="card-list">
                    <div class="text-center text-gray-500 py-4">Loading users...</div>
                </div>
            </div>
        </div>
    </div>
</div>

    <div id="manageSetsModal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-lg marker-underline">⚙️ Manage Card Sets</h3>
                <button id="closeSetsModalBtn" class="text-gray-500 text-xl font-bold">&times;</button>
            </div>
            <div class="mb-3 flex gap-2">
                <input type="text" id="newSetNameInput" class="form-input flex-1" placeholder="New set name...">
                <button id="addSetBtn" class="btn btn-success whitespace-nowrap">➕ Add</button>
            </div>
            <div id="setListContainer">
                <div class="text-center text-gray-500 py-4">Loading...</div>
            </div>
        </div>
    </div>

    <!-- Import CSV Modal -->
    <div id="importModal" class="modal-overlay hidden">
        <div class="import-modal-content">
            <div class="import-header">
                <h2 class="text-xl marker-underline">📥 Import CSV</h2>
                <button id="closeImportBtn" class="text-gray-500 text-xl font-bold">&times;</button>
            </div>

            <!-- Step 1: File Selection -->
            <div id="importStepFile">
                <div class="import-file-area" id="importDropZone">
                    <div class="import-file-placeholder">
                        <span class="text-4xl">📂</span>
                        <p class="text-lg font-bold mt-2">Drop CSV file here or click to browse</p>
                        <p class="text-sm text-gray-400 mt-1">Accepts .csv files with flashcard data</p>
                    </div>
                    <input type="file" id="importFileInput" accept=".csv" class="hidden">
                </div>
            </div>

            <!-- Step 2: Preview & Mapping (hidden initially) -->
            <div id="importStepPreview" class="hidden">
                <div class="import-toolbar">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-gray-600">File:</span>
                        <span id="importFileName" class="text-sm text-gray-800 font-mono"></span>
                        <span id="importRowCount" class="text-xs text-gray-400"></span>
                    </div>
                    <div class="flex gap-2">
                        <button id="importChangeFileBtn" class="btn btn-secondary btn-sm">📁 Change</button>
                        <button id="importExecuteBtn" class="btn btn-success">🚀 Import</button>
                        <button id="importCancelBtn" class="btn btn-danger btn-sm">Cancel</button>
                    </div>
                </div>

                <div class="import-mapping-bar">
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="text-sm font-bold">Map to Card Set:</label>
                        <select id="importSetSelector" class="form-select" style="width:220px;margin:0;">
                            <option value="">-- Select Set --</option>
                            <?php foreach ($cardSets as $set): ?>
                                <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                        <label class="filter-checkbox text-sm">
                            <input type="checkbox" id="importApplySetAll"> Apply to all
                        </label>
                        <div class="flex gap-1 items-center">
                            <input type="text" id="importNewSetName" class="form-input form-input-sm" style="width:160px;margin:0;" placeholder="Or create new set...">
                            <button id="importCreateSetBtn" class="btn btn-primary btn-xs">➕</button>
                        </div>
                    </div>
                </div>

                <div class="import-body">
                    <div class="import-left">
                        <div class="import-records-container">
                            <table class="import-table" id="importPreviewTable">
                                <thead>
                                    <tr>
                                        <th style="width:36px;"><input type="checkbox" id="importSelectAll" checked></th>
                                        <th style="width:32px;">#</th>
                                        <th style="width:140px;">Card Set</th>
                                        <th style="width:120px;">Style</th>
                                        <th>Title</th>
                                        <th>Level</th>
                                        <th>Content Preview</th>
                                    </tr>
                                </thead>
                                <tbody id="importPreviewBody">
                                    <tr><td colspan="7" class="text-center text-gray-400 py-4">No data</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="import-editor-panel" id="importEditorPanel">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="panel-title" style="margin-bottom:0;">✏️ Edit Selected Card</h3>
                                <div class="flex gap-2">
                                    <button id="importApplyCardBtn" class="btn btn-primary btn-sm">Apply</button>
                                    <button id="importApplyAllBtn" class="btn btn-secondary btn-sm">Apply to all</button>
                                    <button id="importDeleteCardBtn" class="btn btn-danger btn-sm">🗑 Remove</button>
                                </div>
                            </div>
                            <div class="import-edit-grid">
                                <div>
                                    <label class="field-label">Title</label>
                                    <input type="text" id="importEditTitle" class="form-input" placeholder="Card title">
                                </div>
                                <div>
                                    <label class="field-label">Card Set</label>
                                    <select id="importEditSetId" class="form-select">
                                        <option value="">-- Select Set --</option>
                                        <?php foreach ($cardSets as $set): ?>
                                            <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div>
                                    <label class="field-label">Style</label>
                                    <select id="importEditStyle" class="form-select">
                                        <option value="usage_cases">📘 Usage Cases</option>
                                        <option value="deep_dive">🧠 Deep Dive</option>
                                        <option value="formula_table">📐 Formula Table</option>
                                        <option value="multiple_choice">❓ Multiple Choice</option>
                                        <option value="gap_fill">✏️ Gap Fill</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="field-label">Level</label>
                                    <select id="importEditLevel" class="form-select">
                                        <option value="Beginner">🔰 Beginner</option>
                                        <option value="Intermediate">📚 Intermediate</option>
                                        <option value="Advanced">🎓 Advanced</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="field-label">Definition / Question</label>
                                <textarea id="importEditDefinition" class="form-textarea" rows="3" placeholder="Definition, question text, or sentence..."></textarea>
                            </div>
                            <div>
                                <label class="field-label">Example / Options / Answers</label>
                                <textarea id="importEditExtra" class="form-textarea" rows="2" placeholder="Example, options (comma-sep), or correct answer..."></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="import-right">
                        <div class="import-preview-panel">
                            <h3 class="panel-title" style="margin-bottom:8px;">📖 Card Preview</h3>
                            <div class="import-flip-card" id="importCardPreview">
                                <div class="import-flip-front">
                                    <div class="text-gray-400 text-sm text-center p-4">Select a row to preview</div>
                                </div>
                                <div class="import-flip-back">
                                    <div class="text-gray-400 text-sm text-center p-4">Flip to see the answer</div>
                                </div>
                            </div>
                            <p class="text-xs text-gray-400 text-center mt-2">👆 Click card to flip</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

<script src="assets/js/admin.js"></script>
</body>
</html>
