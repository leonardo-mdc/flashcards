# Reimplementation Checklist

## Legend
- ✅ done & verified
- ⬜ not started
- 🟡 partially done

---

## Phase 1 — Security & Data Integrity (our work)

- [x] ✅ XSS: escapeHtml escapes `"` and `'` in app.js + admin.js
- [x] ✅ Session fixation: `session_regenerate_id(true)` on login/register
- [x] ✅ Null-pointer guard: `record_review.php` exits if user not found
- [x] ✅ `User::ensureTable()` called on all write methods
- [x] ✅ CSV export: missing columns added (`image_url`, `description`, `audio_url`, `prompt`, `transcript`)
- [x] ✅ CSV export: header row written
- [x] ✅ Cache busting: `assetVersion()` helper using `filemtime()`
- [x] ✅ Card flip toggle: click again flips back to front
- [x] 🟡 `due_only` boolean: parsed correctly, **but filter logic was missing** — just fixed
- [x] ✅ Clickable "due for review" button with `dueOnlyMode` flag
- [x] ✅ formatBreaks: `\br` → `<br>` in PHP + JS
- [x] ✅ Whiteboard-card CSS class present
- [x] ✅ Compact mobile stats with responsive grid
- [x] ✅ Interval preview on rating buttons (1d/3d/7d)
- [x] ✅ Per-card delete in admin panel
- [x] ✅ Style/pattern-type filter checkboxes in admin
- [x] ✅ healthcheck.php deployed for debugging
- [x] ✅ config.php preserved across FTP deploys (backup/restore in workflow)

## Phase 2 — Full Makeover (from defective-main)

- [ ] ⬜ SM-2 spaced repetition algorithm (ease factor, interval multiplication)
- [ ] ⬜ Keyboard shortcuts on study screen (S/N/D/R/?)
- [ ] ⬜ Auto-flip / timer-based card flip
- [ ] ⬜ Sound FX (correct/incorrect tones, celebration)
- [ ] ⬜ Confetti effect on correct answer streaks
- [ ] ⬜ image_mcq card type (image + multiple choice)
- [ ] ⬜ File upload for images/audio (`uploads/` + API)
- [ ] ⬜ Formatting tags: `\b` `\i` `\u` `\em` `\strong` in card content
- [ ] ⬜ Admin jump-to-edit from study screen
- [ ] ⬜ Export cards filtered by set
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

- [ ] ⬜ Inline JS into PHP to bypass security blocks
- [ ] ⬜ Route API through `index.php`
- [ ] ⬜ Database name: `if0_41632431_flashcards`

## Phase 5 — Additional Admin Tools (from defective-main)

- [ ] ⬜ Card set CRUD in admin panel
- [ ] ⬜ Fix Pattern Types button in fix_db.php
- [ ] ⬜ Schema migration tool (fix_db.php)
- [ ] ⬜ Admin user creation in fix_db

## Phase 6 — Bug Fixes from defective-main

- [ ] ⬜ Race condition in edit-user modal
- [ ] ⬜ `admin_cards.php` crash prevention (null pointer guards)
- [ ] ⬜ CORS headers on login
- [ ] ⬜ CSV data loss on import/export round-trip
- [ ] ⬜ `pattern_type` ENUM truncation (converted to VARCHAR)
- [ ] ⬜ `user_card_progress` table missing → card load failure
- [ ] ⬜ `english_level` overwritten on review
- [ ] ⬜ MCQ `correct_index` bug (`||` vs `??`)
- [ ] ⬜ Import preview interval mismatch
- [ ] ⬜ Due button sizing on mobile
