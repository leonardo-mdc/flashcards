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

function adminCsrfTokenFromRequest(): ?string
{
    return $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? null;
}

function requireAdminAjax(): void
{
    if (!verifyCsrfToken(adminCsrfTokenFromRequest())) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Invalid security token']);
        exit;
    }
}

if (isset($_POST['setup'])) {
    if (!verifyCsrfToken($_POST['csrf_token'] ?? null)) {
        $setupError = 'Invalid security token.';
    } else {
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
}

if (isset($_POST['login'])) {
    if (!verifyCsrfToken($_POST['csrf_token'] ?? null)) {
        $loginError = 'Invalid security token.';
    } else {
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
    requireAdminAjax();

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
            if (isset($header[0])) {
                $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
            }
            $rows = [];
            while (($row = fgetcsv($handle)) !== false) {
                $row = array_slice(array_map('trim', $row), 0, count($header));
                $rows[] = array_combine($header, array_pad($row, count($header), ''));
            }
            fclose($handle);
            echo json_encode(['success' => true, 'header' => $header, 'rows' => $rows, 'total' => count($rows)]);
            exit;
        } elseif ($action === 'get_cards') {
            $setId = isset($_GET['set_id']) ? (int) $_GET['set_id'] : 1;
            if ($setId === 0) {
                echo json_encode(['success' => true, 'cards' => Card::getAll()]);
            } else {
                echo json_encode(['success' => true, 'cards' => Card::getBySet($setId)]);
            }
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
            $password = $data['password'] ?? null;
            if ($userId <= 0 || $username === '') {
                echo json_encode(['success' => false, 'error' => 'Invalid data']);
                exit;
            }
            User::update($userId, $username, $fullName, $englishLevel, $isAdmin, $password);
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
            $exclusiveTo = $data['exclusive_to'] ?? '';
            $id = CardSet::create($name, $exclusiveTo);
            echo json_encode(['success' => true, 'id' => $id, 'name' => $name]);
        } elseif ($action === 'update_set') {
            $data = json_decode(file_get_contents('php://input'), true);
            $id = (int) ($data['id'] ?? 0);
            $name = trim($data['name'] ?? '');
            if ($id <= 0 || $name === '') {
                echo json_encode(['success' => false, 'error' => 'Invalid data']);
                exit;
            }
            $exclusiveTo = $data['exclusive_to'] ?? '';
            CardSet::update($id, $name, $exclusiveTo);
            echo json_encode(['success' => true]);
        } elseif ($action === 'get_students') {
            echo json_encode(['success' => true, 'students' => User::getStudents()]);
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
    <div class="flex justify-between items-center mb-4">
        <a href="index.php" class="back-link">← Back to Flashcards</a>
        <div class="flex gap-2 items-center">
            <span class="text-sm text-gray-500">👤 <?= escapeHtml($currentUser['username']) ?></span>
            <button id="toggleUsersBtn" class="btn btn-secondary text-sm">👥 Users</button>
            <a href="?logout=1" class="btn btn-logout">🚪 Logout</a>
            <form action="api/migrate_types.php" method="POST" style="display:inline" onsubmit="return confirm('Fix truncated card types? This will update cards with empty pattern_type.');">
                <button type="submit" class="btn btn-secondary text-sm">🛠 Fix Card Types</button>
            </form>
        </div>
    </div>

    <?php if (isset($_GET['migrate'])): ?>
        <div class="px-4 py-2 rounded-xl mb-4 text-sm <?= $_GET['migrate'] === 'done' ? 'bg-green-100 border-2 border-green-400 text-green-800' : 'bg-red-100 border-2 border-red-400 text-red-800' ?>">
            <?= escapeHtml($_SESSION['migrate_result'] ?? ($_GET['migrate'] === 'done' ? 'Cards fixed successfully.' : 'Migration failed.')) ?>
        </div>
    <?php unset($_SESSION['migrate_result']); endif; ?>

    <div id="cardEditorSection">
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
                    <button id="manageSetsBtn" class="btn btn-secondary text-sm">⚙️ Manage</button>
                    <button id="importCsvBtn" class="btn btn-secondary text-sm">📥 Import</button>
                    <button id="exportBtn" class="btn btn-secondary text-sm">📤 Export</button>
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
                <input type="text" id="cardSearchInput" class="form-input mb-2" placeholder="🔍 Search cards by title..." style="margin-bottom:8px;">
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
                                <option value="image_mcq">🖼️ Image MCQ (Quiz)</option>
                                <option value="image_description">🖼️ Image Description</option>
                                <option value="audio_listening">🎧 Audio Listening</option>
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
                    <div>
                        <label class="block font-bold mb-1">Card Set:</label>
                        <select id="editSetId" class="form-select">
                            <?php foreach ($cardSets as $set): ?>
                                <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div id="editFieldsContainer"></div>
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

    <div id="userManagementSection" class="hidden">
        <div class="whiteboard-card">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl marker-underline">👥 Manage Users</h2>
                <button id="backToCardsBtn" class="btn btn-secondary">← Back to Cards</button>
            </div>

            <div class="grid-2cols">
                <div class="whiteboard-card" style="padding:16px;">
                    <h3 class="text-lg marker-underline mb-3">➕ Add User</h3>
                    <label class="block font-bold mb-1">Username:</label>
                    <input type="text" id="newUserUsername" class="form-input" placeholder="Enter username" maxlength="30">
                    <label class="block font-bold mb-1">Full Name:</label>
                    <input type="text" id="newUserFullName" class="form-input" placeholder="Enter full name">
                    <label class="block font-bold mb-1">Password:</label>
                    <input type="password" id="newUserPassword" class="form-input" placeholder="Min 6 characters">
                    <label class="block font-bold mb-1">English Level:</label>
                    <select id="newUserLevel" class="form-select">
                        <option value="Beginner">🔰 Beginner</option>
                        <option value="Intermediate">📚 Intermediate</option>
                        <option value="Advanced">🎓 Advanced</option>
                    </select>
                    <label class="flex items-center gap-2 mt-1 mb-3">
                        <input type="checkbox" id="newUserIsAdmin" value="1">
                        <span class="font-bold">Admin privileges</span>
                    </label>
                    <button id="createUserBtn" class="btn btn-success w-full">➕ Create User</button>
                </div>

                <div>
                    <div class="whiteboard-card" style="padding:16px;">
                        <h3 class="text-lg marker-underline mb-3">📋 User List</h3>
                        <div id="userListContainer" class="card-list">
                            <div class="text-center text-gray-500 py-4">Loading users...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

    <div id="manageSetsModal" class="modal-overlay hidden">
        <div class="whiteboard-card" style="max-width:580px;width:95%;padding:24px;max-height:85vh;overflow-y:auto;">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-lg marker-underline">⚙️ Manage Card Sets</h3>
                <button id="closeSetsModalBtn" class="text-gray-500 text-xl font-bold">&times;</button>
            </div>
            <div class="flex gap-2 mb-2">
                <input type="text" id="setsSearchInput" class="form-input flex-1" placeholder="🔍 Search sets..." style="padding:6px 10px;">
                <input type="text" id="newSetNameInput" class="form-input" placeholder="New set name..." style="padding:6px 10px;max-width:180px;">
                <button id="addSetBtn" class="btn btn-success whitespace-nowrap" style="padding:6px 12px;">➕ Add</button>
            </div>
            <div id="newSetExclusiveContainer"></div>
            <div id="setListContainer">
                <div class="text-center text-gray-500 py-4">Loading...</div>
            </div>
        </div>
    </div>
    <div id="manageSetsToast" style="display:none;position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:8px;font-size:12px;z-index:9999;"></div>

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

                <div class="import-3col-grid">
                    <div class="import-list-col">
                        <div class="import-records-container">
                            <table class="import-table" id="importPreviewTable">
                                <thead>
                                    <tr>
                                        <th style="width:36px;"><input type="checkbox" id="importSelectAll" checked></th>
                                        <th style="width:28px;">#</th>
                                        <th style="width:110px;">Card Set</th>
                                        <th style="width:100px;">Style</th>
                                        <th>Title</th>
                                        <th style="width:80px;">Level</th>
                                    </tr>
                                </thead>
                                <tbody id="importPreviewBody">
                                    <tr><td colspan="6" class="text-center text-gray-400 py-4">No data</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="import-fields-col">
                        <div class="import-editor-panel">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="panel-title" style="margin-bottom:0;">✏️ Fields</h3>
                                <div class="flex gap-1">
                                    <button id="importApplyCardBtn" class="btn btn-primary btn-xs">Apply</button>
                                    <button id="importApplyAllBtn" class="btn btn-secondary btn-xs">Apply all</button>
                                    <button id="importDeleteCardBtn" class="btn btn-danger btn-xs">🗑</button>
                                </div>
                            </div>
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
                                    <option value="image_mcq">🖼️ Image MCQ</option>
                                    <option value="image_description">🖼️ Image Description</option>
                                    <option value="audio_listening">🎧 Audio Listening</option>
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
                            <div id="importDynamicFields"></div>
                        </div>
                    </div>

                    <div class="import-preview-col">
                        <div class="import-preview-section hidden" id="importPreviewSection">
                            <h3 class="panel-title" style="margin-bottom:8px;">👁️ Preview</h3>
                            <div class="card-preview">
                                <div class="card-front-preview" style="position:relative;min-height:180px;">
                                    <span class="preview-label">📖 FRONT</span>
                                    <div id="importFrontPreview" class="flex items-center justify-center min-h-[140px]">
                                        <div class="text-center text-gray-400">Select a card to preview</div>
                                    </div>
                                </div>
                            </div>
                            <div class="card-preview">
                                <div class="card-back-preview" style="position:relative;min-height:180px;">
                                    <span class="preview-label">🔍 BACK</span>
                                    <div id="importBackPreview" class="flex items-center justify-center min-h-[140px]">
                                        <div class="text-center text-gray-400">Select a card to preview</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="exportModal" class="modal-overlay hidden">
        <div class="export-modal-content">
            <div class="export-header">
                <h2 class="text-xl marker-underline">📤 Export Cards</h2>
                <button id="closeExportBtn" class="text-gray-500 text-xl font-bold">&times;</button>
            </div>
            <div class="export-filters">
                <div class="flex gap-3 items-center flex-wrap">
                    <label class="text-sm font-bold">Card Set:</label>
                    <select id="exportSetSelector" class="form-select" style="width:220px;">
                        <option value="0">All Sets</option>
                        <?php foreach ($cardSets as $set): ?>
                            <option value="<?= $set['id'] ?>"><?= escapeHtml($set['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <label class="text-sm font-bold">Card Type:</label>
                    <select id="exportTypeFilter" class="form-select" style="width:160px;">
                        <option value="">All Types</option>
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="gap_fill">Gap Fill</option>
                        <option value="image_mcq">Image MCQ</option>
                        <option value="image_description">Image Description</option>
                        <option value="audio_listening">Audio Listening</option>
                        <option value="usage_cases">Usage Cases</option>
                        <option value="deep_dive">Deep Dive</option>
                        <option value="formula_table">Formula Table</option>
                    </select>
                </div>
            </div>
            <div class="export-card-list">
                <div class="export-select-all-bar">
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" id="exportSelectAll" checked>
                        <span>Select All</span>
                    </label>
                    <span id="exportSelectedCount" class="text-sm text-gray-500">0 cards selected</span>
                </div>
                <div id="exportCardListContainer" class="export-cards-container">
                    <div class="text-center text-gray-500 py-8">Loading cards...</div>
                </div>
            </div>
            <div class="export-actions">
                <button id="exportCancelBtn" class="btn btn-secondary">Cancel</button>
                <button id="exportExecuteBtn" class="btn btn-success">📤 Export Selected</button>
            </div>
        </div>
    </div>

<script>
    window.FLASHCARD_ADMIN = {
        csrfToken: <?= json_encode(csrfToken()) ?>
    };
</script>
<script src="assets/js/admin.js"></script>
</body>
</html>
