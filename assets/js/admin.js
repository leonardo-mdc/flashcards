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
        return String(text).replace(/\\br/g, '<br>').replace(/\\br /g, '<br>');
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

    function renderCardList(levelFilter = []) {
        let filteredCards = currentCards;
        if (levelFilter.length > 0) {
            filteredCards = currentCards.filter(card => levelFilter.includes(card.level));
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
                        <span class="font-bold">${escapeHtml(card.title || 'Untitled')}</span>
                        <span class="card-type ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="text-sm text-gray-500 mt-1">${escapeHtml(card.level || 'Beginner')}</div>
                    <div class="text-xs text-gray-400">ID: ${card.id}</div>
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
                    <p class="text-xs text-gray-400 mt-3">👆 Tap answer, then flip card</p>
                </div>
            `;
        } else if (patternType === 'gap_fill') {
            frontHtml = `
                <div class="text-center">
                    <div class="text-4xl mb-3">✏️</div>
                    <p class="text-lg mb-4 font-bold">Complete the sentence:</p>
                    <p class="text-base bg-gray-100 p-3 rounded-xl">${escapeHtml(contentData.sentence || 'Complete: ______')}</p>
                    <input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6">
                    <p class="text-xs text-gray-400 mt-3">👆 Type answer, then flip</p>
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

        let html = '<table class="w-full" style="border-collapse:collapse;">';
        html += '<tr><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Name</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Username</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Role</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Progress</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Level</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Actions</th></tr>';
        users.forEach(user => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(user.full_name || user.username)}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(user.username)}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${user.is_admin ? '<span class="card-type mcq">Admin</span>' : '<span class="card-type text">Student</span>'}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${user.progress || 0}%</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(user.english_level || 'Beginner')}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
                    <button class="edit-user-btn btn btn-primary text-xs" data-id="${user.id}" data-username="${escapeHtml(user.username)}" data-fullname="${escapeHtml(user.full_name || '')}" data-level="${escapeHtml(user.english_level || 'Beginner')}" data-admin="${user.is_admin}" style="padding:4px 10px;font-size:0.7rem;">✏️ Edit</button>
                    <button class="reset-user-btn btn btn-warning text-xs" data-id="${user.id}" style="padding:4px 10px;font-size:0.7rem;">🔄 Reset</button>
                    <button class="delete-user-btn btn btn-danger text-xs" data-id="${user.id}" style="padding:4px 10px;font-size:0.7rem;">🗑 Delete</button>
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
            <div class="whiteboard-card" style="max-width:450px;width:90%;padding:24px;">
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
                <div class="flex gap-2">
                    <button id="saveEditUserBtn" class="btn btn-success flex-1">💾 Save</button>
                    <button id="cancelEditUserBtn" class="btn btn-secondary flex-1">Cancel</button>
                </div>
                <p id="editUserError" class="text-red-600 text-center mt-2 hidden"></p>
            </div>
        `;
        document.body.appendChild(modal);

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
            if (result.success) {
                modal.remove();
                loadUsers();
            } else {
                alert(result.error || 'Error saving user');
            }
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
                    <button class="edit-set-btn btn btn-primary text-xs" style="padding:4px 10px;font-size:0.7rem;">✏️</button>
                    <button class="save-set-btn btn btn-success text-xs hidden" style="padding:4px 10px;font-size:0.7rem;">💾</button>
                    <button class="cancel-set-btn btn btn-secondary text-xs hidden" style="padding:4px 10px;font-size:0.7rem;">✕</button>
                    <button class="delete-set-btn btn btn-danger text-xs" style="padding:4px 10px;font-size:0.7rem;">🗑</button>
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
            const currentVal = setSelector.value;
            setSelector.innerHTML = '<option value="">-- Choose Card Set --</option>';
            if (editSetId) {
                const currentEditVal = editSetId.value;
                editSetId.innerHTML = '';
                data.sets.forEach(set => {
                    setSelector.innerHTML += `<option value="${set.id}">${escapeHtml(set.name)}</option>`;
                    editSetId.innerHTML += `<option value="${set.id}">${escapeHtml(set.name)}</option>`;
                });
                if (currentEditVal) editSetId.value = currentEditVal;
            } else {
                data.sets.forEach(set => {
                    setSelector.innerHTML += `<option value="${set.id}">${escapeHtml(set.name)}</option>`;
                });
            }
            if (currentVal) setSelector.value = currentVal;
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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCard();
            }
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's') { e.preventDefault(); saveCard(); }
            if (e.key === 'n') { e.preventDefault(); newCard(); }
            if (e.key === 'd') { e.preventDefault(); deleteCard(); }
            if (e.key === 'z') { e.preventDefault(); revertCard(); }
        }
    });

    loadCardSets();
})();
