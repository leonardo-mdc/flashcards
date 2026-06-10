# CSV Structure for Flashcard Import

## Common Columns (all card types)

| Column     | Description |
|------------|-------------|
| `id`       | Leave empty for new cards, or set an existing ID to update |
| `set`      | Card set name — if the set doesn't exist, it is **created automatically** during import |
| `set_id`   | Optional numeric set ID. If both `set` and `set_id` are given, `set` takes priority |
| `type`     | Card pattern: see table below |
| `title`    | The word, phrase, or main subject of the card |
| `level`    | `A1` `A2` `B1` `B2` `C1` `C2` (will be mapped to Beginner/Intermediate/Advanced on import) |
| `front_fields` | Comma-separated list of fields to display on the front (e.g. `title,image_url`). Only applies to text types. Defaults to `title` if empty. |

## Level Mapping

| CSV value    | Stored as      |
|--------------|----------------|
| `A1` or `A2` | `Beginner`     |
| `B1` or `B2` | `Intermediate` |
| `C1` or `C2` | `Advanced`     |

You can also use `Beginner`, `Intermediate`, `Advanced` directly.

## Available Card Types

| Card Type           | Description |
|---------------------|-------------|
| `usage_cases`       | Pure text — usage cases with examples |
| `deep_dive`         | Pure text — deep dive into a topic |
| `formula_table`     | Pure text — formula/rule/table display |
| `multiple_choice`   | Quiz — pick the correct option |
| `gap_fill`          | Quiz — type the missing word(s) |
| `image_mcq`         | Quiz — image/audio on front + MCQ options (responsive layout) |
| `image_description` | Image card — shows image, back shows description |
| `audio_listening`   | Audio card — plays audio, may include Q&A or transcription |

---

## Type-Specific Fields

### usage_cases (Pure Text — Usage Cases)

Front shows the title. Back shows definition, usage context, examples, and tip.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | The definition or explanation of the word |
| `usage1`     | yes      | Usage context (when/where to use this word) |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | if >=B2  | Extra tip or memory aid |
| `image_url`  | no       | Optional image shown on front above the title |
| `audio_url`  | no       | Optional audio player shown on front above the title |

### deep_dive (Pure Text — Deep Dive)

Front shows the title. Back shows definition, examples, and tip.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | Deep definition or explanation |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | yes      | Extra note or insight |
| `image_url`  | no       | Optional image shown on front above the title |
| `audio_url`  | no       | Optional audio player shown on front above the title |

### formula_table (Pure Text — Formula Table)

Front shows the title. Back shows formula, examples, and tip.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | The formula, structure, or rule |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | yes      | Extra note or memory aid |
| `image_url`  | no       | Optional image shown on front above the title |
| `audio_url`  | no       | Optional audio player shown on front above the title |

### multiple_choice (Quiz)

Front shows a question with clickable answer options. Can optionally include an image or audio above the question.

| Column           | Required | Description |
|------------------|----------|-------------|
| `question_text`  | yes      | The question to display (e.g. "Which tense is correct?") |
| `opt1`           | yes      | Answer option 1 (max 4 options: `opt1` to `opt4`) |
| `opt2`           | yes      | Answer option 2 |
| `opt3`           | no       | Answer option 3 |
| `opt4`           | no       | Answer option 4 |
| `correct_answer` | yes      | Zero-based index of the correct option (0, 1, 2, or 3) |
| `explanation`    | no       | Text shown after answering explaining why it's correct |
| `image_url`      | no       | Optional image displayed above the question on front |
| `audio_url`      | no       | Optional audio player displayed above the question on front |

### gap_fill (Quiz)

Front shows a sentence with a blank. User types the missing word(s). Can optionally include image/audio.

| Column           | Required | Description |
|------------------|----------|-------------|
| `sentence`       | yes      | The sentence with `______` indicating the blank |
| `correct_answer` | yes      | One correct answer, or multiple comma-separated (e.g. `go,goes,went`) |
| `example1`       | no       | Example sentence showing correct usage |
| `image_url`      | no       | Optional image displayed at the TOP of the card (always above the sentence) |
| `audio_url`      | no       | Optional audio player displayed at the TOP of the card (always above the sentence) |

### image_mcq (Quiz — Image + Multiple Choice)

**Layout:** On desktop, image is on the left, options on the right (side by side).  
**Layout:** On mobile, image is on top, options below (vertical stack).

| Column           | Required | Description |
|------------------|----------|-------------|
| `image_url`      | yes*     | Image URL (strongly recommended — card works without it but shows a placeholder icon) |
| `question_text`  | yes      | The question to display (e.g. "What does this picture show?") |
| `opt1`           | yes      | Answer option 1 (max 4 options: `opt1` to `opt4`) |
| `opt2`           | yes      | Answer option 2 |
| `opt3`           | no       | Answer option 3 |
| `opt4`           | no       | Answer option 4 |
| `correct_answer` | yes      | Zero-based index of the correct option (0, 1, 2, or 3) |
| `explanation`    | no       | Text shown after answering explaining why it's correct |

### image_description (Image Card)

Front shows the image (or a placeholder). Back shows the description.

| Column       | Required | Description |
|--------------|----------|-------------|
| `image_url`  | yes*     | Image URL (strongly recommended — shows a 🖼️ placeholder if missing) |
| `description`| yes      | Description text shown on the back of the card |

### audio_listening (Audio Card)

**Two modes:**
1. **Descriptive mode** (no `correct_answer`, no `prompt`): Just plays audio, back shows the transcript/notes.
2. **Interactive/Q&A mode** (with `correct_answer` and/or `prompt`): Shows a text input field. User types an answer and flips to check.

| Column           | Required | Description |
|------------------|----------|-------------|
| `audio_url`      | yes*     | Audio file URL (strongly recommended — shows a 🎧 placeholder if missing) |
| `prompt`         | no       | Optional prompt/question text shown below the audio player |
| `correct_answer` | no       | Comma-separated accepted answers (e.g. `go,goes,went`). Leave empty for descriptive-only mode |
| `transcript`     | no       | Full transcript or notes shown on the back of the card |

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

You can also use **full URLs** (from external sites or CDNs):

| Media type | Example value |
|------------|---------------|
| Image      | `https://example.com/images/sunset.jpg` |
| Audio      | `https://example.com/audio/lesson1.mp3` |

### Naming Convention (REQUIRED — follow this exactly)

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
✅ uploads/images/wh-questions/where-is-the-bathroom.png
✅ uploads/images/modal-verbs/can-ability-example.webp
✅ uploads/audio/modal-verbs/could-polite-request.mp3
✅ uploads/audio/tenses/present-continuous-now.mp3
✅ uploads/images/tenses/simple-present-routine.png
✅ uploads/audio/wh-questions/how-old-are-you.mp3

❌ uploads/images/what is your name.jpg           (spaces not allowed)
❌ uploads/images/What_Is_Your_Name.JPG            (uppercase not allowed)
❌ uploads/audio/can.mp3                           (too generic, missing topic folder)
❌ uploads/images/IMG_2024_001.jpg                 (non-descriptive name)
```

### Accepted File Formats

| Media type | Allowed formats |
|------------|----------------|
| **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |
| **Audio**  | `.mp3`, `.wav`, `.ogg`, `.m4a` (MPEG-4 audio) |

---

## Complete CSV Column Reference

| # | Column           | Used by types | Description |
|---|------------------|---------------|-------------|
| 1 | `id`             | ALL           | Leave empty for new cards, set to existing ID to update |
| 2 | `set`            | ALL           | Card set name (auto-created if missing) |
| 3 | `set_id`         | ALL           | Numeric set ID (secondary to `set`) |
| 4 | `type`           | ALL           | One of: `usage_cases`, `deep_dive`, `formula_table`, `multiple_choice`, `gap_fill`, `image_mcq`, `image_description`, `audio_listening` |
| 5 | `title`          | ALL           | Main subject of the card |
| 6 | `level`          | ALL           | `A1`, `A2`, `B1`, `B2`, `C1`, `C2` (or Beginner/Intermediate/Advanced) |
| 7 | `question_text`  | multiple_choice, image_mcq | The question shown to the student |
| 8 | `definition`     | usage_cases, deep_dive, formula_table | Main explanation/definition |
| 9 | `sentence`       | gap_fill       | Sentence with `______` blank |
| 10 | `opt1`           | multiple_choice, image_mcq | Option 1 |
| 11 | `opt2`           | multiple_choice, image_mcq | Option 2 |
| 12 | `opt3`           | multiple_choice, image_mcq | Option 3 (optional) |
| 13 | `opt4`           | multiple_choice, image_mcq | Option 4 (optional) |
| 14 | `correct_answer` | multiple_choice, image_mcq, gap_fill, audio_listening | Index for MCQ/image_mcq, comma-separated answers for gap_fill/audio_listening |
| 15 | `explanation`    | multiple_choice, image_mcq | Why the correct answer is right |
| 16 | `example1`       | usage_cases, deep_dive, formula_table, gap_fill | First example (max 4 per card: example1–example4) |
| 17 | `example2`       | usage_cases, deep_dive, formula_table | Second example |
| 18 | `example3`       | usage_cases, deep_dive, formula_table | Third example |
| 19 | `example4`       | usage_cases, deep_dive, formula_table | Fourth example |
| 20 | `usage1`         | usage_cases   | Usage context description |
| 21 | `tip`            | usage_cases, deep_dive, formula_table | Extra tip or memory aid |
| 22 | `image_url`      | ALL types     | Path like `uploads/images/<topic>/<name>.jpg` OR full URL |
| 23 | `description`    | image_description | Text shown on the back of image cards |
| 24 | `audio_url`      | ALL types     | Path like `uploads/audio/<topic>/<name>.mp3` OR full URL |
| 25 | `prompt`         | audio_listening | Question/prompt shown below the audio player |
| 26 | `transcript`     | audio_listening | Full transcript or notes shown on the back |
| 27 | `front_fields`   | text types (usage_cases, deep_dive, formula_table) | Comma-separated list of fields to display on the front of the card (e.g. `title,image_url`). Defaults to `title` if empty. |

---

## Example CSV Rows

### Basic text cards

```
id,set,type,title,level,definition,example1,usage1,tip,image_url,audio_url
,Wh-Questions,usage_cases,WHAT - Asking for Information,Beginner,"How to use WHAT in questions?","What is your name?","Names & Identity","In Portuguese 'Qual é seu nome?' but English uses 'What is your name?'",uploads/images/wh-questions/what-intro.jpg,uploads/audio/wh-questions/what-example.mp3
,Wh-Questions,deep_dive,WH- Prepositions at the End,Intermediate,"Why prepositions go at the end of WH questions","Who do you live with?","In Portuguese, prepositions start ('Com quem...') but English puts them at the end.",
,Wh-Questions,formula_table,WHEN - Asking About Time,Beginner,"When + be + subject? OR When + do/does + subject + verb?","When is your birthday?",,,"When asking about days and dates",
```

### Quiz cards

```
id,set,type,title,level,question_text,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,image_url
,Tenses,multiple_choice,Present Perfect,B1,"Which sentence uses Present Perfect correctly?","","She has visited London","She visited London","She visits London","She is visiting London",2,"Present Perfect uses 'have/has + past participle'",uploads/images/tenses/present-perfect-example.jpg
,Phrasal Verbs,gap_fill,break up,B1,,"They decided to ______ after five years","break up",,,,,,She broke up with him last week,uploads/images/phrasal-verbs/break-up.jpg
```

### Image MCQ card

```
id,set,type,title,level,question_text,opt1,opt2,opt3,opt4,correct_answer,explanation,image_url
,Modals,image_mcq,Can or Could?,B1,"What does this picture show?","Ability","Permission","Possibility","Request",0,"The image shows someone swimming - this is ability.",uploads/images/modal-verbs/can-swimming.jpg
,Wh-Questions,image_mcq,Which question word?,A2,"Look at the picture and choose the correct question word","WHAT","WHEN","WHERE","WHO",2,"The image shows a map/location - use WHERE.",uploads/images/wh-questions/where-map.jpg
```

### Image Description card

```
id,set,type,title,level,description,image_url
,Wh-Questions,image_description,WHAT - Asking for Information,A1,"In English, we use WHAT to ask for general information. Example: 'What is your name?' In Portuguese, you would say 'Qual é seu nome?' but in English, we never say 'Which is your name?'",uploads/images/wh-questions/what-intro.jpg
,Tenses,image_description,Present Simple Routine,B1,"The image shows a daily routine. Present Simple is used for habits, routines, and general truths. 'I wake up at 7 AM every day.'",uploads/images/tenses/simple-present-routine.png
```

### Audio Listening card

```
id,set,type,title,level,prompt,correct_answer,transcript,audio_url
,Wh-Questions,audio_listening,WHAT - Listening Practice,A2,"Listen and type what you hear:",What is your name?,"What is your name?","What is your name?",uploads/audio/wh-questions/what-is-your-name.mp3
,Modals,audio_listening,CAN - Pronunciation,B1,"Listen and complete:","I can swim","I can swim",,uploads/audio/modal-verbs/can-swim.mp3
,Modals,audio_listening,Can or Can't - Listening,B1,,"can,can't","I can speak English but I can't speak Japanese.",,uploads/audio/modal-verbs/can-cant-listening.mp3
```

### Full mixed example

```
id,set,type,title,level,question_text,definition,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,example1,usage1,tip,image_url,audio_url,description,prompt,transcript
,Phrasal Verbs,usage_cases,break down,A1,,"To stop functioning (machine) or lose control emotionally",,,,,,,,,"The car broke down on the highway","When talking about machines or emotions","Use 'break down' for both machines and people",uploads/images/phrasal-verbs/break-down-car.jpg,,,,
,Phrasal Verbs,gap_fill,break up,B1,,,"They decided to ______ after five years","break up",,,,,,,,,,,,uploads/audio/phrasal-verbs/break-up.mp3,,
,Wh-Questions,image_mcq,WHERE - Location,B1,"Which question word fits this image?","",,"WHAT","WHEN","WHERE","WHO",2,"The image shows a map - we use WHERE for places",,,,,,uploads/images/wh-questions/where-map.jpg,,,,
,Wh-Questions,image_description,WHAT vs WHICH,A2,,,,,,,,,,,,,,,uploads/images/wh-questions/what-vs-which.jpg,,"WHAT = open, unlimited. WHICH = limited choices.",,
,Wh-Questions,audio_listening,WH- Questions Quiz,A2,,,,,,,,,,,,,,,,uploads/audio/wh-questions/wh-quiz.mp3,"Listen to each question and identify the WH-word",what,when,where,who,which,why,how
```

## Important Notes

- **Empty cells** are fine for unused fields — leave them blank
- The import automatically **creates any set name** that doesn't exist yet
- Text fields support `\br` (backslash + br) for line breaks within a single cell
- Max **4 options** per MCQ/image_mcq (`opt1`–`opt4`), max **4 examples** per text card (`example1`–`example4`)
- The `correct_answer` for **gap_fill** and **audio_listening** accepts **comma-separated alternatives**: `go,goes,went`
- For **image_mcq**, the `correct_answer` is a **zero-based index** (0, 1, 2, or 3)
- For **audio_listening**, leave `correct_answer` AND `prompt` empty to make a **descriptive-only** card (no typing, just listen + read transcript)
- Media files (`image_url`, `audio_url`) can be referenced as **relative paths** (`uploads/images/...`) or **full URLs** (`https://...`)
- Import endpoint: `api/import_csv.php` (admin-only, via the admin panel)
