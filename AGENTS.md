# Admin Revamp Plan

## Overview
Complete rewrite of `admin_cards.php` (HTML+PHP) and `assets/js/admin.js` (JS) into a tabbed interface with 4 tabs and inline workflows (no more modals as primary UI).

## Tab Structure

```
[📝 Card Editor] [📥 Import] [📤 Export] [👥 Users & Sets]
```

### Tab 1: 📝 Card Editor

**Sticky header:**
```
[Set ▼] [Type ▼] [🔍 Search...] [🔰] [📚] [🎓] [✨ New] [💾 Save] [🗑 Bulk Delete]
```

**3-column layout:**
| Left (cards list) | Center (fields) | Right (preview) |
|---|---|---|
| Cards with checkboxes, select-all | Title, Set, Level, Type always visible | Front preview (top) |
| Filtered by set/type/search/level | Dynamic fields below per type config | Back preview (bottom) |
| Bulk delete button (appears when ≥1 selected) | | Live updates |

**Bulk delete:** Checkbox per card row, select-all in header, delete button shows count. Respects current filters. New AJAX handler: `delete_cards_bulk`.

### Tab 2: 📥 Import

**Step 1:** File drop zone (same as current)
**Step 2:** Preview with 3 columns:
- Left: rows table with checkboxes
- Center: field editor (same field config as card editor)
- Right: card preview (front/back)

**Gap fill import bug fix:** Auto-save current editor row to `importRows` before generating CSV for the POST request.

### Tab 3: 📤 Export

- Set/Type filters
- Card list with checkboxes, select-all, count
- Export button → downloads CSV

### Tab 4: 👥 Users & Sets

Two sub-tabs:

**Users sub-tab:**
| Left: user table | Right: edit panel (shown on user click) |
|---|---|
| Username, Name, Role, Level, Progress%, Actions | Edit form: username, name, level, password, is_admin, card set access checkboxes |

**Card Sets sub-tab:**
- Inline list with search + new set creation
- Each row: name (contenteditable), card count, exclusive access chips + editor
- Keep both `exclusive_to` (whitelist by username) and `student_set_access` (user → set checkboxes)

## Unified Field Config

One JS config object `CARD_FIELD_CONFIG` driving field rendering for both editor and import:

```js
const CARD_FIELD_CONFIG = {
  gap_fill: {
    fields: [
      { key: 'sentence', label: 'Sentence with ______', type: 'textarea', rows: 3 },
      { key: 'correct_answers', label: 'Correct Answer(s)', type: 'csv', help: 'Comma separated' },
      { key: 'example', label: 'Example Sentence', type: 'textarea', rows: 2 },
      { key: 'image_url', label: 'Image URL (optional)', type: 'text' },
      { key: 'audio_url', label: 'Audio URL (optional)', type: 'text' },
    ],
    toContentData(dom) { /* DOM → content_data object */ },
    fromContentData(cd) { /* content_data → DOM values */ },
  },
  // ... all 8 types
};
```

## Bug Fix: Gap Fill Import

**Root cause:** Import preview reads from DOM (real-time), but Import button reads from `importRows` array (only updated on "Apply" click). Auto-save editor row to `importRows` right before import.

## Files to Modify

| File | Action |
|---|---|
| `admin_cards.php` | Rewrite — tab shell, keep AJAX handlers, remove inline sections/modals |
| `assets/js/admin.js` | Complete rewrite — tab system, 3-column editor, unified field config, import, export, users, sets |
| `assets/css/admin.css` | Add tab bar, 3-col grid, sub-tabs, right panel; keep chalkboard aesthetic |

## Aesthetic

Keep the "chalkboard/whiteboard" look throughout: `Stampatello Faceto` font, `Bubble Sans` for headings/buttons, whiteboard-card style, marker underlines, dotted background.
