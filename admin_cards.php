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
                    <input type="file" id="importCsvInput" accept=".csv" class="hidden">
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

<script src="assets/js/admin.js"></script>
</body>
</html>
