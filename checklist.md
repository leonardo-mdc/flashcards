# Reimplementation Checklist

## Legend
- ✅ present & verified
- 🟡 present but incomplete
- ⬜ not yet implemented
- ❌ needs fix

---

## Infrastructure (our work)

- [x] ✅ `defective-main` branch created at `9247dcf` preserving fork state
- [x] ✅ `main` reset to `backup-before-makeover` (`586013d`)
- [x] ✅ Auto-deploy via GitHub Actions → FTP → InfinityFree
- [x] ✅ `reimplementation-plan.txt` cataloging all 72 commits
- [x] ✅ `healthcheck.php` for debugging
- [x] ✅ Deploy workflow preserves `config.php` (backup/restore + exclude)

## Our Phase 1 — Security & Data Integrity

- [x] ✅ XSS: `escapeHtml` escapes `"` and `'` in app.js + admin.js
- [x] ✅ Session fixation: `session_regenerate_id(true)` on login/register
- [x] ✅ Null-pointer guard: `record_review.php` exits if user not found
- [x] ✅ `User::ensureTable()` on all write methods
- [x] ✅ CSV export: missing columns (`image_url`, `description`, `audio_url`, `prompt`, `transcript`)
- [x] ✅ CSV export: header row written
- [x] ✅ Cache busting: `assetVersion()` via `filemtime()`
- [x] ✅ Card flip toggle: click again flips back to front
- [x] 🟡 `due_only` filter — parsed as boolean, **now also applied to card results** (was just fixed)
- [x] ✅ Clickable "due for review" button
- [x] ✅ `formatBreaks`: `\br` → `<br>` (PHP + JS)

## Already Present at Fork Point (from backup-before-makeover)

These were in the base code and need no reimplementation:

- [x] ✅ Per-card delete in admin panel
- [x] ✅ Style/pattern-type filter checkboxes in admin
- [x] ✅ Interval preview on rating buttons (1d/3d/7d)
- [x] ✅ Compact mobile stats with responsive grid
- [x] ✅ Whiteboard-card CSS class
- [x] ✅ Card Set CRUD in admin panel
- [x] ✅ `Card::save()` with set_id column
- [x] ✅ Student set access control
- [x] ✅ 30-day auto-reset cycle
- [x] ✅ Snooze filtering
- [x] ✅ Progress bar
- [x] ✅ Keyboard shortcuts in admin (S/N/D/R)
- [x] ✅ Basic CSV import + export

---

## Phase 2 — Full Makeover (from defective-main)

- [ ] ⬜ SM-2 spaced repetition algorithm (ease factor, interval multiplication)
- [ ] ⬜ Keyboard shortcuts on study screen (S/N/D/R/?)
- [ ] ⬜ Auto-flip / timer-based card flip
- [ ] ⬜ Sound FX (correct/incorrect tones, celebration)
- [ ] ⬜ Confetti effect on correct answer streaks
- [ ] ⬜ `image_mcq` card type (image + multiple choice)
- [ ] ⬜ File upload for images/audio (`uploads/` + API)
- [ ] ⬜ Formatting tags: `\b` `\i` `\u` `\em` `\strong`
- [ ] ⬜ Admin jump-to-edit from study screen
- [ ] ⬜ Export cards filtered by set (one/multiple/all)
- [ ] ⬜ Card set description + timestamp
- [ ] ⬜ Duplicate detection on CSV import (title+type+set)
- [ ] ⬜ Auto-calculate english_level from review progress
- [ ] ⬜ `stripFormatTags` helper function
- [ ] ⬜ Compact due button on mobile

## Phase 3 — Rich CSV Import (from defective-main)

- [ ] ⬜ Import modal with live preview
- [ ] ⬜ Column/set mapping UI
- [ ] ⬜ Inline editing before import
- [ ] ⬜ Per-row checkboxes with select-all
- [ ] ⬜ Stacked front/back layout in preview
- [ ] ⬜ Remove 100-row preview limit
- [ ] ⬜ Preserve card `id` on re-import (updates existing cards)

## Phase 4 — InfinityFree Compatibility (from defective-main)

- [ ] ⬜ Inline JS into PHP to bypass security blocks (if needed)
- [ ] ⬜ Route API through `index.php` (if needed)
- [ ] ⬜ Database name: `if0_41632431_flashcards`

## Phase 5 — Bug Fixes from defective-main

- [ ] ⬜ Race condition in edit-user modal
- [ ] ⬜ `admin_cards.php` crash prevention (null pointer guards)
- [ ] ⬜ CSV data loss on import/export round-trip
- [ ] ⬜ `pattern_type` ENUM truncation (convert to VARCHAR)
- [x] ✅ `english_level` overwritten on review — decoupled `updateProgress` from level
- [ ] ⬜ MCQ `correct_index` bug (`||` vs `??`)
- [ ] ⬜ Import preview interval mismatch
- [ ] ⬜ Due button sizing on mobile

