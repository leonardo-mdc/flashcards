(function () {
    let currentCards = [];
    let currentEditingCard = null;
    let selectedCardId = null;
    let currentSetId = null;

    const setSelector = document.getElementById('setSelector');
    const cardListContainer = document.getElementById('cardListContainer');
    const editCardId = document.getElementById('editCardId');
    const editTitle = document.getElementById('editTitle');
    const editPatternType = document.getElementById('editPatternType');
    const editLevel = document.getElementById('editLevel');
    const editSetId = document.getElementById('editSetId');
    const editFieldsContainer = document.getElementById('editFieldsContainer');
    const frontPreviewContent = document.getElementById('frontPreviewContent');
    const backPreviewContent = document.getElementById('backPreviewContent');

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
    }

    function formatBreaks(text) {
        if (!text) return '';
        let s = String(text);
        s = s.replace(/\\br ?/g, '<br>');
        s = s.replace(/\\b(.*?)\\b/g, '<b>$1</b>');
        s = s.replace(/\\i(.*?)\\i/g, '<i>$1</i>');
        s = s.replace(/\\u(.*?)\\u/g, '<u>$1</u>');
        s = s.replace(/\\em(.*?)\\em/g, '<em>$1</em>');
        s = s.replace(/\\strong(.*?)\\strong/g, '<strong>$1</strong>');
        return s;
    }

    async function loadCardSets() {
        const response = await fetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success && data.sets) {
            const currentVal = setSelector.value;
            setSelector.innerHTML = '<option value="">-- Choose Card Set --</option>';
            data.sets.forEach(set => {
                setSelector.innerHTML += `<option value="${set.id}">${escapeHtml(set.name)}</option>`;
            });
            if (currentVal) setSelector.value = currentVal;
        }
    }

    async function loadCards(setId) {
        if (!setId) {
            cardListContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Select a card set to load cards</div>';
            return;
        }
        currentSetId = setId;

        const levels = [];
        if (document.getElementById('levelBeginner').checked) levels.push('Beginner');
        if (document.getElementById('levelIntermediate').checked) levels.push('Intermediate');
        if (document.getElementById('levelAdvanced').checked) levels.push('Advanced');

        cardListContainer.innerHTML = '<div class="text-center py-8"><div class="loader"></div> Loading cards...</div>';

        const response = await fetch(`admin_cards.php?action=get_cards&set_id=${setId}&t=${Date.now()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success) {
            currentCards = data.cards;
            renderCardList(levels);
        } else {
            cardListContainer.innerHTML = '<div class="text-center text-red-500 py-8">Error loading cards</div>';
        }
    }

    function getSearchTerm() {
        const input = document.getElementById('cardSearchInput');
        return input ? input.value.trim().toLowerCase() : '';
    }

    function renderCardList(levelFilter = []) {
        let filteredCards = currentCards;

        const searchTerm = getSearchTerm();
        if (searchTerm) {
            filteredCards = filteredCards.filter(card =>
                (card.title || '').toLowerCase().includes(searchTerm)
            );
        }

        if (levelFilter.length > 0) {
            filteredCards = filteredCards.filter(card => levelFilter.includes(card.level));
        }

        if (!filteredCards.length) {
            cardListContainer.innerHTML = '<div class="text-center text-gray-500 py-8">No cards matching filter in this set</div>';
            return;
        }

        let html = '';
        filteredCards.forEach(card => {
            const isSelected = (selectedCardId === card.id);
            let typeLabel = '';
            let typeClass = '';
            if (card.pattern_type === 'multiple_choice') {
                typeLabel = 'MCQ';
                typeClass = 'mcq';
            } else if (card.pattern_type === 'gap_fill') {
                typeLabel = 'Gap';
                typeClass = 'gap';
            } else {
                typeLabel = 'Text';
                typeClass = 'text';
            }
            html += `
                <div class="card-item ${isSelected ? 'selected' : ''}" data-id="${card.id}">
                    <div class="flex justify-between items-center">
                        <span class="card-title">${escapeHtml(card.title || 'Untitled')}</span>
                        <span class="card-type ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="card-meta">${escapeHtml(card.level || 'Beginner')} · ID ${card.id}</div>
                </div>
            `;
        });
        cardListContainer.innerHTML = html;

        document.querySelectorAll('.card-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.id);
                const card = currentCards.find(c => c.id === id);
                if (card) loadCardIntoEditor(card);
                document.querySelectorAll('.card-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedCardId = id;
            });
        });
    }

    function loadCardIntoEditor(card) {
        currentEditingCard = card;
        editCardId.value = card.id;
        editTitle.value = card.title || '';
        editPatternType.value = card.pattern_type || 'usage_cases';
        editLevel.value = card.level || 'Beginner';
        if (editSetId) editSetId.value = card.set_id || 1;

        let contentData = card.content_data || {};
        if (typeof contentData === 'string') {
            try { contentData = JSON.parse(contentData); } catch (e) { contentData = {}; }
        }

        renderEditFields(card.pattern_type || 'usage_cases', contentData);
        updatePreviews();
    }

    function renderEditFields(patternType, contentData) {
        let html = '';

        if (patternType === 'multiple_choice') {
            const options = (contentData.options || ['Option A', 'Option B', 'Option C']).join(', ');
            const correctIdx = contentData.correct_index !== undefined ? contentData.correct_index : 1;
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Question Text:</label>
                    <input type="text" id="editQuestionText" class="form-input" value="${escapeHtml(contentData.question_text || '')}" placeholder="What is the question?">
                </div>
                <div>
                    <label class="block font-bold mb-1">Options (comma separated):</label>
                    <input type="text" id="editOptions" class="form-input" value="${escapeHtml(options)}" placeholder="Option A, Option B, Option C">
                    <div class="help-text">Example: Go, Goes, Going, Went</div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold mb-1">Correct Index (0,1,2...):</label>
                        <input type="number" id="editCorrectIndex" class="form-input" value="${correctIdx}" min="0">
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-1">Explanation (optional):</label>
                    <textarea id="editExplanation" class="form-textarea" rows="3" placeholder="Explain why this is correct...\brUse \br for line breaks">${escapeHtml(contentData.explanation || '')}</textarea>
                </div>
            `;
        } else if (patternType === 'gap_fill') {
            const correctAnswers = (contentData.correct_answers || ['answer']).join(', ');
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Sentence with ______ (blank):</label>
                    <textarea id="editSentence" class="form-textarea" rows="3" placeholder="They ______ to school every day.\brI ______ (study) more for the test.">${escapeHtml(contentData.sentence || '')}</textarea>
                    <div class="help-text">Use ______ to indicate the blank space</div>
                </div>
                <div>
                    <label class="block font-bold mb-1">Correct Answer(s) (comma separated):</label>
                    <input type="text" id="editCorrectAnswers" class="form-input" value="${escapeHtml(correctAnswers)}" placeholder="go, goes">
                    <div class="help-text">Multiple possible answers: go, goes, went</div>
                </div>
                <div>
                    <label class="block font-bold mb-1">Example Sentence (optional):</label>
                    <textarea id="editExample" class="form-textarea" rows="2" placeholder="Example showing correct usage\brUse \br for line breaks">${escapeHtml(contentData.example || '')}</textarea>
                </div>
            `;
        } else {
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Definition / Description:</label>
                    <textarea id="editDefinition" class="form-textarea" rows="5" placeholder="Enter the definition or description...\brUse \br to create line breaks">${escapeHtml(contentData.definition || contentData.usage1 || '')}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Example (optional):</label>
                    <textarea id="editExample" class="form-textarea" rows="3" placeholder="Example sentence showing usage\brUse \br for line breaks">${escapeHtml(contentData.example1a || contentData.example || '')}</textarea>
                </div>
            `;
        }

        editFieldsContainer.innerHTML = html;
    }

    function getCurrentContentData() {
        const patternType = editPatternType.value;
        const contentData = {};

        if (patternType === 'multiple_choice') {
            const optionsInput = document.getElementById('editOptions');
            const options = optionsInput ? optionsInput.value.split(',').map(s => s.trim()) : ['Option A', 'Option B', 'Option C'];
            const correctIdx = document.getElementById('editCorrectIndex');
            contentData.options = options;
            contentData.correct_index = correctIdx ? parseInt(correctIdx.value) : 1;
            contentData.question_text = document.getElementById('editQuestionText')?.value || '';
            contentData.explanation = document.getElementById('editExplanation')?.value || '';
        } else if (patternType === 'gap_fill') {
            const answersInput = document.getElementById('editCorrectAnswers');
            contentData.sentence = document.getElementById('editSentence')?.value || '';
            contentData.correct_answers = answersInput ? answersInput.value.split(',').map(s => s.trim()) : ['answer'];
            contentData.example = document.getElementById('editExample')?.value || '';
        } else {
            contentData.definition = document.getElementById('editDefinition')?.value || '';
            contentData.example = document.getElementById('editExample')?.value || '';
        }

        return contentData;
    }

    let previewFlipped = false;

    function updatePreviews() {
        const patternType = editPatternType.value;
        const title = editTitle.value || 'Flashcard';
        const contentData = getCurrentContentData();

        let frontHtml = '';
        if (patternType === 'multiple_choice') {
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            frontHtml = `
                <div class="text-center">
                    <div class="text-4xl mb-3">❓</div>
                    <p class="text-lg mb-4 font-bold">${escapeHtml(contentData.question_text || 'Select the correct answer:')}</p>
                    ${options.map((opt, idx) => `<div class="quiz-option-preview text-base">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    <p class="text-xs text-gray-400 mt-3">👆 Tap card to flip</p>
                </div>
            `;
        } else if (patternType === 'gap_fill') {
            frontHtml = `
                <div class="text-center">
                    <div class="text-4xl mb-3">✏️</div>
                    <p class="text-lg mb-4 font-bold">Complete the sentence:</p>
                    <p class="text-base bg-gray-100 p-3 rounded-xl">${escapeHtml(contentData.sentence || 'Complete: ______')}</p>
                    <input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6">
                    <p class="text-xs text-gray-400 mt-3">👆 Tap card to flip</p>
                </div>
            `;
        } else {
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-4xl text-center font-bold">${escapeHtml(title)}</div>
                    <p class="text-xs text-gray-400 mt-4">👆 Tap card to flip</p>
                </div>
            `;
        }

        let backHtml = '';
        if (patternType === 'multiple_choice') {
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            const correctIdx = contentData.correct_index || 1;
            backHtml = `
                <div class="text-center">
                    <h3 class="text-xl text-green-700 marker-underline mb-3">✓ Answer</h3>
                    <div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3">
                        <p class="text-xl font-bold">${String.fromCharCode(65+correctIdx)}. ${escapeHtml(options[correctIdx] || 'Correct Answer')}</p>
                    </div>
                    <p class="text-sm text-gray-600">${formatBreaks(escapeHtml(contentData.explanation || 'Explanation would appear here.'))}</p>
                </div>
            `;
        } else if (patternType === 'gap_fill') {
            const answers = contentData.correct_answers || ['answer'];
            backHtml = `
                <div class="text-center">
                    <h3 class="text-xl text-green-700 marker-underline mb-3">✓ Correct Answer</h3>
                    <div class="bg-green-50 p-4 rounded-xl border-2 border-green-300">
                        <p class="text-xl font-bold">${escapeHtml(answers.join(' / '))}</p>
                    </div>
                    ${contentData.example ? `<p class="text-md text-gray-600 mt-3">📝 Example: ${formatBreaks(escapeHtml(contentData.example))}</p>` : ''}
                </div>
            `;
        } else {
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(contentData.definition || 'Definition would appear here.'))}</p>
                    </div>
                    ${contentData.example ? `<p class="text-md text-gray-600 mt-3">📝 Example: ${formatBreaks(escapeHtml(contentData.example))}</p>` : ''}
                </div>
            `;
        }

        frontPreviewContent.innerHTML = frontHtml;
        backPreviewContent.innerHTML = backHtml;
        previewFlipped = false;

        document.querySelectorAll('.card-preview').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', function previewClick(e) {
                e.stopPropagation();
                previewFlipped = !previewFlipped;
                const front = this.querySelector('.card-front-preview');
                const back = this.querySelector('.card-back-preview');
                if (front && back) {
                    if (previewFlipped) {
                        front.style.display = 'none';
                        back.style.display = 'flex';
                    } else {
                        front.style.display = 'flex';
                        back.style.display = 'none';
                    }
                }
            });
        });
    }

    async function saveCard() {
        const patternType = editPatternType.value;
        const contentData = getCurrentContentData();

        const cardData = {
            id: parseInt(editCardId.value) || 0,
            set_id: editSetId ? parseInt(editSetId.value) : (parseInt(setSelector.value) || 1),
            title: editTitle.value,
            pattern_type: patternType,
            level: editLevel.value,
            question_text: patternType === 'multiple_choice' ? contentData.question_text : '',
            content_data: contentData
        };

        const response = await fetch('admin_cards.php?action=save_card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(cardData)
        });
        const result = await response.json();
        if (result.success) {
            alert('Card saved successfully!');
            if (setSelector.value) loadCards(setSelector.value);
            if (result.id && (!editCardId.value || editCardId.value == 0)) {
                editCardId.value = result.id;
            }
        } else {
            alert('Error saving card');
        }
    }

    async function deleteCard() {
        const cardId = parseInt(editCardId.value);
        if (!cardId) {
            alert('No card selected to delete');
            return;
        }
        if (confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
            const response = await fetch(`admin_cards.php?action=delete_card&card_id=${cardId}`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const result = await response.json();
            if (result.success) {
                alert('Card deleted successfully!');
                newCard();
                if (setSelector.value) loadCards(setSelector.value);
            } else {
                alert('Error deleting card');
            }
        }
    }

    function newCard() {
        editCardId.value = '0';
        editTitle.value = '';
        editPatternType.value = 'usage_cases';
        editLevel.value = 'Beginner';
        if (editSetId) editSetId.value = setSelector.value || '1';
        renderEditFields('usage_cases', {});
        updatePreviews();
        selectedCardId = null;
        document.querySelectorAll('.card-item').forEach(i => i.classList.remove('selected'));
    }

    function revertCard() {
        if (selectedCardId && currentEditingCard) {
            loadCardIntoEditor(currentEditingCard);
        } else {
            newCard();
        }
    }

    const cardEditorSection = document.getElementById('cardEditorSection');
    const userManagementSection = document.getElementById('userManagementSection');
    const userListContainer = document.getElementById('userListContainer');

    function showCardEditor() {
        if (cardEditorSection) cardEditorSection.classList.remove('hidden');
        if (userManagementSection) userManagementSection.classList.add('hidden');
    }

    function showUserManagement() {
        if (cardEditorSection) cardEditorSection.classList.add('hidden');
        if (userManagementSection) userManagementSection.classList.remove('hidden');
        loadUsers();
    }

    async function loadUsers() {
        if (!userListContainer) return;
        userListContainer.innerHTML = '<div class="text-center py-4"><div class="loader"></div> Loading users...</div>';

        const response = await fetch('admin_cards.php?action=get_users&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success && data.users) {
            renderUsers(data.users);
        } else {
            userListContainer.innerHTML = '<div class="text-center text-red-500 py-4">Error loading users</div>';
        }
    }

    function renderUsers(users) {
        if (!users.length) {
            userListContainer.innerHTML = '<div class="text-center text-gray-500 py-4">No users found</div>';
            return;
        }

        let html = '<table class="users-table">';
        html += '<tr><th>Name</th><th>Username</th><th>Role</th><th>Progress</th><th>Level</th><th>Actions</th></tr>';
        users.forEach(user => {
            html += `<tr>
                <td>${escapeHtml(user.full_name || user.username)}</td>
                <td>${escapeHtml(user.username)}</td>
                <td>${user.is_admin ? '<span class="card-type mcq">Admin</span>' : '<span class="card-type text">Student</span>'}</td>
                <td>${user.progress || 0}%</td>
                <td>${escapeHtml(user.english_level || 'Beginner')}</td>
                <td>
                    <button class="edit-user-btn btn btn-primary btn-xs" data-id="${user.id}" data-username="${escapeHtml(user.username)}" data-fullname="${escapeHtml(user.full_name || '')}" data-level="${escapeHtml(user.english_level || 'Beginner')}" data-admin="${user.is_admin}">✏️</button>
                    <button class="reset-user-btn btn btn-warning btn-xs" data-id="${user.id}">🔄</button>
                    <button class="delete-user-btn btn btn-danger btn-xs" data-id="${user.id}">🗑</button>
                </td>
            </tr>`;
        });
        html += '</table>';

        userListContainer.innerHTML = html;

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openEditUserModal(btn.dataset);
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = parseInt(btn.dataset.id);
                if (confirm('Delete this user? This action cannot be undone.')) {
                    const response = await fetch(`admin_cards.php?action=delete_user&user_id=${userId}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    const result = await response.json();
                    if (result.success) {
                        loadUsers();
                    } else {
                        alert(result.error || 'Error deleting user');
                    }
                }
            });
        });

        document.querySelectorAll('.reset-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = parseInt(btn.dataset.id);
                if (confirm('Reset all progress for this user? This will clear review history and progress.')) {
                    const response = await fetch(`admin_cards.php?action=reset_user_progress&user_id=${userId}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    const result = await response.json();
                    if (result.success) {
                        alert('Progress reset successfully');
                        loadUsers();
                    } else {
                        alert(result.error || 'Error resetting progress');
                    }
                }
            });
        });
    }

    function openEditUserModal(data) {
        const existing = document.getElementById('editUserModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'editUserModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
        modal.innerHTML = `
            <div class="whiteboard-card" style="max-width:500px;width:90%;padding:24px;max-height:80vh;overflow-y:auto;">
                <h3 class="text-lg marker-underline mb-3">✏️ Edit User</h3>
                <input type="hidden" id="editUserId" value="${data.id}">
                <label class="block font-bold mb-1">Username:</label>
                <input type="text" id="editUserUsername" class="form-input" value="${data.username}" maxlength="30">
                <label class="block font-bold mb-1">Full Name:</label>
                <input type="text" id="editUserFullName" class="form-input" value="${data.fullname}">
                <label class="block font-bold mb-1">English Level:</label>
                <select id="editUserLevel" class="form-select">
                    <option value="Beginner" ${data.level === 'Beginner' ? 'selected' : ''}>🔰 Beginner</option>
                    <option value="Intermediate" ${data.level === 'Intermediate' ? 'selected' : ''}>📚 Intermediate</option>
                    <option value="Advanced" ${data.level === 'Advanced' ? 'selected' : ''}>🎓 Advanced</option>
                </select>
                <label class="flex items-center gap-2 my-2">
                    <input type="checkbox" id="editUserIsAdmin" value="1" ${data.admin === 'true' || data.admin === '1' ? 'checked' : ''}>
                    <span class="font-bold">Admin privileges</span>
                </label>
                <div class="mt-3 mb-2">
                    <label class="block font-bold mb-1">📚 Visible Card Sets:</label>
                    <p class="text-xs text-gray-500 mb-2">Leave all unchecked to show all sets</p>
                    <div id="userSetAccessContainer" class="space-y-1">
                        <div class="text-sm text-gray-400">Loading sets...</div>
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <button id="saveEditUserBtn" class="btn btn-success flex-1">💾 Save</button>
                    <button id="cancelEditUserBtn" class="btn btn-secondary flex-1">Cancel</button>
                </div>
                <p id="editUserError" class="text-red-600 text-center mt-2 hidden"></p>
            </div>
        `;
        document.body.appendChild(modal);

        // Load card sets and user's current access
        (async () => {
            const [setsRes, accessRes] = await Promise.all([
                fetch('admin_cards.php?action=get_sets&t=' + Date.now(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
                fetch(`admin_cards.php?action=get_user_sets&user_id=${data.id}&t=${Date.now()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            ]);
            const setsData = await setsRes.json();
            const accessData = await accessRes.json();
            const allSets = setsData.success ? setsData.sets : [];
            const userSetIds = accessData.success ? accessData.set_ids : [];
            const container = document.getElementById('userSetAccessContainer');
            if (allSets.length === 0) {
                container.innerHTML = '<div class="text-sm text-gray-400">No card sets available</div>';
            } else {
                container.innerHTML = allSets.map(set => `
                    <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" class="user-set-checkbox" value="${set.id}" ${userSetIds.includes(set.id) ? 'checked' : ''}>
                        ${escapeHtml(set.name)}
                    </label>
                `).join('');
            }
        })();

        document.getElementById('cancelEditUserBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        document.getElementById('saveEditUserBtn').addEventListener('click', async () => {
            const id = parseInt(document.getElementById('editUserId').value);
            const username = document.getElementById('editUserUsername').value.trim();
            const fullName = document.getElementById('editUserFullName').value.trim();
            const englishLevel = document.getElementById('editUserLevel').value;
            const isAdmin = document.getElementById('editUserIsAdmin').checked;

            if (!username) { alert('Username is required'); return; }

            const response = await fetch('admin_cards.php?action=update_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ id, username, full_name: fullName, english_level: englishLevel, is_admin: isAdmin })
            });
            const result = await response.json();
            if (!result.success) { alert(result.error || 'Error saving user'); return; }

            const checkedSets = [...document.querySelectorAll('.user-set-checkbox:checked')].map(cb => parseInt(cb.value));
            await fetch('admin_cards.php?action=set_user_sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ user_id: id, set_ids: checkedSets })
            });

            modal.remove();
            loadUsers();
        });
    }

    async function createUser() {
        const username = document.getElementById('newUserUsername')?.value.trim();
        const fullName = document.getElementById('newUserFullName')?.value.trim();
        const password = document.getElementById('newUserPassword')?.value;
        const englishLevel = document.getElementById('newUserLevel')?.value || 'Beginner';
        const isAdmin = document.getElementById('newUserIsAdmin')?.checked || false;

        if (!username) { alert('Username is required'); return; }
        if (!password || password.length < 6) { alert('Password must be at least 6 characters'); return; }

        const response = await fetch('admin_cards.php?action=create_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ username, full_name: fullName, password, english_level: englishLevel, is_admin: isAdmin })
        });
        const result = await response.json();
        if (result.success) {
            alert('User created successfully!');
            document.getElementById('newUserUsername').value = '';
            document.getElementById('newUserFullName').value = '';
            document.getElementById('newUserPassword').value = '';
            document.getElementById('newUserLevel').value = 'Beginner';
            document.getElementById('newUserIsAdmin').checked = false;
            loadUsers();
        } else {
            alert(result.error || 'Error creating user');
        }
    }

    setSelector.addEventListener('change', () => {
        if (setSelector.value) {
            loadCards(setSelector.value);
            newCard();
        } else {
            cardListContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Select a card set to load cards</div>';
        }
    });

    editPatternType.addEventListener('change', () => {
        const currentContent = getCurrentContentData();
        renderEditFields(editPatternType.value, currentContent);
        updatePreviews();
    });

    editTitle.addEventListener('input', () => updatePreviews());

    document.getElementById('saveCardBtn').addEventListener('click', saveCard);
    document.getElementById('revertCardBtn').addEventListener('click', revertCard);
    document.getElementById('newCardBtn').addEventListener('click', newCard);
    document.getElementById('deleteCardBtn').addEventListener('click', deleteCard);
    document.getElementById('filterCardsBtn').addEventListener('click', () => {
        if (setSelector.value) loadCards(setSelector.value);
    });

    const searchInput = document.getElementById('cardSearchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const levels = [];
                if (document.getElementById('levelBeginner').checked) levels.push('Beginner');
                if (document.getElementById('levelIntermediate').checked) levels.push('Intermediate');
                if (document.getElementById('levelAdvanced').checked) levels.push('Advanced');
                renderCardList(levels);
            }, 200);
        });
    }

    setInterval(() => {
        if (document.activeElement && (document.activeElement.classList?.contains('form-input') ||
            document.activeElement.classList?.contains('form-textarea'))) {
            updatePreviews();
        }
    }, 500);

    document.getElementById('toggleUsersBtn')?.addEventListener('click', showUserManagement);
    document.getElementById('backToCardsBtn')?.addEventListener('click', showCardEditor);
    document.getElementById('createUserBtn')?.addEventListener('click', createUser);

    // --- Manage Sets ---
    const manageSetsModal = document.getElementById('manageSetsModal');
    const setListContainer = document.getElementById('setListContainer');

    async function loadSetsList() {
        if (!setListContainer) return;
        setListContainer.innerHTML = '<div class="text-center text-gray-500 py-4"><div class="loader"></div> Loading...</div>';
        const response = await fetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (!data.success || !data.sets) {
            setListContainer.innerHTML = '<div class="text-center text-red-500 py-4">Error loading sets</div>';
            return;
        }
        let html = '';
        data.sets.forEach(set => {
            html += `
                <div class="set-item" data-id="${set.id}">
                    <span class="set-name-display font-bold">${escapeHtml(set.name)}</span>
                    <input type="text" class="set-name-input hidden" value="${escapeHtml(set.name)}">
                    <button class="edit-set-btn btn btn-primary btn-xs">✏️</button>
                    <button class="save-set-btn btn btn-success btn-xs hidden">💾</button>
                    <button class="cancel-set-btn btn btn-secondary btn-xs hidden">✕</button>
                    <button class="delete-set-btn btn btn-danger btn-xs">🗑</button>
                </div>`;
        });
        setListContainer.innerHTML = html;

        document.querySelectorAll('.edit-set-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.set-item');
                item.querySelector('.set-name-display').classList.add('hidden');
                item.querySelector('.set-name-input').classList.remove('hidden');
                btn.classList.add('hidden');
                item.querySelector('.save-set-btn').classList.remove('hidden');
                item.querySelector('.cancel-set-btn').classList.remove('hidden');
                item.querySelector('.delete-set-btn').classList.add('hidden');
                item.querySelector('.set-name-input').focus();
            });
        });

        document.querySelectorAll('.cancel-set-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.set-item');
                item.querySelector('.set-name-display').classList.remove('hidden');
                item.querySelector('.set-name-input').classList.add('hidden');
                item.querySelector('.edit-set-btn').classList.remove('hidden');
                btn.classList.add('hidden');
                item.querySelector('.save-set-btn').classList.add('hidden');
                item.querySelector('.cancel-set-btn').classList.add('hidden');
                item.querySelector('.delete-set-btn').classList.remove('hidden');
                item.querySelector('.set-name-input').value = item.querySelector('.set-name-display').textContent.trim();
            });
        });

        document.querySelectorAll('.save-set-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const name = item.querySelector('.set-name-input').value.trim();
                if (!name) { alert('Name cannot be empty'); return; }
                const response = await fetch('admin_cards.php?action=update_set', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify({ id, name })
                });
                const result = await response.json();
                if (result.success) {
                    await refreshSets();
                    loadSetsList();
                } else {
                    alert(result.error || 'Error updating set');
                }
            });
        });

        document.querySelectorAll('.delete-set-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                if (confirm('Delete this card set? Cards in this set will remain but become orphaned.')) {
                    const response = await fetch(`admin_cards.php?action=delete_set&set_id=${id}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    const result = await response.json();
                    if (result.success) {
                        await refreshSets();
                        loadSetsList();
                    } else {
                        alert(result.error || 'Error deleting set');
                    }
                }
            });
        });
    }

    async function refreshSets() {
        const response = await fetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success && data.sets) {
            const populateSelect = (sel, currentVal) => {
                sel.innerHTML = '<option value="">-- Choose Card Set --</option>';
                data.sets.forEach(set => {
                    sel.innerHTML += `<option value="${set.id}">${escapeHtml(set.name)}</option>`;
                });
                if (currentVal) sel.value = currentVal;
            };

            const currentVal = setSelector.value;
            populateSelect(setSelector, currentVal);

            if (editSetId) {
                const currentEditVal = editSetId.value;
                populateSelect(editSetId, currentEditVal);
            }

            // Also update import modal selectors if they exist
            if (importSetSelector) {
                const currentImportVal = importSetSelector.value;
                populateSelect(importSetSelector, currentImportVal);
            }
            if (importEditSetId) {
                const currentImportEditVal = importEditSetId.value;
                populateSelect(importEditSetId, currentImportEditVal);
            }
        }
    }

    document.getElementById('manageSetsBtn')?.addEventListener('click', () => {
        manageSetsModal.classList.remove('hidden');
        loadSetsList();
    });

    document.getElementById('closeSetsModalBtn')?.addEventListener('click', () => {
        manageSetsModal.classList.add('hidden');
    });

    manageSetsModal?.addEventListener('click', (e) => {
        if (e.target === manageSetsModal) manageSetsModal.classList.add('hidden');
    });

    document.getElementById('addSetBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('newSetNameInput');
        const name = input.value.trim();
        if (!name) { alert('Enter a name for the new set'); return; }
        const response = await fetch('admin_cards.php?action=create_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name })
        });
        const result = await response.json();
        if (result.success) {
            input.value = '';
            await refreshSets();
            loadSetsList();
        } else {
            alert(result.error || 'Error creating set');
        }
    });

    document.getElementById('newSetNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('addSetBtn').click();
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 's' || e.key === 'S') saveCard();
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newCard(); }
        if (e.key === 'd' || e.key === 'D') deleteCard();
        if (e.key === 'r' || e.key === 'R') revertCard();
        if (e.key === '?' || e.key === 'H' || e.key === 'h') {
            alert('Shortcuts: S=Save  N=New  D=Delete  R=Revert  ?=Help');
        }
    });

    // --- Import CSV Modal ---
    let importRows = [];
    let importHeader = [];
    let importSelectedIdx = -1;
    let importFileHandle = null;

    const importModal = document.getElementById('importModal');
    const importStepFile = document.getElementById('importStepFile');
    const importStepPreview = document.getElementById('importStepPreview');
    const importDropZone = document.getElementById('importDropZone');
    const importFileInput = document.getElementById('importFileInput');
    const importFileName = document.getElementById('importFileName');
    const importRowCount = document.getElementById('importRowCount');
    const importPreviewBody = document.getElementById('importPreviewBody');
    const importSetSelector = document.getElementById('importSetSelector');
    const importApplySetAll = document.getElementById('importApplySetAll');
    const importNewSetName = document.getElementById('importNewSetName');
    const importEditTitle = document.getElementById('importEditTitle');
    const importEditSetId = document.getElementById('importEditSetId');
    const importEditStyle = document.getElementById('importEditStyle');
    const importEditLevel = document.getElementById('importEditLevel');
    const importEditDefinition = document.getElementById('importEditDefinition');
    const importEditExtra = document.getElementById('importEditExtra');
    const importSelectAll = document.getElementById('importSelectAll');
    const importCardPreview = document.getElementById('importCardPreview');

    function openImportModal() {
        importModal.classList.remove('hidden');
        importStepFile.classList.remove('hidden');
        importStepPreview.classList.add('hidden');
        importRows = [];
        importHeader = [];
        importSelectedIdx = -1;
        importFileHandle = null;
        importFileName.textContent = '';
        importRowCount.textContent = '';
        importPreviewBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-4">No data</td></tr>';
        if (importSelectAll) importSelectAll.checked = true;
        resetImportCardPreview();
    }

    function resetImportCardPreview() {
        if (importCardPreview) {
            importCardPreview.innerHTML = `
                <div class="import-flip-front">
                    <div class="text-gray-400 text-sm text-center p-4">Select a row to preview</div>
                </div>
                <div class="import-flip-back">
                    <div class="text-gray-400 text-sm text-center p-4">Back side</div>
                </div>
            `;
        }
    }

    function closeImportModal() {
        importModal.classList.add('hidden');
    }

    // Drop zone / file picker
    importDropZone.addEventListener('click', () => importFileInput.click());

    importDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        importDropZone.classList.add('dragover');
    });
    importDropZone.addEventListener('dragleave', () => {
        importDropZone.classList.remove('dragover');
    });
    importDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        importDropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            loadCsvPreview(files[0]);
        } else {
            alert('Please drop a .csv file');
        }
    });

    importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadCsvPreview(e.target.files[0]);
        }
    });

    document.getElementById('importChangeFileBtn')?.addEventListener('click', () => {
        importFileInput.click();
    });

    document.getElementById('importCancelBtn')?.addEventListener('click', closeImportModal);
    document.getElementById('closeImportBtn')?.addEventListener('click', closeImportModal);
    importModal?.addEventListener('click', (e) => {
        if (e.target === importModal) closeImportModal();
    });

    document.getElementById('importCsvBtn')?.addEventListener('click', openImportModal);

    // Select all / deselect all
    importSelectAll?.addEventListener('change', () => {
        const checked = importSelectAll.checked;
        importRows.forEach(row => { row._selected = checked; });
        renderImportPreview();
        if (importSelectedIdx >= 0) selectImportRow(importSelectedIdx);
    });

    async function loadCsvPreview(file) {
        importFileHandle = file;
        importFileName.textContent = file.name;

        const formData = new FormData();
        formData.append('csv', file);

        importPreviewBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="loader"></div> Parsing CSV...</td></tr>';

        try {
            const response = await fetch('admin_cards.php?action=preview_csv&t=' + Date.now(), {
                method: 'POST',
                body: formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const result = await response.json();

            if (!result.success) {
                alert('❌ ' + (result.error || 'Failed to parse CSV'));
                return;
            }

            importHeader = result.header || [];
            importRows = (result.rows || []).map(row => {
                const levelMap = {
                    'beginner': 'Beginner', 'a1': 'Beginner', 'a2': 'Beginner',
                    'intermediate': 'Intermediate', 'b1': 'Intermediate', 'b2': 'Intermediate',
                    'advanced': 'Advanced', 'c1': 'Advanced', 'c2': 'Advanced',
                };
                let level = (row.level || 'Beginner').trim();
                level = levelMap[level.toLowerCase()] || level;
                let type = (row.type || 'usage_cases').trim().toLowerCase();
                const validTypes = ['usage_cases', 'deep_dive', 'formula_table', 'multiple_choice', 'gap_fill'];
                if (!validTypes.includes(type)) type = 'usage_cases';
                return {
                    ...row,
                    _setName: (row.set || '').trim(),
                    _selected: true,
                    type: type,
                    level: level,
                };
            });

            importRowCount.textContent = `(${result.total} rows)`;
            renderImportPreview();
            importStepFile.classList.add('hidden');
            importStepPreview.classList.remove('hidden');

        } catch (err) {
            alert('❌ Network error during CSV preview');
        }
    }

    function renderImportPreview() {
        const styleLabels = {
            usage_cases: '📘 Usage Cases',
            deep_dive: '🧠 Deep Dive',
            formula_table: '📐 Formula Table',
            multiple_choice: '❓ MCQ',
            gap_fill: '✏️ Gap Fill',
        };

        let selectedCount = 0;
        let html = '';
        importRows.forEach((row, idx) => {
            const isSelected = idx === importSelectedIdx;
            const style = row.type || 'usage_cases';
            const title = row.title || 'Untitled';
            const level = row.level || 'Beginner';
            const setName = row._setName || '';
            const preview = row.definition || row.question_text || row.sentence || '';
            const previewTrim = preview.length > 60 ? preview.substring(0, 60) + '...' : preview;
            const styleClass = style === 'multiple_choice' ? 'mcq' : (style === 'gap_fill' ? 'gap' : 'text');
            const checked = row._selected !== false;
            if (checked) selectedCount++;

            html += `<tr class="${isSelected ? 'selected' : ''} ${!checked ? 'dimmed' : ''}" data-idx="${idx}">
                <td><input type="checkbox" class="import-row-checkbox" data-idx="${idx}" ${checked ? 'checked' : ''}></td>
                <td class="text-gray-400 text-xs">${idx + 1}</td>
                <td>${escapeHtml(setName)}</td>
                <td><span class="card-type ${styleClass}">${styleLabels[style] || style}</span></td>
                <td class="import-row-title">${escapeHtml(title)}</td>
                <td><span class="text-xs bg-gray-100 px-2 py-0.5 rounded">${escapeHtml(level)}</span></td>
                <td class="text-gray-500 text-xs">${escapeHtml(previewTrim)}</td>
            </tr>`;
        });

        importPreviewBody.innerHTML = html;
        updateImportRowCount(selectedCount);

        // Row click (excluding checkbox clicks)
        importPreviewBody.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const idx = parseInt(tr.dataset.idx);
                selectImportRow(idx);
            });
        });

        // Checkbox toggle
        importPreviewBody.querySelectorAll('.import-row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (idx >= 0 && idx < importRows.length) {
                    importRows[idx]._selected = e.target.checked;
                }
                renderImportPreview();
                if (importSelectedIdx >= 0) selectImportRow(importSelectedIdx);
                updateImportSelectAll();
            });
        });

        if (importRows.length > 0 && importSelectedIdx < 0) {
            selectImportRow(0);
        } else if (importSelectedIdx >= 0 && importSelectedIdx < importRows.length) {
            renderImportCardPreview(importRows[importSelectedIdx]);
        }
    }

    function updateImportRowCount(selectedCount) {
        const total = importRows.length;
        importRowCount.textContent = selectedCount === total
            ? `(${total} rows)`
            : `(${selectedCount}/${total} selected)`;
    }

    function updateImportSelectAll() {
        if (!importSelectAll) return;
        const allChecked = importRows.every(r => r._selected !== false);
        importSelectAll.checked = allChecked;
        importSelectAll.indeterminate = !allChecked && importRows.some(r => r._selected !== false);
    }

    function selectImportRow(idx) {
        if (idx < 0 || idx >= importRows.length) return;
        importSelectedIdx = idx;
        const row = importRows[idx];

        importEditTitle.value = row.title || '';
        importEditStyle.value = row.type || 'usage_cases';
        importEditLevel.value = row.level || 'Beginner';

        // Try to determine the best set_id from _setName
        const setName = row._setName || '';
        let matchedSetId = '';
        if (setName) {
            const options = importEditSetId.options;
            for (let i = 0; i < options.length; i++) {
                if (options[i].text === setName) {
                    matchedSetId = options[i].value;
                    break;
                }
            }
        }
        importEditSetId.value = matchedSetId || '';

        // Content fields
        const def = row.definition || row.question_text || row.sentence || '';
        const extra = row.example1 || row.usage1 || row.tip || row.correct_answer || '';

        importEditDefinition.value = def;
        importEditExtra.value = extra;

        // Highlight row
        importPreviewBody.querySelectorAll('tr').forEach(tr => {
            tr.classList.toggle('selected', parseInt(tr.dataset.idx) === idx);
        });

        renderImportCardPreview(row);
    }

    function updateRowFromEditor(idx) {
        if (idx < 0 || idx >= importRows.length) return;
        const row = importRows[idx];
        row.title = importEditTitle.value;
        row.type = importEditStyle.value;
        row.level = importEditLevel.value;

        const setId = importEditSetId.value;
        const setName = importEditSetId.options[importEditSetId.selectedIndex]?.text || '';
        if (setId) {
            row._setName = setName;
            row.set_id = setId;
        } else {
            row._setName = '';
            row.set_id = '';
        }

        row.definition = importEditDefinition.value;
        row.question_text = importEditDefinition.value;
        row.sentence = importEditDefinition.value;

        const extra = importEditExtra.value;
        if (row.type === 'gap_fill') {
            row.correct_answer = extra;
        } else if (row.type === 'multiple_choice') {
            // Parse options from extra (comma-separated, last is correct-index)
            row.correct_answer = '';
            row.question_text = importEditDefinition.value;
        } else {
            row.example1 = extra;
            row.tip = extra;
            row.usage1 = extra;
        }
    }

    function renderImportCardPreview(row) {
        if (!importCardPreview || !row) { resetImportCardPreview(); return; }
        const style = row.type || 'usage_cases';
        const title = row.title || 'Flashcard';
        const definition = row.definition || row.question_text || row.sentence || '';
        const example = row.example1 || row.usage1 || row.tip || '';
        const extra = row.correct_answer || row.tip || '';

        let frontHtml = '';
        let backHtml = '';

        if (style === 'multiple_choice') {
            frontHtml = `
                <div class="text-center">
                    <div class="text-3xl mb-1">❓</div>
                    <p class="text-lg font-bold">${escapeHtml(title)}</p>
                    <p class="text-sm text-gray-600 mt-1">${formatBreaks(escapeHtml(definition || 'Select the correct answer:'))}</p>
                    <div class="mt-1 text-xs text-gray-400">(options shown on card)</div>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-green-700 marker-underline mb-1">✓ Answer</div>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300">
                        <p class="text-base font-bold">${formatBreaks(escapeHtml(extra || 'Correct Answer'))}</p>
                    </div>
                    ${example ? `<p class="text-xs text-gray-600 mt-1">${formatBreaks(escapeHtml(example))}</p>` : ''}
                </div>
            `;
        } else if (style === 'gap_fill') {
            frontHtml = `
                <div class="text-center">
                    <div class="text-3xl mb-1">✏️</div>
                    <p class="text-xs text-gray-500 mb-1">Complete the sentence:</p>
                    <p class="text-sm bg-gray-100 p-2 rounded-lg">${formatBreaks(escapeHtml(definition || 'Complete: ______'))}</p>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-green-700 marker-underline mb-1">✓ Correct</div>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300">
                        <p class="text-base font-bold">${formatBreaks(escapeHtml(extra || 'Answer'))}</p>
                    </div>
                    ${example ? `<p class="text-xs text-gray-600 mt-1">📝 ${formatBreaks(escapeHtml(example))}</p>` : ''}
                </div>
            `;
        } else {
            frontHtml = `
                <div class="flex flex-col items-center justify-center">
                    <div class="text-2xl text-center font-bold">${escapeHtml(title)}</div>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-blue-700 marker-underline mb-1">${escapeHtml(title)}</div>
                    <div class="bg-blue-50 p-2 rounded-xl border-2 border-blue-300">
                        <p class="text-sm">${formatBreaks(escapeHtml(definition || 'Definition'))}</p>
                    </div>
                    ${example ? `<p class="text-xs text-gray-600 mt-1">📝 ${formatBreaks(escapeHtml(example))}</p>` : ''}
                </div>
            `;
        }

        importCardPreview.innerHTML = `
            <div class="import-flip-front">${frontHtml}</div>
            <div class="import-flip-back">${backHtml}</div>
        `;
    }

    document.getElementById('importApplyCardBtn')?.addEventListener('click', () => {
        if (importSelectedIdx < 0) { alert('Select a row first'); return; }
        updateRowFromEditor(importSelectedIdx);
        renderImportPreview();
        selectImportRow(importSelectedIdx);
    });

    document.getElementById('importApplyAllBtn')?.addEventListener('click', () => {
        if (importRows.length === 0) return;
        for (let i = 0; i < importRows.length; i++) {
            updateRowFromEditor(i);
        }
        renderImportPreview();
        if (importSelectedIdx >= 0) selectImportRow(importSelectedIdx);
    });

    document.getElementById('importDeleteCardBtn')?.addEventListener('click', () => {
        if (importSelectedIdx < 0) { alert('Select a row first'); return; }
        if (!confirm('Remove this row from import?')) return;
        importRows.splice(importSelectedIdx, 1);
        importSelectedIdx = -1;
        renderImportPreview();
        if (importRows.length > 0) selectImportRow(0);
    });

    // Create new set from mapping bar
    document.getElementById('importCreateSetBtn')?.addEventListener('click', async () => {
        const name = importNewSetName.value.trim();
        if (!name) { alert('Enter a set name'); return; }
        const response = await fetch('admin_cards.php?action=create_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name })
        });
        const result = await response.json();
        if (result.success) {
            // Refresh both selectors
            const setsRes = await fetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const setsData = await setsRes.json();
            if (setsData.success && setsData.sets) {
                const populateSelect = (sel, val) => {
                    const cur = sel.value;
                    sel.innerHTML = '<option value="">-- Select Set --</option>';
                    setsData.sets.forEach(s => {
                        sel.innerHTML += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
                    });
                    if (cur) sel.value = cur;
                };
                populateSelect(importSetSelector);
                populateSelect(importEditSetId);
                importSetSelector.value = String(result.id);
            }
            importNewSetName.value = '';
        } else {
            alert(result.error || 'Error creating set');
        }
    });

    // Apply set mapping to all rows
    importApplySetAll.addEventListener('change', () => {
        if (importApplySetAll.checked && importSetSelector.value) {
            const setName = importSetSelector.options[importSetSelector.selectedIndex]?.text || '';
            importRows.forEach(row => {
                row._setName = setName;
                row.set_id = importSetSelector.value;
            });
            renderImportPreview();
        }
    });

    importSetSelector.addEventListener('change', () => {
        if (importApplySetAll.checked && importSetSelector.value) {
            const setName = importSetSelector.options[importSetSelector.selectedIndex]?.text || '';
            importRows.forEach(row => {
                row._setName = setName;
                row.set_id = importSetSelector.value;
            });
            renderImportPreview();
        }
    });

    // Live preview update on editor field changes
    function refreshImportPreviewFromEditor() {
        if (importSelectedIdx >= 0 && importRows[importSelectedIdx]) {
            renderImportCardPreview({
                title: importEditTitle.value,
                type: importEditStyle.value,
                level: importEditLevel.value,
                definition: importEditDefinition.value,
                question_text: importEditDefinition.value,
                sentence: importEditDefinition.value,
                example1: importEditExtra.value,
                usage1: importEditExtra.value,
                tip: importEditExtra.value,
                correct_answer: importEditExtra.value,
            });
        }
    }
    importEditTitle.addEventListener('input', refreshImportPreviewFromEditor);
    importEditStyle.addEventListener('change', refreshImportPreviewFromEditor);
    importEditLevel.addEventListener('change', refreshImportPreviewFromEditor);
    importEditDefinition.addEventListener('input', refreshImportPreviewFromEditor);
    importEditExtra.addEventListener('input', refreshImportPreviewFromEditor);

    // Execute import
    document.getElementById('importExecuteBtn')?.addEventListener('click', async () => {
        const selectedRows = importRows.filter(r => r._selected !== false);
        if (selectedRows.length === 0) { alert('No rows selected for import'); return; }
        if (!confirm(`Import ${selectedRows.length} card${selectedRows.length > 1 ? 's' : ''}?`)) return;

        // Build CSV from selected rows
        const csvCols = ['set', 'set_id', 'type', 'title', 'level', 'definition', 'question_text', 'sentence', 'example1', 'example2', 'usage1', 'tip', 'correct_answer', 'explanation'];
        const csvRows = [csvCols.join(',')];

        selectedRows.forEach(row => {
            const vals = csvCols.map(col => {
                let val = '';
                if (col === 'set') {
                    val = row._setName || '';
                } else if (col === 'set_id') {
                    val = row.set_id || '';
                } else if (col === 'type') {
                    val = row.type || 'usage_cases';
                } else if (col === 'level') {
                    val = row.level || 'Beginner';
                } else if (col === 'title') {
                    val = row.title || '';
                } else if (col === 'definition' || col === 'question_text' || col === 'sentence') {
                    val = row.definition || row.question_text || row.sentence || '';
                } else if (col === 'usage1' || col === 'tip') {
                    val = row.usage1 || row.tip || '';
                } else if (col === 'example1' || col === 'example2') {
                    val = row.example1 || row.example2 || '';
                } else if (col === 'correct_answer') {
                    val = row.correct_answer || '';
                } else {
                    val = row[col] || '';
                }
                // Escape CSV value
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csvRows.push(vals.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const formData = new FormData();
        formData.append('csv', blob, (importFileHandle ? importFileHandle.name : 'import.csv'));

        try {
            const response = await fetch('api/import_csv.php', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                let msg = `✅ Imported ${result.imported} cards.`;
                if (result.errors.length) msg += `\n⚠️ ${result.errors.length} errors:\n` + result.errors.slice(0, 10).join('\n');
                if (result.errors.length > 10) msg += `\n...and ${result.errors.length - 10} more`;
                alert(msg);
                closeImportModal();
                await refreshSets();
                if (setSelector.value) loadCards(setSelector.value);
            } else {
                alert('❌ Import failed: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('❌ Network error during import');
        }
    });

    loadCardSets();
})();
