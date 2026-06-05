(function () {
    let currentCards = [];
    let currentEditingCard = null;
    let selectedCardId = null;
    let currentSetId = null;
    let _filteredCardIds = [];

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

        const styles = [];
        if (document.getElementById('styleText').checked) styles.push('text');
        if (document.getElementById('styleMcq').checked) styles.push('mcq');
        if (document.getElementById('styleGap').checked) styles.push('gap');
        if (document.getElementById('styleImage').checked) styles.push('image');
        if (document.getElementById('styleAudio').checked) styles.push('audio');

        cardListContainer.innerHTML = '<div class="text-center py-8"><div class="loader"></div> Loading cards...</div>';

        const response = await fetch(`admin_cards.php?action=get_cards&set_id=${setId}&t=${Date.now()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await response.json();
        if (data.success) {
            currentCards = data.cards;
            renderCardList(levels, styles);
        } else {
            cardListContainer.innerHTML = '<div class="text-center text-red-500 py-8">Error loading cards</div>';
        }
    }

    function getSearchTerm() {
        const input = document.getElementById('cardSearchInput');
        return input ? input.value.trim().toLowerCase() : '';
    }

    function getStyleClass(patternType) {
        if (patternType === 'multiple_choice') return 'mcq';
        if (patternType === 'image_mcq') return 'image';
        if (patternType === 'gap_fill') return 'gap';
        if (patternType === 'image_description') return 'image';
        if (patternType === 'audio_listening') return 'audio';
        return 'text';
    }

    function renderCardList(levelFilter = [], styleFilter = []) {
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

        if (styleFilter.length > 0) {
            filteredCards = filteredCards.filter(card => styleFilter.includes(getStyleClass(card.pattern_type)));
        }

        _filteredCardIds = filteredCards.map(c => c.id);

        if (!filteredCards.length) {
            cardListContainer.innerHTML = '<div class="text-center text-gray-500 py-8">No cards matching filter in this set</div>';
            return;
        }

        let html = '';
        filteredCards.forEach(card => {
            const isSelected = (selectedCardId === card.id);
            const typeClass = getStyleClass(card.pattern_type);
            const typeLabels = { mcq: 'MCQ', gap: 'Gap', image: 'Image', audio: 'Audio', text: 'Text' };
            const typeLabel = typeLabels[typeClass] || 'Text';
            html += `
                <div class="card-item ${isSelected ? 'selected' : ''}" data-id="${card.id}">
                    <div class="flex justify-between items-center">
                        <span class="card-title">${escapeHtml(card.title || 'Untitled')}</span>
                        <span class="card-type ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="card-meta">${escapeHtml(card.level || 'Beginner')} · ID ${card.id}</div>
                    <button class="card-delete-btn" title="Delete card">&times;</button>
                </div>
            `;
        } else if (pattern === 'image_mcq') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            return `
                <div class="flex flex-col md:flex-row gap-2 w-full min-h-[200px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${hasImage ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="max-h-32 md:max-h-full w-full object-contain rounded-lg" onerror="this.style.display='none'">` : `<div class="text-4xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-1" id="testMcqOptions">
                        ${options.map((opt, idx) => `<div class="quiz-option text-xs py-1.5 px-2" data-idx="${idx}">${String.fromCharCode(65+idx)}. ${formatBreaks(escapeHtml(opt))}</div>`).join('')}
                        <p class="text-xs text-gray-400 mt-1">👆 Tap your answer, then flip</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'image_description') {
            contentData.image_url = row.image_url || '';
            contentData.description = row.description || row.definition || 'No description';
        } else if (pattern === 'audio_listening') {
            contentData.audio_url = row.audio_url || '';
            contentData.prompt = row.prompt || row.question_text || '';
            contentData.transcript = row.transcript || row.correct_answer || '';
            if (row.correct_answer && !row.transcript) {
                contentData.correct_answers = row.correct_answer.split(',').map(s => s.trim());
            }
        } else {
            contentData.definition = row.definition || row.question_text || 'No definition';
            contentData.usage1 = row.usage1 || '';
            contentData.example1a = row.example1 || '';
            contentData.tip = row.tip || '';
        }

        openTestCardModal({
            title: row.title || 'Flashcard',
            pattern_type: pattern,
            question_text: pattern === 'multiple_choice' ? (contentData.question_text || '') : '',
            content_data: contentData,
        });
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
        } else if (row.type === 'multiple_choice' || row.type === 'image_mcq') {
            if (row.type === 'multiple_choice') row.question_text = importEditDefinition.value;
            row.image_url = row.type === 'image_mcq' ? importEditDefinition.value : row.image_url || '';
            row.opt1 = importEditOpt1 ? importEditOpt1.value : '';
            row.opt2 = importEditOpt2 ? importEditOpt2.value : '';
            row.opt3 = importEditOpt3 ? importEditOpt3.value : '';
            row.opt4 = importEditOpt4 ? importEditOpt4.value : '';
            row.correct_answer = importEditCorrectIdx ? importEditCorrectIdx.value : '0';
        } else if (row.type === 'image_description') {
            row.image_url = importEditDefinition.value;
            row.description = extra;
        } else if (row.type === 'audio_listening') {
            row.audio_url = importEditDefinition.value;
            row.transcript = extra;
            row.correct_answer = extra;
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
        let extra;
        if (style === 'gap_fill') {
            extra = row.correct_answer || '';
        } else if (style === 'multiple_choice') {
            extra = row.correct_answer || row.tip || '';
        } else {
            extra = row.example1 || row.usage1 || row.tip || '';
        }
        const example = row.example1 || row.usage1 || row.tip || '';

        let frontHtml = '';
        let backHtml = '';

        if (style === 'multiple_choice') {
            const opts = [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean);
            const correctIdx = parseInt(row.correct_answer) || 0;
            const correctText = opts[correctIdx] || extra;
            frontHtml = `
                <div class="text-center">
                    <div class="text-3xl mb-1">❓</div>
                    <p class="text-lg font-bold">${formatBreaks(escapeHtml(title))}</p>
                    <p class="text-sm text-gray-600 mt-1">${formatBreaks(escapeHtml(definition || 'Select the correct answer:'))}</p>
                    <div class="mt-2 text-left text-xs space-y-1">
                        ${opts.map((o, i) => `<div class="bg-gray-100 p-1.5 rounded ${i === correctIdx ? 'ring-2 ring-green-400' : ''}">${formatBreaks(escapeHtml(o))}</div>`).join('')}
                    </div>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-green-700 marker-underline mb-1">✓ Correct Answer</div>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300">
                        <p class="text-base font-bold">${formatBreaks(escapeHtml(correctText))}</p>
                    </div>
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
        } else if (style === 'image_mcq') {
            const imageUrl = row.image_url || '';
            const opts = [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean);
            const correctIdx = parseInt(row.correct_answer) || 0;
            const correctText = opts[correctIdx] || extra;
            frontHtml = `
                <div class="flex flex-col md:flex-row gap-2 min-h-[150px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" class="max-h-24 md:max-h-full w-full object-contain rounded-lg" onerror="this.style.display='none'">` : `<div class="text-3xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-1 text-left text-xs">
                        ${opts.map((o, i) => `<div class="bg-gray-100 p-1.5 rounded ${i === correctIdx ? 'ring-2 ring-green-400' : ''}">${formatBreaks(escapeHtml(o))}</div>`).join('')}
                    </div>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-green-700 marker-underline mb-1">✓ Correct Answer</div>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300">
                        <p class="text-base font-bold">${formatBreaks(escapeHtml(correctText))}</p>
                    </div>
                    ${example ? `<p class="text-xs text-gray-600 mt-1">📝 ${formatBreaks(escapeHtml(example))}</p>` : ''}
                </div>
            `;
        } else if (style === 'image_description') {
            const imageUrl = row.image_url || '';
            const description = row.description || definition || 'Description';
            frontHtml = `
                <div class="text-center">
                    <div class="text-3xl mb-1">🖼️</div>
                    <p class="text-sm font-bold">${formatBreaks(escapeHtml(title))}</p>
                    ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="mx-auto mt-2 max-h-32 rounded-lg border" onerror="this.alt='Image not found'" />` : `<div class="mx-auto mt-2 w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No image</div>`}
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-blue-700 marker-underline mb-1">${formatBreaks(escapeHtml(title))}</div>
                    <div class="bg-blue-50 p-2 rounded-xl border-2 border-blue-300">
                        <p class="text-sm">${formatBreaks(escapeHtml(description))}</p>
                    </div>
                </div>
            `;
        } else if (style === 'audio_listening') {
            const transcript = row.transcript || row.correct_answer || '';
            const prompt = row.question_text || definition || 'Listen and answer:';
            frontHtml = `
                <div class="text-center">
                    <div class="text-3xl mb-1">🎧</div>
                    <p class="text-sm font-bold">${formatBreaks(escapeHtml(title))}</p>
                    <p class="text-xs text-gray-500 mt-1">${formatBreaks(escapeHtml(prompt))}</p>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-green-700 marker-underline mb-1">✓ Transcript</div>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300">
                        <p class="text-sm">${formatBreaks(escapeHtml(transcript || 'Transcript not provided'))}</p>
                    </div>
                </div>
            `;
        } else {
            frontHtml = `
                <div class="flex flex-col items-center justify-center">
                    <div class="text-2xl text-center font-bold">${formatBreaks(escapeHtml(title))}</div>
                </div>
            `;
            backHtml = `
                <div class="text-center">
                    <div class="text-base text-blue-700 marker-underline mb-1">${formatBreaks(escapeHtml(title))}</div>
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

    document.getElementById('importDeleteCardBtn')?.addEventListener('click', () => {
        if (importSelectedIdx < 0) { alert('Select a row first'); return; }
        if (!confirm('Remove this row from import?')) return;
        importRows.splice(importSelectedIdx, 1);
        importSelectedIdx = -1;
        renderImportPreview();
        if (importRows.length > 0) selectImportRow(0);
    });

    document.getElementById('importTestCardBtn')?.addEventListener('click', openImportTestCardModal);

    // Create new set from mapping bar
    document.getElementById('importCreateSetBtn')?.addEventListener('click', async () => {
        const name = importNewSetName.value.trim();
        if (!name) { alert('Enter a set name'); return; }
        const descInput = document.getElementById('importNewSetDesc');
        const response = await fetch('admin_cards.php?action=create_set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ name, description: descInput ? descInput.value.trim() : '' })
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
            if (descInput) descInput.value = '';
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
            const style = importEditStyle.value;
            const extra = importEditExtra.value;
            let correctAnswer = extra;
            let example = extra;
            if (style === 'multiple_choice' || style === 'image_mcq') {
                correctAnswer = importEditCorrectIdx ? importEditCorrectIdx.value : '0';
                example = '';
            }
            const base = {
                title: importEditTitle.value,
                type: style,
                level: importEditLevel.value,
                definition: importEditDefinition.value,
                question_text: importEditDefinition.value,
                sentence: importEditDefinition.value,
                example1: example,
                usage1: example,
                tip: example,
                correct_answer: correctAnswer,
            };
            if (style === 'image_mcq') {
                base.image_url = importEditDefinition.value;
                base.correct_answer = importEditCorrectIdx ? importEditCorrectIdx.value : '0';
            } else if (style === 'image_description') {
                base.image_url = importEditDefinition.value;
                base.description = extra;
            } else if (style === 'audio_listening') {
                base.audio_url = importEditDefinition.value;
                base.transcript = extra;
                base.correct_answer = extra;
            }
            renderImportCardPreview(base);
        }
    }
    function updateImportEditorFields() {
        const style = importEditStyle.value;
        if (!importEditDefGroup || !importEditExtraGroup || !importEditMcqFields) return;
        const defLabel = importEditDefGroup.querySelector('.field-label');
        const extraLabel = importEditExtraGroup.querySelector('.field-label');
        importEditMcqFields.classList.add('hidden');
        if (style === 'multiple_choice' || style === 'image_mcq') {
            importEditMcqFields.classList.remove('hidden');
            if (defLabel) defLabel.textContent = style === 'image_mcq' ? 'Image URL' : 'Question Text';
            if (extraLabel) extraLabel.textContent = 'Explanation';
            importEditDefinition.placeholder = style === 'image_mcq' ? 'https://example.com/image.jpg' : 'Question text for the MCQ...';
            importEditExtra.placeholder = 'Explanation shown after answering...';
        } else if (style === 'gap_fill') {
            if (defLabel) defLabel.textContent = 'Sentence';
            if (extraLabel) extraLabel.textContent = 'Correct Answers';
            importEditDefinition.placeholder = 'Sentence with blank (_______)';
            importEditExtra.placeholder = 'Comma-separated correct answers...';
        } else if (style === 'image_description') {
            if (defLabel) defLabel.textContent = 'Image URL';
            if (extraLabel) extraLabel.textContent = 'Description';
            importEditDefinition.placeholder = 'https://example.com/image.jpg';
            importEditExtra.placeholder = 'Description shown on back...';
        } else if (style === 'audio_listening') {
            if (defLabel) defLabel.textContent = 'Audio URL';
            if (extraLabel) extraLabel.textContent = 'Transcript / Answer';
            importEditDefinition.placeholder = 'https://example.com/audio.mp3';
            importEditExtra.placeholder = 'Transcript or comma-separated answers...';
        } else {
            if (defLabel) defLabel.textContent = 'Definition';
            if (extraLabel) extraLabel.textContent = 'Example / Tip';
            importEditDefinition.placeholder = 'Definition, notes...';
            importEditExtra.placeholder = 'Example, usage1, or tip...';
        }
    }

    importEditStyle.addEventListener('change', () => {
        updateImportEditorFields();
        refreshImportPreviewFromEditor();
    });
    importEditTitle.addEventListener('input', refreshImportPreviewFromEditor);
    importEditLevel.addEventListener('change', refreshImportPreviewFromEditor);
    importEditDefinition.addEventListener('input', refreshImportPreviewFromEditor);
    importEditExtra.addEventListener('input', refreshImportPreviewFromEditor);
    [importEditOpt1, importEditOpt2, importEditOpt3, importEditOpt4, importEditCorrectIdx].forEach(el => {
        if (el) el.addEventListener('input', refreshImportPreviewFromEditor);
    });

    // Execute import
    document.getElementById('importExecuteBtn')?.addEventListener('click', async () => {
        const selectedRows = importRows.filter(r => r._selected !== false);
        if (selectedRows.length === 0) { alert('No rows selected for import'); return; }
        if (!confirm(`Import ${selectedRows.length} card${selectedRows.length > 1 ? 's' : ''}?`)) return;

        // Build CSV from selected rows
        const csvCols = ['id', 'set', 'set_id', 'type', 'title', 'level', 'definition', 'question_text', 'sentence', 'example1', 'example2', 'usage1', 'tip', 'correct_answer', 'explanation', 'opt1', 'opt2', 'opt3', 'opt4', 'image_url', 'description', 'audio_url', 'prompt', 'transcript'];
        const csvRows = [csvCols.join(',')];

        selectedRows.forEach(row => {
            const vals = csvCols.map(col => {
                let val = '';
                if (col === 'id') {
                    val = row.id || '';
                } else if (col === 'set') {
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
                } else if (col === 'image_url') {
                    val = row.image_url || '';
                } else if (col === 'description') {
                    val = row.description || '';
                } else if (col === 'audio_url') {
                    val = row.audio_url || '';
                } else if (col === 'prompt') {
                    val = row.prompt || '';
                } else if (col === 'transcript') {
                    val = row.transcript || '';
                } else if (col === 'correct_answer') {
                    val = row.correct_answer || '';
                } else if (col === 'opt1' || col === 'opt2' || col === 'opt3' || col === 'opt4') {
                    val = row[col] || '';
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
                if (result.skipped > 0) msg += `\n⏭️ ${result.skipped} duplicate(s) skipped.`;
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

    // === Test Card Popup ===
    const testCardModal = document.getElementById('testCardModal');
    const closeTestCardBtn = document.getElementById('closeTestCardBtn');
    const testCardFront = document.getElementById('testCardFront');
    const testCardBack = document.getElementById('testCardBack');
    const testFlipBtn = document.getElementById('testFlipBtn');
    const testMissBtn = document.getElementById('testMissBtn');
    const testHitBtn = document.getElementById('testHitBtn');
    const testCardFeedback = document.getElementById('testCardFeedback');
    const testCardFeedbackMsg = document.getElementById('testCardFeedbackMsg');
    const testCardFeedbackDetail = document.getElementById('testCardFeedbackDetail');
    let testQuizState = {};
    let testFlipped = false;
    let testAnswered = false;
    let _testCardData = null;

    function renderTestCardFront(card) {
        const pattern = card.pattern_type;
        const data = card.content_data || {};
        const title = card.title || 'Flashcard';

        if (pattern === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const gridClass = options.length > 3 ? 'grid gap-2' : 'space-y-2';
            return `
                <div class="text-center w-full">
                    <p class="text-base mb-2 font-bold">❓ ${formatBreaks(escapeHtml(card.question_text || 'Select the correct answer:'))}</p>
                    <div class="${gridClass}" id="testMcqOptions">
                        ${options.map((opt, idx) => `<div class="quiz-option text-sm" data-idx="${idx}">${String.fromCharCode(65+idx)}. ${formatBreaks(escapeHtml(opt))}</div>`).join('')}
                    </div>
                    <p class="text-xs text-gray-400 mt-2">👆 Tap your answer, then flip</p>
                </div>
            `;
        } else if (pattern === 'image_mcq') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            return `
                <div class="flex flex-col md:flex-row gap-2 w-full min-h-[200px]">
                    <div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">
                        ${hasImage ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="max-h-32 md:max-h-full w-full object-contain rounded-lg" onerror="this.style.display='none'">` : `<div class="text-4xl text-gray-300">🖼️</div>`}
                    </div>
                    <div class="flex flex-col justify-center md:w-1/2 gap-1" id="testMcqOptions">
                        ${options.map((opt, idx) => `<div class="quiz-option text-xs py-1.5 px-2" data-idx="${idx}">${String.fromCharCode(65+idx)}. ${formatBreaks(escapeHtml(opt))}</div>`).join('')}
                        <p class="text-xs text-gray-400 mt-1">👆 Tap your answer, then flip</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'gap_fill') {
            const sentence = data.sentence || 'Complete the sentence: ______';
            return `
                <div class="text-center w-full">
                    <p class="text-base mb-1 font-bold">✏️ Complete the sentence:</p>
                    <p class="text-sm bg-gray-100 p-3 rounded-xl mb-1">${formatBreaks(escapeHtml(sentence))}</p>
                    <input type="text" id="testGapFillInput" placeholder="Type your answer..." class="w-full p-2 text-sm border-2 rounded-xl" autocomplete="off">
                    <p class="text-xs text-gray-400 mt-2">👆 Type answer, then flip</p>
                </div>
            `;
        } else if (pattern === 'image_description') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
            return `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <h1 class="text-lg text-center font-bold marker-underline mb-2">🖼️ ${formatBreaks(escapeHtml(title))}</h1>
                    ${hasImage ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="max-h-32 rounded-lg shadow mb-1 object-contain" onerror="this.style.display='none'">` : `<div class="text-4xl mb-1">🖼️</div>`}
                    <p class="text-xs text-gray-400 mt-1">👆 Tap card to flip</p>
                </div>
            `;
        } else if (pattern === 'audio_listening') {
            const audioUrl = data.audio_url || '';
            const hasAudio = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('uploads/'));
            const prompt = data.prompt || '';
            const isInteractive = !!(prompt || (data.correct_answers && data.correct_answers.length));
            return `
                <div class="flex flex-col items-center justify-center min-h-[200px] w-full">
                    <h1 class="text-lg text-center font-bold marker-underline mb-2">🎧 ${formatBreaks(escapeHtml(title))}</h1>
                    ${hasAudio ? `<audio controls class="w-full max-w-xs mb-1" src="${escapeHtml(audioUrl)}">Your browser does not support audio.</audio>` : `<div class="text-4xl mb-1">🎧</div>`}
                    ${prompt ? `<p class="text-xs bg-gray-100 p-2 rounded-xl mb-1">${formatBreaks(escapeHtml(prompt))}</p>` : ''}
                    ${isInteractive ? `<input type="text" id="testGapFillInput" placeholder="${data.transcript && !data.correct_answers ? 'Type what you hear...' : 'Type your answer...'}" class="w-full p-2 text-sm border-2 rounded-xl" autocomplete="off">` : ''}
                    <p class="text-xs text-gray-400 mt-1">👆 Tap card to flip${isInteractive ? ' after answering' : ''}</p>
                </div>
            `;
        } else {
            return `
                <div class="flex flex-col items-center justify-center min-h-[200px]">
                    <h1 class="text-xl text-center font-bold marker-underline">${formatBreaks(escapeHtml(title))}</h1>
                    <p class="text-xs text-gray-400 mt-3">👆 Tap card to flip</p>
                </div>
            `;
        }
    }

    function renderTestCardBack(card) {
        const data = card.content_data || {};
        const pattern = card.pattern_type;
        const title = card.title || 'Flashcard';

        if (pattern === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const correctIdx = data.correct_index !== undefined ? data.correct_index : 1;
            const correctAnswer = options[correctIdx];
            const selectedIdx = testQuizState.selectedIdx;
            const isCorrect = (selectedIdx === correctIdx);
            const explanation = formatBreaks(escapeHtml(data.explanation || ''));
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-green-700 marker-underline mb-2">✓ Answer</h3>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300 mb-2">
                        <p class="text-sm font-bold">${String.fromCharCode(65+correctIdx)}. ${formatBreaks(escapeHtml(correctAnswer))}</p>
                    </div>
                    ${selectedIdx !== undefined && selectedIdx !== null ? `
                    <div class="p-2 rounded-lg mb-2 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        <p class="text-sm">${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</p>
                    </div>
                    ` : '<p class="text-xs text-gray-500 mb-2">You did not select an answer.</p>'}
                    ${explanation ? `<div class="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded-lg">📝 ${explanation}</div>` : ''}
                </div>
            `;
        } else if (pattern === 'image_mcq') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const correctIdx = data.correct_index !== undefined ? data.correct_index : 1;
            const correctAnswer = options[correctIdx];
            const selectedIdx = testQuizState.selectedIdx;
            const isCorrect = (selectedIdx === correctIdx);
            const explanation = formatBreaks(escapeHtml(data.explanation || ''));
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-green-700 marker-underline mb-2">✓ Answer</h3>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300 mb-2">
                        <p class="text-sm font-bold">${String.fromCharCode(65+correctIdx)}. ${formatBreaks(escapeHtml(correctAnswer))}</p>
                    </div>
                    ${selectedIdx !== undefined && selectedIdx !== null ? `
                    <div class="p-2 rounded-lg mb-2 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        <p class="text-sm">${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</p>
                    </div>
                    ` : '<p class="text-xs text-gray-500 mb-2">You did not select an answer.</p>'}
                    ${explanation ? `<div class="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded-lg">📝 ${explanation}</div>` : ''}
                </div>
            `;
        } else if (pattern === 'gap_fill') {
            const correctAnswers = data.correct_answers || ['answer'];
            const userAnswer = testQuizState.userAnswer || '';
            const isMatch = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
            const example = formatBreaks(escapeHtml(data.example || ''));
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-green-700 marker-underline mb-2">✓ Correct Answer</h3>
                    <div class="bg-green-50 p-2 rounded-xl border-2 border-green-300 mb-2">
                        <p class="text-sm font-bold">${formatBreaks(escapeHtml(correctAnswers.join(' / ')))}</p>
                    </div>
                    ${userAnswer ? `
                    <div class="p-2 rounded-lg mb-2 ${isMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        <p class="text-sm">${isMatch ? '✅ Correct!' : '❌ Incorrect'}</p>
                    </div>
                    ` : '<p class="text-xs text-gray-500 mb-2">You did not type an answer.</p>'}
                    ${example ? `<div class="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded-lg">📝 Example: ${example}</div>` : ''}
                </div>
            `;
        } else if (pattern === 'image_description') {
            const description = formatBreaks(escapeHtml(data.description || 'No description'));
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-blue-700 marker-underline mb-2">${formatBreaks(escapeHtml(title))}</h3>
                    <div class="bg-blue-50 p-2 rounded-xl border-2 border-blue-300">
                        <p class="text-sm">${description}</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'audio_listening') {
            const transcript = formatBreaks(escapeHtml(data.transcript || data.notes || ''));
            const correctAnswers = data.correct_answers || [];
            const userAnswer = testQuizState.userAnswer || '';
            let isMatch = false;
            if (userAnswer && correctAnswers.length) {
                isMatch = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
            } else if (userAnswer && data.transcript) {
                isMatch = data.transcript.toLowerCase().trim() === userAnswer.toLowerCase().trim();
            }
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-green-700 marker-underline mb-2">${formatBreaks(escapeHtml(title))}</h3>
                    ${transcript ? `<div class="bg-green-50 p-2 rounded-xl border-2 border-green-300 mb-2"><p class="text-sm">${transcript}</p></div>` : ''}
                    ${userAnswer ? `
                    <div class="p-2 rounded-lg mb-2 ${isMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        <p class="text-sm">${isMatch ? '✅ Correct!' : '❌ Incorrect'}</p>
                    </div>
                    ` : '<p class="text-xs text-gray-500 mb-2">Passive listening — tap Hit if you understood.</p>'}
                </div>
            `;
        } else {
            const definition = formatBreaks(escapeHtml(data.definition || data.usage1 || 'No definition available'));
            const example = formatBreaks(escapeHtml(data.example1a || data.example || ''));
            return `
                <div class="text-center w-full">
                    <h3 class="text-base text-blue-700 marker-underline mb-2">${formatBreaks(escapeHtml(title))}</h3>
                    <div class="bg-blue-50 p-2 rounded-xl border-2 border-blue-300">
                        <p class="text-sm">${definition}</p>
                    </div>
                    ${example ? `<div class="mt-1 p-2 bg-gray-100 rounded-lg"><p class="text-xs"><strong>Example:</strong> ${example}</p></div>` : ''}
                </div>
            `;
        }
    }

    function openTestCardModal(card) {
        _testCardData = card || null;
        if (!card) {
            const title = editTitle.value.trim() || 'Flashcard';
            const patternType = editPatternType.value;
            const contentData = getCurrentContentData();
            card = {
                title,
                pattern_type: patternType,
                question_text: patternType === 'multiple_choice' ? contentData.question_text : '',
                content_data: contentData
            };
        }
        testQuizState = {};
        testFlipped = false;
        testAnswered = false;

        testCardFront.innerHTML = renderTestCardFront(card);
        testCardBack.classList.add('hidden');
        testCardBack.innerHTML = renderTestCardBack(card);
        testFlipBtn.classList.remove('hidden');
        testMissBtn.classList.add('hidden');
        testHitBtn.classList.add('hidden');
        testCardFeedback.classList.add('hidden');
        testCardFeedback.classList.remove('hit', 'miss');
        testCardModal.classList.remove('hidden');

        // Bind MCQ options
        if (card.pattern_type === 'multiple_choice' || card.pattern_type === 'image_mcq') {
            setTimeout(() => {
                document.querySelectorAll('#testMcqOptions .quiz-option').forEach(el => {
                    el.addEventListener('click', function () {
                        document.querySelectorAll('#testMcqOptions .quiz-option').forEach(o => o.classList.remove('selected'));
                        this.classList.add('selected');
                        testQuizState.selectedIdx = parseInt(this.getAttribute('data-idx'));
                        testAnswered = true;
                    });
                });
            }, 50);
        }
    }

    function closeTestCardModal() {
        testCardModal.classList.add('hidden');
        testQuizState = {};
        testFlipped = false;
        testAnswered = false;
        _testCardData = null;
    }

    function openImportTestCardModal() {
        if (importSelectedIdx < 0 || !importRows[importSelectedIdx]) {
            alert('Select a row first');
            return;
        }
        const row = importRows[importSelectedIdx];
        const pattern = row.type || 'usage_cases';
        const contentData = {};

        if (pattern === 'multiple_choice') {
            const opts = [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean);
            contentData.options = opts.length ? opts : ['Option A', 'Option B', 'Option C'];
            contentData.correct_index = parseInt(row.correct_answer) || 0;
            contentData.question_text = row.question_text || row.definition || 'Select the correct answer:';
            contentData.explanation = row.explanation || '';
        } else if (pattern === 'image_mcq') {
            const opts = [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean);
            contentData.image_url = row.image_url || '';
            contentData.options = opts.length ? opts : ['Option A', 'Option B', 'Option C'];
            contentData.correct_index = parseInt(row.correct_answer) || 0;
            contentData.explanation = row.explanation || '';
        } else if (pattern === 'gap_fill') {
            contentData.sentence = row.sentence || row.definition || 'Complete: ______';
            contentData.correct_answers = (row.correct_answer || 'answer').split(',').map(s => s.trim());
            contentData.example = row.example1 || '';
        } else if (pattern === 'image_description') {
            contentData.image_url = row.image_url || '';
            contentData.description = row.description || row.definition || 'No description';
        } else if (pattern === 'audio_listening') {
            contentData.audio_url = row.audio_url || '';
            contentData.prompt = row.prompt || row.question_text || '';
            contentData.transcript = row.transcript || row.correct_answer || '';
            if (row.correct_answer && !row.transcript) {
                contentData.correct_answers = row.correct_answer.split(',').map(s => s.trim());
            }
        } else {
            contentData.definition = row.definition || row.question_text || 'No definition';
            contentData.usage1 = row.usage1 || '';
            contentData.example1a = row.example1 || '';
            contentData.tip = row.tip || '';
        }

        openTestCardModal({
            title: row.title || 'Flashcard',
            pattern_type: pattern,
            question_text: pattern === 'multiple_choice' ? (contentData.question_text || '') : '',
            content_data: contentData,
        });
    }

    testFlipBtn?.addEventListener('click', () => {
        if (testFlipped) return;
        const card = _testCardData || { pattern_type: editPatternType.value };
        const pattern = card.pattern_type;
        // Capture answer before flipping
        if (pattern === 'multiple_choice' || pattern === 'image_mcq') {
            const selected = document.querySelector('#testMcqOptions .quiz-option.selected');
            if (selected) {
                testQuizState.selectedIdx = parseInt(selected.getAttribute('data-idx'));
                testAnswered = true;
            }
        } else if (pattern === 'gap_fill' || pattern === 'audio_listening') {
            const input = document.getElementById('testGapFillInput');
            if (input) {
                testQuizState.userAnswer = input.value.trim();
                testAnswered = true;
            }
        } else {
            testAnswered = true;
        }

        testCardFront.classList.add('hidden');
        testCardBack.classList.remove('hidden');
        testFlipBtn.classList.add('hidden');
        testMissBtn.classList.remove('hidden');
        testHitBtn.classList.remove('hidden');
        testFlipped = true;
    });

    function evaluateTestCard() {
        const card = _testCardData;
        const pattern = card ? card.pattern_type : editPatternType.value;
        const data = card ? card.content_data : getCurrentContentData();
        let isCorrect = false;

        if (pattern === 'multiple_choice' || pattern === 'image_mcq') {
            const correctIdx = data.correct_index !== undefined ? data.correct_index : 1;
            isCorrect = (testQuizState.selectedIdx === correctIdx);
        } else if (pattern === 'gap_fill') {
            const correctAnswers = data.correct_answers || ['answer'];
            isCorrect = correctAnswers.some(ans => ans.toLowerCase() === (testQuizState.userAnswer || '').toLowerCase());
        } else if (pattern === 'audio_listening') {
            const correctAnswers = data.correct_answers || [];
            const userAnswer = testQuizState.userAnswer || '';
            if (correctAnswers.length) {
                isCorrect = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
            } else if (data.transcript) {
                isCorrect = data.transcript.toLowerCase().trim() === userAnswer.toLowerCase().trim();
            } else {
                isCorrect = true;
            }
        } else {
            isCorrect = true;
        }

        testHitBtn.classList.add('hidden');
        testMissBtn.classList.add('hidden');
        testCardFeedback.classList.remove('hidden', 'hit', 'miss');
        testCardFeedback.classList.add(isCorrect ? 'hit' : 'miss');
        testCardFeedbackMsg.textContent = isCorrect ? '✅ Hit! You got it right.' : '❌ Miss. Review this card.';
        testCardFeedbackDetail.textContent = isCorrect
            ? 'Great job! This card would count as a hit in real study.'
            : 'You would need to review this card again. Keep studying!';
    }

    testMissBtn?.addEventListener('click', evaluateTestCard);
    testHitBtn?.addEventListener('click', evaluateTestCard);

    closeTestCardBtn?.addEventListener('click', closeTestCardModal);
    testCardModal?.addEventListener('click', (e) => {
        if (e.target === testCardModal) closeTestCardModal();
    });

    document.getElementById('testCardBtn')?.addEventListener('click', openTestCardModal);

    // Auto-load card from URL param ?focus_card=X
    const urlParams = new URLSearchParams(window.location.search);
    const focusCardId = urlParams.get('focus_card');
    if (focusCardId) {
        (async function focusCard() {
            const res = await fetch(`admin_cards.php?action=get_card&card_id=${focusCardId}&t=` + Date.now(), {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await res.json();
            if (data.success && data.card && data.card.set_id) {
                setSelector.value = data.card.set_id;
                await loadCards(data.card.set_id);
                const el = document.querySelector(`.card-item[data-id="${data.card.id}"]`);
                if (el) {
                    el.click();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        })();
    }

    loadCardSets();
})();
