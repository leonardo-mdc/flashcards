# CSV Structure for Flashcard Import

## Common Columns (all card types)

| Column       | Description |
|--------------|-------------|
| `id`         | Leave empty for new cards, or set an existing ID to update |
| `set`        | Card set name — if the set doesn't exist, it is **created automatically** during import |
| `set_id`     | Optional numeric set ID. If both `set` and `set_id` are given, `set` takes priority |
| `type`       | Card pattern: `usage_cases`, `deep_dive`, `formula_table`, `multiple_choice`, `gap_fill`, `image_mcq`, `image_description`, `audio_listening` |
| `title`      | The word, phrase, or main subject of the card |
| `level`      | `A1` `A2` `B1` `B2` `C1` `C2` (mapped to Beginner/Intermediate/Advanced on import) or use Beginner/Intermediate/Advanced directly |
| `front_fields` | Comma-separated list of fields to display on the front (e.g. `title,image_url`). Only applies to text types. Defaults to `title` if empty. |

## Level Mapping

| CSV value    | Stored as      |
|--------------|----------------|
| `A1` or `A2` | `Beginner`     |
| `B1` or `B2` | `Intermediate` |
| `C1` or `C2` | `Advanced`     |

---

## ⚠️ CRITICAL — The ONLY Valid Column Order (Master Table)

**You MUST produce every CSV using this exact 27-column order.** Never reorder columns. For unused columns, leave the cell empty but KEEP the column in the header. The header row must be this exact string:

```
id,set,set_id,type,title,level,question_text,definition,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,example1,example2,example3,example4,usage1,tip,image_url,description,audio_url,prompt,transcript,front_fields
```

| # | Column           | Filled for these types |
|---|------------------|------------------------|
| 1 | `id`             | all (leave empty for new cards) |
| 2 | `set`            | all |
| 3 | `set_id`         | all (optional, `set` takes priority) |
| 4 | `type`           | all |
| 5 | `title`          | all |
| 6 | `level`          | all |
| 7 | `question_text`  | multiple_choice, image_mcq |
| 8 | `definition`     | usage_cases, deep_dive, formula_table |
| 9 | `sentence`       | gap_fill |
| 10 | `opt1`           | multiple_choice, image_mcq (at least 1 required) |
| 11 | `opt2`           | multiple_choice, image_mcq (at least 1 required with opt1) |
| 12 | `opt3`           | multiple_choice, image_mcq (optional) |
| 13 | `opt4`           | multiple_choice, image_mcq (optional) |
| 14 | `correct_answer` | multiple_choice (0-based index), image_mcq (0-based index), gap_fill (comma-separated), audio_listening (comma-separated) |
| 15 | `explanation`    | multiple_choice, image_mcq |
| 16 | `example1`       | usage_cases, deep_dive, formula_table, gap_fill |
| 17 | `example2`       | usage_cases, deep_dive, formula_table |
| 18 | `example3`       | usage_cases, deep_dive, formula_table |
| 19 | `example4`       | usage_cases, deep_dive, formula_table |
| 20 | `usage1`         | usage_cases |
| 21 | `tip`            | usage_cases, deep_dive, formula_table |
| 22 | `image_url`      | usage_cases, deep_dive, formula_table, multiple_choice, gap_fill, image_mcq, image_description |
| 23 | `description`    | image_description |
| 24 | `audio_url`      | usage_cases, deep_dive, formula_table, multiple_choice, gap_fill, audio_listening |
| 25 | `prompt`         | audio_listening |
| 26 | `transcript`     | audio_listening |
| 27 | `front_fields`   | usage_cases, deep_dive, formula_table |

---

## Type-Specific Field Guide

For each type, fill these columns (by number from the Master Table above). Leave all other columns empty.

### usage_cases (text)
- **Columns to fill**: 1, 2, 4, 5, 6, 8, 16–21, 22, 24, 27
- `definition` (col 8) — what the word/phrase means (defaults to "No definition")
- `example1`–`example4` (cols 16–19) — example sentences
- `usage1` (col 20) — context of when to use it (auto-fills from example1)
- `tip` (col 21) — memory aid or note
- `image_url` (col 22), `audio_url` (col 24) — optional media
- `front_fields` (col 27) — which fields appear on the front

### deep_dive (text)
- **Columns to fill**: 1, 2, 4, 5, 6, 8, 16–19, 21, 22, 24, 27
- Same as usage_cases but no `usage1` column

### formula_table (text)
- **Columns to fill**: same as deep_dive
- Use `definition` for the formula/rule/table content

### multiple_choice (quiz)
- **Columns to fill**: 1, 2, 4, 5, 6, 7, 10–14, 15, 22, 24
- `question_text` (col 7) — the question (defaults to "Select the correct answer:")
- `opt1`–`opt4` (cols 10–13) — answer choices (at least 1 required, max 4)
- `correct_answer` (col 14) — **0-based index** of the correct option (0, 1, 2, or 3). Defaults to 0.
- `explanation` (col 15) — text shown after answering

### gap_fill (quiz)
- **Columns to fill**: 1, 2, 4, 5, 6, 9, 14, 16, 22, 24
- `sentence` (col 9) — the sentence with `______` for the blank (defaults to "Complete: ______")
- `correct_answer` (col 14) — one answer, or comma-separated alternatives: `go,goes,went` (defaults to `answer`)
- `example1` (col 16) — example showing correct usage

### image_mcq (quiz)
- **Columns to fill**: 1, 2, 4, 5, 6, 7, 10–14, 15, 22
- Same as multiple_choice, plus `image_url` (col 22) is strongly recommended

### image_description (image card)
- **Columns to fill**: 1, 2, 4, 5, 6, 22, 23
- `image_url` (col 22) — image to show on front
- `description` (col 23) — text shown on back (falls back to `definition`, then "No description")

### audio_listening (audio card)
- **Columns to fill**: 1, 2, 4, 5, 6, 14, 24, 25, 26
- `audio_url` (col 24) — audio file to play on front
- `prompt` (col 25) — optional question/prompt shown below the player
- `correct_answer` (col 14) — optional comma-separated answers for interactive mode
- `transcript` (col 26) — text shown on the back

---

## Example CSV Rows

All examples below keep columns in the EXACT order of the Master Table. Unused columns are omitted from the header but the RELATIVE order is always preserved.

### Basic text cards (usage_cases, deep_dive, formula_table)

```
id,set,type,title,level,definition,example1,usage1,tip,image_url,audio_url
,Wh-Questions,usage_cases,WHAT - Asking for Information,Beginner,"How to use WHAT in questions?","What is your name?","Names & Identity","In Portuguese 'Qual é seu nome?' but English uses 'What is your name?'",uploads/images/wh-questions/what-intro.jpg,uploads/audio/wh-questions/what-example.mp3
,Wh-Questions,deep_dive,WH- Prepositions at the End,Intermediate,"Why prepositions go at the end of WH questions","Who do you live with?","In Portuguese, prepositions start ('Com quem...') but English puts them at the end.",
,Wh-Questions,formula_table,WHEN - Asking About Time,Beginner,"When + be + subject? OR When + do/does + subject + verb?","When is your birthday?",,,"When asking about days and dates",
```

Header columns map to master columns: 1,2,4,5,6,8,16,20,21,22,24 — correct relative order ✓

### Quiz cards (multiple_choice, gap_fill)

```
id,set,type,title,level,question_text,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,image_url
,Tenses,multiple_choice,Present Perfect,B1,"Which sentence uses Present Perfect correctly?","","She has visited London","She visited London","She visits London","She is visiting London",2,"Present Perfect uses 'have/has + past participle'",uploads/images/tenses/present-perfect-example.jpg
,Phrasal Verbs,gap_fill,break up,B1,,"They decided to ______ after five years",,,,,,break up,,,
```

Header columns map to master columns: 1,2,4,5,6,7,9,10,11,12,13,14,15,22 — correct relative order ✓

### Full mixed example (all types, full 27-column header)

```
id,set,set_id,type,title,level,question_text,definition,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,example1,example2,example3,example4,usage1,tip,image_url,description,audio_url,prompt,transcript,front_fields
,Phrasal Verbs,,usage_cases,break down,A1,,"To stop functioning (machine) or lose control emotionally",,,,,,,,,,"The car broke down on the highway",,,,,"When talking about machines or emotions","Use 'break down' for both machines and people",,,,,,
,Phrasal Verbs,,gap_fill,break up,B1,,,"They decided to ______ after five years",,,,,,"break up",,,,,,,,,,,uploads/audio/phrasal-verbs/break-up.mp3,,,
,Wh-Questions,,image_mcq,WHERE - Location,B1,"Which question word fits this image?",,,,,,"WHAT","WHEN","WHERE","WHO",2,"The image shows a map - we use WHERE for places",,,,,,,,,,uploads/images/wh-questions/where-map.jpg,,,,
,Wh-Questions,,image_description,WHAT vs WHICH,A2,,,,,,,,,,,,,,,,,,,,uploads/images/wh-questions/what-vs-which.jpg,"WHAT = open, unlimited. WHICH = limited choices.",,,,
,Wh-Questions,,audio_listening,WH- Questions Quiz,A2,,,,,,,,,,,"what,when,where,who,which,why,how",,,,,,,,,,uploads/audio/wh-questions/wh-quiz.mp3,,"Listen to each question and identify the WH-word",
```

### Image Description card

```
id,set,type,title,level,image_url,description
,Wh-Questions,image_description,WHAT - Asking for Information,A1,uploads/images/wh-questions/what-intro.jpg,"In English, we use WHAT to ask for general information."
,Tenses,image_description,Present Simple Routine,B1,uploads/images/tenses/simple-present-routine.png,"The image shows a daily routine. Present Simple is used for habits, routines, and general truths. 'I wake up at 7 AM every day.'"
```

### Audio Listening card

```
id,set,type,title,level,correct_answer,audio_url,prompt,transcript
,Wh-Questions,audio_listening,WHAT - Listening Practice,A2,What is your name?,uploads/audio/wh-questions/what-is-your-name.mp3,"Listen and type what you hear:","What is your name?"
,Modals,audio_listening,CAN - Pronunciation,B1,I can swim,uploads/audio/modal-verbs/can-swim.mp3,"Listen and complete:",I can swim
,Modals,audio_listening,Can or Can't - Listening,B1,"can,can't",uploads/audio/modal-verbs/can-cant-listening.mp3,,"I can speak English but I can't speak Japanese."
```

---

## Where to Place Media Files (Images & Audio)

### Folder Structure

All media files live inside the `uploads/` directory at the root of the website:

```
project-root/
├── uploads/
│   ├── images/          ← all image files go here
│   │   ├── wh-questions/
│   │   ├── modal-verbs/
│   │   └── tenses/
│   └── audio/           ← all audio files go here
│       ├── wh-questions/
│       ├── modal-verbs/
│       └── tenses/
├── import/
│   ├── CSV_STRUCTURE_FOR_AI.md
│   ├── cards.csv
│   └── card_sets.csv
├── api/
├── assets/
└── ...
```

### How to Reference Files in the CSV

Use the **relative path** from the website root, starting with `uploads/`:

| Media type | CSV column    | Example value |
|------------|---------------|---------------|
| Image      | `image_url`   | `uploads/images/wh-questions/what-is-this.jpg` |
| Audio      | `audio_url`   | `uploads/audio/modal-verbs/can-ability.mp3` |

You can also use **full URLs** (from external sites or CDNs).

### Naming Convention

Every file name MUST follow this pattern:

```
<topic>[-<subtopic>]-<descriptive-name>.<extension>
```

**Rules:**
- Use **only lowercase letters, numbers, and hyphens** (`-`)
- No spaces, no underscores, no special characters
- The `<topic>` and `<subtopic>` match the card's set name
- The `<descriptive-name>` briefly describes the content in English

**Examples:**

```
✅ uploads/images/wh-questions/what-is-your-name.jpg
✅ uploads/audio/modal-verbs/could-polite-request.mp3
✅ uploads/images/tenses/simple-present-routine.png
❌ uploads/images/IMG_2024_001.jpg                 (non-descriptive name)
❌ uploads/images/my image.jpg                      (spaces not allowed)
```

### Accepted File Formats

| Media type | Allowed formats |
|------------|----------------|
| **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |
| **Audio**  | `.mp3`, `.wav`, `.ogg`, `.m4a` |

---

## Important Notes

- **Always use the full 27-column header** as shown in the Master Table. Leave unused cells empty.
- The import automatically **creates any set name** that doesn't exist yet
- Text fields support `\br` (backslash + br) for line breaks within a single cell
- Max **4 options** per MCQ/image_mcq (`opt1`–`opt4`), max **4 examples** per text card (`example1`–`example4`)
- The `correct_answer` for **gap_fill** and **audio_listening** accepts **comma-separated alternatives**: `go,goes,went`
- For **multiple_choice** and **image_mcq**, the `correct_answer` is a **zero-based index** (0, 1, 2, or 3). Defaults to 0 if empty.
- For **audio_listening**, leave `correct_answer` AND `prompt` empty to make a **descriptive-only** card (just listen + read transcript)
- Media files can be referenced as **relative paths** (`uploads/images/...`) or **full URLs** (`https://...`)
- Import endpoint: `api/import_csv.php` (admin-only, via the admin panel)
