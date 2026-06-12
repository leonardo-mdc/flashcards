(function () {
    const CSRF = window.FLASHCARD_ADMIN?.csrfToken || '';
    const T = (id) => document.getElementById(id);

    // ─── Helpers ────────────────────────────────────────────────────
    function esc(str) { if (!str) return ''; const m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }; return String(str).replace(/[&<>"']/g, c => m[c]); }
    function fmtBreaks(t) { if (!t) return ''; let s = String(t); s = s.replace(/\\\\/g, '\\').replace(/\\br ?/g, '<br>'); s = s.replace(/\\b(.*?)\\b/g,'<b>$1</b>').replace(/\\i(.*?)\\i/g,'<i>$1</i>').replace(/\\u(.*?)\\u/g,'<u>$1</u>').replace(/\\em(.*?)\\em/g,'<em>$1</em>').replace(/\\strong(.*?)\\strong/g,'<strong>$1</strong>'); return s; }
    function splitCSV(s) { if (!s) return []; const r=[]; let c='',q=false; for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'){q=!q;continue}if(ch===','&&!q){r.push(c.trim());c='';continue}c+=ch}r.push(c.trim());return r.filter(Boolean); }
    function fetchJSON(url, opts = {}) {
        const h = new Headers(opts.headers || {}); if (CSRF) h.set('X-CSRF-Token', CSRF);
        if (!(opts.body instanceof FormData)) h.set('Content-Type', 'application/json');
        return window.fetch(url, { ...opts, headers: h }).then(r => r.json());
    }
    function toast(msg, type = 'info') {
        const el = T('toast'); if (!el) return;
        const colors = { success:'#16a34a', error:'#dc2626', warning:'#d97706', info:'#2563eb' };
        el.style.background = colors[type] || colors.info;
        el.textContent = msg; el.style.display = 'block';
        clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', 3000);
    }
    function setLoading(btnId, loading, label) {
        const btn = T(btnId); if (!btn) return;
        if (loading) {
            btn._label = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="loader" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:4px;"></span> ' + (label || 'Working...');
        } else {
            btn.disabled = false;
            btn.innerHTML = btn._label || label || btn.innerHTML;
        }
    }
    const styleSpin = document.createElement('style');
    styleSpin.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(styleSpin);

    // ─── Keyboard arrow navigation for lists ──────────────────────
    function arrowNav(containerId, itemSelector, onEnter) {
        const c = T(containerId);
        if (!c) return;
        c.setAttribute('tabindex', '0');
        c.style.outline = 'none';
        c.addEventListener('keydown', e => {
            const items = c.querySelectorAll(itemSelector);
            if (!items.length) return;
            let idx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected') || it.matches('.selected')) idx = i; });
            if (idx < 0) idx = 0;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                idx = Math.min(idx + 1, items.length - 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                idx = Math.max(idx - 1, 0);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[idx]) onEnter(items[idx], idx);
                return;
            } else return;
            if (items[idx]) {
                items[idx].click();
                items[idx].scrollIntoView({ block: 'nearest' });
            }
        });
        c.addEventListener('focus', () => {
            const sel = c.querySelector(itemSelector + '.selected');
            if (!sel) {
                const first = c.querySelector(itemSelector);
                if (first) first.click();
            }
        });
    }

    // ─── Unified Card Field Config ──────────────────────────────────
    const CFC = {};

    function registerType(type, cfg) { CFC[type] = cfg; }

    function renderFields(containerId, type, contentData) {
        const cfg = CFC[type];
        if (!cfg) { T(containerId).innerHTML = '<div class="text-sm text-gray-500">No fields for this type</div>'; return; }
        const vals = cfg.fromContentData ? cfg.fromContentData(contentData || {}) : (contentData || {});
        let html = '';
        cfg.fields.forEach(f => {
            const v = vals[f.key] !== undefined ? vals[f.key] : (f.default || '');
            const h = f.help ? `<div class="help-text">${f.help}</div>` : '';
            if (f.type === 'textarea') {
                html += `<div><label class="block font-bold mb-1">${f.label}</label><textarea id="${containerId}_${f.key}" class="form-textarea" rows="${f.rows || 3}" placeholder="${f.placeholder || ''}">${esc(v)}</textarea>${h}</div>`;
            } else if (f.type === 'csv') {
                html += `<div><label class="block font-bold mb-1">${f.label}</label><input type="text" id="${containerId}_${f.key}" class="form-input" value="${esc(v)}" placeholder="${f.placeholder || ''}">${h}</div>`;
            } else {
                html += `<div><label class="block font-bold mb-1">${f.label}</label><input type="text" id="${containerId}_${f.key}" class="form-input" value="${esc(v)}" placeholder="${f.placeholder || ''}">${h}</div>`;
            }
        });

        T(containerId).innerHTML = html;
    }

    function collectFields(containerId, type) {
        const cfg = CFC[type];
        if (!cfg) return {};
        const dom = {};
        cfg.fields.forEach(f => {
            const el = T(`${containerId}_${f.key}`);
            if (f.type === 'csv') {
                dom[f.key] = el ? splitCSV(el.value) : [];
            } else {
                dom[f.key] = el ? el.value : '';
            }
        });
            return cfg.toContentData ? cfg.toContentData(dom) : dom;
    }

    function collectFieldVisibility(visId) {
        const el = T(visId); if (!el) return {};
        const ff = [], bf = [];
        el.querySelectorAll('.ff-cb:checked').forEach(cb => ff.push(cb.dataset.key));
        el.querySelectorAll('.bf-cb:checked').forEach(cb => bf.push(cb.dataset.key));
        const r = {};
        if (ff.length) r.front_fields = ff;
        if (bf.length) r.back_fields = bf;
        return r;
    }

    function renderFieldVisibility(containerId, type, contentData) {
        const cfg = CFC[type];
        if (!cfg || !cfg.frontFields) { T(containerId).innerHTML = ''; return; }
        const ff = Array.isArray(contentData?.front_fields) ? contentData.front_fields : cfg.defaultFrontFields;
        const bf = Array.isArray(contentData?.back_fields) ? contentData.back_fields : cfg.frontFields;
        let html = '<div class="p-2 bg-gray-50 rounded-lg border border-gray-200 mb-2"><table class="w-full text-xs"><thead><tr><th class="text-left font-bold pb-1">Field</th><th class="text-center font-bold pb-1">Front</th><th class="text-center font-bold pb-1">Back</th></tr></thead><tbody>';
        cfg.frontFields.forEach(fk => {
            const fLabel = cfg.fields.find(f => f.key === fk)?.label || fk;
            html += `<tr><td class="py-0.5">${fLabel}</td><td class="text-center"><input type="checkbox" class="ff-cb" data-key="${fk}" ${ff.includes(fk) ? 'checked' : ''}></td><td class="text-center"><input type="checkbox" class="bf-cb" data-key="${fk}" ${bf.includes(fk) ? 'checked' : ''}></td></tr>`;
        });
        html += '</tbody></table><p class="text-gray-400 mt-1 text-xs">Unchecked = default</p></div>';
        T(containerId).innerHTML = html;
    }

    // ─── Register all 8 types ──────────────────────────────────────
    function initFieldConfig() {
        const textFields = [
            { key:'definition',  label:'Definition / Description', type:'textarea', rows:5, placeholder:'Enter definition...' },
            { key:'usage1',      label:'Usage / Context',         type:'textarea', rows:2, placeholder:'When/why to use...' },
            { key:'examples',    label:'Examples (one per line)', type:'textarea', rows:3, placeholder:'Example 1\nExample 2\nExample 3\nExample 4' },
            { key:'tip',         label:'Tip (optional)',          type:'textarea', rows:2, placeholder:'Helpful tip...' },
            { key:'image_url',   label:'Image URL (optional)',    type:'text',     placeholder:'https://...' },
            { key:'audio_url',   label:'Audio URL (optional)',    type:'text',     placeholder:'https://...' },
        ];
        function textFromContentData(cd) {
            const ex = Array.isArray(cd.examples) ? cd.examples : (typeof cd.examples === 'string' ? cd.examples.split('\n').map(s => s.trim()).filter(Boolean) : []);
            const r = { definition: cd.definition || '', usage1: cd.usage1 || '', examples: ex.join('\n'), tip: cd.tip || '', image_url: cd.image_url || '', audio_url: cd.audio_url || '' };
            if (cd.front_fields) r.front_fields = cd.front_fields;
            if (cd.back_fields) r.back_fields = cd.back_fields;
            return r;
        }
        function textToContentData(dom) {
            const exLines = dom.examples.split('\n').map(s => s.trim()).filter(Boolean);
            const cd = { definition: dom.definition, usage1: dom.usage1, examples: exLines, tip: dom.tip, image_url: dom.image_url, audio_url: dom.audio_url };
            if (exLines.length) cd.example1a = exLines[0];
            if (dom.front_fields?.length) cd.front_fields = dom.front_fields;
            if (dom.back_fields?.length) cd.back_fields = dom.back_fields;
            return cd;
        }
        ['usage_cases','deep_dive','formula_table'].forEach(t => {
            const isUsage = t === 'usage_cases';
            const fields = isUsage ? textFields : textFields.filter(f => f.key !== 'usage1');
            registerType(t, {
                fields,
                frontFields: ['definition','usage1','examples','tip'],
                defaultFrontFields: t === 'deep_dive' ? [] : ['definition'],
                fromContentData: textFromContentData,
                toContentData: textToContentData,
            });
        });

        registerType('multiple_choice', {
            fields: [
                { key:'image_url',     label:'Image URL (optional)',  type:'text', placeholder:'https://...' },
                { key:'audio_url',     label:'Audio URL (optional)',  type:'text', placeholder:'https://...' },
                { key:'question_text', label:'Question Text',         type:'textarea', rows:2, placeholder:'What is the question?' },
                { key:'options',       label:'Options (comma separated)', type:'csv', default:['Option A','Option B','Option C'], placeholder:'Option A, Option B, Option C', help:'The first option has index 0' },
                { key:'correct_index', label:'Correct Index (0, 1, 2...)', type:'text', default:'0', placeholder:'0' },
                { key:'explanation',   label:'Explanation (optional)', type:'textarea', rows:3, placeholder:'Why this is correct...' },
            ],
            fromContentData(cd) {
                const opts = Array.isArray(cd.options) ? cd.options : (typeof cd.options === 'string' ? splitCSV(cd.options) : []);
                return { image_url: cd.image_url || '', audio_url: cd.audio_url || '', question_text: cd.question_text || '', options: opts.join(', '), correct_index: cd.correct_index !== undefined ? String(cd.correct_index) : '0', explanation: cd.explanation || '' };
            },
            toContentData(dom) { return { image_url: dom.image_url, audio_url: dom.audio_url, question_text: dom.question_text, options: dom.options, correct_index: parseInt(dom.correct_index) || 0, explanation: dom.explanation }; },
        });

        registerType('image_mcq', {
            fields: [
                { key:'image_url',     label:'Image URL',             type:'text', placeholder:'https://...' },
                { key:'question_text', label:'Question Text',         type:'textarea', rows:2, placeholder:'What is the question?' },
                { key:'options',       label:'Options (comma separated)', type:'csv', default:['Option A','Option B','Option C'], placeholder:'Option A, Option B, Option C' },
                { key:'correct_index', label:'Correct Index (0, 1, 2...)', type:'text', default:'0', placeholder:'0' },
                { key:'explanation',   label:'Explanation (optional)', type:'textarea', rows:3, placeholder:'Why this is correct...' },
            ],
            fromContentData(cd) {
                const opts = Array.isArray(cd.options) ? cd.options : (typeof cd.options === 'string' ? splitCSV(cd.options) : []);
                return { image_url: cd.image_url || '', question_text: cd.question_text || '', options: opts.join(', '), correct_index: cd.correct_index !== undefined ? String(cd.correct_index) : '0', explanation: cd.explanation || '' };
            },
            toContentData(dom) { return { image_url: dom.image_url, question_text: dom.question_text, options: dom.options, correct_index: parseInt(dom.correct_index) || 0, explanation: dom.explanation }; },
        });

        registerType('gap_fill', {
            fields: [
                { key:'sentence',        label:'Sentence with ______', type:'textarea', rows:3, placeholder:'They ______ to school every day.' },
                { key:'correct_answers', label:'Correct Answer(s)',    type:'csv', default:['answer'], placeholder:'go, goes, went', help:'Comma separated — all accepted answers' },
                { key:'example',         label:'Example Sentence',      type:'textarea', rows:2, placeholder:'They go to school every day.' },
                { key:'image_url',       label:'Image URL (optional)', type:'text', placeholder:'https://...' },
                { key:'audio_url',       label:'Audio URL (optional)', type:'text', placeholder:'https://...' },
            ],
            fromContentData(cd) {
                const ca = Array.isArray(cd.correct_answers) ? cd.correct_answers : (typeof cd.correct_answers === 'string' ? splitCSV(cd.correct_answers) : []);
                return { sentence: cd.sentence || '', correct_answers: ca.join(', '), example: cd.example || '', image_url: cd.image_url || '', audio_url: cd.audio_url || '' };
            },
            toContentData(dom) { return { sentence: dom.sentence, correct_answers: dom.correct_answers, example: dom.example, image_url: dom.image_url, audio_url: dom.audio_url }; },
        });

        registerType('image_description', {
            fields: [
                { key:'image_url',   label:'Image URL',            type:'text', placeholder:'https://...' },
                { key:'description', label:'Description',          type:'textarea', rows:5, placeholder:'Enter description...' },
            ],
            fromContentData(cd) { return { image_url: cd.image_url || '', description: cd.description || '' }; },
            toContentData(dom) { return { image_url: dom.image_url, description: dom.description }; },
        });

        registerType('audio_listening', {
            fields: [
                { key:'audio_url',       label:'Audio URL',              type:'text', placeholder:'https://...' },
                { key:'prompt',          label:'Prompt (what to listen)', type:'textarea', rows:2, placeholder:'Listen and type what you hear...' },
                { key:'correct_answers', label:'Correct Answer(s)',       type:'csv', default:[], placeholder:'answer1, answer2', help:'Comma separated accepted answers' },
                { key:'transcript',      label:'Notes / Full Transcript', type:'textarea', rows:3, placeholder:'Full transcript...' },
            ],
            fromContentData(cd) {
                const ca = Array.isArray(cd.correct_answers) ? cd.correct_answers : (typeof cd.correct_answers === 'string' ? splitCSV(cd.correct_answers) : []);
                return { audio_url: cd.audio_url || '', prompt: cd.prompt || '', correct_answers: ca.join(', '), transcript: cd.transcript || cd.notes || '' };
            },
            toContentData(dom) { return { audio_url: dom.audio_url, prompt: dom.prompt, correct_answers: dom.correct_answers, transcript: dom.transcript, notes: dom.transcript }; },
        });
    }

    // ─── Preview Rendering ──────────────────────────────────────────
    function renderPreview(frontEl, backEl, type, title, contentData) {
        const cd = contentData || {};
        const isURL = (u) => u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('uploads/'));
        const hasImg = isURL(cd.image_url);
        const hasAud = isURL(cd.audio_url);

        let front = '';
        let back = '';
        const t = esc(title || 'Flashcard');

        if (type === 'image_mcq') {
            const opts = cd.options || ['Option A','Option B','Option C'];
            front = `<div class="flex flex-col md:flex-row gap-3 min-h-[200px]"><div class="flex items-center justify-center md:w-1/2 bg-gray-50 rounded-xl p-2">${hasImg ? `<img src="${esc(cd.image_url)}" class="max-h-32 object-contain">` : '<div class="text-5xl text-gray-300">🖼️</div>'}</div><div class="flex flex-col justify-center md:w-1/2 gap-2"><p class="text-sm font-bold text-center md:text-left">Select the correct answer:</p>${opts.map((o,i) => `<div class="quiz-option-preview text-sm py-1">${String.fromCharCode(65+i)}. ${fmtBreaks(esc(o))}</div>`).join('')}</div></div>`;
            const ci = cd.correct_index || 0;
            back = `<div class="text-center"><h3 class="text-xl text-green-700 marker-underline mb-3">✓ Answer</h3><div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3"><p class="text-xl font-bold">${String.fromCharCode(65+ci)}. ${esc(opts[ci] || 'Correct')}</p></div><p class="text-sm text-gray-600">${fmtBreaks(esc(cd.explanation || ''))}</p></div>`;
        } else if (type === 'image_description') {
            front = `<div class="flex flex-col items-center justify-center min-h-[200px]"><div class="text-xl font-bold marker-underline mb-3">🖼️ ${t}</div>${hasImg ? `<img src="${esc(cd.image_url)}" class="max-h-40 rounded-xl shadow-md mb-2 object-contain">` : '<div class="text-5xl mb-2">🖼️</div>'}<p class="text-xs text-gray-400 mt-2">👆 Tap to flip</p></div>`;
            back = `<div class="text-center"><h3 class="text-2xl text-blue-700 marker-underline mb-3">${t}</h3><div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300"><p class="text-lg">${fmtBreaks(esc(cd.description || ''))}</p></div></div>`;
        } else if (type === 'audio_listening') {
            const int = !!(cd.prompt || (Array.isArray(cd.correct_answers) && cd.correct_answers.length));
            front = `<div class="flex flex-col items-center justify-center min-h-[200px]"><div class="text-xl font-bold marker-underline mb-3">🎧 ${t}</div>${hasAud ? '<div class="text-sm mb-2">🔊 Audio file provided</div>' : '<div class="text-5xl mb-2">🎧</div>'}${cd.prompt ? `<p class="text-sm bg-gray-100 p-2 rounded-xl mb-1">${fmtBreaks(esc(cd.prompt))}</p>` : ''}${int ? '<input type="text" placeholder="Type answer..." class="w-full p-2 text-sm border-2 rounded-xl mb-2" disabled>' : ''}<p class="text-xs text-gray-400 mt-2">👆 Tap to flip${int ? ' after answering' : ''}</p></div>`;
            const tr = cd.transcript || cd.notes || '';
            back = `<div class="text-center"><h3 class="text-2xl text-green-700 marker-underline mb-3">${t}</h3>${tr ? `<div class="bg-green-50 p-4 rounded-xl border-2 border-green-300"><p class="text-lg">${fmtBreaks(esc(tr))}</p></div>` : '<p class="text-gray-500">(Transcript)</p>'}</div>`;
        } else if (type === 'multiple_choice') {
            const opts = cd.options || ['Option A','Option B','Option C'];
            front = `<div class="text-center">${hasImg ? `<img src="${esc(cd.image_url)}" class="max-h-32 object-contain mx-auto mb-2 rounded-lg">` : ''}${hasAud ? '<div class="text-sm mb-2">🔊 Audio</div>' : ''}<div class="text-4xl mb-3">❓</div><p class="text-lg mb-4 font-bold">${fmtBreaks(esc(cd.question_text || 'Select the correct answer:'))}</p>${opts.map((o,i) => `<div class="quiz-option-preview text-base">${String.fromCharCode(65+i)}. ${fmtBreaks(esc(o))}</div>`).join('')}<p class="text-xs text-gray-400 mt-3">👆 Tap answer, then flip</p></div>`;
            const ci = cd.correct_index || 0;
            back = `<div class="text-center"><h3 class="text-xl text-green-700 marker-underline mb-3">✓ Answer</h3><div class="bg-green-50 p-4 rounded-xl border-2 border-green-300 mb-3"><p class="text-xl font-bold">${String.fromCharCode(65+ci)}. ${esc(opts[ci] || 'Correct')}</p></div><p class="text-sm text-gray-600">${fmtBreaks(esc(cd.explanation || ''))}</p></div>`;
        } else if (type === 'gap_fill') {
            const gapMedia = (hasImg || hasAud) ? `<div class="w-full flex justify-center mb-2">${hasImg ? `<img src="${esc(cd.image_url)}" class="max-h-32 object-contain rounded-lg">` : ''}${hasAud ? '<div class="text-sm">🔊 Audio</div>' : ''}</div>` : '';
            front = `<div class="text-center">${gapMedia}<div class="text-4xl mb-3">✏️</div><p class="text-lg mb-4 font-bold">Complete the sentence:</p><p class="text-base bg-gray-100 p-3 rounded-xl">${fmtBreaks(esc(cd.sentence || 'Complete: ______'))}</p><input type="text" placeholder="Type answer..." class="w-full p-2 text-base border-2 rounded-xl mt-3" disabled style="background:#f3f4f6"><p class="text-xs text-gray-400 mt-3">👆 Type answer, then flip</p></div>`;
            const ans = Array.isArray(cd.correct_answers) ? cd.correct_answers : [cd.correct_answers || 'answer'];
            back = `<div class="text-center"><h3 class="text-xl text-green-700 marker-underline mb-3">✓ Correct Answer</h3><div class="bg-green-50 p-4 rounded-xl border-2 border-green-300"><p class="text-xl font-bold">${esc(ans.join(' / '))}</p></div>${cd.example ? `<p class="text-md text-gray-600 mt-3">📝 Example: ${fmtBreaks(esc(cd.example))}</p>` : ''}</div>`;
        } else {
            const exList = cd.examples || [];
            const exHtml = exList.length ? exList.map((ex,i) => `<p class="text-md text-gray-600">📝 Example ${i+1}: ${fmtBreaks(esc(ex))}</p>`).join('') : '';
            const defFront = type === 'deep_dive' ? [] : ['definition'];
            const ff = Array.isArray(cd.front_fields) ? cd.front_fields : defFront;
            const parts = [];
            if (ff.includes('definition') && cd.definition) parts.push(`<div class="text-base text-center">${fmtBreaks(esc(cd.definition))}</div>`);
            if (ff.includes('usage1') && cd.usage1) parts.push(`<div class="text-sm text-center text-gray-700 mt-1">${fmtBreaks(esc(cd.usage1))}</div>`);
            if (ff.includes('tip') && cd.tip) parts.push(`<div class="text-sm text-center text-gray-700 mt-1">💡 ${fmtBreaks(esc(cd.tip))}</div>`);
            front = `<div class="flex flex-col items-center justify-center min-h-[200px]">${hasImg ? `<img src="${esc(cd.image_url)}" class="max-h-32 object-contain rounded-lg mb-2">` : ''}${hasAud ? '<div class="text-sm mb-2">🔊 Audio</div>' : ''}<div class="text-2xl text-center font-bold mb-2">${t}</div>${parts.join('')}<p class="text-xs text-gray-400 mt-4">👆 Tap to flip</p></div>`;
            const bf = Array.isArray(cd.back_fields) ? cd.back_fields : null;
            const bParts = [];
            if (bf === null || bf.includes('definition')) { if (cd.definition) bParts.push(`<div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-300"><p class="text-lg">${fmtBreaks(esc(cd.definition))}</p></div>`); }
            if (bf === null || bf.includes('usage1')) { if (cd.usage1) bParts.push(`<p class="text-md text-gray-600 mt-2">💡 Usage: ${fmtBreaks(esc(cd.usage1))}</p>`); }
            if (bf === null || bf.includes('examples')) bParts.push(exHtml);
            if (bf === null || bf.includes('tip')) { if (cd.tip) bParts.push(`<div class="mt-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3"><p class="text-md text-yellow-800">💡 Tip: ${fmtBreaks(esc(cd.tip))}</p></div>`); }
            back = `<div class="text-center"><h3 class="text-2xl text-blue-700 marker-underline mb-3">${t}</h3>${bParts.join('') || '<p class="text-gray-500">(No back fields selected)</p>'}</div>`;
        }

        T(frontEl).innerHTML = front;
        T(backEl).innerHTML = back;
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB SYSTEM
    // ═══════════════════════════════════════════════════════════════
    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const tab = T('tab-' + btn.dataset.tab);
                if (tab) tab.classList.add('active');
                if (btn.dataset.tab === 'editor' && !editorInitialized) initEditor();
                if (btn.dataset.tab === 'import' && !importInitialized) initImport();
                if (btn.dataset.tab === 'export' && !exportInitialized) initExport();
                if (btn.dataset.tab === 'users' && !usersInitialized) initUsersAndSets();
            });
        });
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const parent = btn.closest('.sub-tab-bar').parentElement;
                parent.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
                parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const st = T('subtab-' + btn.dataset.subtab);
                if (st) st.classList.add('active');
                if (btn.dataset.subtab === 'users-list' && !usersSubInitialized) initUsersSubTab();
                if (btn.dataset.subtab === 'sets-list' && !setsSubInitialized) initSetsSubTab();
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB 1: CARD EDITOR
    // ═══════════════════════════════════════════════════════════════
    let editorInitialized = false;
    let editorCards = [];
    let editorSelectedCardId = null;
    let editorEditingCard = null;
    let editorTotal = 0;
    let editorPages = 1;

    function initEditor() {
        editorInitialized = true;
        // Filters
        T('editorSetFilter').addEventListener('change', loadEditorCards);
        T('editorTypeFilter').addEventListener('change', loadEditorCards);
        T('editorSearch').addEventListener('input', loadEditorCards);
        [T('editorFilterBeginner'), T('editorFilterIntermediate'), T('editorFilterAdvanced')].forEach(cb => cb.addEventListener('change', loadEditorCards));
        T('editorNewCardBtn').addEventListener('click', editorNewCard);
        T('editorSaveBtn').addEventListener('click', editorSaveCard);
        T('editRevertBtn').addEventListener('click', editorRevertCard);
        T('editDeleteBtn').addEventListener('click', editorDeleteCard);
        T('editorSelectAll').addEventListener('change', editorToggleSelectAll);
        T('editorBulkDeleteBtn').addEventListener('click', editorBulkDelete);
        T('editorBulkTypeBtn').addEventListener('click', editorBulkChangeType);
        T('editPatternType').addEventListener('change', editorOnTypeChange);
        T('editTitle').addEventListener('input', editorUpdatePreview);
        T('editFieldsContainer').addEventListener('input', editorUpdatePreview);
        T('editFieldsContainer').addEventListener('change', editorUpdatePreview);
        T('editFieldVisibility').addEventListener('change', editorUpdatePreview);
        loadEditorCards();
    }

    let editorPage = 1;
    const EDITOR_PER_PAGE = 100;

    async function loadEditorCards() {
        const setId = T('editorSetFilter').value;
        let url = `admin_cards.php?action=get_cards&t=${Date.now()}&page=${editorPage}&per_page=${EDITOR_PER_PAGE}`;
        if (setId) url += `&set_id=${setId}`;
        else url += '&set_id=0';
        T('editorCardList').innerHTML = '<div class="text-center py-8"><div class="loader"></div> Loading...</div>';
        const data = await fetchJSON(url, { headers: { 'X-Requested-With':'XMLHttpRequest' } });
        if (data.success) {
            editorCards = data.cards;
            editorTotal = data.total || 0;
            editorPages = data.pages || 1;
            editorPage = data.page || 1;
            renderEditorCardList();
            handleFocusCard();
        } else {
            T('editorCardList').innerHTML = '<div class="text-center text-red-500 py-8">Error loading cards</div>';
        }
    }

    async function handleFocusCard() {
        const fc = window.FLASHCARD_ADMIN?.focusCard;
        if (!fc) return;
        delete window.FLASHCARD_ADMIN.focusCard;
        const card = editorCards.find(c => c.id === fc);
        if (card) {
            editorSelectedCardId = fc;
            editorLoadCard(card);
            renderEditorCardList();
            const el = document.querySelector(`.card-item[data-id="${fc}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const res = await fetchJSON(`admin_cards.php?action=get_card&card_id=${fc}`, { headers: { 'X-Requested-With':'XMLHttpRequest' } });
        if (res.success && res.card) {
            if (T('editorSetFilter').value && parseInt(T('editorSetFilter').value) !== res.card.set_id) {
                T('editorSetFilter').value = '';
                editorPage = 1;
                await loadEditorCards();
                const c2 = editorCards.find(c => c.id === fc);
                if (c2) {
                    editorSelectedCardId = fc;
                    editorLoadCard(c2);
                    renderEditorCardList();
                    const el = document.querySelector(`.card-item[data-id="${fc}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            editorCards.unshift(res.card);
            editorTotal++;
            renderEditorCardList();
            const cardItem = document.querySelector(`.card-item[data-id="${fc}"]`);
            if (cardItem) {
                cardItem.classList.add('selected');
                cardItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            editorSelectedCardId = fc;
            editorLoadCard(res.card);
        } else {
            toast('Card #' + fc + ' not found', 'error');
        }
    }

    window._editorPage = (p) => {
        editorPage = Math.max(1, Math.min(p, editorPages || 1));
        loadEditorCards();
    };

    function getEditorCardFilter() {
        const typeFilter = T('editorTypeFilter').value;
        const search = T('editorSearch').value.toLowerCase();
        const levels = [];
        if (T('editorFilterBeginner').checked) levels.push('Beginner');
        if (T('editorFilterIntermediate').checked) levels.push('Intermediate');
        if (T('editorFilterAdvanced').checked) levels.push('Advanced');
        return { typeFilter, search, levels };
    }

    function renderEditorCardList() {
        const f = getEditorCardFilter();
        const typeColors = { multiple_choice:'#fef3c7', gap_fill:'#dcfce7', image_mcq:'#e0e7ff', image_description:'#d1fae5', audio_listening:'#fce7f3', usage_cases:'#f3e8ff', deep_dive:'#ffe4e6', formula_table:'#e0f2fe' };
        const typeLabels = { multiple_choice:'MCQ', gap_fill:'Gap', image_mcq:'ImgMCQ', image_description:'Img', audio_listening:'Audio', usage_cases:'Text', deep_dive:'Deep', formula_table:'Formula' };

        let cards = editorCards.filter(c => {
            if (f.typeFilter && c.pattern_type !== f.typeFilter) return false;
            if (f.search && !(c.title || '').toLowerCase().includes(f.search)) return false;
            if (f.levels.length && !f.levels.includes(c.level)) return false;
            return true;
        });

        T('editorCardCount').textContent = (editorTotal || cards.length) + ' cards';

        const allChecked = T('editorSelectAll');
        const checkedCbs = [];
        let html = '';
        cards.forEach(card => {
            const sel = editorSelectedCardId === card.id ? ' selected' : '';
            const typeLabel = typeLabels[card.pattern_type] || 'Text';
            const color = typeColors[card.pattern_type] || '#f3f4f6';
            html += `<div class="card-item${sel}" data-id="${card.id}">
                <div class="flex items-center gap-2">
                    <input type="checkbox" class="editor-card-cb" value="${card.id}" onclick="event.stopPropagation()">
                    <div class="flex-1 cursor-pointer" onclick="window._selectEditorCard(${card.id})">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-sm">${esc(card.title || 'Untitled')}</span>
                            <span class="card-type" style="background:${color}">${typeLabel}</span>
                        </div>
                        <div class="text-xs text-gray-500">${esc(card.level || 'Beginner')} · ID: ${card.id}</div>
                    </div>
                </div>
            </div>`;
        });
        if (!cards.length) html = '<div class="text-center text-gray-500 py-8">No cards match filters</div>';
        if (editorPages > 1) {
            html += '<div class="flex justify-center items-center gap-2 py-2 text-xs">';
            html += `<button class="btn btn-xs" onclick="window._editorPage(${editorPage - 1})" ${editorPage <= 1 ? 'disabled' : ''}>← Prev</button>`;
            html += `<span>Page ${editorPage} / ${editorPages}</span>`;
            html += `<button class="btn btn-xs" onclick="window._editorPage(${editorPage + 1})" ${editorPage >= editorPages ? 'disabled' : ''}>Next →</button>`;
            html += '</div>';
        }
        T('editorCardList').innerHTML = html;

        // Attach checkboxes
        document.querySelectorAll('.editor-card-cb').forEach(cb => {
            cb.addEventListener('change', updateEditorBulkDeleteBtn);
        });
        allChecked.checked = cards.length > 0 && document.querySelectorAll('.editor-card-cb:not(:checked)').length === 0;

        // Enable arrow navigation
        arrowNav('editorCardList', '.card-item');

        // Expose select function globally for inline onclick
        window._selectEditorCard = (id) => {
            const card = editorCards.find(c => c.id === id);
            if (card) editorLoadCard(card);
            document.querySelectorAll('.card-item').forEach(i => i.classList.toggle('selected', parseInt(i.dataset.id) === id));
            editorSelectedCardId = id;
        };
    }

    function updateEditorBulkDeleteBtn() {
        const checked = document.querySelectorAll('.editor-card-cb:checked').length;
        T('editorSelectedCount').textContent = checked;
        T('editorBulkDeleteBtn').classList.toggle('hidden', checked === 0);
        T('editorBulkTypeWrap').classList.toggle('hidden', checked === 0);
    }

    async function editorBulkChangeType() {
        const ids = Array.from(document.querySelectorAll('.editor-card-cb:checked')).map(cb => parseInt(cb.value));
        if (!ids.length) return;
        const type = T('editorBulkTypeSelect').value;
        if (!type) { toast('Select a type', 'warning'); return; }
        if (!confirm(`Change type of ${ids.length} card(s) to ${type}?`)) return;
        setLoading('editorBulkTypeBtn', true, 'Changing...');
        const data = await fetchJSON('admin_cards.php?action=update_cards_type_bulk', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify({ card_ids: ids, pattern_type: type })
        });
        setLoading('editorBulkTypeBtn', false);
        if (data.success) {
            toast(`✅ Changed ${data.updated} card(s) to ${type}`, 'success');
            loadEditorCards();
        } else {
            toast('❌ ' + (data.error || 'Error'), 'error');
        }
    }

    function editorToggleSelectAll() {
        const checked = T('editorSelectAll').checked;
        document.querySelectorAll('.editor-card-cb').forEach(cb => cb.checked = checked);
        updateEditorBulkDeleteBtn();
    }

    async function editorBulkDelete() {
        const ids = Array.from(document.querySelectorAll('.editor-card-cb:checked')).map(cb => parseInt(cb.value));
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} card(s)? This cannot be undone.`)) return;
        setLoading('editorBulkDeleteBtn', true, 'Deleting...');
        const data = await fetchJSON('admin_cards.php?action=delete_cards_bulk', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify({ card_ids: ids })
        });
        setLoading('editorBulkDeleteBtn', false);
        if (data.success) {
            toast(`✅ Deleted ${data.deleted} card(s)`, 'success');
            loadEditorCards();
            editorNewCard();
        } else {
            toast('❌ ' + (data.error || 'Delete failed'), 'error');
        }
    }

    function editorNewCard() {
        editorSelectedCardId = null;
        editorEditingCard = null;
        T('editCardId').value = '0';
        T('editTitle').value = '';
        T('editPatternType').value = 'usage_cases';
        T('editLevel').value = 'Beginner';
        T('editSetId').value = T('editorSetFilter').value || '1';
        renderFields('editFieldsContainer', 'usage_cases', {});
        renderFieldVisibility('editFieldVisibility', 'usage_cases', {});
        editorUpdatePreview();
        document.querySelectorAll('.card-item').forEach(i => i.classList.remove('selected'));
    }

    function editorLoadCard(card) {
        editorEditingCard = card;
        T('editCardId').value = card.id;
        T('editTitle').value = card.title || '';
        T('editPatternType').value = card.pattern_type || 'usage_cases';
        T('editLevel').value = card.level || 'Beginner';
        T('editSetId').value = card.set_id || 1;
        renderFields('editFieldsContainer', card.pattern_type || 'usage_cases', card.content_data || {});
        renderFieldVisibility('editFieldVisibility', card.pattern_type || 'usage_cases', card.content_data || {});
        editorUpdatePreview();
    }

    function editorRevertCard() {
        if (editorEditingCard) editorLoadCard(editorEditingCard);
        else editorNewCard();
    }

    function editorOnTypeChange() {
        const type = T('editPatternType').value;
        const current = collectFields('editFieldsContainer', type);
        renderFields('editFieldsContainer', type, current);
        renderFieldVisibility('editFieldVisibility', type, current);
        editorUpdatePreview();
    }

    function editorUpdatePreview() {
        const type = T('editPatternType').value;
        const title = T('editTitle').value || 'Flashcard';
        const cd = collectFields('editFieldsContainer', type);
        Object.assign(cd, collectFieldVisibility('editFieldVisibility'));
        renderPreview('frontPreviewContent', 'backPreviewContent', type, title, cd);
    }

    async function editorSaveCard() {
        setLoading('editorSaveBtn', true, 'Saving...');
        const type = T('editPatternType').value;
        const cd = collectFields('editFieldsContainer', type);
        Object.assign(cd, collectFieldVisibility('editFieldVisibility'));
        const data = {
            id: parseInt(T('editCardId').value) || 0,
            set_id: parseInt(T('editSetId').value) || 1,
            title: T('editTitle').value,
            pattern_type: type,
            level: T('editLevel').value,
            question_text: (type === 'multiple_choice' || type === 'image_mcq') ? cd.question_text : '',
            content_data: cd,
        };
        const res = await fetchJSON('admin_cards.php?action=save_card', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify(data)
        });
        setLoading('editorSaveBtn', false);
        if (res.success) {
            toast('✅ Card saved!', 'success');
            loadEditorCards();
            if (res.id && (!T('editCardId').value || T('editCardId').value == '0')) T('editCardId').value = res.id;
        } else {
            toast('❌ ' + (res.error || 'Error saving card'), 'error');
        }
    }

    async function editorDeleteCard() {
        const id = parseInt(T('editCardId').value);
        if (!id) { toast('No card selected', 'warning'); return; }
        if (!confirm('Delete this card?')) return;
        setLoading('editDeleteBtn', true, 'Deleting...');
        const res = await fetchJSON(`admin_cards.php?action=delete_card&card_id=${id}`, {
            headers: { 'X-Requested-With':'XMLHttpRequest' }
        });
        setLoading('editDeleteBtn', false);
        if (res.success) {
            toast('🗑 Deleted', 'success');
            editorNewCard();
            loadEditorCards();
        } else {
            toast('❌ ' + (res.error || 'Error'), 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB 2: IMPORT
    // ═══════════════════════════════════════════════════════════════
    let importInitialized = false;
    let importRows = [];
    let importHeader = [];
    let importSelectedIdx = -1;
    let importFileHandle = null;

    function initImport() {
        importInitialized = true;
        const dz = T('importDropZone');
        const fi = T('importFileInput');
        dz.addEventListener('click', () => fi.click());
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', e => {
            e.preventDefault(); dz.classList.remove('dragover');
            if (e.dataTransfer.files.length && e.dataTransfer.files[0].name.endsWith('.csv')) loadImportPreview(e.dataTransfer.files[0]);
            else toast('Please drop a .csv file', 'warning');
        });
        fi.addEventListener('change', e => { if (e.target.files.length) loadImportPreview(e.target.files[0]); });
        T('importChangeFileBtn').addEventListener('click', () => fi.click());
        T('importApplyCardBtn').addEventListener('click', importApplyRow);
        T('importApplyAllBtn').addEventListener('click', importApplyAll);
        T('importDeleteCardBtn').addEventListener('click', importDeleteRow);
        T('importExecuteBtn').addEventListener('click', importExecute);
        T('importCreateSetBtn').addEventListener('click', importCreateSet);
        T('importApplySetAll').addEventListener('change', importApplySetAllToggle);
        T('importSetSelector').addEventListener('change', importSetSelectorChange);
        T('importEditType').addEventListener('change', () => {
            if (importSelectedIdx >= 0) {
                renderImportEditorFields(importSelectedIdx);
                importRenderPreview();
            }
        });
        T('importEditTitle').addEventListener('input', importRenderPreview);
        T('importEditLevel').addEventListener('change', importRenderPreview);
        arrowNav('importPreviewBody', 'tr', (el) => { if (el.dataset.idx !== undefined) selectImportRow(parseInt(el.dataset.idx)); });
    }

    async function loadImportPreview(file) {
        importFileHandle = file;
        T('importFileName').textContent = file.name;
        const fd = new FormData(); fd.append('csv', file);
        T('importPreviewBody').innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="loader"></div> Parsing...</td></tr>';
        const res = await fetchJSON('admin_cards.php?action=preview_csv&t=' + Date.now(), {
            method: 'POST', body: fd, headers: { 'X-Requested-With':'XMLHttpRequest' }
        });
        if (!res.success) { toast('❌ ' + (res.error || 'Failed to parse'), 'error'); return; }

        importHeader = res.header || [];
        importRows = (res.rows || []).map(row => {
            let level = (row.level || 'Beginner').trim();
            const lm = { 'beginner':'Beginner','a1':'Beginner','a2':'Beginner','intermediate':'Intermediate','b1':'Intermediate','b2':'Intermediate','advanced':'Advanced','c1':'Advanced','c2':'Advanced' };
            level = lm[level.toLowerCase()] || level;
            let type = (row.type || 'usage_cases').trim().toLowerCase();
            if (!['usage_cases','deep_dive','formula_table','multiple_choice','gap_fill','image_mcq','image_description','audio_listening'].includes(type)) type = 'usage_cases';
            // Merge content_data JSON into row
            let cd = row.content_data;
            if (typeof cd === 'string' && cd) { try { cd = JSON.parse(cd); } catch(e) { cd = null; } }
            if (cd && typeof cd === 'object') {
                for (const k of Object.keys(cd)) {
                    const v = cd[k];
                    if (v != null && !row[k]) {
                        if (Array.isArray(v)) { if (k === 'options' || k === 'correct_answers') row[k] = v.join(', '); }
                        else if (typeof v === 'string') row[k] = v;
                    }
                }
                if (cd.definition && !row.definition) row.definition = cd.definition;
                if (cd.question_text && !row.question_text) row.question_text = cd.question_text;
                if (cd.sentence && !row.sentence) row.sentence = cd.sentence;
                if (cd.example && !row.example1) row.example1 = cd.example;
                if (cd.usage1 && !row.usage1) row.usage1 = cd.usage1;
                if (cd.tip && !row.tip) row.tip = cd.tip;
                if (cd.explanation && !row.explanation) row.explanation = cd.explanation;
                if (cd.image_url && !row.image_url) row.image_url = cd.image_url;
                if (cd.audio_url && !row.audio_url) row.audio_url = cd.audio_url;
                if (cd.description && !row.description) row.description = cd.description;
                if (cd.prompt && !row.prompt) row.prompt = cd.prompt;
                if (cd.transcript && !row.transcript) row.transcript = cd.transcript;
                if (cd.correct_index !== undefined && row.correct_answer === undefined) row.correct_answer = String(cd.correct_index);
                if (Array.isArray(cd.options) && !row.opt1) cd.options.forEach((o,i) => { if (i<4) row['opt'+(i+1)]=o; });
                if (Array.isArray(cd.correct_answers) && !row.correct_answer) row.correct_answer = cd.correct_answers.join(',');
            }
            return { ...row, _setName: (row.set || '').trim(), _checked: true, type, level };
        });
        T('importRowCount').textContent = `(${res.total} rows)`;
        renderImportPreview();
        T('importStepFile').classList.add('hidden');
        T('importStepPreview').classList.remove('hidden');
    }

    function renderImportPreview() {
        const labels = { usage_cases:'📘 Usage', deep_dive:'🧠 Deep', formula_table:'📐 Formula', multiple_choice:'❓ MCQ', gap_fill:'✏️ Gap', image_mcq:'🖼️ ImgMCQ', image_description:'🖼️ Img', audio_listening:'🎧 Audio' };
        const selAll = T('importSelectAll');
        let html = '';
        importRows.forEach((row, i) => {
            const sel = i === importSelectedIdx ? ' selected' : '';
            const s = row.type || 'usage_cases';
            html += `<tr class="${sel}" data-idx="${i}">
                <td><input type="checkbox" class="import-row-cb" data-idx="${i}" ${row._checked ? 'checked' : ''}></td>
                <td class="text-gray-400 text-xs">${i+1}</td>
                <td>${esc(row._setName || '')}</td>
                <td><span class="card-type ${s === 'multiple_choice'||s==='image_mcq'?'mcq':s==='gap_fill'?'gap':'text'}">${labels[s]||s}</span></td>
                <td class="import-row-title">${esc(row.title || 'Untitled')}</td>
                <td><span class="text-xs bg-gray-100 px-2 py-0.5 rounded">${esc(row.level || 'Beginner')}</span></td>
            </tr>`;
        });
        T('importPreviewBody').innerHTML = html;

        T('importPreviewBody').querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', e => { if (e.target.type === 'checkbox') return; selectImportRow(parseInt(tr.dataset.idx)); });
        });
        T('importPreviewBody').querySelectorAll('.import-row-cb').forEach(cb => {
            cb.addEventListener('change', e => {
                const i = parseInt(e.target.dataset.idx);
                if (importRows[i]) importRows[i]._checked = e.target.checked;
                selAll.checked = importRows.every(r => r._checked);
            });
        });
        selAll.onchange = () => { const c = selAll.checked; importRows.forEach(r => r._checked = c); document.querySelectorAll('.import-row-cb').forEach(cb => cb.checked = c); };

        if (importRows.length && importSelectedIdx < 0) selectImportRow(0);
    }

    function selectImportRow(idx) {
        if (idx < 0 || idx >= importRows.length) return;
        importSelectedIdx = idx;
        const row = importRows[idx];
        T('importEditTitle').value = row.title || '';
        T('importEditType').value = row.type || 'usage_cases';
        T('importEditLevel').value = row.level || 'Beginner';
        T('importPreviewSection').classList.remove('hidden');
        // Match set name to dropdown
        const sName = row._setName || '';
        const setSel = T('importEditSetId');
        let matched = '';
        for (let i = 0; i < setSel.options.length; i++) { if (setSel.options[i].text === sName) { matched = setSel.options[i].value; break; } }
        setSel.value = matched || '';
        renderImportEditorFields(idx);
        importRenderPreview();
        document.querySelectorAll('#importPreviewBody tr').forEach(tr => tr.classList.toggle('selected', parseInt(tr.dataset.idx) === idx));
    }

    function renderImportEditorFields(idx) {
        const row = importRows[idx];
        const type = T('importEditType').value || row.type || 'usage_cases';
        const cfg = CFC[type];
        if (cfg) {
            const vals = {};
            cfg.fields.forEach(f => {
                vals[f.key] = row[f.key] !== undefined && row[f.key] !== '' ? row[f.key] : '';
            });
            // CSV column aliases
            if (!vals.correct_answers && row.correct_answer) vals.correct_answers = row.correct_answer;
            if (!vals.example && row.example1) vals.example = row.example1;
            if (!vals.examples) {
                const exs = [row.example1, row.example2, row.example3, row.example4].filter(Boolean);
                if (exs.length) vals.examples = exs.join('\n');
            }
            if (!vals.options) {
                const opts = [row.opt1, row.opt2, row.opt3, row.opt4].filter(Boolean);
                if (opts.length) vals.options = opts.join(', ');
            }
            if (!vals.correct_index && row.correct_answer !== undefined && row.correct_answer !== '' && isNaN(parseInt(vals.correct_index))) {
                vals.correct_index = row.correct_answer;
            }
            renderFields('importDynamicFields', type, vals);
            renderFieldVisibility('importFieldVisibility', type, vals);
        } else {
            T('importDynamicFields').innerHTML = '<div class="text-sm text-gray-500">No fields</div>';
            T('importFieldVisibility').innerHTML = '';
        }
        T('importDynamicFields').querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', importRenderPreview);
            el.addEventListener('change', importRenderPreview);
        });
        T('importFieldVisibility').querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', importRenderPreview);
            el.addEventListener('change', importRenderPreview);
        });
    }

    function importApplyRow() {
        if (importSelectedIdx < 0) return;
        updateImportRow(importSelectedIdx);
        renderImportPreview();
        selectImportRow(importSelectedIdx);
        toast('Row updated', 'success');
    }

    function importApplyAll() {
        for (let i = 0; i < importRows.length; i++) updateImportRow(i);
        renderImportPreview();
        if (importSelectedIdx >= 0) selectImportRow(importSelectedIdx);
        toast('Applied to all rows', 'success');
    }

    function updateImportRow(idx) {
        if (idx < 0 || idx >= importRows.length) return;
        const row = importRows[idx];
        row.title = T('importEditTitle').value;
        row.type = T('importEditType').value;
        row.level = T('importEditLevel').value;
        const setId = T('importEditSetId').value;
        const sName = setId ? (T('importEditSetId').options[T('importEditSetId').selectedIndex]?.text || '') : '';
        row._setName = sName;
        row.set_id = setId;
        // Collect dynamic fields
        const cd = collectFields('importDynamicFields', row.type);
        Object.assign(cd, collectFieldVisibility('importFieldVisibility'));
        Object.keys(cd).forEach(k => { row[k] = Array.isArray(cd[k]) ? cd[k].join(', ') : cd[k]; });
        // Map CFC keys back to CSV column names
        if (row.correct_answers) row.correct_answer = Array.isArray(row.correct_answers) ? row.correct_answers.join(',') : splitCSV(row.correct_answers).join(',');
        if (row.options) {
            const opts = Array.isArray(row.options) ? row.options : splitCSV(String(row.options));
            for (let i = 0; i < 4; i++) row['opt' + (i + 1)] = opts[i] || '';
        } else {
            for (let i = 0; i < 4; i++) row['opt' + (i + 1)] = '';
        }
        if (row.examples) {
            const exs = Array.isArray(row.examples) ? row.examples : String(row.examples).split('\n').filter(Boolean);
            for (let i = 0; i < 4; i++) row['example' + (i + 1)] = exs[i] || '';
        } else {
            for (let i = 0; i < 4; i++) row['example' + (i + 1)] = '';
        }
        if (row.example && !row.example1) row.example1 = String(row.example);
        if (row.front_fields && Array.isArray(row.front_fields)) row.front_fields = row.front_fields.join(',');
        if (row.back_fields && Array.isArray(row.back_fields)) row.back_fields = row.back_fields.join(',');
    }

    function importDeleteRow() {
        if (importSelectedIdx < 0) { toast('Select a row first', 'warning'); return; }
        if (!confirm('Remove this row?')) return;
        importRows.splice(importSelectedIdx, 1);
        importSelectedIdx = -1;
        renderImportPreview();
        if (importRows.length) selectImportRow(0);
    }

    function importRenderPreview() {
        const idx = importSelectedIdx;
        if (idx < 0 || idx >= importRows.length) { T('importPreviewSection')?.classList.add('hidden'); return; }
        T('importPreviewSection').classList.remove('hidden');
        const row = importRows[idx];
        const title = T('importEditTitle').value || row.title || 'Untitled';
        const type = T('importEditType').value || row.type || 'usage_cases';
        // Collect content data from editor fields (same as editor preview)
        const cd = collectFields('importDynamicFields', type);
        Object.assign(cd, collectFieldVisibility('importFieldVisibility'));
        renderPreview('importFrontPreview', 'importBackPreview', type, title, cd);
    }

    function importApplySetAllToggle() {
        if (T('importApplySetAll').checked && T('importSetSelector').value) {
            const sName = T('importSetSelector').options[T('importSetSelector').selectedIndex]?.text || '';
            importRows.forEach(r => { r._setName = sName; r.set_id = T('importSetSelector').value; });
            renderImportPreview();
        }
    }

    function importSetSelectorChange() {
        if (T('importApplySetAll').checked && T('importSetSelector').value) {
            const sName = T('importSetSelector').options[T('importSetSelector').selectedIndex]?.text || '';
            importRows.forEach(r => { r._setName = sName; r.set_id = T('importSetSelector').value; });
            renderImportPreview();
        }
    }

    async function importCreateSet() {
        const name = T('importNewSetName').value.trim();
        if (!name) { toast('Enter a set name', 'warning'); return; }
        const res = await fetchJSON('admin_cards.php?action=create_set', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify({ name })
        });
        if (res.success) {
            toast(`✅ "${name}" created`, 'success');
            T('importNewSetName').value = '';
            await refreshSetSelectors();
            if (res.id && T('importSetSelector')) T('importSetSelector').value = String(res.id);
        } else {
            toast('❌ ' + (res.error || 'Error'), 'error');
        }
    }

    async function importExecute() {
        if (importSelectedIdx >= 0) updateImportRow(importSelectedIdx);

        const checked = importRows.filter(r => r._checked);
        if (!checked.length) { toast('Select at least one row', 'warning'); return; }
        if (!confirm(`Import ${checked.length} card(s)?`)) return;
        setLoading('importExecuteBtn', true, 'Importing...');

        const cols = ['id','set','set_id','type','title','level','question_text','definition','sentence','opt1','opt2','opt3','opt4','correct_answer','explanation','example1','example2','example3','example4','usage1','tip','image_url','description','audio_url','prompt','transcript','front_fields','back_fields'];
        const csvRows = [cols.join(';')];
        checked.forEach(row => {
            const vals = cols.map(col => {
                if (col === 'set') return row._setName || '';
                if (col === 'set_id') return row.set_id || '';
                if (col === 'type') return row.type || 'usage_cases';
                if (col === 'level') return row.level || 'Beginner';
                let v = row[col] !== undefined ? String(row[col]) : '';
                if (v.includes(';') || v.includes('"') || v.includes('\n')) v = '"' + v.replace(/"/g, '""') + '"';
                return v;
            });
            csvRows.push(vals.join(';'));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const fd = new FormData();
        fd.append('csv', blob, (importFileHandle ? importFileHandle.name : 'import.csv'));
        try {
            const res = await fetchJSON('api/import_csv.php', { method: 'POST', body: fd });
            if (res.success) {
                let msg = `✅ Imported ${res.imported} cards.`;
                if (res.errors.length) msg += `\n⚠️ ${res.errors.length} errors:\n` + res.errors.slice(0,10).join('\n');
                if (res.errors.length > 10) msg += `\n...and ${res.errors.length-10} more`;
                toast(msg.split('\n')[0], res.errors.length ? 'warning' : 'success');
                if (res.errors.length) alert(msg);
                // Reset import UI
                T('importStepFile').classList.remove('hidden');
                T('importStepPreview').classList.add('hidden');
                importRows = []; importSelectedIdx = -1; importFileHandle = null;
                await refreshSetSelectors();
            } else {
                toast('❌ ' + (res.error || 'Import failed'), 'error');
            }
            setLoading('importExecuteBtn', false);
        } catch (e) { setLoading('importExecuteBtn', false); toast('❌ Network error', 'error'); }
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB 3: EXPORT
    // ═══════════════════════════════════════════════════════════════
    let exportInitialized = false;
    let exportCards = [];

    function initExport() {
        exportInitialized = true;
        T('exportSetFilter').addEventListener('change', renderExportList);
        T('exportTypeFilter').addEventListener('change', renderExportList);
        T('exportSelectAll').addEventListener('change', () => {
            document.querySelectorAll('.export-card-cb').forEach(cb => cb.checked = T('exportSelectAll').checked);
            updateExportCount();
        });
        T('exportExecuteBtn').addEventListener('click', exportExecute);
        arrowNav('exportCardListContainer', '.export-card-item');
        loadExportCards();
    }

    async function loadExportCards() {
        T('exportCardListContainer').innerHTML = '<div class="text-center py-8"><div class="loader"></div> Loading...</div>';
        const res = await fetchJSON('admin_cards.php?action=get_cards&set_id=0&t=' + Date.now(), {
            headers: { 'X-Requested-With':'XMLHttpRequest' }
        });
        if (res.success) {
            exportCards = res.cards;
            renderExportList();
        } else {
            T('exportCardListContainer').innerHTML = '<div class="text-center text-red-500 py-8">Error</div>';
        }
    }

    function renderExportList() {
        const setId = parseInt(T('exportSetFilter').value);
        const typeFilter = T('exportTypeFilter').value;
        const typeColors = { multiple_choice:'#fef3c7', gap_fill:'#dcfce7', image_mcq:'#e0e7ff', image_description:'#d1fae5', audio_listening:'#fce7f3', usage_cases:'#f3e8ff', deep_dive:'#ffe4e6', formula_table:'#e0f2fe' };
        const typeLabels = { multiple_choice:'MCQ', gap_fill:'Gap', image_mcq:'ImgMCQ', image_description:'Img', audio_listening:'Audio', usage_cases:'Text', deep_dive:'Deep', formula_table:'Formula' };

        let cards = exportCards.filter(c => {
            if (setId > 0 && c.set_id !== setId) return false;
            if (typeFilter && c.pattern_type !== typeFilter) return false;
            return true;
        });

        if (!cards.length) {
            T('exportCardListContainer').innerHTML = '<div class="text-center text-gray-500 py-8">No cards match filters</div>';
            updateExportCount();
            return;
        }

        let html = '';
        cards.forEach(c => {
            const tl = typeLabels[c.pattern_type] || 'Text';
            const tc = typeColors[c.pattern_type] || '#f3f4f6';
            html += `<div class="export-card-item">
                <input type="checkbox" class="export-card-cb" value="${c.id}" checked>
                <div class="card-info flex-1 flex justify-between items-center">
                    <div><span class="font-medium text-sm">${esc(c.title || 'Untitled')}</span><span class="text-xs text-gray-500 ml-2">${esc(c.set_name || '')}</span></div>
                    <span class="card-type-badge" style="background:${tc}">${tl}</span>
                </div>
            </div>`;
        });
        T('exportCardListContainer').innerHTML = html;
        document.querySelectorAll('.export-card-cb').forEach(cb => cb.addEventListener('change', updateExportCount));
        T('exportCardListContainer').querySelectorAll('.export-card-item').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.type === 'checkbox') return;
                const cb = el.querySelector('.export-card-cb');
                if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
            });
        });
        updateExportCount();
    }

    function updateExportCount() {
        const checked = document.querySelectorAll('.export-card-cb:checked').length;
        const total = document.querySelectorAll('.export-card-cb').length;
        T('exportSelectedCount').textContent = `${checked} of ${total} cards selected`;
        T('exportSelectAll').checked = total > 0 && checked === total;
    }

    function exportExecute() {
        const ids = Array.from(document.querySelectorAll('.export-card-cb:checked')).map(cb => cb.value);
        if (!ids.length) { toast('Select cards to export', 'warning'); return; }
        const setId = T('exportSetFilter').value;
        const type = T('exportTypeFilter').value;
        let p = new URLSearchParams();
        if (setId !== '0') p.set('set_id', setId);
        if (type) p.set('type', type);
        p.set('card_ids', ids.join(','));
        window.location.href = 'api/export_csv.php?' + p.toString();
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB 4: USERS & SETS
    // ═══════════════════════════════════════════════════════════════
    let usersInitialized = false;
    let usersSubInitialized = false;
    let setsSubInitialized = false;
    let cachedUsers = [];
    let cachedSets = [];

    function initUsersAndSets() {
        usersInitialized = true;
    }

    // ─── Users Sub-tab ──────────────────────────────────────────────
    function renderNewUserForm() {
        const panel = T('userEditPanel');
        fetchJSON('admin_cards.php?action=get_sets&t=' + Date.now(), { headers: { 'X-Requested-With':'XMLHttpRequest' } }).then(setsRes => {
            const allSets = setsRes.success ? setsRes.sets : [];
            let setCbs = allSets.map(s => `<label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" class="new-user-set-cb" value="${s.id}"> ${esc(s.name)}</label>`).join('');
            if (!allSets.length) setCbs = '<div class="text-sm text-gray-400">No sets available</div>';
            panel.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <h2 class="text-lg marker-underline">➕ New User</h2>
                    <div class="flex gap-2">
                        <button id="createUserSaveBtn" class="btn btn-success btn-xs">💾 Save</button>
                        <button id="createUserCancelBtn" class="btn btn-secondary btn-xs">✕ Cancel</button>
                    </div>
                </div>
                <label class="block font-bold mb-1">Username:</label>
                <input type="text" id="newUserUsername" class="form-input" placeholder="Enter username" maxlength="30">
                <label class="block font-bold mb-1">Full Name:</label>
                <input type="text" id="newUserFullName" class="form-input" placeholder="Enter full name">
                <label class="block font-bold mb-1">Password:</label>
                <input type="password" id="newUserPassword" class="form-input" placeholder="Min 6 characters">
                <label class="block font-bold mb-1">Level:</label>
                <select id="newUserLevel" class="form-select">
                    <option value="Beginner">🔰 Beginner</option>
                    <option value="Intermediate">📚 Intermediate</option>
                    <option value="Advanced">🎓 Advanced</option>
                </select>
                <label class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="newUserIsAdmin">
                    <span class="font-bold">Admin privileges</span>
                </label>
                <div class="mt-2 mb-2">
                    <label class="block font-bold mb-1">📚 Card Set Access:</label>
                    <p class="text-xs text-gray-500 mb-2">Leave all unchecked = show all sets</p>
                    <div class="space-y-1">${setCbs}</div>
                </div>
            `;
            T('createUserSaveBtn').addEventListener('click', async () => {
                const username = T('newUserUsername').value.trim();
                const fullName = T('newUserFullName').value.trim();
                const password = T('newUserPassword').value;
                const level = T('newUserLevel').value;
                const isAdmin = T('newUserIsAdmin').checked;
                if (!username) { toast('Username required', 'warning'); return; }
                if (!password || password.length < 6) { toast('Password min 6 chars', 'warning'); return; }
                const res = await fetchJSON('admin_cards.php?action=create_user', {
                    method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                    body: JSON.stringify({ username, full_name: fullName, password, english_level: level, is_admin: isAdmin })
                });
                if (res.success) {
                    const setIds = Array.from(document.querySelectorAll('.new-user-set-cb:checked')).map(cb => parseInt(cb.value));
                    await fetchJSON('admin_cards.php?action=set_user_sets', {
                        method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                        body: JSON.stringify({ user_id: res.user.id, set_ids: setIds })
                    });
                    toast('✅ User created', 'success');
                    loadUsers();
                    openUserEditor({ id: res.user.id, username, fullname: fullName, level, admin: isAdmin ? 'true' : 'false' });
                } else toast('❌ ' + (res.error || 'Error'), 'error');
            });
            T('createUserCancelBtn').addEventListener('click', () => {
                panel.innerHTML = '<div class="text-gray-400 text-center py-8">Select a user from the list</div>';
            });
        });
    }

    function initUsersSubTab() {
        usersSubInitialized = true;
        T('userListNewBtn').addEventListener('click', renderNewUserForm);
        arrowNav('userListContainer', 'tr');
        loadUsers();
    }

    async function loadUsers() {
        T('userListContainer').innerHTML = '<div class="text-center py-4"><div class="loader"></div> Loading...</div>';
        const res = await fetchJSON('admin_cards.php?action=get_users&t=' + Date.now(), {
            headers: { 'X-Requested-With':'XMLHttpRequest' }
        });
        if (res.success && res.users) {
            cachedUsers = res.users;
            renderUsers(res.users);
        } else {
            T('userListContainer').innerHTML = '<div class="text-center text-red-500 py-4">Error</div>';
        }
    }

    function renderUsers(users) {
        if (!users.length) { T('userListContainer').innerHTML = '<div class="text-center text-gray-500 py-4">No users</div>'; return; }
        let html = '<table class="w-full" style="border-collapse:collapse;"><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Username</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Name</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Role</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Level</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Progress</th><th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;">Actions</th></tr>';
        users.forEach(u => {
            html += `<tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(u.username)}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(u.full_name || '')}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${u.is_admin ? '<span class="card-type mcq">Admin</span>' : '<span class="card-type text">Student</span>'}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${esc(u.english_level || 'Beginner')}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${u.progress || 0}%</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
                    <button class="user-edit-btn btn btn-primary text-xs" data-id="${u.id}" data-username="${esc(u.username)}" data-fullname="${esc(u.full_name||'')}" data-level="${esc(u.english_level||'Beginner')}" data-admin="${u.is_admin}" style="padding:4px 10px;">✏️ Edit</button>
                    <button class="user-reset-btn btn btn-warning text-xs" data-id="${u.id}" style="padding:4px 10px;">🔄 Reset</button>
                    <button class="user-del-btn btn btn-danger text-xs" data-id="${u.id}" style="padding:4px 10px;">🗑 Delete</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        T('userListContainer').innerHTML = html;

        // Row click → edit
        T('userListContainer').querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', e => {
                if (e.target.closest('button')) return;
                tr.querySelector('.user-edit-btn')?.click();
            });
        });

        // Edit button
        document.querySelectorAll('.user-edit-btn').forEach(b => {
            b.addEventListener('click', () => openUserEditor(b.dataset));
        });
        // Delete button
        document.querySelectorAll('.user-del-btn').forEach(b => {
            b.addEventListener('click', async () => {
                if (!confirm('Delete user?')) return;
                const res = await fetchJSON(`admin_cards.php?action=delete_user&user_id=${b.dataset.id}`, {
                    headers: { 'X-Requested-With':'XMLHttpRequest' }
                });
                if (res.success) { toast('🗑 User deleted', 'success'); loadUsers(); }
                else toast('❌ ' + (res.error || 'Error'), 'error');
            });
        });
        // Reset progress button
        document.querySelectorAll('.user-reset-btn').forEach(b => {
            b.addEventListener('click', async () => {
                if (!confirm('Reset all progress for this user?')) return;
                const res = await fetchJSON(`admin_cards.php?action=reset_user_progress&user_id=${b.dataset.id}`, {
                    headers: { 'X-Requested-With':'XMLHttpRequest' }
                });
                if (res.success) { toast('Progress reset', 'success'); loadUsers(); }
                else toast('❌ Error', 'error');
            });
        });
    }

    async function openUserEditor(data) {
        const panel = T('userEditPanel');
        const uid = parseInt(data.id);

        // Fetch sets and user set access
        const [setsRes, accessRes] = await Promise.all([
            fetchJSON('admin_cards.php?action=get_sets&t=' + Date.now(), { headers: { 'X-Requested-With':'XMLHttpRequest' } }),
            fetchJSON(`admin_cards.php?action=get_user_sets&user_id=${uid}&t=${Date.now()}`, { headers: { 'X-Requested-With':'XMLHttpRequest' } })
        ]);
        const allSets = setsRes.success ? setsRes.sets : [];
        const userSetIds = accessRes.success ? accessRes.set_ids : [];

        let setCbs = allSets.map(s => `<label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" class="user-set-cb" value="${s.id}" ${userSetIds.includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('');
        if (!allSets.length) setCbs = '<div class="text-sm text-gray-400">No sets available</div>';

        panel.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg marker-underline">✏️ Edit User</h2>
                <div class="flex gap-2">
                    <button id="saveEditUserBtn" class="btn btn-success btn-xs">💾 Save</button>
                    <button id="createUserBtn" class="btn btn-primary btn-xs">➕ New</button>
                    <button id="deleteUserBtn" class="btn btn-danger btn-xs">🗑 Del</button>
                </div>
            </div>
            <input type="hidden" id="editUserId" value="${uid}">
            <label class="block font-bold mb-1">Username:</label>
            <input type="text" id="editUserUsername" class="form-input" value="${esc(data.username)}" maxlength="30">
            <label class="block font-bold mb-1">Full Name:</label>
            <input type="text" id="editUserFullName" class="form-input" value="${esc(data.fullname)}">
            <label class="block font-bold mb-1">Level:</label>
            <select id="editUserLevel" class="form-select">
                <option value="Beginner" ${data.level==='Beginner'?'selected':''}>🔰 Beginner</option>
                <option value="Intermediate" ${data.level==='Intermediate'?'selected':''}>📚 Intermediate</option>
                <option value="Advanced" ${data.level==='Advanced'?'selected':''}>🎓 Advanced</option>
            </select>
            <label class="block font-bold mb-1">New Password:</label>
            <input type="password" id="editUserPassword" class="form-input" placeholder="Leave empty to keep current">
            <label class="flex items-center gap-2 my-2">
                <input type="checkbox" id="editUserIsAdmin" ${data.admin === 'true' || data.admin === '1' ? 'checked' : ''}>
                <span class="font-bold">Admin privileges</span>
            </label>
            <div class="mt-2 mb-2">
                <label class="block font-bold mb-1">📚 Card Set Access:</label>
                <p class="text-xs text-gray-500 mb-2">Leave all unchecked = show all sets</p>
                <div class="space-y-1">${setCbs}</div>
            </div>
        `;

        T('saveEditUserBtn').addEventListener('click', async () => {
            const id = parseInt(T('editUserId').value);
            const username = T('editUserUsername').value.trim();
            const fullName = T('editUserFullName').value.trim();
            const level = T('editUserLevel').value;
            const isAdmin = T('editUserIsAdmin').checked;
            const pwd = T('editUserPassword').value;
            if (!username) { toast('Username required', 'warning'); return; }
            const body = { id, username, full_name: fullName, english_level: level, is_admin: isAdmin };
            if (pwd) body.password = pwd;
            const res = await fetchJSON('admin_cards.php?action=update_user', {
                method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                body: JSON.stringify(body)
            });
            if (!res.success) { toast('❌ ' + (res.error || 'Error'), 'error'); return; }
            // Save set access
            const setIds = Array.from(document.querySelectorAll('.user-set-cb:checked')).map(cb => parseInt(cb.value));
            await fetchJSON('admin_cards.php?action=set_user_sets', {
                method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                body: JSON.stringify({ user_id: id, set_ids: setIds })
            });
            toast('✅ User saved', 'success');
            loadUsers();
        });

        T('createUserBtn').addEventListener('click', renderNewUserForm);

        T('deleteUserBtn').addEventListener('click', async () => {
            if (!confirm('Delete this user?')) return;
            const id = parseInt(T('editUserId').value);
            const res = await fetchJSON(`admin_cards.php?action=delete_user&user_id=${id}`, {
                headers: { 'X-Requested-With':'XMLHttpRequest' }
            });
            if (res.success) { toast('🗑 User deleted', 'success'); loadUsers(); T('userEditPanel').innerHTML = '<div class="text-gray-400 text-center py-8">Select a user to edit</div>'; }
            else toast('❌ ' + (res.error || 'Error'), 'error');
        });
    }

    // ─── Card Sets Sub-tab ──────────────────────────────────────────
    function initSetsSubTab() {
        setsSubInitialized = true;
        T('setsSearchInput').addEventListener('input', () => { if (cachedSets.length) renderSetsList(cachedSets); });
        T('addSetBtn').addEventListener('click', addSet);
        T('newSetNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') T('addSetBtn').click(); });
        fetchSets();
    }

    async function fetchSets() {
        const res = await fetchJSON('admin_cards.php?action=get_sets&t=' + Date.now(), {
            headers: { 'X-Requested-With':'XMLHttpRequest' }
        });
        if (res.success && res.sets) {
            cachedSets = res.sets;
            renderSetsList(res.sets);
            refreshSetSelectors(res.sets);
        }
    }

    function renderSetsList(sets) {
        const search = (T('setsSearchInput').value || '').toLowerCase();
        const filtered = search ? sets.filter(s => s.name.toLowerCase().includes(search)) : sets;

        let html = '';
        filtered.forEach(set => {
            const cnt = set.card_count !== undefined ? parseInt(set.card_count) : 0;
            const excl = set.exclusive_to || '';
            const desc = set.description || '';
            const names = excl.split(',').map(s => s.trim()).filter(Boolean);
            let chips = names.length ? names.slice(0,3).map(u => `<span class="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full mr-1 mb-0.5">🔒 ${esc(u)}</span>`).join('') + (names.length > 3 ? `<span class="text-xs text-gray-400">+${names.length-3} more</span>` : '') : '<span class="text-xs text-gray-400">🌐 Public</span>';
            html += `<div class="set-item mb-2 p-2.5 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors" data-id="${set.id}">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="set-name-display font-bold text-sm flex-1 cursor-text" contenteditable="true">${esc(set.name)}</span>
                    <span class="text-xs text-gray-400 font-mono">${cnt} card${cnt !== 1 ? 's' : ''}</span>
                    <button class="delete-set-btn btn btn-danger text-xs" style="padding:2px 6px;">🗑</button>
                </div>
                <div class="mt-1">
                    <textarea class="set-description-display form-textarea text-xs" rows="1" placeholder="Set description...">${esc(desc)}</textarea>
                </div>
                <div class="mt-1 flex items-center gap-2 flex-wrap">
                    <div class="exclusive-chips">${chips}</div>
                    <button class="toggle-exclusive-btn text-xs text-blue-500 hover:text-blue-700" style="background:none;border:none;cursor:pointer;">✏️ access</button>
                </div>
                <div class="exclusive-editor hidden mt-1.5 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <label class="text-xs text-gray-500 block mb-1">🎯 Select students who can see this set:</label>
                    <div class="exclusive-select-wrap"></div>
                    <div class="flex gap-2 mt-1">
                        <button class="save-exclusive-btn btn btn-success text-xs">💾 Save</button>
                        <button class="cancel-exclusive-btn btn btn-secondary text-xs">✕ Cancel</button>
                    </div>
                </div>
            </div>`;
        });
        if (!filtered.length) html = '<div class="text-center text-gray-400 py-4">' + (search ? 'No matches' : 'No sets yet') + '</div>';
        T('setListContainer').innerHTML = html;

        // Inline rename
        document.querySelectorAll('.set-name-display').forEach(el => {
            el.addEventListener('blur', () => saveSetName(el));
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
                if (e.key === 'Escape') { el.textContent = el.dataset.orig; el.blur(); }
            });
            el.dataset.orig = el.textContent;
        });

        // Description auto-save on blur
        document.querySelectorAll('.set-description-display').forEach(el => {
            el.addEventListener('blur', () => {
                const item = el.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const name = item.querySelector('.set-name-display').textContent.trim();
                const description = el.value.trim();
                const set = cachedSets.find(s => s.id == id);
                const exclusiveTo = set?.exclusive_to || '';
                if (description === (set?.description || '')) return;
                const res = fetchJSON('admin_cards.php?action=update_set', {
                    method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                    body: JSON.stringify({ id, name, exclusive_to: exclusiveTo, description })
                });
                res.then(r => { if (r.success) { toast('✅ Description saved', 'success'); fetchSets(); } });
            });
            el.addEventListener('keydown', e => { if (e.key === 'Escape') { el.value = el.dataset.orig || ''; el.blur(); } });
            el.dataset.orig = el.value;
        });

        // Delete set
        document.querySelectorAll('.delete-set-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const name = item.querySelector('.set-name-display').textContent.trim();
                if (!confirm(`Delete "${name}"?`)) return;
                const res = await fetchJSON(`admin_cards.php?action=delete_set&set_id=${id}`, {
                    headers: { 'X-Requested-With':'XMLHttpRequest' }
                });
                if (res.success) { toast(`✅ "${name}" deleted`, 'success'); fetchSets(); }
                else toast('❌ ' + (res.error || 'Error'), 'error');
            });
        });

        // Toggle exclusive editor
        document.querySelectorAll('.toggle-exclusive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const ed = item.querySelector('.exclusive-editor');
                const hidden = ed.classList.contains('hidden');
                ed.classList.toggle('hidden', !hidden);
                btn.textContent = hidden ? '✕ close' : '✏️ access';
                if (hidden) {
                    const wrap = ed.querySelector('.exclusive-select-wrap');
                    const sRes = await fetchJSON('admin_cards.php?action=get_students&t=' + Date.now(), {
                        headers: { 'X-Requested-With':'XMLHttpRequest' }
                    });
                    const students = sRes.success ? sRes.students : [];
                    const set = cachedSets.find(s => s.id == item.dataset.id);
                    const excl = (set?.exclusive_to || '').split(',').map(s => s.trim()).filter(Boolean);
                    let opts = '';
                    students.forEach(s => { const sel = excl.includes(s.username) ? 'selected' : ''; opts += `<option value="${esc(s.username)}" ${sel}>${esc(s.full_name || s.username)}</option>`; });
                    wrap.innerHTML = `<select class="exclusive-select text-xs w-full" multiple size="4" style="border:2px solid #d1d5db;border-radius:8px;padding:4px;background:white;">${opts}</select>`;
                }
            });
        });

        // Save exclusive access
        document.querySelectorAll('.save-exclusive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = btn.closest('.set-item');
                const id = parseInt(item.dataset.id);
                const sel = item.querySelector('.exclusive-select');
                const exclusiveTo = sel ? Array.from(sel.selectedOptions).map(o => o.value).filter(v => v).join(',') : '';
                const name = item.querySelector('.set-name-display').textContent.trim();
                const description = item.querySelector('.set-description-display')?.value.trim() || '';
                const res = await fetchJSON('admin_cards.php?action=update_set', {
                    method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
                    body: JSON.stringify({ id, name, exclusive_to: exclusiveTo, description })
                });
                if (res.success) { toast('✅ Access saved', 'success'); item.querySelector('.exclusive-editor').classList.add('hidden'); item.querySelector('.toggle-exclusive-btn').textContent = '✏️ access'; fetchSets(); }
                else toast('❌ ' + (res.error || 'Error'), 'error');
            });
        });

        // Cancel exclusive
        document.querySelectorAll('.cancel-exclusive-btn').forEach(btn => {
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
        if (!name) { el.textContent = el.dataset.orig || ''; toast('Name required', 'warning'); return; }
        if (name === el.dataset.orig) return;
        const set = cachedSets.find(s => s.id == id);
        const exclusiveTo = set?.exclusive_to || '';
        const description = set?.description || '';
        const res = await fetchJSON('admin_cards.php?action=update_set', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify({ id, name, exclusive_to: exclusiveTo, description })
        });
        if (res.success) { el.dataset.orig = name; toast('✅ Renamed', 'success'); fetchSets(); }
        else { el.textContent = el.dataset.orig || name; toast('❌ Error', 'error'); }
    }

    async function addSet() {
        const input = T('newSetNameInput');
        const name = input.value.trim();
        if (!name) { toast('Enter a name', 'warning'); return; }
        const res = await fetchJSON('admin_cards.php?action=create_set', {
            method: 'POST', headers: { 'X-Requested-With':'XMLHttpRequest' },
            body: JSON.stringify({ name })
        });
        if (res.success) { input.value = ''; toast(`✅ "${name}" created`, 'success'); fetchSets(); }
        else toast('❌ ' + (res.error || 'Error'), 'error');
    }

    // ─── Shared: Refresh Selectors ────────────────────────────────
    async function refreshSetSelectors(sets) {
        if (!sets) {
            const res = await fetchJSON('admin_cards.php?action=get_sets&t=' + Date.now(), {
                headers: { 'X-Requested-With':'XMLHttpRequest' }
            });
            if (res.success && res.sets) sets = res.sets;
            else return;
        }
        const build = (placeholder) => { let h = placeholder ? `<option value="">${placeholder}</option>` : ''; sets.forEach(s => { h += `<option value="${s.id}">${esc(s.name)}</option>`; }); return h; };
        const selects = ['editorSetFilter','editSetId','importSetSelector','importEditSetId'];
        selects.forEach(id => {
            const el = T(id);
            if (!el) return;
            const cur = el.value;
            if (id === 'editorSetFilter') el.innerHTML = build('-- All Sets --');
            else if (id === 'importSetSelector') el.innerHTML = build('-- Select Set --');
            else el.innerHTML = build('');
            if (cur) el.value = cur;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════
    initFieldConfig();
    initTabs();
    // Editor tab starts visible, init it
    initEditor();
})();
