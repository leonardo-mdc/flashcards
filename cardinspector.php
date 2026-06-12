<?php
require_once __DIR__ . '/src/session_init.php';
initSession();

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';
require_once __DIR__ . '/src/User.php';
require_once __DIR__ . '/src/CardSet.php';
require_once __DIR__ . '/src/Card.php';

$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH'])
    && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

// ── AJAX handlers ──────────────────────────────────────────────
if ($isAjax && isset($_GET['action'])) {
    header('Content-Type: application/json');

    $adminUser = $_SESSION['admin_user'] ?? null;
    $isAdmin = $adminUser !== null && ($adminUser['is_admin'] ?? false);

    if (!$isAdmin) {
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }

    if ($action !== 'login' && !verifyCsrfToken($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Invalid security token']);
        exit;
    }

    try {
        $action = $_GET['action'];

        if ($action === 'login') {
            $input = json_decode(file_get_contents('php://input'), true);
            $username = trim($input['username'] ?? '');
            $password = $input['password'] ?? '';
            $user = User::authenticate($username, $password);
            if ($user && $user['is_admin']) {
                session_regenerate_id(true);
                $_SESSION['admin_user'] = $user;
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
            }
            exit;
        }

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
            $firstLine = fgets($handle); rewind($handle);
            $delim = (count(str_getcsv($firstLine, ';')) > count(str_getcsv($firstLine, ','))) ? ';' : ',';
            $header = fgetcsv($handle, 0, $delim);
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
            while (($row = fgetcsv($handle, 0, $delim)) !== false) {
                $row = array_slice(array_map('trim', $row), 0, count($header));
                $rows[] = array_combine($header, array_pad($row, count($header), ''));
            }
            fclose($handle);
            echo json_encode(['success' => true, 'header' => $header, 'rows' => $rows, 'total' => count($rows)]);
            exit;
        }

        if ($action === 'import') {
            if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'error' => 'CSV file required']);
                exit;
            }
            // Forward to the import API logic
            require __DIR__ . '/api/import_csv.php';
            exit;
        }

        if ($action === 'get_sets') {
            echo json_encode(['success' => true, 'sets' => CardSet::getAll()]);
            exit;
        }
    } catch (Exception $e) {
        error_log('Card inspector action error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'An error occurred.']);
        exit;
    }
}

// ── HTML page ──────────────────────────────────────────────────
$adminUser = $_SESSION['admin_user'] ?? null;
$isLoggedIn = $adminUser !== null && ($adminUser['is_admin'] ?? false);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Card Inspector</title>
    <link href="https://fonts.cdnfonts.com/css/bubble-sans" rel="stylesheet">
    <link href="https://fonts.cdnfonts.com/css/stampatello-faceto" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="assets/css/admin.css">
    <style>
        body { padding: 0; background: #e5e7eb; }
        .inspector-container { max-width: 1400px; margin: 0 auto; padding: 16px; }
        .split-3col-layout { display: grid; grid-template-columns: 200px 1fr 1fr; gap: 12px; align-items: start; }
        .preview-panel { background: white; border-radius: 12px; border: 2px solid #e5e7eb; padding: 20px; overflow-y: auto; max-height: calc(100vh - 120px); }
        @media (max-width: 1100px) { .split-3col-layout { grid-template-columns: 1fr 1fr; } .preview-panel { display: none; } }
        @media (max-width: 700px) { .split-3col-layout { grid-template-columns: 1fr; } }
        .card-list-panel { overflow-y: auto; background: white; border-radius: 12px; border: 2px solid #e5e7eb; max-height: calc(100vh - 120px); }
        .card-list-panel .card-row { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.1s; }
        .card-list-panel .card-row:hover { background: #f9fafb; }
        .card-list-panel .card-row.selected { background: #eff6ff; border-left: 4px solid #1d4ed8; }
        .card-list-panel .card-row .card-name { font-weight: 600; font-size: 0.85rem; color: #1f2937; }
        .card-list-panel .card-row .card-meta { font-size: 0.7rem; color: #6b7280; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .editor-panel { background: white; border-radius: 12px; border: 2px solid #e5e7eb; padding: 20px; overflow-y: auto; max-height: calc(100vh - 120px); }
        .login-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .login-box { background: white; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; border: 8px solid #374151; box-shadow: 12px 12px 24px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
<div class="inspector-container">
    <div class="flex justify-between items-center mb-3">
        <h1 class="text-xl marker-underline">🔍 Card Inspector</h1>
        <div class="flex gap-2">
            <span id="fileNameDisplay" class="text-sm text-gray-500 hidden"></span>
            <a href="admin_cards.php" class="btn btn-secondary btn-sm">← Admin</a>
            <a href="?logout=1" class="btn btn-danger btn-sm <?= !$isLoggedIn ? 'hidden' : '' ?>">Logout</a>
        </div>
    </div>

    <div id="stepUpload" class="<?= $isLoggedIn ? '' : 'hidden' ?>">
        <div class="import-file-area" id="dropZone" style="padding:24px 16px;margin-bottom:12px;">
            <div class="text-center">
                <span class="text-3xl">📂</span>
                <p class="text-base font-bold mt-1">Drop CSV file here or click to browse</p>
                <p class="text-xs text-gray-400 mt-1">Accepts .csv files with flashcard data</p>
            </div>
            <input type="file" id="fileInput" accept=".csv" class="hidden">
        </div>
    </div>

    <div id="stepEditor" class="hidden <?= $isLoggedIn ? '' : 'hidden' ?>">
        <div class="flex gap-2 mb-3 flex-wrap items-center">
            <button id="changeFileBtn" class="btn btn-secondary btn-sm">📁 Change File</button>
            <button id="saveCsvBtn" class="btn btn-warning btn-sm">💾 Save CSV</button>
            <button id="importDbBtn" class="btn btn-success btn-sm">🚀 Import to Database</button>
            <span id="rowCount" class="text-xs text-gray-400 ml-auto"></span>
        </div>

        <div class="split-3col-layout">
            <div class="card-list-panel" id="cardListPanel">
                <div class="text-center text-gray-500 py-8 text-sm">Load a CSV to see cards</div>
            </div>

            <div class="editor-panel" id="editorPanel">
                <div class="text-center text-gray-500 py-12">Select a card from the list</div>
            </div>

            <div class="preview-panel" id="previewPanel">
                <div class="text-center text-gray-500 py-12">Select a card to preview</div>
            </div>
        </div>
    </div>
</div>

<?php if (!$isLoggedIn): ?>
<div class="login-overlay" id="loginOverlay">
    <div class="login-box">
        <h2 class="text-xl marker-underline mb-4">🔒 Admin Access</h2>
        <div>
            <label class="block font-bold mb-1">Username:</label>
            <input type="text" id="loginUsername" class="form-input" placeholder="Admin username">
        </div>
        <div>
            <label class="block font-bold mb-1">Password:</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="Password">
        </div>
        <p id="loginError" class="text-red-600 text-sm hidden mb-2"></p>
        <button id="loginBtn" class="btn btn-success w-full">🔑 Log In</button>
    </div>
</div>
<?php endif; ?>

<script>
    window.CARDINSPECTOR_CSRF = <?= json_encode(csrfToken()) ?>;
(function() {
    const styleLabels = {
        usage_cases: 'Usage Cases', deep_dive: 'Deep Dive', formula_table: 'Formula Table',
        multiple_choice: 'MCQ', gap_fill: 'Gap Fill',
        image_mcq: 'Image MCQ', image_description: 'Image Desc', audio_listening: 'Audio',
    };

    let rows = [];
    let header = [];
    let selectedIdx = -1;
    let originalFile = null;
    let cardSets = [];

    const csrfToken = window.CARDINSPECTOR_CSRF || '';

    function adminFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
        return window.fetch(url, { ...options, headers });
    }

    const cardListPanel = document.getElementById('cardListPanel');
    const editorPanel = document.getElementById('editorPanel');
    const rowCount = document.getElementById('rowCount');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    function formatBreaks(text) {
        if (!text) return '';
        let s = String(text);
        s = s.replace(/\\\\/g, '\\');
        s = s.replace(/\\br ?/g, '<br>');
        s = s.replace(/\\b(.*?)\\b/g, '<b>$1</b>');
        s = s.replace(/\\i(.*?)\\i/g, '<i>$1</i>');
        s = s.replace(/\\u(.*?)\\u/g, '<u>$1</u>');
        s = s.replace(/\\em(.*?)\\em/g, '<em>$1</em>');
        s = s.replace(/\\strong(.*?)\\strong/g, '<strong>$1</strong>');
        return s;
    }

    function splitCSV(s) { if (!s) return []; const r=[]; let c='',q=false; for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'){q=!q;continue}if(ch===','&&!q){r.push(c.trim());c='';continue}c+=ch}r.push(c.trim());return r.filter(Boolean); }

    // ── Login ──────────────────────────────────────────────────
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const res = await adminFetch('cardinspector.php?action=login', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('stepUpload').classList.remove('hidden');
            document.querySelector('[href*="logout"]')?.classList.remove('hidden');
        } else {
            const err = document.getElementById('loginError');
            err.textContent = data.error || 'Invalid credentials';
            err.classList.remove('hidden');
        }
    });
    document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('loginBtn').click();
    });

    // ── File upload ────────────────────────────────────────────
    dropZone?.addEventListener('click', () => fileInput.click());
    dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].name.endsWith('.csv')) {
            loadCsv(e.dataTransfer.files[0]);
        } else { alert('Please drop a .csv file'); }
    });
    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) loadCsv(e.target.files[0]);
    });
    document.getElementById('changeFileBtn')?.addEventListener('click', () => fileInput.click());

    async function loadCsv(file) {
        originalFile = file;
        fileNameDisplay.textContent = '📄 ' + file.name;
        fileNameDisplay.classList.remove('hidden');
        rowCount.textContent = 'Parsing...';

        const formData = new FormData();
        formData.append('csv', file);
        const res = await adminFetch('cardinspector.php?action=preview_csv&t=' + Date.now(), {
            method: 'POST', body: formData, headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const result = await res.json();
        if (!result.success) { alert(result.error || 'Failed to parse CSV'); return; }

        // Fetch sets for mapping
        const setsRes = await adminFetch('cardinspector.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const setsData = await setsRes.json();
        cardSets = setsData.success ? setsData.sets : [];

        header = result.header || [];
        rows = (result.rows || []).map(r => {
            const levelMap = {
                'beginner': 'Beginner', 'a1': 'Beginner', 'a2': 'Beginner',
                'intermediate': 'Intermediate', 'b1': 'Intermediate', 'b2': 'Intermediate',
                'advanced': 'Advanced', 'c1': 'Advanced', 'c2': 'Advanced',
            };
            let level = (r.level || 'Beginner').trim();
            level = levelMap[level.toLowerCase()] || level;
            let type = (r.type || 'usage_cases').trim().toLowerCase();
            const validTypes = ['usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_mcq','image_description','audio_listening'];
            if (!validTypes.includes(type)) type = 'usage_cases';
            return { ...r, _setName: (r.set || '').trim(), type, level };
        });

        rowCount.textContent = `${rows.length} rows`;
        document.getElementById('stepUpload').classList.add('hidden');
        document.getElementById('stepEditor').classList.remove('hidden');
        selectedIdx = -1;
        renderList();
        if (rows.length > 0) selectCard(0);
    }

    // ── Card list ──────────────────────────────────────────────
    function renderList() {
        let html = '';
        rows.forEach((row, idx) => {
            const sel = idx === selectedIdx ? 'selected' : '';
            const style = row.type || 'usage_cases';
            const title = row.title || 'Untitled';
            const setName = row._setName || '-';
            html += `<div class="card-row ${sel}" data-idx="${idx}">
                <div class="card-name">${escapeHtml(title)}</div>
                <div class="card-meta"><span>${escapeHtml(setName)}</span><span class="card-type ${style === 'multiple_choice' || style === 'image_mcq' ? 'mcq' : style === 'gap_fill' ? 'gap' : 'text'}">${styleLabels[style] || style}</span><span>${escapeHtml(row.level || 'Beginner')}</span></div>
            </div>`;
        });
        cardListPanel.innerHTML = html || '<div class="text-center text-gray-500 py-8 text-sm">No cards</div>';
        cardListPanel.querySelectorAll('.card-row').forEach(el => {
            el.addEventListener('click', () => selectCard(parseInt(el.dataset.idx)));
        });
    }

    function selectCard(idx) {
        if (idx < 0 || idx >= rows.length) return;
        selectedIdx = idx;
        renderList();
        renderEditor(rows[idx]);
    }

    // ── Editor ─────────────────────────────────────────────────
    function renderEditor(row) {
        const type = row.type || 'usage_cases';
        const editorHtml = `
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="field-label">Title</label>
                    <input type="text" id="editTitle" class="form-input" value="${escapeHtml(row.title || '')}">
                </div>
                <div>
                    <label class="field-label">Card Set</label>
                    <select id="editSet" class="form-select">
                        <option value="">-- Select Set --</option>
                        ${cardSets.map(s => `<option value="${s.id}" ${row.set_id == s.id || row._setName === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                        ${row._setName && !cardSets.find(s => s.name === row._setName) ? `<option value="" selected disabled>${escapeHtml(row._setName)} (new)</option>` : ''}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="field-label">Style</label>
                    <select id="editType" class="form-select">
                        ${Object.entries(styleLabels).map(([k,v]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="field-label">Level</label>
                    <select id="editLevel" class="form-select">
                        <option value="Beginner" ${row.level === 'Beginner' ? 'selected' : ''}>Beginner</option>
                        <option value="Intermediate" ${row.level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                        <option value="Advanced" ${row.level === 'Advanced' ? 'selected' : ''}>Advanced</option>
                    </select>
                </div>
            </div>
            <div id="dynamicFields">${renderDynamicFields(row)}</div>
            <div class="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                <button id="applyCardBtn" class="btn btn-primary btn-sm">Apply</button>
                <button id="deleteCardBtn" class="btn btn-danger btn-sm">Remove</button>
            </div>
        `;
        editorPanel.innerHTML = editorHtml;

        const previewHtml = `
            <h3 class="panel-title" style="margin-bottom:8px;">👁️ Preview</h3>
            <div class="card-preview">
                <div class="card-front-preview" style="position:relative;min-height:200px;">
                    <span class="preview-label">📖 FRONT</span>
                    <div id="inspectorFrontPreview" class="flex items-center justify-center min-h-[160px]">
                        <div class="text-center text-gray-400">Select a card to preview</div>
                    </div>
                </div>
            </div>
            <div class="card-preview">
                <div class="card-back-preview" style="position:relative;min-height:200px;">
                    <span class="preview-label">🔍 BACK</span>
                    <div id="inspectorBackPreview" class="flex items-center justify-center min-h-[160px]">
                        <div class="text-center text-gray-400">Select a card to preview</div>
                    </div>
                </div>
            </div>
        `;
        previewPanel.innerHTML = previewHtml;

        document.getElementById('editType').addEventListener('change', () => {
            const newType = document.getElementById('editType').value;
            const fieldsDiv = document.getElementById('dynamicFields');
            const dummyRow = { ...row, type: newType };
            fieldsDiv.innerHTML = renderDynamicFields(dummyRow);
            refreshCardPreview();
        });

        const allFields = document.querySelectorAll('#editorPanel input, #editorPanel textarea, #editorPanel select');
        allFields.forEach(el => {
            el.addEventListener('input', refreshCardPreview);
            el.addEventListener('change', refreshCardPreview);
        });

        refreshCardPreview();

        document.getElementById('applyCardBtn')?.addEventListener('click', () => {
            applyEditorToRow(selectedIdx);
            renderList();
            if (selectedIdx >= 0) selectCard(selectedIdx);
        });

        document.getElementById('deleteCardBtn')?.addEventListener('click', () => {
            if (!confirm('Remove this card from the import list?')) return;
            rows.splice(selectedIdx, 1);
            selectedIdx = Math.min(selectedIdx, rows.length - 1);
            rowCount.textContent = `${rows.length} rows`;
            renderList();
            if (rows.length > 0) selectCard(selectedIdx);
            else editorPanel.innerHTML = '<div class="text-center text-gray-500 py-12">No cards loaded</div>';
        });
    }

    function renderDynamicFields(row) {
        const type = row.type || 'usage_cases';
        const cd = {};
        // Parse content_data if it exists as a JSON string
        let contentData = row.content_data;
        if (typeof contentData === 'string') {
            try { contentData = JSON.parse(contentData); } catch(e) { contentData = {}; }
        }
        if (!contentData || typeof contentData !== 'object') contentData = {};

        const def = contentData.definition || row.definition || '';
        const questionText = contentData.question_text || row.question_text || '';
        const sentence = contentData.sentence || row.sentence || '';
        const usage1 = contentData.usage1 || row.usage1 || '';
        const tip = contentData.tip || row.tip || '';
        const exArr = Array.isArray(contentData.examples) ? contentData.examples : [];
        const example = exArr[0] || contentData.example1a || row.example1 || contentData.example || '';
        const example2 = exArr[1] || row.example2 || (contentData.example && contentData.example !== example ? contentData.example : '');
        const correctAnswer = contentData.correct_answer || row.correct_answer || '';
        const optArr = contentData.options;
        const optStr = Array.isArray(optArr) && optArr.length ? optArr.join(', ') : (row.opt1 ? [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean).join(', ') : '');
        const correctIdx = contentData.correct_index !== undefined ? contentData.correct_index : (row.correct_answer || 1);
        const imageUrl = contentData.image_url || row.image_url || '';
        const audioUrl = contentData.audio_url || row.audio_url || '';
        const description = contentData.description || row.description || '';
        const prompt = contentData.prompt || row.prompt || '';
        const transcript = contentData.transcript || row.transcript || '';
        const explanation = contentData.explanation || row.explanation || '';
        const correctAnswers = (contentData.correct_answers || [correctAnswer].filter(Boolean)).join(', ');

        if (type === 'multiple_choice' || type === 'image_mcq') {
            return `
                ${type === 'image_mcq' ? `<div><label class="field-label">Image URL</label><input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(imageUrl)}"></div>` : ''}
                <div><label class="field-label">Question Text</label><input type="text" id="editQuestionText" class="form-input" value="${escapeHtml(questionText)}"></div>
                <div><label class="field-label">Options (comma separated)</label><input type="text" id="editOptions" class="form-input" value="${escapeHtml(optStr)}"></div>
                <div><label class="field-label">Correct Index (0,1,2...)</label><input type="number" id="editCorrectIndex" class="form-input" value="${correctIdx}" min="0"></div>
                <div><label class="field-label">Explanation</label><textarea id="editExplanation" class="form-textarea" rows="2">${escapeHtml(explanation)}</textarea></div>
            `;
        }
        if (type === 'gap_fill') {
            return `
                <div><label class="field-label">Sentence with ______</label><textarea id="editSentence" class="form-textarea" rows="3">${escapeHtml(sentence)}</textarea></div>
                <div><label class="field-label">Correct Answer(s) (comma separated)</label><input type="text" id="editCorrectAnswers" class="form-input" value="${escapeHtml(correctAnswers)}"></div>
                <div><label class="field-label">Example Sentence</label><textarea id="editExample" class="form-textarea" rows="2">${escapeHtml(example)}</textarea></div>
            `;
        }
        if (type === 'image_description') {
            return `
                <div><label class="field-label">Image URL</label><input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(imageUrl)}"></div>
                <div><label class="field-label">Description</label><textarea id="editDescription" class="form-textarea" rows="5">${escapeHtml(description)}</textarea></div>
            `;
        }
        if (type === 'audio_listening') {
            return `
                <div><label class="field-label">Audio URL</label><input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(audioUrl)}"></div>
                <div><label class="field-label">Prompt</label><textarea id="editPrompt" class="form-textarea" rows="2">${escapeHtml(prompt)}</textarea></div>
                <div><label class="field-label">Correct Answer(s) (comma separated)</label><input type="text" id="editCorrectAnswers" class="form-input" value="${escapeHtml(correctAnswers)}"></div>
                <div><label class="field-label">Notes / Transcript</label><textarea id="editNotes" class="form-textarea" rows="3">${escapeHtml(transcript)}</textarea></div>
            `;
        }
        // Text types: usage_cases, deep_dive, formula_table
        const defFront = type === 'deep_dive' ? [] : ['definition'];
        const ff = Array.isArray(contentData.front_fields) ? contentData.front_fields : defFront;
        return `
            <div><label class="field-label">Image URL (optional)</label><input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(imageUrl)}"></div>
            <div><label class="field-label">Audio URL (optional)</label><input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(audioUrl)}"></div>
            <div><label class="field-label">Definition / Description</label><textarea id="editDefinition" class="form-textarea" rows="5">${escapeHtml(def)}</textarea></div>
            <div><label class="field-label">Usage / Context</label><textarea id="editUsage" class="form-textarea" rows="2">${escapeHtml(usage1)}</textarea></div>
            <div><label class="field-label">Example 1</label><textarea id="editExample" class="form-textarea" rows="2">${escapeHtml(example)}</textarea></div>
            <div><label class="field-label">Example 2 (optional)</label><textarea id="editExample2" class="form-textarea" rows="2">${escapeHtml(example2)}</textarea></div>
            <div><label class="field-label">Tip</label><textarea id="editTip" class="form-textarea" rows="2">${escapeHtml(tip)}</textarea></div>
            <div class="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <label class="field-label mb-1">Show on front:</label>
                <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffDefinition" ${ff.includes('definition') ? 'checked' : ''}> Definition</label>
                <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffUsage1" ${ff.includes('usage1') ? 'checked' : ''}> Usage</label>
                <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffExamples" ${ff.includes('examples') ? 'checked' : ''}> Examples</label>
                <label class="inline-flex items-center gap-1 text-xs"><input type="checkbox" id="ffTip" ${ff.includes('tip') ? 'checked' : ''}> Tip</label>
            </div>
        `;
    }

    // ── Card preview ───────────────────────────────────────────
    function refreshCardPreview() {
        if (selectedIdx < 0 || selectedIdx >= rows.length) return;
        const row = rows[selectedIdx];
        const type = document.getElementById('editType')?.value || row.type || 'usage_cases';
        const title = document.getElementById('editTitle')?.value || row.title || 'Untitled';
        const level = document.getElementById('editLevel')?.value || row.level || 'Beginner';
        const contentData = {};
        const def = document.getElementById('editDefinition')?.value || '';
        const questionText = document.getElementById('editQuestionText')?.value || '';
        const sentence = document.getElementById('editSentence')?.value || '';
        const usage = document.getElementById('editUsage')?.value || '';
        const tip = document.getElementById('editTip')?.value || '';
        const example = document.getElementById('editExample')?.value || '';
        const correctAnswer = document.getElementById('editCorrectAnswers')?.value || document.getElementById('editCorrectAnswer')?.value || row.correct_answer || '';
        const options = document.getElementById('editOptions')?.value || '';
        const correctIdx = parseInt(document.getElementById('editCorrectIndex')?.value) || 1;
        const imageUrl = document.getElementById('editImageUrl')?.value || '';
        const audioUrl = document.getElementById('editAudioUrl')?.value || '';
        const description = document.getElementById('editDescription')?.value || '';
        const prompt = document.getElementById('editPrompt')?.value || '';
        const transcript = document.getElementById('editNotes')?.value || '';
        const explanation = document.getElementById('editExplanation')?.value || '';

        if (type === 'multiple_choice' || type === 'image_mcq') {
            const opts = options ? splitCSV(options) : ['Option A', 'Option B', 'Option C'];
            contentData.options = opts;
            contentData.correct_index = correctIdx;
            contentData.question_text = questionText || 'Select the correct answer:';
            contentData.explanation = explanation;
            contentData.image_url = imageUrl;
            contentData.audio_url = audioUrl;
        } else if (type === 'gap_fill') {
            const answers = correctAnswer ? splitCSV(correctAnswer) : ['answer'];
            contentData.sentence = sentence || 'Complete: ______';
            contentData.correct_answers = answers;
            contentData.example = example;
            contentData.image_url = imageUrl;
            contentData.audio_url = audioUrl;
        } else if (type === 'image_description') {
            contentData.image_url = imageUrl;
            contentData.description = description || 'No description';
        } else if (type === 'audio_listening') {
            const answers = correctAnswer ? splitCSV(correctAnswer) : [];
            contentData.audio_url = audioUrl;
            contentData.prompt = prompt;
            contentData.correct_answers = answers;
            contentData.transcript = transcript;
            contentData.notes = transcript;
        } else {
            const ex1 = document.getElementById('editExample')?.value || example || '';
            const ex2 = document.getElementById('editExample2')?.value || '';
            const ff = [];
            if (document.getElementById('ffDefinition')?.checked) ff.push('definition');
            if (document.getElementById('ffUsage1')?.checked) ff.push('usage1');
            if (document.getElementById('ffExamples')?.checked) ff.push('examples');
            if (document.getElementById('ffTip')?.checked) ff.push('tip');
            contentData.definition = def || 'No definition';
            contentData.image_url = imageUrl;
            contentData.audio_url = audioUrl;
            contentData.usage1 = usage;
            contentData.example1a = ex1;
            contentData.examples = [ex1, ex2].filter(Boolean);
            contentData.tip = tip;
            contentData.front_fields = ff;
        }

        const frontHtml = renderCardFront(type, title, contentData);
        const backHtml = renderCardBack(type, title, contentData);
        document.getElementById('inspectorFrontPreview').innerHTML = frontHtml;
        document.getElementById('inspectorBackPreview').innerHTML = backHtml;
    }

    function renderCardFront(type, title, data) {
        if (type === 'image_mcq') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            return `
                <div class="flex flex-col md:flex-row gap-3 h-full min-h-[200px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-32 object-contain">` : `<div class="text-5xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-2">
                        <p class="text-sm font-bold text-center md:text-left">Select the correct answer:</p>
                        ${options.map((opt, i) => `<div class="quiz-option-preview text-sm py-1">${String.fromCharCode(65+i)}. ${formatBreaks(escapeHtml(opt))}</div>`).join('')}
                    </div>
                </div>`;
        }
        if (type === 'image_description') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            return `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🖼️ ${escapeHtml(title)}</div>
                    ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-40 rounded-xl shadow-md mb-2 object-contain">` : `<div class="text-5xl mb-2">🖼️</div>`}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip</p>
                </div>`;
        }
        if (type === 'audio_listening') {
            const audioUrl = data.audio_url || '';
            const hasAudio = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('uploads/'));
            const prompt = data.prompt || '';
            const isInteractive = !!(prompt || (data.correct_answers && data.correct_answers.length));
            return `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🎧 ${escapeHtml(title)}</div>
                    ${hasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : `<div class="text-5xl mb-2">🎧</div>`}
                    ${prompt ? `<p class="text-sm bg-gray-100 p-2 rounded-xl mb-1">${formatBreaks(escapeHtml(prompt))}</p>` : ''}
                    ${isInteractive ? `<input type="text" placeholder="Type answer..." class="w-full p-2 text-sm border-2 rounded-xl mb-2" disabled>` : ''}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip${isInteractive ? ' after answering' : ''}</p>
                </div>`;
        }
        if (type === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const mcImageUrl = data.image_url || '';
            const mcAudioUrl = data.audio_url || '';
            const mcHasImage = mcImageUrl && (mcImageUrl.startsWith('http://') || mcImageUrl.startsWith('https://') || mcImageUrl.startsWith('uploads/'));
            const mcHasAudio = mcAudioUrl && (mcAudioUrl.startsWith('http://') || mcAudioUrl.startsWith('https://') || mcAudioUrl.startsWith('uploads/'));
            return `
                <div class="text-center">
                    ${mcHasImage ? `<img src="${escapeHtml(mcImageUrl)}" class="max-h-32 object-contain mx-auto mb-2 rounded-lg">` : ''}
                    ${mcHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                    <div class="text-4xl mb-3">❓</div>
                    <p class="text-lg mb-4 font-bold">${formatBreaks(escapeHtml(data.question_text || 'Select the correct answer:'))}</p>
                    ${options.map((opt, i) => `<div class="quiz-option-preview text-base">${String.fromCharCode(65+i)}. ${formatBreaks(escapeHtml(opt))}</div>`).join('')}
                    <p class="text-xs text-gray-400 mt-3">👆 Tap answer, then flip card</p>
                </div>`;
        }
        if (type === 'gap_fill') {
            const gapImageUrl = data.image_url || '';
            const gapAudioUrl = data.audio_url || '';
            const gapHasImage = gapImageUrl && (gapImageUrl.startsWith('http://') || gapImageUrl.startsWith('https://') || gapImageUrl.startsWith('uploads/'));
            const gapHasAudio = gapAudioUrl && (gapAudioUrl.startsWith('http://') || gapAudioUrl.startsWith('https://') || gapAudioUrl.startsWith('uploads/'));
            const gapMediaHtml = (gapHasImage || gapHasAudio) ? `
                <div class="w-full flex justify-center mb-2">
                    ${gapHasImage ? `<img src="${escapeHtml(gapImageUrl)}" class="max-h-32 object-contain rounded-lg">` : ''}
                    ${gapHasAudio ? `<div class="text-sm">🔊 Audio file provided</div>` : ''}
                </div>` : '';
            return `
                <div class="text-center">
                    ${gapMediaHtml}
                    <div class="text-4xl mb-3">✏️</div>
                    <p class="text-lg mb-4 font-bold">Complete the sentence:</p>
                    <p class="text-base bg-gray-100 p-3 rounded-xl">${formatBreaks(escapeHtml(data.sentence || 'Complete: ______'))}</p>
                    <input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6">
                    <p class="text-xs text-gray-400 mt-3">👆 Type answer, then flip</p>
                </div>`;
        }
        const genImageUrl = data.image_url || '';
        const genAudioUrl = data.audio_url || '';
        const genHasImage = genImageUrl && (genImageUrl.startsWith('http://') || genImageUrl.startsWith('https://') || genImageUrl.startsWith('uploads/'));
        const genHasAudio = genAudioUrl && (genAudioUrl.startsWith('http://') || genAudioUrl.startsWith('https://') || genAudioUrl.startsWith('uploads/'));
        const defaultFront = type === 'deep_dive' ? [] : ['definition'];
        const frontFields = Array.isArray(data.front_fields) ? data.front_fields : defaultFront;
        const frontParts = [];
        if (frontFields.includes('definition') && data.definition) frontParts.push(`<div class="text-base text-center px-2">${formatBreaks(escapeHtml(data.definition))}</div>`);
        if (frontFields.includes('usage1') && data.usage1) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">${formatBreaks(escapeHtml(data.usage1))}</div>`);
        if (frontFields.includes('tip') && data.tip) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">💡 ${formatBreaks(escapeHtml(data.tip))}</div>`);
        return `
            <div class="flex flex-col items-center justify-center min-h-[200px]">
                ${genHasImage ? `<img src="${escapeHtml(genImageUrl)}" class="max-h-32 object-contain rounded-lg mb-2">` : ''}
                ${genHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                <div class="text-2xl text-center font-bold mb-2">${escapeHtml(title)}</div>
                ${frontParts.join('')}
                <p class="text-xs text-gray-400 mt-4">👆 Tap card to flip</p>
            </div>`;
    }

    function renderCardBack(type, title, data) {
        if (type === 'image_mcq' || type === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const correctIdx = data.correct_index || 1;
            return `
                <div class="text-center">
                    <h3 class="text-xl text-green-700 marker-underline mb-3">✓ Answer</h3>
                    <div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3">
                        <p class="text-xl font-bold">${String.fromCharCode(65+correctIdx)}. ${formatBreaks(escapeHtml(options[correctIdx] || 'Correct Answer'))}</p>
                    </div>
                    <p class="text-sm text-gray-600">${formatBreaks(escapeHtml(data.explanation || 'Explanation would appear here.'))}</p>
                </div>`;
        }
        if (type === 'image_description') {
            return `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(data.description || 'Description would appear here.'))}</p>
                    </div>
                </div>`;
        }
        if (type === 'audio_listening') {
            const transcript = data.transcript || data.notes || '';
            return `
                <div class="text-center">
                    <h3 class="text-2xl text-green-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    ${transcript ? `<div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3"><p class="text-lg">${formatBreaks(escapeHtml(transcript))}</p></div>` : '<p class="text-gray-500">(Transcript)</p>'}
                </div>`;
        }
        if (type === 'gap_fill') {
            const answers = data.correct_answers || ['answer'];
            return `
                <div class="text-center">
                    <h3 class="text-xl text-green-700 marker-underline mb-3">✓ Correct Answer</h3>
                    <div class="bg-green-50 p-4 rounded-xl border-2 border-green-300">
                        <p class="text-xl font-bold">${escapeHtml(answers.join(' / '))}</p>
                    </div>
                    ${data.example ? `<p class="text-md text-gray-600 mt-3">📝 Example: ${formatBreaks(escapeHtml(data.example))}</p>` : ''}
                </div>`;
        }
        const exList = data.examples || [];
        const exHtml = exList.length
            ? exList.map((ex, i) => `<p class="text-md text-gray-600">📝 Example ${i+1}: ${formatBreaks(escapeHtml(ex))}</p>`).join('')
            : (data.example1a ? `<p class="text-md text-gray-600">📝 Example: ${formatBreaks(escapeHtml(data.example1a))}</p>` : '');
        return `
            <div class="text-center">
                <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                    <p class="text-lg">${formatBreaks(escapeHtml(data.definition || 'Definition would appear here.'))}</p>
                </div>
                ${data.usage1 ? `<p class="text-md text-gray-600 mt-2">💡 Usage: ${formatBreaks(escapeHtml(data.usage1))}</p>` : ''}
                ${exHtml ? `<div class="mt-2">${exHtml}</div>` : ''}
                ${data.tip ? `<div class="mt-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3"><p class="text-md text-yellow-800">💡 Tip: ${formatBreaks(escapeHtml(data.tip))}</p></div>` : ''}
            </div>`;
    }

    // ── Apply editor to row ────────────────────────────────────
    function applyEditorToRow(idx) {
        if (idx < 0 || idx >= rows.length) return;
        const row = rows[idx];
        row.title = document.getElementById('editTitle')?.value || '';
        row.type = document.getElementById('editType')?.value || 'usage_cases';
        row.level = document.getElementById('editLevel')?.value || 'Beginner';

        const setId = document.getElementById('editSet')?.value || '';
        const setName = document.getElementById('editSet')?.options[document.getElementById('editSet').selectedIndex]?.text || '';
        row.set_id = setId;
        row._setName = setId ? setName : '';

        const type = row.type;

        if (type === 'multiple_choice' || type === 'image_mcq') {
            row.question_text = document.getElementById('editQuestionText')?.value || '';
            const opts = document.getElementById('editOptions')?.value || 'Option A, Option B, Option C';
            row.correct_index = parseInt(document.getElementById('editCorrectIndex')?.value) || 1;
            row.definition = '';
            row.usage1 = '';
            row.tip = '';
            row.image_url = type === 'image_mcq' ? (document.getElementById('editImageUrl')?.value || '') : '';
            row.explanation = document.getElementById('editExplanation')?.value || '';
            // Store in content_data as CSV columns
            const optArr = splitCSV(opts);
            for (let i = 0; i < 4; i++) row['opt' + (i + 1)] = optArr[i] || '';
            row.correct_answer = String(row.correct_index);
        } else if (type === 'gap_fill') {
            row.sentence = document.getElementById('editSentence')?.value || '';
            const answers = document.getElementById('editCorrectAnswers')?.value || 'answer';
            row.correct_answer = splitCSV(answers).join(',');
            row.example1 = document.getElementById('editExample')?.value || '';
            row.definition = '';
            row.usage1 = '';
            row.tip = '';
        } else if (type === 'image_description') {
            row.image_url = document.getElementById('editImageUrl')?.value || '';
            row.description = document.getElementById('editDescription')?.value || '';
            row.definition = row.description;
            row.usage1 = '';
            row.tip = '';
        } else if (type === 'audio_listening') {
            row.audio_url = document.getElementById('editAudioUrl')?.value || '';
            row.prompt = document.getElementById('editPrompt')?.value || '';
            const answers = document.getElementById('editCorrectAnswers')?.value || '';
            row.correct_answer = answers;
            row.transcript = document.getElementById('editNotes')?.value || '';
            row.definition = '';
            row.usage1 = '';
            row.tip = '';
        } else {
            row.image_url = document.getElementById('editImageUrl')?.value || '';
            row.audio_url = document.getElementById('editAudioUrl')?.value || '';
            row.definition = document.getElementById('editDefinition')?.value || '';
            row.usage1 = document.getElementById('editUsage')?.value || '';
            row.example1 = document.getElementById('editExample')?.value || '';
            row.example2 = document.getElementById('editExample2')?.value || '';
            row.tip = document.getElementById('editTip')?.value || '';
            const ff = [];
            if (document.getElementById('ffDefinition')?.checked) ff.push('definition');
            if (document.getElementById('ffUsage1')?.checked) ff.push('usage1');
            if (document.getElementById('ffExamples')?.checked) ff.push('examples');
            if (document.getElementById('ffTip')?.checked) ff.push('tip');
            row.front_fields = ff.join(',');
            row.question_text = '';
            row.sentence = '';
            row.correct_answer = '';
        }
    }

    // ── Export CSV ─────────────────────────────────────────────
    function buildCsvContent() {
        const cols = ['set','set_id','type','title','level','definition','question_text','sentence','example1','example2','usage1','tip','front_fields','correct_answer','explanation','image_url','audio_url','description','prompt','transcript'];
        const lines = [cols.join(';')];
        rows.forEach(row => {
            const vals = cols.map(col => {
                let val = '';
                if (col === 'set') val = row._setName || '';
                else if (col === 'set_id') val = row.set_id || '';
                else if (col === 'type') val = row.type || 'usage_cases';
                else if (col === 'level') val = row.level || 'Beginner';
                else if (col === 'title') val = row.title || '';
                else if (col === 'definition') val = row.definition || '';
                else if (col === 'question_text') val = row.question_text || '';
                else if (col === 'sentence') val = row.sentence || '';
                else if (col === 'example1') val = row.example1 || '';
                else if (col === 'example2') val = row.example2 || '';
                else if (col === 'usage1') val = row.usage1 || '';
                else if (col === 'tip') val = row.tip || '';
                else if (col === 'correct_answer') val = row.correct_answer || '';
                else if (col === 'explanation') val = row.explanation || '';
                else if (col === 'image_url') val = row.image_url || '';
                else if (col === 'audio_url') val = row.audio_url || '';
                else if (col === 'description') val = row.description || '';
                else if (col === 'prompt') val = row.prompt || '';
                else if (col === 'transcript') val = row.transcript || '';
                else val = row[col] || '';
                if (val.includes(';') || val.includes('"') || val.includes('\n')) val = '"' + val.replace(/"/g, '""') + '"';
                return val;
            });
            lines.push(vals.join(';'));
        });
        return lines.join('\n');
    }

    document.getElementById('saveCsvBtn')?.addEventListener('click', () => {
        if (rows.length === 0) { alert('No rows to save'); return; }
        applyEditorToRow(selectedIdx);
        const csv = buildCsvContent();
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = originalFile ? originalFile.name.replace('.csv', '_edited.csv') : 'export.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    });

    document.getElementById('importDbBtn')?.addEventListener('click', async () => {
        if (rows.length === 0) { alert('No rows to import'); return; }
        applyEditorToRow(selectedIdx);
        if (!confirm(`Import ${rows.length} cards into the database?`)) return;

        const csv = buildCsvContent();
        const blob = new Blob([csv], { type: 'text/csv' });
        const formData = new FormData();
        formData.append('csv', blob, (originalFile ? originalFile.name : 'import.csv'));

        try {
            const res = await adminFetch('api/import_csv.php', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                let msg = `✅ Imported ${result.imported} cards.`;
                if (result.errors.length) msg += `\n⚠️ ${result.errors.length} errors:\n` + result.errors.slice(0, 10).join('\n');
                if (result.errors.length > 10) msg += `\n...and ${result.errors.length - 10} more`;
                alert(msg);
            } else {
                alert('❌ Import failed: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('❌ Network error during import');
        }
    });
})();
</script>
</body>
</html>
