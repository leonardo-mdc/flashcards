# Flashcards — Spaced Repetition Study System

A flashcard study application with 8 card types, spaced repetition, multi-user support, admin panel, and CSV import/export.

---

## Quick Start

### Requirements
- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- A web server (Apache, Nginx, or `php -S`)

### Setup

1. **Clone & configure**
   ```bash
   cp config.example.php config.php
   ```
   Edit `config.php` with your database credentials.

2. **Initialize database**
   Visit `api/setup.php` in your browser to create tables and sample data.

3. **Create an admin account**
   Visit `admin_cards.php` — if no admins exist, you'll see a setup form.

4. **Start studying**
   Visit `index.php` — register as a student and begin.

---

## Student Interface (`index.php`)

### Authentication
- **Register**: Username + password (min 6 chars) + full name + English level
- **Login**: Username + password
- **Profile**: Click "Edit" on the welcome screen to change name or password

### Welcome Dashboard
- Study stats (total reviews, correct, incorrect, cards seen)
- Progress bar (percentage of all cards reviewed)
- Streak badge (consecutive days with reviews)
- Level filter — toggle Beginner / Intermediate / Advanced
- Set selector — choose one set or "Random Mode" (cards from all accessible sets)
- "X cards due" — switches to due-only mode (only cards ready for review)
- Button to switch student (logout)

### Study Screen
- **Flip**: Click card or press **Space**
- **Self-rate**: Press **1** (Again), **2** (Good), **3** (Easy)
  - Again → next review in 1 day
  - Good → next review in 3 days
  - Easy → next review in 7 days
- **Exit**: Press **Escape**
- Progress bar shows position in current deck
- Keyboard shortcuts shown on study buttons

### Spaced Repetition
- Quality-based intervals (1 / 3 / 7 days)
- Progress resets automatically after 30 days from first review
- Streak tracking: consecutive days with ≥1 review

---

## 8 Card Types

| Type | Description | Interaction |
|------|-------------|-------------|
| `usage_cases` | Definition + usage examples + tip | Read-only |
| `deep_dive` | Detailed explanation + examples + tip | Read-only |
| `formula_table` | Formula/rule + examples + tip | Read-only |
| `multiple_choice` | Question + clickable options | Tap an option before flipping |
| `gap_fill` | Sentence with a blank + text input | Type answer before flipping |
| `image_mcq` | Image + question + clickable options | Tap an option before flipping |
| `image_description` | Image with description on back | Read-only |
| `audio_listening` | Audio player + optional text input | Type answer before flipping |

---

## Admin Panel (`admin_cards.php`)

### Access
- First visit: create the initial admin account
- Subsequent visits: log in with admin credentials

### Card Management
- **CRUD**: Create, edit, delete cards with type-specific form fields
- **Live preview**: Front and back previews update in real time
- **Search**: Filter cards by title in sidebar
- **Level filter**: Checkboxes for Beginner / Intermediate / Advanced
- **Keyboard shortcuts**: S=Save, N=New, D=Delete, R=Revert
- **Focus card**: `?focus_card=X&return_url=Y` loads a specific card for editing

### User Management
- View all users (name, username, role, progress, level)
- Create users (username, full name, password, level, admin toggle)
- Edit users (change name, password, level, admin status)
- Configure per-user set access via checkboxes
- Delete users (cannot delete self)
- Reset user progress

### Card Set Management
- Create, rename, delete sets
- Configure student exclusivity (restrict a set to specific students)

### CSV Import Wizard
1. Upload CSV (drag-drop or file picker)
2. Preview table — edit fields, map sets, view live card previews
3. Execute import (auto-creates new sets, validates types/levels)

### CSV Export
- Download all cards as CSV with 27 columns covering all card types

---

## Card Inspector (`cardinspector.php`)

A standalone offline-style CSV editor:
- Upload a CSV file
- Browse and edit cards with live front/back preview
- Save back to CSV or import directly to the database

---

## CSV Format (Import / Export)

**Delimiter: semicolon (`;`).** Commas inside field values (e.g. `correct_answer: go,goes,went` or thousands: `2500,2,500`) don't conflict with the separator.

| Column | Used By |
|--------|---------|
| `set` | All |
| `set_id` | All |
| `type` | All |
| `title` | All |
| `level` | All |
| `definition` | Text types |
| `question_text` | MCQ types |
| `sentence` | gap_fill |
| `opt1` .. `opt4` | MCQ types |
| `correct_answer` | Quiz types |
| `explanation` | MCQ types |
| `example1` .. `example4` | Text types |
| `usage1` | usage_cases |
| `tip` | Text types |
| `image_url` | image_mcq, image_description, text types |
| `audio_url` | audio_listening, text types |
| `description` | image_description |
| `prompt` | audio_listening |
| `transcript` | audio_listening |
| `front_fields` | Text types |

Level values are normalized: A1/A2 → Beginner, B1/B2 → Intermediate, C1/C2 → Advanced.

See [`import/CSV_STRUCTURE_FOR_AI.md`](import/CSV_STRUCTURE_FOR_AI.md) for the full 27-column master table, type-specific field guides, and examples.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `api/setup.php` | GET | One-time database initialization |
| `api/login.php` | POST | Student login / register / update profile |
| `api/get_cards.php` | POST | Fetch cards for study (with filters) |
| `api/get_sets.php` | GET | List accessible card sets |
| `api/get_stats.php` | POST | Student study statistics |
| `api/record_review.php` | POST | Record a card review |
| `api/import_csv.php` | POST | Import cards from CSV (admin) |
| `api/export_csv.php` | GET | Export all cards as CSV (admin) |
| `api/migrate_types.php` | GET | Fix truncated card types (admin) |
| `api/create_student.php` | POST | Legacy student creation |

---

## Project Structure

```
├── index.php              # Student SPA entry point
├── admin_cards.php        # Admin panel
├── cardinspector.php      # CSV card editor
├── healthcheck.php        # Diagnostic page
├── config.php             # Database config (gitignored)
├── config.example.php     # Config template
├── api/                   # Backend API endpoints
├── src/                   # PHP classes
│   ├── Database.php       # PDO singleton
│   ├── Card.php           # Card CRUD + queries
│   ├── CardSet.php        # Set CRUD
│   ├── User.php           # User CRUD + auth
│   ├── Review.php         # Spaced rep, stats, access control
│   ├── Student.php        # Legacy student helper
│   ├── helpers.php        # escapeHtml, formatBreaks, assetVersion
│   └── templates/         # Admin setup/login HTML templates
├── assets/
│   ├── js/app.js          # Student SPA
│   ├── js/admin.js        # Admin panel SPA
│   ├── css/app.css        # Student styles
│   └── css/admin.css      # Admin styles
├── import/                # Legacy import scripts + CSV docs
└── uploads/               # User-uploaded media
```

---

## Tech Stack

- **Backend**: PHP 8+, MySQL
- **Frontend**: Vanilla JS (no framework), Tailwind CSS (CDN)
- **Auth**: Session-based with bcrypt password hashing
- **Fonts**: Bubble Sans (headings), Stampatello Faceto (body)
