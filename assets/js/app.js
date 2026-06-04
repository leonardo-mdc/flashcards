(function () {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

    let currentView = 'login';
    let currentStudent = null;
    let currentSet = null;
    let selectedLevels = [];
    let currentCards = [];
    let currentIndex = 0;
    let currentCardObj = null;
    let availableCardSets = [];
    let isRandomMode = false;
    let allDueReviewed = false;
    let currentQuizState = null;
    let isFlipped = false;
    let streakDays = 0;

    const SESSION_STATE_KEY = 'flashcard_session';

    const phpCardSets = window.FLASHCARD_DATA.cardSets;
    const dbConnected = window.FLASHCARD_DATA.dbConnected;
    const loggedInStudent = window.FLASHCARD_DATA.loggedInStudent;

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    function formatBreaks(text) {
        if (!text) return '';
        return String(text).replace(/\\br/g, '<br>').replace(/\\br /g, '<br>');
    }

    const SoundFX = {
        _ctx: null,
        _getCtx() {
            if (!this._ctx) {
                try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
            }
            return this._ctx;
        },
        _play(freq, duration, type, vol) {
            const ctx = this._getCtx();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        },
        correct() {
            this._play(523.25, 0.15, 'sine', 0.12);
            setTimeout(() => this._play(659.25, 0.15, 'sine', 0.12), 100);
            setTimeout(() => this._play(783.99, 0.25, 'sine', 0.12), 200);
        },
        incorrect() {
            this._play(150, 0.15, 'sine', 0.12);
            setTimeout(() => this._play(120, 0.3, 'sine', 0.1), 100);
        },
        flip() {
            this._play(800, 0.08, 'sine', 0.05);
        },
        complete() {
            const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
            notes.forEach((n, i) => setTimeout(() => this._play(n, 0.2, 'sine', 0.1), i * 100));
        },
        click() { this._play(600, 0.04, 'sine', 0.04); }
    };

    function loadSavedData() {
        if (loggedInStudent && loggedInStudent.id) {
            currentStudent = loggedInStudent;
            currentView = 'welcome';
        }
        const session = sessionStorage.getItem(SESSION_STATE_KEY);
        if (session) try { const s = JSON.parse(session);
            if (s.selectedLevels) selectedLevels = s.selectedLevels;
            if (s.currentSet) currentSet = s.currentSet;
            if (s.isRandomMode) isRandomMode = s.isRandomMode;
        } catch (e) {}
    }

    function saveSessionState() {
        sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify({ selectedLevels, currentSet, isRandomMode }));
    }

    function clearStudent() {
        currentStudent = null;
        currentView = 'login';
        render();
    }

    async function apiCall(endpoint, method = 'GET', data = null) {
        try {
            let url = endpoint;
            let options = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
            if (data && method === 'POST') {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(url, options);
            const text = await response.text();
            if (!text || text.trim() === '') return null;
            try { return JSON.parse(text); } catch (e) { return null; }
        } catch (err) { return null; }
    }

    async function loadCardSetsFromAPI() {
        try {
            const res = await apiCall('api/get_sets.php?user_id=' + (currentStudent?.id || 0), 'GET');
            if (res && res.success && res.sets && res.sets.length > 0) {
                availableCardSets = res.sets;
                return availableCardSets;
            }
        } catch (e) {}
        if (phpCardSets && phpCardSets.length > 0) {
            availableCardSets = phpCardSets;
            return availableCardSets;
        }
        availableCardSets = [{ id: 1, name: 'English: Present Simple' }];
        return availableCardSets;
    }

    async function loadCardsFromAPI(setId, levels, studentId, randomMode = false, studentLevel = '') {
        allDueReviewed = false;
        try {
            const body = {
                set_id: (randomMode || setId === null) ? '' : setId.toString(),
                student_id: studentId,
                levels: levels,
                random_mode: randomMode ? 'true' : 'false',
                student_level: studentLevel
            };
            if (randomMode && phpCardSets && phpCardSets.length > 0) {
                const filtered = phpCardSets.filter(s => s.id);
                const restrictedSets = currentStudent?.accessible_set_ids;
                if (restrictedSets && restrictedSets.length > 0) {
                    body.set_ids = restrictedSets;
                }
            }
            const res = await apiCall('api/get_cards.php', 'POST', body);
            if (res && res.success) {
                if (res.all_due_reviewed) allDueReviewed = true;
                if (res.cards && res.cards.length > 0) return res.cards;
            }
        } catch (e) {}
        return [];
    }

    async function loginOrRegister(name, password, action, fullName = '', englishLevel = 'Beginner') {
        const res = await apiCall('api/login.php', 'POST', { name, password, action, full_name: fullName, english_level: englishLevel });
        if (res && res.success && res.student) {
            currentStudent = res.student;
            currentView = 'welcome';
            render();
            return res.student;
        }
        return null;
    }

    async function recordReview(cardId, studentId, quality, wasCorrect) {
        try {
            const res = await apiCall('api/record_review.php', 'POST', { card_id: cardId, user_id: studentId, quality, correct: wasCorrect });
            if (res && res.progress !== undefined) {
                currentStudent.progress = res.progress;
                if (res.english_level) currentStudent.english_level = res.english_level;
                if (res.streak_days !== undefined) streakDays = res.streak_days;
            }
            return res;
        } catch (e) {}
        return null;
    }

    async function loadStats() {
        const res = await apiCall('api/get_stats.php', 'POST', { user_id: currentStudent?.id });
        if (res?.stats) {
            streakDays = res.stats.streak_days || 0;
            if (res?.user) currentStudent.english_level = res.user.english_level;
        }
        return res?.stats || null;
    }

    function spawnConfetti(count = 60) {
        const colors = ['#fbbf24', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#f97316'];
        const container = document.body;
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            el.style.width = (Math.random() * 8 + 4) + 'px';
            el.style.height = (Math.random() * 8 + 4) + 'px';
            el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            el.style.animationDuration = (Math.random() * 2 + 2) + 's';
            el.style.animationDelay = (Math.random() * 1.5) + 's';
            container.appendChild(el);
            setTimeout(() => el.remove(), 5000);
        }
    }

    let statusTimeout;
    function displayStatusMessage(message, type = 'info') {
        const existing = document.getElementById('statusMessage');
        if (existing) existing.remove();
        const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb' };
        const div = document.createElement('div');
        div.id = 'statusMessage';
        div.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${colors[type]}; color: white; padding: 10px 16px; border-radius: 8px; font-size: 12px; z-index: 1000; animation: fadeIn 0.2s;`;
        div.innerHTML = message;
        document.body.appendChild(div);
        if (statusTimeout) clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => div.remove(), 3000);
    }

    const appEl = document.getElementById('appRoot');

    if (!appEl) {
        console.error('Flashcard Studio: #appRoot element not found');
    }

    function render() {
        if (!appEl) return;
        if (currentView === 'login') renderLoginScreen();
        else if (currentView === 'welcome') renderWelcomeScreen();
        else renderStudyScreen();
    }

    function renderLoginScreen() {
        appEl.innerHTML = `
            <div class="whiteboard-card p-4 md:p-6 shadow-2xl screen-fade-in">
                <div class="text-center mb-4 md:mb-5">
                    <h1 class="text-2xl md:text-4xl text-blue-900 marker-underline"><span class="text-3xl md:text-4xl">🎓</span> Flashcard Studio <span class="text-xl md:text-2xl">✏️</span></h1>
                    <p class="text-gray-600 text-sm md:text-lg mt-1">sign in to start studying</p>
                </div>
                <div class="space-y-4 md:space-y-5 max-w-md mx-auto">
                    <div class="marker-border p-3 md:p-4 bg-white/80">
                        <label class="text-lg md:text-xl font-bold text-gray-800 title-font">👤 Username</label>
                        <input type="text" id="authNameInput" placeholder="Username (max 30 chars)" maxlength="30" class="w-full p-2 md:p-2 text-base md:text-lg border-2 rounded-xl mt-1">
                    </div>
                    <div class="marker-border p-3 md:p-4 bg-white/80">
                        <label class="text-lg md:text-xl font-bold text-gray-800 title-font">🔒 Password</label>
                        <input type="password" id="authPasswordInput" placeholder="Enter password" class="w-full p-2 md:p-2 text-base md:text-lg border-2 rounded-xl mt-1">
                    </div>
                    <button id="loginBtn" class="w-full bg-blue-700 text-white py-2 md:py-3 text-lg md:text-xl title-font rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-1 transition-all">🔑 LOG IN</button>
                    <p id="authError" class="text-red-600 text-center hidden"></p>
                </div>
            </div>
        `;

        const showError = (msg) => {
            const el = document.getElementById('authError');
            if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        };

        document.getElementById('loginBtn').addEventListener('click', async () => {
            const btn = document.getElementById('loginBtn');
            if (btn.disabled) return;
            const name = document.getElementById('authNameInput').value.trim();
            const password = document.getElementById('authPasswordInput').value;
            if (!name || !password) { showError('Please fill in all fields'); return; }
            btn.disabled = true;
            btn.textContent = '⏳ Signing in...';
            SoundFX.click();
            const result = await loginOrRegister(name, password, 'login');
            if (!result) { showError('Invalid name or password'); btn.disabled = false; btn.textContent = '🔑 LOG IN'; }
        });

        document.getElementById('authPasswordInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('loginBtn').click();
        });
    }

    function getGapFillHint(card) {
        const title = (card.title || '').toLowerCase();
        const content = card.content_data || {};

        if (title.includes('past') || title.includes('simple past')) {
            return '📝 Use Simple Past tense';
        } else if (title.includes('present perfect')) {
            return '📝 Use Present Perfect (have/has + past participle)';
        } else if (title.includes('modal') || title.includes('can') || title.includes('could') || title.includes('should') || title.includes('must')) {
            return '📝 Use a modal verb (can, could, should, must, might, etc.)';
        } else if (title.includes('future') || title.includes('will')) {
            return '📝 Use Future (will + base verb)';
        } else if (title.includes('continuous') || title.includes('progressive')) {
            return '📝 Use Continuous form (am/is/are/was/were + verb-ing)';
        } else if (title.includes('passive')) {
            return '📝 Use Passive voice (be + past participle)';
        } else if (title.includes('conditional')) {
            return '📝 Use Conditional (would/could/might + base verb)';
        } else if (content.sentence) {
            if (content.sentence.includes('yesterday') || content.sentence.includes('last week') || content.sentence.includes('ago')) {
                return '📝 Hint: This happened in the past → use Simple Past';
            } else if (content.sentence.includes('tomorrow') || content.sentence.includes('next week')) {
                return '📝 Hint: This will happen in the future → use Future (will)';
            } else if (content.sentence.includes('every day') || content.sentence.includes('usually') || content.sentence.includes('always')) {
                return '📝 Hint: This is a habit/routine → use Simple Present';
            } else if (content.sentence.includes('now') || content.sentence.includes('right now')) {
                return '📝 Hint: This is happening now → use Present Continuous';
            }
        }
        return '📝 Type the correct form of the verb in parentheses';
    }

    async function renderWelcomeScreen() {
        appEl.innerHTML = `<div class="whiteboard-card p-4 text-center screen-fade-in"><div class="loader mx-auto mb-2"></div><p>Loading card sets...</p></div>`;
        const sets = await loadCardSetsFromAPI();
        const randomSelected = (currentSet === null || isRandomMode);
        const setsHtml = `<option value="" ${randomSelected ? 'selected' : ''}>🎲 RANDOM MODE - All Sets</option>` +
            sets.map(s => `<option value="${s.id}" ${currentSet?.id == s.id && !randomSelected ? 'selected' : ''}>📚 ${escapeHtml(s.name)}</option>`).join('');

        const stats = await loadStats();

        const streakHtml = streakDays > 0
            ? `<div class="streak-badge">${streakDays} day${streakDays > 1 ? 's' : ''}</div>`
            : '';

        const html = `
            <div class="whiteboard-card p-4 md:p-6 shadow-2xl screen-fade-in">
                <div class="text-center mb-4 md:mb-5">
                    <h1 class="text-2xl md:text-4xl text-blue-900 marker-underline"><span class="text-3xl md:text-4xl">🎓</span> Flashcard Studio <span class="text-xl md:text-2xl">✏️</span></h1>
                    <p class="text-gray-600 text-sm md:text-lg mt-1">spaced repetition · tap card to flip</p>
                </div>
                <div class="space-y-4 md:space-y-5">
                    <div class="md:grid md:grid-cols-2 md:gap-5">
                    <div class="marker-border p-4 md:p-5 bg-white/80">
                        <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                            <label class="text-xl md:text-2xl font-bold text-gray-800 title-font">👤 Student</label>
                            <div class="flex gap-2 items-center">
                                <span class="student-badge">✅ ${escapeHtml(currentStudent?.username || currentStudent?.name)}</span>
                                <button id="editProfileBtn" class="text-xs text-blue-600 underline whitespace-nowrap">✏️ Edit</button>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500 mt-1">📝 ${escapeHtml(currentStudent?.full_name || currentStudent?.username)}</div>
                        <div class="flex gap-4 mt-2 text-sm items-center flex-wrap">
                            <span>🎯 Level: <strong>${escapeHtml(currentStudent?.english_level || 'Beginner')}</strong></span>
                            ${streakHtml}
                            <a href="?logout=1" class="text-xs text-red-600 underline ml-auto">Logout</a>
                        </div>
                    </div>
                    ${stats ? `
                    <div class="marker-border p-4 md:p-5 bg-white/80">
                        <label class="text-xl md:text-2xl font-bold text-gray-800 mb-3 title-font">📈 Study Stats</label>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                            <div class="bg-blue-50 p-3 rounded-xl">
                                <div class="text-2xl font-bold text-blue-700">${stats.total_reviews}</div>
                                <div class="text-xs text-gray-600">Total Reviews</div>
                            </div>
                            <div class="bg-green-50 p-3 rounded-xl">
                                <div class="text-2xl font-bold text-green-700">${stats.correct_count}</div>
                                <div class="text-xs text-gray-600">Correct</div>
                            </div>
                            <div class="bg-red-50 p-3 rounded-xl">
                                <div class="text-2xl font-bold text-red-700">${stats.incorrect_count}</div>
                                <div class="text-xs text-gray-600">Incorrect</div>
                            </div>
                            <div class="bg-purple-50 p-3 rounded-xl">
                                <div class="text-2xl font-bold text-purple-700">${stats.learned_count}</div>
                                <div class="text-xs text-gray-600">Cards Learned</div>
                            </div>
                        </div>
                        <div class="mt-3">
                            <div class="flex justify-between text-xs text-gray-500 mb-1">
                                <span>📊 Learning Progress:</span>
                                <span>${stats.learned_count}/${stats.total_cards}</span>
                            </div>
                            <div class="progress-bar-container" style="max-width:100%;">
                                <div class="progress-bar-fill ${stats.progress < 100 ? 'progress-pulse' : ''}" style="width: ${stats.progress || 0}%"></div>
                                <span class="pct-label">${stats.progress || 0}%</span>
                            </div>
                        </div>
                        ${stats.due_today > 0 ? `<p class="text-xs text-orange-600 mt-2 font-bold">📅 ${stats.due_today} card${stats.due_today > 1 ? 's' : ''} due for review today!</p>` : ''}
                    </div>
                    ` : ''}
                    </div>
                    <div class="marker-border p-4 md:p-5 bg-white/80">
                        <label class="text-xl md:text-2xl font-bold text-gray-800 mb-2 title-font">📖 Card Set</label>
                        <select id="setSelect" class="w-full p-2 md:p-3 text-base md:text-lg border-2 rounded-xl bg-white">${setsHtml}</select>
                        <button id="refreshSetsBtn" class="mt-2 text-xs text-blue-600 underline">⟳ Refresh (show non-empty sets)</button>
                    </div>
                    <div class="marker-border p-4 md:p-5 bg-white/80">
                        <label class="text-xl md:text-2xl font-bold text-gray-800 mb-3 title-font">🎯 Difficulty Levels</label>
                        <p class="text-xs text-gray-500 mb-2">Leave unselected to auto-pick your level (${escapeHtml(currentStudent?.english_level || 'Beginner')})</p>
                        <div class="flex flex-wrap gap-2 md:gap-4">
                            ${['Beginner', 'Intermediate', 'Advanced'].map(lvl => `
                                <button data-level="${lvl}" class="level-picker px-4 md:px-6 py-1 md:py-2 text-sm md:text-xl rounded-full border-2 transition-all ${selectedLevels.includes(lvl) ? 'bg-blue-600 text-white border-blue-800' : 'bg-white border-gray-400 hover:bg-gray-100'}">${lvl}</button>
                            `).join('')}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">💡 Select levels, then click START to filter cards</p>
                    </div>
                    <button id="launchStudyBtn" class="w-full bg-blue-700 text-white py-3 md:py-4 text-xl md:text-2xl title-font rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-1 transition-all">🚀 START STUDYING →</button>
                    <button id="switchStudentBtn" class="w-full text-gray-500 py-2 text-xs md:text-sm underline">↺ Switch student</button>
                </div>
                <div class="teacher-script mt-5 md:mt-6 p-2 md:p-3 text-center text-gray-500 text-xs md:text-sm bg-yellow-50 border border-yellow-200 rounded-lg">
                    💡 Tap any card to flip it! For multiple choice, tap your answer then flip to check.
                </div>
            </div>
        `;
        appEl.innerHTML = html;

        document.querySelectorAll('.level-picker').forEach(btn => {
            btn.addEventListener('click', () => {
                SoundFX.click();
                const lvl = btn.getAttribute('data-level');
                if (selectedLevels.includes(lvl)) {
                    selectedLevels = selectedLevels.filter(l => l !== lvl);
                    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-800');
                    btn.classList.add('bg-white', 'border-gray-400', 'hover:bg-gray-100');
                } else {
                    selectedLevels.push(lvl);
                    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-800');
                    btn.classList.remove('bg-white', 'border-gray-400', 'hover:bg-gray-100');
                }
                saveSessionState();
            });
        });

        document.getElementById('refreshSetsBtn')?.addEventListener('click', async () => {
            SoundFX.click();
            displayStatusMessage('Refreshing card sets (non-empty only)...', 'info');
            const freshSets = await loadCardSetsFromAPI();
            const selectEl = document.getElementById('setSelect');
            if (selectEl && freshSets.length) {
                const randomSelectedNow = (currentSet === null || isRandomMode);
                selectEl.innerHTML = '<option value="" ' + (randomSelectedNow ? 'selected' : '') + '>🎲 RANDOM MODE - All Sets</option>' +
                    freshSets.map(s => `<option value="${s.id}" ${currentSet?.id == s.id && !randomSelectedNow ? 'selected' : ''}>📚 ${escapeHtml(s.name)}</option>`).join('');
                displayStatusMessage(`Loaded ${freshSets.length} card sets`, 'success');
            } else {
                displayStatusMessage('No card sets with cards found!', 'warning');
            }
        });

        document.getElementById('launchStudyBtn')?.addEventListener('click', async () => {
            const launchBtn = document.getElementById('launchStudyBtn');
            if (launchBtn.disabled) return;
            launchBtn.disabled = true;
            SoundFX.click();
            const setSelect = document.getElementById('setSelect');
            const selectedValue = setSelect?.value;
            const randomMode = (selectedValue === "");
            let setId = null;
            if (!randomMode) setId = parseInt(selectedValue);

            const levelsToUse = selectedLevels.length > 0 ? selectedLevels : [];
            const studentLevel = currentStudent?.english_level || '';

            displayStatusMessage(randomMode ? 'Loading random cards from ALL sets...' : `Loading cards...`, 'info');

            isRandomMode = randomMode;
            currentSet = randomMode ? null : { id: setId };
            saveSessionState();

            if (!currentStudent) { if (launchBtn) launchBtn.disabled = false; displayStatusMessage('Not logged in', 'error'); return; }
            const cards = await loadCardsFromAPI(setId, levelsToUse, currentStudent.id, randomMode, studentLevel);
            if (!cards || cards.length === 0) {
                if (allDueReviewed) {
                    currentCards = [];
                    currentIndex = 0;
                    currentView = 'study';
                    render();
                    return;
                }
                if (selectedLevels.length === 0) {
                    displayStatusMessage('No cards at your level. Trying all levels...', 'warning');
                    const fallback = await loadCardsFromAPI(setId, ['Beginner', 'Intermediate', 'Advanced'], currentStudent?.id, randomMode);
                    if (fallback && fallback.length > 0) {
                        currentCards = fallback;
                        currentIndex = 0;
                        currentView = 'study';
                        render();
                        return;
                    }
                }
                if (launchBtn) launchBtn.disabled = false;
                alert('No cards found for the selected filters! Try different difficulty levels.');
                return;
            }
            if (randomMode) {
                for (let i = cards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [cards[i], cards[j]] = [cards[j], cards[i]];
                }
            }
            currentCards = cards;
            currentIndex = 0;
            currentView = 'study';
            render();
        });

        document.getElementById('switchStudentBtn')?.addEventListener('click', () => clearStudent());
        document.getElementById('editProfileBtn')?.addEventListener('click', openEditProfileModal);
    }

    function openEditProfileModal() {
        const existing = document.getElementById('editProfileModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'editProfileModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeIn 0.2s;';
        modal.innerHTML = `
            <div class="whiteboard-card" style="max-width:400px;width:90%;padding:24px;">
                <h3 class="text-lg marker-underline mb-3">✏️ Edit Profile</h3>
                <label class="block font-bold mb-1">Full Name:</label>
                <input type="text" id="editProfileFullName" class="form-input w-full p-2 border-2 rounded-xl mb-3" value="${escapeHtml(currentStudent?.full_name || '')}">
                <label class="block font-bold mb-1">English Level:</label>
                <select id="editProfileLevel" class="form-select w-full p-2 border-2 rounded-xl mb-3 bg-white">
                    <option value="Beginner" ${currentStudent?.english_level === 'Beginner' ? 'selected' : ''}>🔰 Beginner</option>
                    <option value="Intermediate" ${currentStudent?.english_level === 'Intermediate' ? 'selected' : ''}>📚 Intermediate</option>
                    <option value="Advanced" ${currentStudent?.english_level === 'Advanced' ? 'selected' : ''}>🎓 Advanced</option>
                </select>
                <div class="flex gap-2">
                    <button id="saveProfileBtn" class="flex-1 bg-blue-700 text-white py-2 rounded-xl font-bold">💾 Save</button>
                    <button id="cancelProfileBtn" class="flex-1 bg-gray-300 text-gray-800 py-2 rounded-xl font-bold">Cancel</button>
                </div>
                <p id="editProfileError" class="text-red-600 text-center mt-2 hidden"></p>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelProfileBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        document.getElementById('saveProfileBtn').addEventListener('click', async () => {
            const fullName = document.getElementById('editProfileFullName').value.trim();
            const englishLevel = document.getElementById('editProfileLevel').value;

            const res = await apiCall('api/login.php', 'POST', {
                action: 'update_profile',
                user_id: currentStudent.id,
                full_name: fullName,
                english_level: englishLevel
            });
            if (res && res.success) {
                currentStudent.full_name = fullName;
                currentStudent.english_level = englishLevel;
                modal.remove();
                render();
            } else {
                alert(res?.error || 'Error updating profile');
            }
        });
    }

    function renderCardFront(card) {
        const pattern = card.pattern_type;
        const data = card.content_data || {};
        const title = card.title || 'Flashcard';

        if (pattern === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const gridClass = options.length > 3 ? 'grid md:grid-cols-2 gap-3' : 'space-y-3';
            return `
                <div class="text-center">
                    <p class="text-lg mb-3 font-bold">❓ ${escapeHtml(card.question_text || 'Select the correct answer:')}</p>
                    <div class="${gridClass}" id="mcqOptionsContainer">
                        ${options.map((opt, idx) => `<div class="quiz-option" data-idx="${idx}">${String.fromCharCode(65+idx)}. ${escapeHtml(opt)}</div>`).join('')}
                    </div>
                    <p class="text-sm text-gray-400 mt-2">👆 Tap your answer, then flip the card</p>
                </div>
            `;
        } else if (pattern === 'gap_fill') {
            const sentence = data.sentence || 'Complete the sentence: ______';
            const hint = getGapFillHint(card);
            return `
                <div class="text-center">
                    <p class="text-lg mb-1 font-bold">✏️ Complete the sentence:</p>
                    <p class="text-sm bg-gray-100 p-3 rounded-xl mb-1">${escapeHtml(sentence)}</p>
                    <div class="context-hint">${hint}</div>
                    <input type="text" id="gapFillInput" placeholder="Type your answer..." class="w-full p-2 text-sm border-2 rounded-xl mb-2" autocomplete="off">
                    <p class="text-sm text-gray-400 mt-1">👆 Type answer, then flip to check</p>
                </div>
            `;
        } else if (pattern === 'image_description') {
            const imageUrl = data.image_url || '';
            const hasImage = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
            return `
                <div class="flex flex-col items-center justify-center h-full min-h-[200px]">
                    <h1 class="text-xl md:text-2xl text-center font-bold marker-underline mb-3">🖼️ ${escapeHtml(title)}</h1>
                    ${hasImage ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="max-h-48 md:max-h-64 rounded-xl shadow-md mb-2 object-contain" onerror="this.style.display='none'">` : `<div class="text-6xl mb-2">🖼️</div>`}
                    <p class="text-sm text-gray-400 mt-2">👆 Tap card to flip</p>
                </div>
            `;
        } else if (pattern === 'audio_listening') {
            const audioUrl = data.audio_url || '';
            const hasAudio = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'));
            const prompt = data.prompt || '';
            const isInteractive = !!(prompt || data.correct_answers);
            const isTranscription = !!data.transcript && !data.correct_answers;
            return `
                <div class="flex flex-col items-center justify-center h-full min-h-[200px]">
                    <h1 class="text-xl md:text-2xl text-center font-bold marker-underline mb-3">🎧 ${escapeHtml(title)}</h1>
                    ${hasAudio ? `<audio controls class="w-full max-w-xs mb-2" src="${escapeHtml(audioUrl)}">Your browser does not support audio.</audio>` : `<div class="text-6xl mb-2">🎧</div>`}
                    ${prompt ? `<p class="text-sm bg-gray-100 p-2 rounded-xl mb-1">${escapeHtml(prompt)}</p>` : ''}
                    ${isInteractive ? `<input type="text" id="gapFillInput" placeholder="${isTranscription ? 'Type what you hear...' : 'Type your answer...'}" class="w-full p-2 text-sm border-2 rounded-xl mb-2" autocomplete="off">` : ''}
                    <p class="text-sm text-gray-400 mt-1">👆 Tap card to flip${isInteractive ? ' after answering' : ''}</p>
                </div>
            `;
        } else {
            return `
                <div class="flex flex-col items-center justify-center h-full min-h-[200px]">
                    <h1 class="text-2xl md:text-3xl text-center font-bold marker-underline">${escapeHtml(title)}</h1>
                    <p class="text-sm text-gray-400 mt-3">👆 Tap card to flip</p>
                </div>
            `;
        }
    }

    function renderCardBack(card, quizState) {
        const data = card.content_data || {};
        const pattern = card.pattern_type;
        const title = card.title || 'Flashcard';

        if (pattern === 'multiple_choice') {
            const options = data.options || ['Option A', 'Option B', 'Option C'];
            const correctIdx = data.correct_index !== undefined ? data.correct_index : 1;
            const correctAnswer = options[correctIdx];
            const selectedIdx = quizState?.selectedIdx;
            const isCorrect = (selectedIdx === correctIdx);
            const explanation = formatBreaks(escapeHtml(data.explanation || ''));

            return `
                <div class="back-content">
                    <div class="text-center">
                        <h3 class="text-lg text-green-700 title-font marker-underline mb-2">✓ Answer</h3>
                        <div class="bg-green-50 p-3 rounded-xl border-2 border-green-300 mb-2">
                            <p class="text-base font-bold">${String.fromCharCode(65+correctIdx)}. ${escapeHtml(correctAnswer)}</p>
                        </div>
                        ${selectedIdx !== null ? `
                        <div class="p-2 rounded-lg mb-2 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            <p class="text-sm">${isCorrect ? '✅ Correct!' : `❌ Incorrect. The correct answer is ${String.fromCharCode(65+correctIdx)}.`}</p>
                        </div>
                        ` : ''}
                        ${explanation ? `<div class="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded-lg">📝 ${explanation}</div>` : ''}
                        <p class="text-xs text-gray-400 mt-2">Rate your recall using the buttons below</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'gap_fill') {
            const correctAnswers = data.correct_answers || ['answer'];
            const userAnswer = quizState?.userAnswer || '';
            const isMatch = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
            const example = formatBreaks(escapeHtml(data.example || ''));

            return `
                <div class="back-content">
                    <div class="text-center">
                        <h3 class="text-lg text-green-700 title-font marker-underline mb-2">✓ Correct Answer</h3>
                        <div class="bg-green-50 p-3 rounded-xl border-2 border-green-300 mb-2">
                            <p class="text-base font-bold">${escapeHtml(correctAnswers.join(' / '))}</p>
                        </div>
                        ${userAnswer ? `
                        <div class="p-2 rounded-lg mb-2 ${isMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            <p class="text-sm">${isMatch ? '✅ Correct!' : `❌ Incorrect. Your answer: "${escapeHtml(userAnswer)}"`}</p>
                        </div>
                        ` : ''}
                        ${example ? `<div class="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded-lg">📝 Example: ${example}</div>` : ''}
                        <p class="text-xs text-gray-400 mt-2">Rate your recall using the buttons below</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'image_description') {
            const description = formatBreaks(escapeHtml(data.description || 'No description'));
            return `
                <div class="back-content">
                    <div class="text-center">
                        <h3 class="text-lg text-blue-700 title-font marker-underline mb-2">${escapeHtml(title)}</h3>
                        <div class="card-definition bg-blue-50 p-3 rounded-xl border-2 border-blue-300">
                            ${description}
                        </div>
                        <p class="text-xs text-gray-400 mt-2">Rate your recall using the buttons below</p>
                    </div>
                </div>
            `;
        } else if (pattern === 'audio_listening') {
            const transcript = formatBreaks(escapeHtml(data.transcript || data.notes || ''));
            const correctAnswers = data.correct_answers || [];
            const userAnswer = quizState?.userAnswer || '';
            const isInteractive = !!(data.prompt || correctAnswers.length);
            let isMatch = false;
            if (userAnswer && correctAnswers.length) {
                isMatch = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
            } else if (userAnswer && data.transcript) {
                isMatch = data.transcript.toLowerCase().trim() === userAnswer.toLowerCase().trim();
            }
            return `
                <div class="back-content">
                    <div class="text-center">
                        <h3 class="text-lg text-green-700 title-font marker-underline mb-2">${escapeHtml(title)}</h3>
                        ${transcript ? `<div class="card-definition bg-green-50 p-3 rounded-xl border-2 border-green-300 mb-2">${transcript}</div>` : ''}
                        ${isInteractive && userAnswer ? `
                        <div class="p-2 rounded-lg mb-2 ${isMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            <p class="text-sm">${isMatch ? '✅ Correct!' : `❌ Your answer: "${escapeHtml(userAnswer)}"`}</p>
                        </div>
                        ` : isInteractive && !userAnswer ? `<p class="text-sm text-gray-500 mb-2">Type what you heard above, then flip.</p>` : ''}
                        <p class="text-xs text-gray-400 mt-2">Rate your recall using the buttons below</p>
                    </div>
                </div>
            `;
        } else {
            const definition = formatBreaks(escapeHtml(data.definition || data.usage1 || 'No definition available'));
            const example = formatBreaks(escapeHtml(data.example1a || data.example || ''));

            return `
                <div class="back-content">
                    <div class="text-center">
                        <h3 class="text-lg text-blue-700 title-font marker-underline mb-2">${escapeHtml(title)}</h3>
                        <div class="card-definition bg-blue-50 p-3 rounded-xl border-2 border-blue-300">
                            ${definition}
                        </div>
                        ${example ? `
                            <div class="mt-2 p-2 bg-gray-100 rounded-lg">
                                <p class="text-sm"><strong>Example:</strong> ${example}</p>
                            </div>
                        ` : ''}
                        <p class="text-xs text-gray-400 mt-2">Rate your recall using the buttons below</p>
                    </div>
                </div>
            `;
        }
    }

    function handleFlip(card, quizState, flashcardEl) {
        if (flashcardEl.classList.contains('flipped')) {
            flashcardEl.classList.remove('flipped');
            isFlipped = false;
            return;
        }

        const pattern = card.pattern_type;
        if (pattern === 'multiple_choice') {
            const selected = document.querySelector('#mcqOptionsContainer .quiz-option.selected');
            if (selected) {
                quizState.selectedIdx = parseInt(selected.getAttribute('data-idx'));
                quizState.answered = true;
            }
        } else if (pattern === 'gap_fill' || pattern === 'audio_listening') {
            const input = document.getElementById('gapFillInput');
            if (input) {
                quizState.userAnswer = input.value.trim();
                quizState.answered = true;
            }
        }

        SoundFX.flip();
        isFlipped = true;

        const backDiv = document.getElementById('cardBack');
        if (backDiv && quizState.answered) {
            backDiv.innerHTML = renderCardBack(card, quizState);
        } else if (backDiv && !quizState.answered && pattern !== 'usage_cases' && pattern !== 'deep_dive' && pattern !== 'formula_table' && pattern !== 'image_description' && pattern !== 'audio_listening') {
            backDiv.innerHTML = renderCardBack(card, quizState);
        }

        flashcardEl.classList.add('flipped');
    }

    function handleAutoFlip(card, quizState) {
        setTimeout(() => {
            if (!isFlipped) {
                SoundFX.flip();
                isFlipped = true;
                const flashcardEl = document.getElementById('flashcardEl');
                if (flashcardEl) {
                    const backDiv = document.getElementById('cardBack');
                    if (backDiv) backDiv.innerHTML = renderCardBack(card, quizState);
                    flashcardEl.classList.add('flipped');
                }
            }
        }, 400);
    }

    function renderStudyScreen() {
        if (!currentCards.length || currentIndex >= currentCards.length) {
            const isAllDue = allDueReviewed;
            const msg = isAllDue
                ? `<div class="text-5xl md:text-6xl mb-2 celebration-pop">🎉📚</div><h2 class="text-2xl md:text-3xl text-blue-800 marker-underline mb-2">All cards viewed!</h2><p class="text-sm md:text-base mb-3">You've seen all due cards for this set.<br>Try another set or come back later!</p>`
                : `<div class="text-5xl md:text-6xl mb-2 celebration-pop">🏆✨</div><h2 class="text-2xl md:text-3xl text-green-800 marker-underline mb-2">All caught up!</h2><p class="text-sm md:text-base mb-3">Great job, ${escapeHtml(currentStudent?.username || currentStudent?.name || 'student')}!</p>`;
            appEl.innerHTML = `<div class="whiteboard-card p-4 md:p-8 text-center screen-fade-in">${msg}${streakDays > 1 ? `<div class="streak-badge text-lg my-3">${streakDays} day streak!</div>` : ''}<button id="backToWelcomeBtn" class="bg-gray-800 text-white px-4 md:px-6 py-1 md:py-2 text-base md:text-lg rounded-xl btn-chalk">← Back</button></div>`;
            document.getElementById('backToWelcomeBtn')?.addEventListener('click', () => { currentView = 'welcome'; render(); });
            SoundFX.complete();
            if (!isAllDue) spawnConfetti(80);
            return;
        }

        currentCardObj = currentCards[currentIndex];
        const card = currentCardObj;
        const pattern = card.pattern_type || 'usage_cases';
        const progressPercent = ((currentIndex + 1) / currentCards.length) * 100;
        isFlipped = false;

        currentQuizState = { selectedIdx: null, userAnswer: '', answered: false, isCorrect: false };

        const html = `
            <div class="whiteboard-card p-3 md:p-4 screen-fade-in">
                <div class="flex justify-between items-center flex-wrap gap-1 mb-2">
                    <div class="flex gap-2 items-center">
                        <span class="level-chip">${escapeHtml(card.level || 'Beginner')}</span>
                        <span class="text-xs text-gray-500">${currentIndex + 1}/${currentCards.length}</span>
                        ${streakDays > 0 ? `<span class="streak-badge" style="font-size:10px;padding:2px 8px;">${streakDays}d</span>` : ''}
                    </div>
                    <div class="flex gap-2 items-center">
                        <span class="kb-hint">space</span>
                        <button id="flipCardBtn" class="flip-btn px-3 py-1 md:px-4 md:py-1 rounded-xl text-xs md:text-xs font-bold">🔄 FLIP</button>
                        <button id="exitStudyBtn" class="text-red-600 font-bold bg-red-50 px-3 py-1 rounded-full text-xs">Exit</button>
                    </div>
                </div>
                <div class="progress-bar-container mb-1" style="height:10px;">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    <span class="pct-label">${currentIndex + 1}/${currentCards.length}</span>
                </div>
                <div class="text-center mb-1">
                    <span class="text-lg text-gray-600 title-font font-bold">📚 ${escapeHtml(card.set_name || '')}</span>
                </div>
                <div class="flashcard-container relative w-full" style="min-height: ${isMobile ? '340px' : '400px'};">
                    <div class="flashcard relative w-full" id="flashcardEl" style="min-height: ${isMobile ? '340px' : '400px'};">
                        <div class="card-front p-4 md:p-5 overflow-y-auto border-4 border-gray-700 shadow-xl" id="cardFront">
                            ${renderCardFront(card)}
                        </div>
                        <div class="card-back p-4 md:p-5 overflow-y-auto border-4 border-blue-300 shadow-xl" id="cardBack">
                            ${renderCardBack(card, currentQuizState)}
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap justify-center gap-1 md:gap-2 mt-2">
                    <button id="againBtn" class="bg-red-600 hover:bg-red-700 text-white px-3 md:px-4 py-1 rounded-xl text-xs md:text-sm font-bold btn-chalk"><span class="kb-hint" style="background:rgba(255,255,255,0.2);border-color:transparent;">1</span> Again</button>
                    <button id="goodBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 md:px-4 py-1 rounded-xl text-xs md:text-sm font-bold btn-chalk"><span class="kb-hint" style="background:rgba(255,255,255,0.2);border-color:transparent;">2</span> Good</button>
                    <button id="easyBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-1 rounded-xl text-xs md:text-sm font-bold btn-chalk"><span class="kb-hint" style="background:rgba(255,255,255,0.2);border-color:transparent;">3</span> Easy</button>
                </div>
                <p class="text-center text-xs text-gray-400 mt-2">💡 Tap card or press <span class="kb-hint">Space</span> to flip · <span class="kb-hint">1</span><span class="kb-hint">2</span><span class="kb-hint">3</span> to rate</p>
            </div>
        `;
        appEl.innerHTML = html;

        const flashcard = document.getElementById('flashcardEl');

        function flipHandler() {
            handleFlip(card, currentQuizState, flashcard);
        }

        document.getElementById('flipCardBtn')?.addEventListener('click', flipHandler);

        flashcard?.addEventListener('click', (e) => {
            if (e.target.closest('.quiz-option') || e.target.closest('#gapFillInput') || e.target.closest('.btn-chalk') || e.target.closest('#flipCardBtn')) {
                return;
            }
            flipHandler();
        });

        if (pattern === 'multiple_choice') {
            const options = document.querySelectorAll('#mcqOptionsContainer .quiz-option');
            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    SoundFX.click();
                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    currentQuizState.selectedIdx = parseInt(opt.getAttribute('data-idx'));
                    currentQuizState.answered = true;
                    handleAutoFlip(card, currentQuizState);
                });
            });
        }

        if (pattern === 'gap_fill') {
            const input = document.getElementById('gapFillInput');
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        currentQuizState.userAnswer = input.value.trim();
                        currentQuizState.answered = true;
                        handleAutoFlip(card, currentQuizState);
                    }
                });
            }
        }

        document.getElementById('exitStudyBtn')?.addEventListener('click', () => { currentView = 'welcome'; render(); });

        const handleReview = async (quality) => {
            SoundFX.click();
            let wasCorrect = false;
            if (pattern === 'multiple_choice') {
                const correctIdx = card.content_data?.correct_index ?? 1;
                wasCorrect = (currentQuizState.selectedIdx === correctIdx);
            } else if (pattern === 'gap_fill') {
                const correctAnswers = card.content_data?.correct_answers || ['answer'];
                wasCorrect = correctAnswers.some(ans => ans.toLowerCase() === currentQuizState.userAnswer.toLowerCase());
            } else if (pattern === 'audio_listening') {
                const correctAnswers = card.content_data?.correct_answers || [];
                const transcript = card.content_data?.transcript || '';
                const userAnswer = currentQuizState?.userAnswer || '';
                if (correctAnswers.length) {
                    wasCorrect = correctAnswers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
                } else if (transcript) {
                    wasCorrect = transcript.toLowerCase().trim() === userAnswer.toLowerCase().trim();
                } else {
                    wasCorrect = true;
                }
            } else {
                wasCorrect = true;
            }

            if (wasCorrect) SoundFX.correct();
            else SoundFX.incorrect();

            if (!currentStudent) { displayStatusMessage('Not logged in', 'error'); return; }
            const res = await recordReview(card.id, currentStudent.id, quality, wasCorrect);
            if (res?.streak_days !== undefined) streakDays = res.streak_days;
            currentIndex++;
            render();
        };

        document.getElementById('againBtn')?.addEventListener('click', () => handleReview(0));
        document.getElementById('goodBtn')?.addEventListener('click', () => handleReview(2));
        document.getElementById('easyBtn')?.addEventListener('click', () => handleReview(3));
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (currentView === 'study') {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    const flipBtn = document.getElementById('flipCardBtn');
                    if (flipBtn) {
                        flipBtn.click();
                    } else if (!document.getElementById('flashcardEl')?.classList.contains('flipped')) {
                        const el = document.getElementById('flashcardEl');
                        if (el && currentCardObj) handleFlip(currentCardObj, currentQuizState, el);
                    }
                    break;
                case '1':
                    document.getElementById('againBtn')?.click();
                    break;
                case '2':
                    document.getElementById('goodBtn')?.click();
                    break;
                case '3':
                    document.getElementById('easyBtn')?.click();
                    break;
                case 'Escape':
                    document.getElementById('exitStudyBtn')?.click();
                    break;
            }
        } else if (currentView === 'welcome') {
            if (e.key === 'Enter') {
                document.getElementById('launchStudyBtn')?.click();
            }
        }
    });

    loadSavedData();
    render();
})();
