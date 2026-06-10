(function () {
    let currentCards = [];
    let currentEditingCard = null;
    let selectedCardId = null;
    let currentSetId = null;

    const csrfToken = window.FLASHCARD_ADMIN?.csrfToken || '';

    function adminFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
        return window.fetch(url, { ...options, headers });
    }

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
    const cardSearchInput = document.getElementById('cardSearchInput');

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    function formatBreaks(text) {
        if (!text) return '';
        return String(text).replace(/\\br/g, '<br>').replace(/\\br /g, '<br>');
    }

    async function loadCardSets() {
        const response = await adminFetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
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
        if (cardSearchInput) { cardSearchInput.value = ''; }
        cardSearchTerm = '';

        const levels = [];
        if (document.getElementById('levelBeginner').checked) levels.push('Beginner');
        if (document.getElementById('levelIntermediate').checked) levels.push('Intermediate');
        if (document.getElementById('levelAdvanced').checked) levels.push('Advanced');

        cardListContainer.innerHTML = '<div class="text-center py-8"><div class="loader"></div> Loading cards...</div>';

        const response = await adminFetch(`admin_cards.php?action=get_cards&set_id=${setId}&t=${Date.now()}`, {
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

    let cardSearchTerm = '';

    function renderCardList(levelFilter = []) {
        let filteredCards = currentCards;
        if (levelFilter.length > 0) {
            filteredCards = currentCards.filter(card => levelFilter.includes(card.level));
        }
        if (cardSearchTerm) {
            const term = cardSearchTerm.toLowerCase();
            filteredCards = filteredCards.filter(card => (card.title || '').toLowerCase().includes(term));
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
            if (card.pattern_type === 'multiple_choice' || card.pattern_type === 'image_mcq') {
                typeLabel = card.pattern_type === 'image_mcq' ? 'ImgMCQ' : 'MCQ';
                typeClass = 'mcq';
            } else if (card.pattern_type === 'gap_fill' || card.pattern_type === 'audio_listening') {
                typeLabel = card.pattern_type === 'audio_listening' ? 'Audio' : 'Gap';
                typeClass = 'gap';
            } else if (card.pattern_type === 'image_description') {
                typeLabel = 'Image';
                typeClass = 'image';
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
                    <label class="block font-bold mb-1">Image URL (optional):</label>
                    <input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(contentData.image_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div>
                    <label class="block font-bold mb-1">Audio URL (optional):</label>
                    <input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(contentData.audio_url || '')}" placeholder="https://example.com/audio.mp3">
                </div>
                <div>
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
                    <label class="block font-bold mb-1">Image URL (optional):</label>
                    <input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(contentData.image_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div>
                    <label class="block font-bold mb-1">Audio URL (optional):</label>
                    <input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(contentData.audio_url || '')}" placeholder="https://example.com/audio.mp3">
                </div>
                <div>
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
        } else if (patternType === 'image_description') {
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Image URL:</label>
                    <input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(contentData.image_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div>
                    <label class="block font-bold mb-1">Description:</label>
                    <textarea id="editDescription" class="form-textarea" rows="5" placeholder="Enter the image description...\brUse \br for line breaks">${escapeHtml(contentData.description || '')}</textarea>
                </div>
            `;
        } else if (patternType === 'image_mcq') {
            const options = (contentData.options || ['Option A', 'Option B', 'Option C']).join(', ');
            const correctIdx = contentData.correct_index !== undefined ? contentData.correct_index : 1;
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Image URL:</label>
                    <input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(contentData.image_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div>
                    <label class="block font-bold mb-1">Question Text:</label>
                    <input type="text" id="editQuestionText" class="form-input" value="${escapeHtml(contentData.question_text || '')}" placeholder="What is the question?">
                </div>
                <div>
                    <label class="block font-bold mb-1">Options (comma separated):</label>
                    <input type="text" id="editOptions" class="form-input" value="${escapeHtml(options)}" placeholder="Option A, Option B, Option C">
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
        } else if (patternType === 'audio_listening') {
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Audio URL:</label>
                    <input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(contentData.audio_url || '')}" placeholder="https://example.com/audio.mp3">
                </div>
                <div>
                    <label class="block font-bold mb-1">Prompt (what to listen for):</label>
                    <textarea id="editPrompt" class="form-textarea" rows="2" placeholder="Listen to the audio and type what you hear...">${escapeHtml(contentData.prompt || '')}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Transcript / Correct Answer(s) (comma separated):</label>
                    <input type="text" id="editCorrectAnswers" class="form-input" value="${escapeHtml((contentData.correct_answers || contentData.transcript || contentData.notes || '').split(',').map(s => s.trim()).join(', '))}" placeholder="answer1, answer2">
                    <div class="help-text">For Q&A: comma-separated accepted answers. Leave empty for descriptive-only.</div>
                </div>
                <div>
                    <label class="block font-bold mb-1">Notes / Full Transcript:</label>
                    <textarea id="editNotes" class="form-textarea" rows="3" placeholder="Full transcript or notes for the audio...\brUse \br for line breaks">${escapeHtml(contentData.notes || contentData.transcript || '')}</textarea>
                </div>
            `;
        } else {
            const ex1 = contentData.example1a || contentData.example || '';
            const ex2 = contentData.example && contentData.example !== contentData.example1a ? contentData.example : '';
            html = `
                <div class="mt-2">
                    <label class="block font-bold mb-1">Image URL (optional):</label>
                    <input type="text" id="editImageUrl" class="form-input" value="${escapeHtml(contentData.image_url || '')}" placeholder="https://example.com/image.jpg">
                </div>
                <div>
                    <label class="block font-bold mb-1">Audio URL (optional):</label>
                    <input type="text" id="editAudioUrl" class="form-input" value="${escapeHtml(contentData.audio_url || '')}" placeholder="https://example.com/audio.mp3">
                </div>
                <div>
                    <label class="block font-bold mb-1">Definition / Description:</label>
                    <textarea id="editDefinition" class="form-textarea" rows="5" placeholder="Enter the definition or description...\brUse \br to create line breaks">${escapeHtml(contentData.definition || contentData.usage1 || '')}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Usage / Context:</label>
                    <textarea id="editUsage" class="form-textarea" rows="2" placeholder="When/why to use this...\brUse \br for line breaks">${escapeHtml(contentData.usage1 || '')}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Example 1:</label>
                    <textarea id="editExample" class="form-textarea" rows="2" placeholder="First example...\brUse \br for line breaks">${escapeHtml(ex1)}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Example 2 (optional):</label>
                    <textarea id="editExample2" class="form-textarea" rows="2" placeholder="Second example...\brUse \br for line breaks">${escapeHtml(ex2)}</textarea>
                </div>
                <div>
                    <label class="block font-bold mb-1">Tip (optional):</label>
                    <textarea id="editTip" class="form-textarea" rows="2" placeholder="Helpful tip...\brUse \br for line breaks">${escapeHtml(contentData.tip || '')}</textarea>
                </div>
                <div class="mt-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <label class="block font-bold mb-1 text-xs">Show on front:</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffDefinition" ${(contentData.front_fields || ['definition']).includes('definition') ? 'checked' : ''}> Definition</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffUsage1" ${(contentData.front_fields || []).includes('usage1') ? 'checked' : ''}> Usage</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="ffExamples" ${(contentData.front_fields || []).includes('examples') ? 'checked' : ''}> Examples</label>
                    <label class="inline-flex items-center gap-1 text-xs"><input type="checkbox" id="ffTip" ${(contentData.front_fields || []).includes('tip') ? 'checked' : ''}> Tip</label>
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
            contentData.image_url = document.getElementById('editImageUrl')?.value || '';
            contentData.audio_url = document.getElementById('editAudioUrl')?.value || '';
            contentData.options = options;
            contentData.correct_index = correctIdx ? parseInt(correctIdx.value) : 1;
            contentData.question_text = document.getElementById('editQuestionText')?.value || '';
            contentData.explanation = document.getElementById('editExplanation')?.value || '';
        } else if (patternType === 'gap_fill') {
            const answersInput = document.getElementById('editCorrectAnswers');
            contentData.sentence = document.getElementById('editSentence')?.value || '';
            contentData.correct_answers = answersInput ? answersInput.value.split(',').map(s => s.trim()) : ['answer'];
            contentData.example = document.getElementById('editExample')?.value || '';
            contentData.image_url = document.getElementById('editImageUrl')?.value || '';
            contentData.audio_url = document.getElementById('editAudioUrl')?.value || '';
        } else if (patternType === 'image_description') {
            contentData.image_url = document.getElementById('editImageUrl')?.value || '';
            contentData.description = document.getElementById('editDescription')?.value || '';
        } else if (patternType === 'image_mcq') {
            const optionsInput = document.getElementById('editOptions');
            const options = optionsInput ? optionsInput.value.split(',').map(s => s.trim()) : ['Option A', 'Option B', 'Option C'];
            const correctIdx = document.getElementById('editCorrectIndex');
            contentData.image_url = document.getElementById('editImageUrl')?.value || '';
            contentData.options = options;
            contentData.correct_index = correctIdx ? parseInt(correctIdx.value) : 1;
            contentData.question_text = document.getElementById('editQuestionText')?.value || '';
            contentData.explanation = document.getElementById('editExplanation')?.value || '';
        } else if (patternType === 'audio_listening') {
            contentData.audio_url = document.getElementById('editAudioUrl')?.value || '';
            contentData.prompt = document.getElementById('editPrompt')?.value || '';
            const answersInput = document.getElementById('editCorrectAnswers');
            contentData.correct_answers = answersInput ? answersInput.value.split(',').map(s => s.trim()).filter(s => s) : [];
            contentData.notes = document.getElementById('editNotes')?.value || '';
            contentData.transcript = contentData.notes;
        } else {
            contentData.image_url = document.getElementById('editImageUrl')?.value || '';
            contentData.audio_url = document.getElementById('editAudioUrl')?.value || '';
            contentData.definition = document.getElementById('editDefinition')?.value || '';
            contentData.usage1 = document.getElementById('editUsage')?.value || '';
            contentData.example1a = document.getElementById('editExample')?.value || '';
            contentData.example = document.getElementById('editExample2')?.value || '';
            contentData.tip = document.getElementById('editTip')?.value || '';
            const ff = [];
            if (document.getElementById('ffDefinition')?.checked) ff.push('definition');
            if (document.getElementById('ffUsage1')?.checked) ff.push('usage1');
            if (document.getElementById('ffExamples')?.checked) ff.push('examples');
            if (document.getElementById('ffTip')?.checked) ff.push('tip');
            contentData.front_fields = ff;
        }

        return contentData;
    }

    function updatePreviews() {
        const patternType = editPatternType.value;
        const title = editTitle.value || 'Flashcard';
        const contentData = getCurrentContentData();

        let frontHtml = '';
        if (patternType === 'image_mcq') {
            const imageUrl = contentData.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            frontHtml = `
                <div class="flex flex-col md:flex-row gap-3 h-full min-h-[200px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-32 object-contain">` : `<div class="text-5xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-2">
                        <p class="text-sm font-bold text-center md:text-left">Select the correct answer:</p>
                        ${options.map((opt, idx) => `<div class="quiz-option-preview text-sm py-1">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    </div>
                </div>
            `;
        } else if (patternType === 'image_description') {
            const imageUrl = contentData.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🖼️ ${escapeHtml(title)}</div>
                    ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-40 rounded-xl shadow-md mb-2 object-contain">` : `<div class="text-5xl mb-2">🖼️</div>`}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip</p>
                </div>
            `;
        } else if (patternType === 'audio_listening') {
            const audioUrl = contentData.audio_url || '';
            const hasAudio = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('uploads/'));
            const prompt = contentData.prompt || '';
            const isInteractive = !!(prompt || (contentData.correct_answers && contentData.correct_answers.length));
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🎧 ${escapeHtml(title)}</div>
                    ${hasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : `<div class="text-5xl mb-2">🎧</div>`}
                    ${prompt ? `<p class="text-sm bg-gray-100 p-2 rounded-xl mb-1">${escapeHtml(prompt)}</p>` : ''}
                    ${isInteractive ? `<input type="text" placeholder="Type answer..." class="w-full p-2 text-sm border-2 rounded-xl mb-2" disabled>` : ''}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip${isInteractive ? ' after answering' : ''}</p>
                </div>
            `;
        } else if (patternType === 'multiple_choice') {
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            const mcImageUrl = contentData.image_url || '';
            const mcAudioUrl = contentData.audio_url || '';
            const mcHasImage = mcImageUrl && (mcImageUrl.startsWith('http://') || mcImageUrl.startsWith('https://') || mcImageUrl.startsWith('uploads/'));
            const mcHasAudio = mcAudioUrl && (mcAudioUrl.startsWith('http://') || mcAudioUrl.startsWith('https://') || mcAudioUrl.startsWith('uploads/'));
            frontHtml = `
                <div class="text-center">
                    ${mcHasImage ? `<img src="${escapeHtml(mcImageUrl)}" class="max-h-32 object-contain mx-auto mb-2 rounded-lg">` : ''}
                    ${mcHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                    <div class="text-4xl mb-3">❓</div>
                    <p class="text-lg mb-4 font-bold">${escapeHtml(contentData.question_text || 'Select the correct answer:')}</p>
                    ${options.map((opt, idx) => `<div class="quiz-option-preview text-base">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    <p class="text-xs text-gray-400 mt-3">👆 Tap answer, then flip card</p>
                </div>
            `;
        } else if (patternType === 'gap_fill') {
            const gapImageUrl = contentData.image_url || '';
            const gapAudioUrl = contentData.audio_url || '';
            const gapHasImage = gapImageUrl && (gapImageUrl.startsWith('http://') || gapImageUrl.startsWith('https://') || gapImageUrl.startsWith('uploads/'));
            const gapHasAudio = gapAudioUrl && (gapAudioUrl.startsWith('http://') || gapAudioUrl.startsWith('https://') || gapAudioUrl.startsWith('uploads/'));
            const gapMediaHtml = (gapHasImage || gapHasAudio) ? `
                <div class="w-full flex justify-center mb-2">
                    ${gapHasImage ? `<img src="${escapeHtml(gapImageUrl)}" class="max-h-32 object-contain rounded-lg">` : ''}
                    ${gapHasAudio ? `<div class="text-sm">🔊 Audio file provided</div>` : ''}
                </div>
            ` : '';
            frontHtml = `
                <div class="text-center">
                    ${gapMediaHtml}
                    <div class="text-4xl mb-3">✏️</div>
                    <p class="text-lg mb-4 font-bold">Complete the sentence:</p>
                    <p class="text-base bg-gray-100 p-3 rounded-xl">${escapeHtml(contentData.sentence || 'Complete: ______')}</p>
                    <input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6">
                    <p class="text-xs text-gray-400 mt-3">👆 Type answer, then flip</p>
                </div>
            `;
        } else {
            const genImageUrl = contentData.image_url || '';
            const genAudioUrl = contentData.audio_url || '';
            const genHasImage = genImageUrl && (genImageUrl.startsWith('http://') || genImageUrl.startsWith('https://') || genImageUrl.startsWith('uploads/'));
            const genHasAudio = genAudioUrl && (genAudioUrl.startsWith('http://') || genAudioUrl.startsWith('https://') || genAudioUrl.startsWith('uploads/'));
            const defaultFront = patternType === 'deep_dive' ? [] : ['definition'];
            const frontFields = Array.isArray(contentData.front_fields) ? contentData.front_fields : defaultFront;
            const frontParts = [];
            if (frontFields.includes('definition') && contentData.definition) frontParts.push(`<div class="text-base text-center">${formatBreaks(escapeHtml(contentData.definition))}</div>`);
            if (frontFields.includes('usage1') && contentData.usage1) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">${formatBreaks(escapeHtml(contentData.usage1))}</div>`);
            if (frontFields.includes('tip') && contentData.tip) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">💡 ${formatBreaks(escapeHtml(contentData.tip))}</div>`);
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    ${genHasImage ? `<img src="${escapeHtml(genImageUrl)}" class="max-h-32 object-contain rounded-lg mb-2">` : ''}
                    ${genHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                    <div class="text-2xl text-center font-bold mb-2">${escapeHtml(title)}</div>
                    ${frontParts.join('')}
                    <p class="text-xs text-gray-400 mt-4">👆 Tap card to flip</p>
                </div>
            `;
        }

        let backHtml = '';
        if (patternType === 'image_mcq') {
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
        } else if (patternType === 'image_description') {
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(contentData.description || 'Description would appear here.'))}</p>
                    </div>
                </div>
            `;
        } else if (patternType === 'audio_listening') {
            const transcript = contentData.transcript || contentData.notes || '';
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-green-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    ${transcript ? `<div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3"><p class="text-lg">${formatBreaks(escapeHtml(transcript))}</p></div>` : '<p class="text-gray-500">(Transcript)</p>'}
                </div>
            `;
        } else if (patternType === 'multiple_choice') {
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
            const exList = contentData.examples || [];
            const exHtml = exList.length
                ? exList.map((ex, i) => `<p class="text-md text-gray-600">📝 Example ${i+1}: ${formatBreaks(escapeHtml(ex))}</p>`).join('')
                : (contentData.example1a ? `<p class="text-md text-gray-600">📝 Example: ${formatBreaks(escapeHtml(contentData.example1a))}</p>` : '');
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(contentData.definition || 'Definition would appear here.'))}</p>
                    </div>
                    ${contentData.usage1 ? `<p class="text-md text-gray-600 mt-2">💡 Usage: ${formatBreaks(escapeHtml(contentData.usage1))}</p>` : ''}
                    ${exHtml ? `<div class="mt-2">${exHtml}</div>` : ''}
                    ${contentData.tip ? `<div class="mt-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3"><p class="text-md text-yellow-800">💡 Tip: ${formatBreaks(escapeHtml(contentData.tip))}</p></div>` : ''}
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
            question_text: (patternType === 'multiple_choice' || patternType === 'image_mcq') ? contentData.question_text : '',
            content_data: contentData
        };

        const response = await adminFetch('admin_cards.php?action=save_card', {
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
            const response = await adminFetch(`admin_cards.php?action=delete_card&card_id=${cardId}`, {
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

        const response = await adminFetch('admin_cards.php?action=get_users&t=' + Date.now(), {
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
                    const response = await adminFetch(`admin_cards.php?action=delete_user&user_id=${userId}`, {
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
                    const response = await adminFetch(`admin_cards.php?action=reset_user_progress&user_id=${userId}`, {
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
                <div class="flex gap-2 mb-3">
                    <button id="saveEditUserBtn" class="btn btn-success flex-1">💾 Save</button>
                    <button id="cancelEditUserBtn" class="btn btn-secondary flex-1">Cancel</button>
                </div>
                <input type="hidden" id="editUserId" value="${data.id}">
                <label class="block font-bold mb-1">Username:</label>
                <input type="text" id="editUserUsername" class="form-input" value="${data.username}" maxlength="30" autofocus>
                <label class="block font-bold mb-1">Full Name:</label>
                <input type="text" id="editUserFullName" class="form-input" value="${data.fullname}">
                <label class="block font-bold mb-1">Level:</label>
                <select id="editUserLevel" class="form-select w-full p-2 border-2 rounded-xl mb-3 bg-white">
                    <option value="Beginner" ${data.level === 'Beginner' ? 'selected' : ''}>🔰 Beginner</option>
                    <option value="Intermediate" ${data.level === 'Intermediate' ? 'selected' : ''}>📚 Intermediate</option>
                    <option value="Advanced" ${data.level === 'Advanced' ? 'selected' : ''}>🎓 Advanced</option>
                </select>
                <label class="block font-bold mb-1">New Password:</label>
                <input type="password" id="editUserPassword" class="form-input" placeholder="Leave empty to keep current">
                <label class="block font-bold mb-1">Confirm Password:</label>
                <input type="password" id="editUserPasswordConfirm" class="form-input" placeholder="Repeat new password">
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
                <p id="editUserError" class="text-red-600 text-center mt-2 hidden"></p>
            </div>
        `;
        document.body.appendChild(modal);

        // Load card sets and user's current access
        (async () => {
            const [setsRes, accessRes] = await Promise.all([
                adminFetch('admin_cards.php?action=get_sets&t=' + Date.now(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
                adminFetch(`admin_cards.php?action=get_user_sets&user_id=${data.id}&t=${Date.now()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
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
            const pwd = document.getElementById('editUserPassword').value;
            const pwdConfirm = document.getElementById('editUserPasswordConfirm').value;

            if (!username) { alert('Username is required'); return; }

            let password = null;
            if (pwd || pwdConfirm) {
                if (pwd !== pwdConfirm) {
                    alert('Passwords do not match');
                    document.getElementById('editUserPassword').value = '';
                    document.getElementById('editUserPasswordConfirm').value = '';
                    return;
                }
                password = pwd;
            }

            const body = { id, username, full_name: fullName, english_level: englishLevel, is_admin: isAdmin };
            if (password) body.password = password;

            const response = await adminFetch('admin_cards.php?action=update_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (!result.success) { alert(result.error || 'Error saving user'); return; }

            const checkedSets = [...document.querySelectorAll('.user-set-checkbox:checked')].map(cb => parseInt(cb.value));
            await adminFetch('admin_cards.php?action=set_user_sets', {
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

        const response = await adminFetch('admin_cards.php?action=create_user', {
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

    if (cardSearchInput) {
        cardSearchInput.addEventListener('input', () => {
            cardSearchTerm = cardSearchInput.value;
            const levels = [];
            if (document.getElementById('levelBeginner').checked) levels.push('Beginner');
            if (document.getElementById('levelIntermediate').checked) levels.push('Intermediate');
            if (document.getElementById('levelAdvanced').checked) levels.push('Advanced');
            renderCardList(levels);
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
    const toastEl = document.getElementById('manageSetsToast');

    let toastTimeout;

    function showToast(message, type = 'info') {
        if (!toastEl) return;
        const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb' };
        toastEl.style.background = colors[type];
        toastEl.style.color = 'white';
        toastEl.textContent = message;
        toastEl.style.display = 'block';
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
    }

    let cachedStudents = null;
    let cachedSets = null;

    async function getStudents() {
        if (cachedStudents) return cachedStudents;
        const res = await adminFetch('admin_cards.php?action=get_students&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        cachedStudents = data.success ? data.students : [];
        return cachedStudents;
    }

    async function fetchSets() {
        const response = await adminFetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (!data.success || !data.sets) {
            if (setListContainer) setListContainer.innerHTML = '<div class="text-center text-red-500 py-4">Error loading sets</div>';
            return;
        }
        cachedSets = data.sets;
        renderSetsList(data.sets);
        refreshSetSelectors(data.sets);
    }

    function renderSetsList(sets) {
        if (!setListContainer) return;
        const searchVal = document.getElementById('setsSearchInput')?.value.toLowerCase() || '';
        const filtered = searchVal ? sets.filter(s => s.name.toLowerCase().includes(searchVal)) : sets;

        let html = '';
        filtered.forEach(set => {
            const count = set.card_count !== undefined ? parseInt(set.card_count) : 0;
            const excl = set.exclusive_to || '';
            const names = excl.split(',').map(s => s.trim()).filter(Boolean);
            let chipHtml;
            if (names.length) {
                const shown = names.slice(0, 3);
                const remainder = names.length - shown.length;
                chipHtml = shown.map(u => `<span class="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full mr-1 mb-0.5">🔒 ${escapeHtml(u)}</span>`).join('');
                if (remainder > 0) chipHtml += `<span class="text-xs text-gray-400 mr-1">+${remainder} more</span>`;
            } else {
                chipHtml = '<span class="text-xs text-gray-400">🌐 Public</span>';
            }
            html += `
                <div class="set-item mb-2 p-2.5 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors" data-id="${set.id}">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="set-name-display font-bold text-sm flex-1 cursor-text" contenteditable="true">${escapeHtml(set.name)}</span>
                        <span class="text-xs text-gray-400 font-mono">${count} card${count !== 1 ? 's' : ''}</span>
                        <div class="flex gap-1">
                            <button class="delete-set-btn btn btn-danger text-xs" style="padding:2px 6px;font-size:0.65rem;">🗑</button>
                        </div>
                    </div>
                    <div class="mt-1 flex items-center gap-2 flex-wrap">
                        <div class="exclusive-chips">${chipHtml}</div>
                        <button class="toggle-exclusive-btn text-xs text-blue-500 hover:text-blue-700" style="background:none;border:none;cursor:pointer;">✏️ access</button>
                    </div>
                    <div class="exclusive-editor hidden mt-1.5 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <label class="text-xs text-gray-500 block mb-1">🎯 Select students who can see this set (leave empty = public):</label>
                        <div class="exclusive-select-wrap"></div>
                        <div class="flex gap-2 mt-1">
                            <button class="save-exclusive-btn btn btn-success text-xs" style="padding:2px 8px;">💾 Save access</button>
                            <button class="cancel-exclusive-btn btn btn-secondary text-xs" style="padding:2px 8px;">✕ Cancel</button>
                        </div>
                    </div>
                </div>`;
        });
        if (!filtered.length) {
            html = '<div class="text-center text-gray-400 py-4">' + (searchVal ? 'No sets match your search' : 'No sets yet. Add one above!') + '</div>';
        }
        setListContainer.innerHTML = html;

        setListContainer.querySelectorAll('.set-name-display').forEach(el => {
            el.addEventListener('blur', () => saveSetName(el));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
                if (e.key === 'Escape') { el.textContent = el.dataset.origName || el.textContent; el.blur(); }
            });
            el.dataset.origName = el.textContent;
        });

        setListContainer.querySelectorAll('.delete-set-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const name = item.querySelector('.set-name-display').textContent.trim();
                if (!confirm(`Delete "${name}"? Cards will become orphaned.`)) return;
                const response = await adminFetch(`admin_cards.php?action=delete_set&set_id=${id}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const result = await response.json();
                if (result.success) {
                    showToast(`✅ "${name}" deleted`, 'success');
                    fetchSets();
                } else {
                    showToast('❌ ' + (result.error || 'Error deleting set'), 'error');
                }
            });
        });

        setListContainer.querySelectorAll('.toggle-exclusive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const editor = item.querySelector('.exclusive-editor');
                const isHidden = editor.classList.contains('hidden');
                editor.classList.toggle('hidden', !isHidden);
                btn.textContent = isHidden ? '✕ close' : '✏️ access';
                if (isHidden) {
                    const wrap = editor.querySelector('.exclusive-select-wrap');
                    const students = await getStudents();
                    const set = cachedSets?.find(s => s.id == item.dataset.id);
                    const excl = (set?.exclusive_to || '').split(',').map(s => s.trim()).filter(Boolean);
                    let opts = '';
                    students.forEach(s => {
                        const sel = excl.includes(s.username) ? 'selected' : '';
                        opts += `<option value="${escapeHtml(s.username)}" ${sel}>${escapeHtml(s.full_name || s.username)}</option>`;
                    });
                    wrap.innerHTML = `<select class="exclusive-select text-xs w-full" multiple size="4" style="border:2px solid #d1d5db;border-radius:8px;padding:4px;background:white;">${opts}</select>`;
                }
            });
        });

        setListContainer.querySelectorAll('.save-exclusive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const select = item.querySelector('.exclusive-select');
                const exclusiveTo = select ? Array.from(select.selectedOptions).map(o => o.value).filter(v => v).join(',') : '';
                const name = item.querySelector('.set-name-display').textContent.trim();
                const response = await adminFetch('admin_cards.php?action=update_set', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify({ id, name, exclusive_to: exclusiveTo })
                });
                const result = await response.json();
                if (result.success) {
                    showToast('✅ Access updated', 'success');
                    item.querySelector('.exclusive-editor').classList.add('hidden');
                    item.querySelector('.toggle-exclusive-btn').textContent = '✏️ access';
                    fetchSets();
                } else {
                    showToast('❌ ' + (result.error || 'Error saving access'), 'error');
                }
            });
        });

        setListContainer.querySelectorAll('.cancel-exclusive-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.set-item');
                item.querySelector('.exclusive-editor').classList.add('hidden');
                item.querySelector('.toggle-exclusive-btn').textContent = '✏️ access';
            });
        });
    }

    async function saveSetName(el) {
        const item = el.closest('.set-item');
        const id = parseInt(item.dataset.id);
        const name = el.textContent.trim();
        if (!name) { el.textContent = el.dataset.origName || ''; showToast('Name cannot be empty', 'error'); return; }
        if (name === el.dataset.origName) return;
        const set = cachedSets?.find(s => s.id == id);
        const exclusiveTo = set?.exclusive_to || '';
        const response = await adminFetch('admin_cards.php?action=update_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ id, name, exclusive_to: exclusiveTo })
        });
        const result = await response.json();
        if (result.success) {
            el.dataset.origName = name;
            showToast('✅ Renamed', 'success');
            fetchSets();
        } else {
            el.textContent = el.dataset.origName || name;
            showToast('❌ ' + (result.error || 'Error renaming set'), 'error');
        }
    }

    function refreshSetSelectors(sets) {
        const setSel = document.getElementById('setSelector');
        const editSel = document.getElementById('editSetId');
        const importSel = document.getElementById('importSetSelector');
        const importEditSel = document.getElementById('importEditSetId');

        const curSet = setSel?.value;
        const curEdit = editSel?.value;
        const curImport = importSel?.value;
        const curImportEdit = importEditSel?.value;

        const build = (placeholder) => {
            let h = placeholder ? `<option value="">${placeholder}</option>` : '';
            sets.forEach(s => { h += `<option value="${s.id}">${escapeHtml(s.name)}</option>`; });
            return h;
        };

        if (setSel) { setSel.innerHTML = build('-- Choose Card Set --'); if (curSet) setSel.value = curSet; }
        if (editSel) { editSel.innerHTML = build(''); if (curEdit) editSel.value = curEdit; }
        if (importSel) { importSel.innerHTML = build('-- Select Set --'); if (curImport) importSel.value = curImport; }
        if (importEditSel) { importEditSel.innerHTML = editSel ? editSel.innerHTML : build(''); if (curImportEdit) importEditSel.value = curImportEdit; }
    }

    async function refreshSets() {
        const response = await adminFetch('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success && data.sets) refreshSetSelectors(data.sets);
    }

    let newSetExclusiveSelectHtml = '';

    async function loadNewSetExclusiveSelect() {
        const students = await getStudents();
        let opts = '';
        students.forEach(s => {
            opts += `<option value="${escapeHtml(s.username)}">${escapeHtml(s.full_name || s.username)}</option>`;
        });
        newSetExclusiveSelectHtml = `
            <div class="mt-1 mb-2">
                <label class="text-xs text-gray-500">🎯 Exclusivity (optional):</label>
                <select id="newSetExclusiveSelect" class="text-xs w-full" multiple size="3" style="border:2px solid #d1d5db;border-radius:8px;padding:4px;background:white;margin-top:2px;">
                    <option value="">— Public (all students) —</option>
                    ${opts}
                </select>
            </div>`;
        const container = document.getElementById('newSetExclusiveContainer');
        if (container) container.innerHTML = newSetExclusiveSelectHtml;
    }

    document.getElementById('setsSearchInput')?.addEventListener('input', () => {
        if (cachedSets) renderSetsList(cachedSets);
    });

    document.getElementById('manageSetsBtn')?.addEventListener('click', () => {
        manageSetsModal.classList.remove('hidden');
        loadNewSetExclusiveSelect();
        fetchSets();
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
        if (!name) { showToast('Enter a name for the new set', 'warning'); return; }
        const exclSelect = document.getElementById('newSetExclusiveSelect');
        const exclusiveTo = exclSelect ? Array.from(exclSelect.selectedOptions).map(o => o.value).filter(v => v).join(',') : '';
        const response = await adminFetch('admin_cards.php?action=create_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name, exclusive_to: exclusiveTo })
        });
        const result = await response.json();
        if (result.success) {
            input.value = '';
            showToast(`✅ "${name}" created`, 'success');
            fetchSets();
        } else {
            showToast('❌ ' + (result.error || 'Error creating set'), 'error');
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

    // --- Import CSV with Preview/Checkout Modal ---
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
    const importDynamicFields = document.getElementById('importDynamicFields');

    function getImportField(id) { return document.getElementById(id)?.value || ''; }
    function setImportField(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

    function renderImportEditorFields(type, row) {
        const r = row || {};
        const cd = {};
        let contentData = r.content_data;
        if (typeof contentData === 'string' && contentData) {
            try { contentData = JSON.parse(contentData); } catch (e) { contentData = {}; }
        }
        if (contentData && typeof contentData === 'object') Object.assign(cd, contentData);

        const val = (...fields) => { for (const f of fields) { const v = r[f] || cd[f]; if (v != null && v !== '') return escapeHtml(v); } return ''; };
        let html = '';

        if (type === 'multiple_choice' || type === 'image_mcq') {
            const opts = cd.options;
            const optStr = Array.isArray(opts) && opts.length ? opts.join(', ') : (r.opt1 ? [r.opt1, r.opt2, r.opt3, r.opt4].filter(Boolean).join(', ') : '');
            const corrIdx = cd.correct_index !== undefined ? cd.correct_index : (r.correct_answer || '1');
            html = `
                ${type === 'image_mcq' ? `<div><label class="field-label">Image URL</label><input type="text" id="importEditImageUrl" class="form-input" value="${val('image_url')}"></div>` : ''}
                <div><label class="field-label">Question Text</label><textarea id="importEditQuestionText" class="form-textarea" rows="2">${val('question_text')}</textarea></div>
                <div><label class="field-label">Options (comma separated)</label><input type="text" id="importEditOptions" class="form-input" value="${escapeHtml(optStr)}"></div>
                <div><label class="field-label">Correct Index (0, 1, 2...)</label><input type="number" id="importEditCorrectIndex" class="form-input" value="${corrIdx}" min="0"></div>
                <div><label class="field-label">Explanation</label><textarea id="importEditExplanation" class="form-textarea" rows="2">${val('explanation')}</textarea></div>
                ${type === 'multiple_choice' ? `<div><label class="field-label">Image URL (optional)</label><input type="text" id="importEditImageUrl" class="form-input" value="${val('image_url')}"></div><div><label class="field-label">Audio URL (optional)</label><input type="text" id="importEditAudioUrl" class="form-input" value="${val('audio_url')}"></div>` : ''}
            `;
        } else if (type === 'gap_fill') {
            const answers = cd.correct_answers || [];
            const ansStr = Array.isArray(answers) ? answers.join(', ') : (r.correct_answer || '');
            html = `
                <div><label class="field-label">Sentence with ______</label><textarea id="importEditSentence" class="form-textarea" rows="3">${val('sentence')}</textarea></div>
                <div><label class="field-label">Correct Answer(s) (comma separated)</label><input type="text" id="importEditCorrectAnswers" class="form-input" value="${escapeHtml(ansStr)}"></div>
                <div><label class="field-label">Example Sentence</label><textarea id="importEditExample" class="form-textarea" rows="2">${val('example', 'example1', 'example')}</textarea></div>
                <div><label class="field-label">Image URL (optional)</label><input type="text" id="importEditImageUrl" class="form-input" value="${val('image_url')}"></div>
                <div><label class="field-label">Audio URL (optional)</label><input type="text" id="importEditAudioUrl" class="form-input" value="${val('audio_url')}"></div>
            `;
        } else if (type === 'image_description') {
            html = `
                <div><label class="field-label">Image URL</label><input type="text" id="importEditImageUrl" class="form-input" value="${val('image_url')}"></div>
                <div><label class="field-label">Description</label><textarea id="importEditDescription" class="form-textarea" rows="5">${val('description')}</textarea></div>
            `;
        } else if (type === 'audio_listening') {
            html = `
                <div><label class="field-label">Audio URL</label><input type="text" id="importEditAudioUrl" class="form-input" value="${val('audio_url')}"></div>
                <div><label class="field-label">Prompt</label><textarea id="importEditPrompt" class="form-textarea" rows="2">${val('prompt')}</textarea></div>
                <div><label class="field-label">Correct Answer(s) (comma separated)</label><input type="text" id="importEditCorrectAnswers" class="form-input" value="${escapeHtml(r.correct_answer || (cd.correct_answers || []).join(', ') || '')}"></div>
                <div><label class="field-label">Notes / Transcript</label><textarea id="importEditTranscript" class="form-textarea" rows="3">${val('transcript')}</textarea></div>
            `;
        } else {
            // Text types: usage_cases, deep_dive, formula_table
            const exArr = cd.examples || [];
            const ex1 = exArr[0] || cd.example1a || r.example1 || cd.example || '';
            const ex2 = exArr[1] || (cd.example && cd.example !== cd.example1a ? cd.example : '');
            const defFront = type === 'deep_dive' ? [] : ['definition'];
            const ff = Array.isArray(cd.front_fields) ? cd.front_fields : defFront;
            html = `
                <div><label class="field-label">Definition / Description</label><textarea id="importEditDefinition" class="form-textarea" rows="5">${val('definition')}</textarea></div>
                <div><label class="field-label">Usage / Context</label><textarea id="importEditUsage" class="form-textarea" rows="2">${escapeHtml(r.usage1 || cd.usage1 || '')}</textarea></div>
                <div><label class="field-label">Example 1</label><textarea id="importEditExample" class="form-textarea" rows="2">${escapeHtml(ex1)}</textarea></div>
                <div><label class="field-label">Example 2 (optional)</label><textarea id="importEditExample2" class="form-textarea" rows="2">${escapeHtml(ex2)}</textarea></div>
                <div><label class="field-label">Tip</label><textarea id="importEditTip" class="form-textarea" rows="2">${val('tip')}</textarea></div>
                <div><label class="field-label">Image URL (optional)</label><input type="text" id="importEditImageUrl" class="form-input" value="${val('image_url')}"></div>
                <div><label class="field-label">Audio URL (optional)</label><input type="text" id="importEditAudioUrl" class="form-input" value="${val('audio_url')}"></div>
                <div class="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <label class="field-label mb-1">Show on front:</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="importFfDefinition" ${ff.includes('definition') ? 'checked' : ''}> Definition</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="importFfUsage1" ${ff.includes('usage1') ? 'checked' : ''}> Usage</label>
                    <label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" id="importFfExamples" ${ff.includes('examples') ? 'checked' : ''}> Examples</label>
                    <label class="inline-flex items-center gap-1 text-xs"><input type="checkbox" id="importFfTip" ${ff.includes('tip') ? 'checked' : ''}> Tip</label>
                </div>
            `;
        }
        importDynamicFields.innerHTML = html;

        // Attach input listeners on new fields to update preview
        importDynamicFields.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', renderImportCardPreview);
            el.addEventListener('change', renderImportCardPreview);
        });
    }

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
        importPreviewBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-4">No data</td></tr>';
        importDynamicFields.innerHTML = '';
        document.getElementById('importPreviewSection')?.classList.add('hidden');
    }

    function closeImportModal() {
        importModal.classList.add('hidden');
    }

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

    async function loadCsvPreview(file) {
        importFileHandle = file;
        importFileName.textContent = file.name;

        const formData = new FormData();
        formData.append('csv', file);

        importPreviewBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="loader"></div> Parsing CSV...</td></tr>';

        try {
            const response = await adminFetch('admin_cards.php?action=preview_csv&t=' + Date.now(), {
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
                const validTypes = ['usage_cases', 'deep_dive', 'formula_table', 'multiple_choice', 'gap_fill', 'image_mcq', 'image_description', 'audio_listening'];
                if (!validTypes.includes(type)) type = 'usage_cases';
                // Parse content_data JSON if present and merge into row fields
                let contentData = row.content_data;
                if (typeof contentData === 'string' && contentData) {
                    try { contentData = JSON.parse(contentData); } catch (e) { contentData = null; }
                }
                if (contentData && typeof contentData === 'object') {
                    for (const key of Object.keys(contentData)) {
                        const val = contentData[key];
                        if (val != null && !row[key] && row[key] !== '') {
                            if (Array.isArray(val)) {
                                if (key === 'options' || key === 'correct_answers') {
                                    row[key] = val.join(', ');
                                }
                            } else if (typeof val === 'string') {
                                row[key] = val;
                            }
                        }
                    }
                    // Map common content_data fields to CSV column names
                    if (contentData.definition && !row.definition) row.definition = contentData.definition;
                    if (contentData.question_text && !row.question_text) row.question_text = contentData.question_text;
                    if (contentData.sentence && !row.sentence) row.sentence = contentData.sentence;
                    if (contentData.example && !row.example1) row.example1 = contentData.example;
                    if (contentData.usage1 && !row.usage1) row.usage1 = contentData.usage1;
                    if (contentData.tip && !row.tip) row.tip = contentData.tip;
                    if (contentData.explanation && !row.explanation) row.explanation = contentData.explanation;
                    if (contentData.image_url && !row.image_url) row.image_url = contentData.image_url;
                    if (contentData.audio_url && !row.audio_url) row.audio_url = contentData.audio_url;
                    if (contentData.description && !row.description) row.description = contentData.description;
                    if (contentData.prompt && !row.prompt) row.prompt = contentData.prompt;
                    if (contentData.transcript && !row.transcript) row.transcript = contentData.transcript;
                    if (contentData.correct_index !== undefined && row.correct_answer === undefined) row.correct_answer = String(contentData.correct_index);
                    if (contentData.options && Array.isArray(contentData.options) && !row.opt1) {
                        contentData.options.forEach((opt, i) => { if (i < 4) row['opt' + (i+1)] = opt; });
                    }
                    if (contentData.correct_answers && Array.isArray(contentData.correct_answers) && !row.correct_answer) {
                        row.correct_answer = contentData.correct_answers.join(',');
                    }
                }
                return {
                    ...row,
                    _setName: (row.set || '').trim(),
                    _checked: true,
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
            image_mcq: '🖼️ Image MCQ',
            image_description: '🖼️ Image Desc',
            audio_listening: '🎧 Audio Listening',
        };

        const selectAll = document.getElementById('importSelectAll');

        let html = '';
        importRows.forEach((row, idx) => {
            const isSelected = idx === importSelectedIdx;
            const style = row.type || 'usage_cases';
            const title = row.title || 'Untitled';
            const level = row.level || 'Beginner';
            const setName = row._setName || '';
            const preview = row.definition || row.question_text || row.sentence || '';
            const previewTrim = preview.length > 60 ? preview.substring(0, 60) + '...' : preview;
            const styleClass = style === 'multiple_choice' || style === 'image_mcq' ? 'mcq' : (style === 'gap_fill' ? 'gap' : 'text');

            html += `<tr class="${isSelected ? 'selected' : ''}" data-idx="${idx}">
                <td><input type="checkbox" class="import-row-checkbox" data-idx="${idx}" ${row._checked ? 'checked' : ''}></td>
                <td class="text-gray-400 text-xs">${idx + 1}</td>
                <td>${escapeHtml(setName)}</td>
                <td><span class="card-type ${styleClass}">${styleLabels[style] || style}</span></td>
                <td class="import-row-title">${escapeHtml(title)}</td>
                <td><span class="text-xs bg-gray-100 px-2 py-0.5 rounded">${escapeHtml(level)}</span></td>
            </tr>`;
        });

        importPreviewBody.innerHTML = html;

        importPreviewBody.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const idx = parseInt(tr.dataset.idx);
                selectImportRow(idx);
            });
        });

        importPreviewBody.querySelectorAll('.import-row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                if (importRows[idx]) importRows[idx]._checked = e.target.checked;
                if (selectAll) selectAll.checked = importRows.every(r => r._checked);
            });
        });

        if (selectAll) {
            selectAll.onchange = () => {
                const checked = selectAll.checked;
                importRows.forEach(row => { row._checked = checked; });
                importPreviewBody.querySelectorAll('.import-row-checkbox').forEach(cb => { cb.checked = checked; });
            };
        }

        if (importRows.length > 0 && importSelectedIdx < 0) {
            selectImportRow(0);
        }
    }

    function getImportContentData(row, overrideType) {
        const type = overrideType || row.type || 'usage_cases';
        const gf = getImportField;

        if (type === 'multiple_choice' || type === 'image_mcq') {
            const optsStr = gf('importEditOptions') || (row.opt1 ? [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean).join(', ') : '');
            const parts = optsStr.split(',').map(s => s.trim()).filter(Boolean);
            const options = parts.length >= 2 ? parts : ['Option A', 'Option B', 'Option C'];
            return {
                image_url: gf('importEditImageUrl') || row.image_url || '',
                audio_url: gf('importEditAudioUrl') || row.audio_url || '',
                options: options,
                correct_index: parseInt(gf('importEditCorrectIndex') || row.correct_answer || '1'),
                question_text: gf('importEditQuestionText') || row.question_text || 'Select the correct answer:',
                explanation: gf('importEditExplanation') || row.explanation || '',
            };
        }
        if (type === 'gap_fill') {
            const ans = gf('importEditCorrectAnswers') || row.correct_answer || '';
            const answers = ans ? ans.split(',').map(s => s.trim()).filter(Boolean) : ['answer'];
            return {
                sentence: gf('importEditSentence') || row.sentence || 'Complete: ______',
                correct_answers: answers,
                example: gf('importEditExample') || row.example1 || row.example || '',
                image_url: gf('importEditImageUrl') || row.image_url || '',
                audio_url: gf('importEditAudioUrl') || row.audio_url || '',
            };
        }
        if (type === 'image_description') {
            return {
                image_url: gf('importEditImageUrl') || row.image_url || '',
                description: gf('importEditDescription') || row.description || 'No description',
            };
        }
        if (type === 'audio_listening') {
            const ans = gf('importEditCorrectAnswers') || row.correct_answer || '';
            const answers = ans ? ans.split(',').map(s => s.trim()).filter(Boolean) : [];
            return {
                audio_url: gf('importEditAudioUrl') || row.audio_url || '',
                prompt: gf('importEditPrompt') || row.prompt || '',
                correct_answers: answers,
                notes: gf('importEditTranscript') || row.transcript || '',
                transcript: gf('importEditTranscript') || row.transcript || '',
            };
        }
        const ex1 = gf('importEditExample') || row.example1 || '';
        const ex2 = gf('importEditExample2') || row.example2 || '';
        const allExamples = [ex1, ex2].filter(Boolean);
        const ff = [];
        if (document.getElementById('importFfDefinition')?.checked) ff.push('definition');
        if (document.getElementById('importFfUsage1')?.checked) ff.push('usage1');
        if (document.getElementById('importFfExamples')?.checked) ff.push('examples');
        if (document.getElementById('importFfTip')?.checked) ff.push('tip');
        return {
            image_url: gf('importEditImageUrl') || row.image_url || '',
            audio_url: gf('importEditAudioUrl') || row.audio_url || '',
            definition: gf('importEditDefinition') || row.definition || 'No definition',
            usage1: gf('importEditUsage') || row.usage1 || '',
            example1a: ex1,
            examples: allExamples,
            tip: gf('importEditTip') || row.tip || '',
            front_fields: ff,
        };
    }

    function renderImportCardPreview() {
        const idx = importSelectedIdx;
        if (idx < 0 || idx >= importRows.length) {
            document.getElementById('importPreviewSection')?.classList.add('hidden');
            return;
        }
        document.getElementById('importPreviewSection')?.classList.remove('hidden');
        const row = importRows[idx];
        const title = document.getElementById('importEditTitle')?.value || row.title || 'Untitled';
        const type = document.getElementById('importEditStyle')?.value || row.type || 'usage_cases';
        const level = document.getElementById('importEditLevel')?.value || row.level || 'Beginner';
        const contentData = getImportContentData(row, type);

        let frontHtml = '';
        if (type === 'image_mcq') {
            const imageUrl = contentData.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            frontHtml = `
                <div class="flex flex-col md:flex-row gap-3 h-full min-h-[200px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-32 object-contain">` : `<div class="text-5xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-2">
                        <p class="text-sm font-bold text-center md:text-left">Select the correct answer:</p>
                        ${options.map((opt, idx) => `<div class="quiz-option-preview text-sm py-1">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    </div>
                </div>
            `;
        } else if (type === 'image_description') {
            const imageUrl = contentData.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('uploads/'));
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🖼️ ${escapeHtml(title)}</div>
                    ${hasImage ? `<img src="${escapeHtml(imageUrl)}" class="max-h-40 rounded-xl shadow-md mb-2 object-contain">` : `<div class="text-5xl mb-2">🖼️</div>`}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip</p>
                </div>
            `;
        } else if (type === 'audio_listening') {
            const audioUrl = contentData.audio_url || '';
            const hasAudio = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('uploads/'));
            const prompt = contentData.prompt || '';
            const isInteractive = !!(prompt || (contentData.correct_answers && contentData.correct_answers.length));
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <div class="text-xl font-bold marker-underline mb-3">🎧 ${escapeHtml(title)}</div>
                    ${hasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : `<div class="text-5xl mb-2">🎧</div>`}
                    ${prompt ? `<p class="text-sm bg-gray-100 p-2 rounded-xl mb-1">${escapeHtml(prompt)}</p>` : ''}
                    ${isInteractive ? `<input type="text" placeholder="Type answer..." class="w-full p-2 text-sm border-2 rounded-xl mb-2" disabled>` : ''}
                    <p class="text-xs text-gray-400 mt-2">👆 Tap card to flip${isInteractive ? ' after answering' : ''}</p>
                </div>
            `;
        } else if (type === 'multiple_choice') {
            const options = contentData.options || ['Option A', 'Option B', 'Option C'];
            const mcImageUrl = contentData.image_url || '';
            const mcAudioUrl = contentData.audio_url || '';
            const mcHasImage = mcImageUrl && (mcImageUrl.startsWith('http://') || mcImageUrl.startsWith('https://') || mcImageUrl.startsWith('uploads/'));
            const mcHasAudio = mcAudioUrl && (mcAudioUrl.startsWith('http://') || mcAudioUrl.startsWith('https://') || mcAudioUrl.startsWith('uploads/'));
            frontHtml = `
                <div class="text-center">
                    ${mcHasImage ? `<img src="${escapeHtml(mcImageUrl)}" class="max-h-32 object-contain mx-auto mb-2 rounded-lg">` : ''}
                    ${mcHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                    <div class="text-4xl mb-3">❓</div>
                    <p class="text-lg mb-4 font-bold">${escapeHtml(contentData.question_text || 'Select the correct answer:')}</p>
                    ${options.map((opt, idx) => `<div class="quiz-option-preview text-base">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    <p class="text-xs text-gray-400 mt-3">👆 Tap answer, then flip card</p>
                </div>
            `;
        } else if (type === 'gap_fill') {
            const gapImageUrl = contentData.image_url || '';
            const gapAudioUrl = contentData.audio_url || '';
            const gapHasImage = gapImageUrl && (gapImageUrl.startsWith('http://') || gapImageUrl.startsWith('https://') || gapImageUrl.startsWith('uploads/'));
            const gapHasAudio = gapAudioUrl && (gapAudioUrl.startsWith('http://') || gapAudioUrl.startsWith('https://') || gapAudioUrl.startsWith('uploads/'));
            const gapMediaHtml = (gapHasImage || gapHasAudio) ? `
                <div class="w-full flex justify-center mb-2">
                    ${gapHasImage ? `<img src="${escapeHtml(gapImageUrl)}" class="max-h-32 object-contain rounded-lg">` : ''}
                    ${gapHasAudio ? `<div class="text-sm">🔊 Audio file provided</div>` : ''}
                </div>
            ` : '';
            frontHtml = `
                <div class="text-center">
                    ${gapMediaHtml}
                    <div class="text-4xl mb-3">✏️</div>
                    <p class="text-lg mb-4 font-bold">Complete the sentence:</p>
                    <p class="text-base bg-gray-100 p-3 rounded-xl">${escapeHtml(contentData.sentence || 'Complete: ______')}</p>
                    <input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6">
                    <p class="text-xs text-gray-400 mt-3">👆 Type answer, then flip</p>
                </div>
            `;
        } else {
            const genImageUrl = contentData.image_url || '';
            const genAudioUrl = contentData.audio_url || '';
            const genHasImage = genImageUrl && (genImageUrl.startsWith('http://') || genImageUrl.startsWith('https://') || genImageUrl.startsWith('uploads/'));
            const genHasAudio = genAudioUrl && (genAudioUrl.startsWith('http://') || genAudioUrl.startsWith('https://') || genAudioUrl.startsWith('uploads/'));
            const defaultFront = type === 'deep_dive' ? [] : ['definition'];
            const frontFields = Array.isArray(contentData.front_fields) ? contentData.front_fields : defaultFront;
            const frontParts = [];
            if (frontFields.includes('definition') && contentData.definition) frontParts.push(`<div class="text-base text-center px-2">${formatBreaks(escapeHtml(contentData.definition))}</div>`);
            if (frontFields.includes('usage1') && contentData.usage1) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">${formatBreaks(escapeHtml(contentData.usage1))}</div>`);
            if (frontFields.includes('tip') && contentData.tip) frontParts.push(`<div class="text-sm text-center text-gray-700 mt-1">💡 ${formatBreaks(escapeHtml(contentData.tip))}</div>`);
            frontHtml = `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    ${genHasImage ? `<img src="${escapeHtml(genImageUrl)}" class="max-h-32 object-contain rounded-lg mb-2">` : ''}
                    ${genHasAudio ? `<div class="text-sm mb-2">🔊 Audio file provided</div>` : ''}
                    <div class="text-2xl text-center font-bold mb-2">${escapeHtml(title)}</div>
                    ${frontParts.join('')}
                    <p class="text-xs text-gray-400 mt-4">👆 Tap card to flip</p>
                </div>
            `;
        }

        let backHtml = '';
        if (type === 'image_mcq') {
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
        } else if (type === 'image_description') {
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(contentData.description || 'Description would appear here.'))}</p>
                    </div>
                </div>
            `;
        } else if (type === 'audio_listening') {
            const transcript = contentData.transcript || contentData.notes || '';
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-green-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    ${transcript ? `<div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3"><p class="text-lg">${formatBreaks(escapeHtml(transcript))}</p></div>` : '<p class="text-gray-500">(Transcript)</p>'}
                </div>
            `;
        } else if (type === 'multiple_choice') {
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
        } else if (type === 'gap_fill') {
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
            const exList = contentData.examples || [];
            const exHtml = exList.length
                ? exList.map((ex, i) => `<p class="text-md text-gray-600">📝 Example ${i+1}: ${formatBreaks(escapeHtml(ex))}</p>`).join('')
                : (contentData.example1a ? `<p class="text-md text-gray-600">📝 Example: ${formatBreaks(escapeHtml(contentData.example1a))}</p>` : '');
            backHtml = `
                <div class="text-center">
                    <h3 class="text-2xl text-blue-700 marker-underline mb-3">${escapeHtml(title)}</h3>
                    <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                        <p class="text-lg">${formatBreaks(escapeHtml(contentData.definition || 'Definition would appear here.'))}</p>
                    </div>
                    ${contentData.usage1 ? `<p class="text-md text-gray-600 mt-2">💡 Usage: ${formatBreaks(escapeHtml(contentData.usage1))}</p>` : ''}
                    ${exHtml ? `<div class="mt-2">${exHtml}</div>` : ''}
                    ${contentData.tip ? `<div class="mt-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3"><p class="text-md text-yellow-800">💡 Tip: ${formatBreaks(escapeHtml(contentData.tip))}</p></div>` : ''}
                </div>
            `;
        }

        document.getElementById('importFrontPreview').innerHTML = frontHtml;
        document.getElementById('importBackPreview').innerHTML = backHtml;
    }

    function selectImportRow(idx) {
        if (idx < 0 || idx >= importRows.length) return;
        importSelectedIdx = idx;
        const row = importRows[idx];

        importEditTitle.value = row.title || '';
        importEditStyle.value = row.type || 'usage_cases';
        importEditLevel.value = row.level || 'Beginner';

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

        renderImportEditorFields(row.type || 'usage_cases', row);

        importPreviewBody.querySelectorAll('tr').forEach(tr => {
            tr.classList.toggle('selected', parseInt(tr.dataset.idx) === idx);
        });

        renderImportCardPreview();
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

        const type = row.type;
        row.definition = getImportField('importEditDefinition');
        row.question_text = getImportField('importEditQuestionText');
        row.sentence = getImportField('importEditSentence');
        row.correct_answer = getImportField('importEditCorrectAnswer') || getImportField('importEditCorrectAnswers') || '';
        row.explanation = getImportField('importEditExplanation');
        row.image_url = getImportField('importEditImageUrl');
        row.audio_url = getImportField('importEditAudioUrl');
        row.description = getImportField('importEditDescription');
        row.prompt = getImportField('importEditPrompt');
        row.transcript = getImportField('importEditTranscript');
        row.example1 = getImportField('importEditExample') || row.example1;
        row.example2 = getImportField('importEditExample2') || row.example2;
        row.usage1 = getImportField('importEditUsage') || row.usage1;
        row.tip = getImportField('importEditTip');

        if (type === 'multiple_choice' || type === 'image_mcq') {
            const opts = getImportField('importEditOptions');
            const parts = opts.split(',').map(s => s.trim()).filter(Boolean);
            parts.forEach((opt, i) => { if (i < 4) row['opt' + (i + 1)] = opt; });
            row.correct_answer = getImportField('importEditCorrectIndex');
        } else if (type === 'gap_fill' || type === 'audio_listening') {
            row.correct_answer = getImportField('importEditCorrectAnswers');
        }
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

    document.getElementById('importCreateSetBtn')?.addEventListener('click', async () => {
        const name = importNewSetName.value.trim();
        if (!name) { showToast('Enter a set name', 'warning'); return; }
        const response = await adminFetch('admin_cards.php?action=create_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name })
        });
        const result = await response.json();
        if (result.success) {
            await refreshSets();
            if (result.id && importSetSelector) importSetSelector.value = String(result.id);
            importNewSetName.value = '';
        } else {
            showToast('❌ ' + (result.error || 'Error creating set'), 'error');
        }
    });

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

    document.getElementById('importExecuteBtn')?.addEventListener('click', async () => {
        const checkedRows = importRows.filter(r => r._checked);
        if (checkedRows.length === 0) { showToast('Select at least one row to import', 'warning'); return; }
        if (!confirm(`Import ${checkedRows.length} of ${importRows.length} card(s)?`)) return;

        const csvCols = ['id', 'set', 'set_id', 'type', 'title', 'level', 'question_text', 'definition', 'sentence', 'opt1', 'opt2', 'opt3', 'opt4', 'correct_answer', 'explanation', 'example1', 'example2', 'example3', 'example4', 'usage1', 'tip', 'image_url', 'description', 'audio_url', 'prompt', 'transcript', 'front_fields'];
        const csvRows = [csvCols.join(',')];

        checkedRows.forEach(row => {
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
                } else {
                    val = row[col] !== undefined ? String(row[col]) : '';
                }
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
            const response = await adminFetch('api/import_csv.php', { method: 'POST', body: formData });
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

    importEditTitle?.addEventListener('input', renderImportCardPreview);
    importEditStyle?.addEventListener('change', () => {
        if (importSelectedIdx >= 0 && importSelectedIdx < importRows.length) {
            const row = importRows[importSelectedIdx];
            renderImportEditorFields(importEditStyle.value, row);
        }
        renderImportCardPreview();
    });
    importEditLevel?.addEventListener('change', renderImportCardPreview);

    loadCardSets().then(async () => {
        const params = new URLSearchParams(window.location.search);
        const focusCardId = params.get('focus_card');
        const returnUrl = params.get('return_url');

        if (returnUrl) {
            const header = document.querySelector('.fixed-header .flex');
            if (header) {
                const backLink = document.createElement('a');
                backLink.href = returnUrl;
                backLink.className = 'btn btn-secondary btn-sm';
                backLink.innerHTML = '← Back to Study';
                header.prepend(backLink);
            }
        }

        if (focusCardId) {
            try {
                const res = await adminFetch(`admin_cards.php?action=get_card&card_id=${focusCardId}&t=${Date.now()}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                const data = await res.json();
                if (data.success && data.card) {
                    const card = data.card;
                    const setId = card.set_id;
                    if (setId) {
                        setSelector.value = setId;
                        setSelector.dispatchEvent(new Event('change'));
                        // After cards load, find and select this card
                        const checkCards = setInterval(() => {
                            const found = currentCards.find(c => c.id == focusCardId);
                            if (found) {
                                clearInterval(checkCards);
                                loadCardIntoEditor(found);
                                document.querySelectorAll('.card-item').forEach(i => {
                                    i.classList.toggle('selected', parseInt(i.dataset.id) == focusCardId);
                                });
                                selectedCardId = parseInt(focusCardId);
                            }
                        }, 200);
                        // Stop checking after 10 seconds
                        setTimeout(() => clearInterval(checkCards), 10000);
                    }
                }
            } catch (e) {
                console.error('Error loading focused card:', e);
            }
        }
    });
})();
