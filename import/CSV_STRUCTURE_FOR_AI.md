# CSV Structure for Flashcard Import

## Common Columns (all card types)

| Column   | Description |
|----------|------------|
| `id`     | Leave empty for new cards, or set an existing ID to update |
| `set`    | Card set name — if the set doesn't exist, it is **created automatically** during import |
| `set_id` | Optional numeric set ID. If both `set` and `set_id` are given, `set` takes priority |
| `type`   | Card pattern: `usage_cases`, `deep_dive`, `formula_table`, `multiple_choice`, `gap_fill`  |
| `title`  | The word, phrase, or main subject of the card |
| `level`  | `A1` `A2` `B1` `B2` `C1` `C2` (will be mapped to Beginner/Intermediate/Advanced on import) |

## Level Mapping

| CSV value    | Stored as      |
|--------------|----------------|
| `A1` or `A2` | `Beginner`     |
| `B1` or `B2` | `Intermediate` |
| `C1` or `C2` | `Advanced`     |

You can also use `Beginner`, `Intermediate`, `Advanced` directly.

## Type-Specific Fields

### usage_cases (Pure Text — Usage Cases)
Shows the word, then reveals definition, usage context, example, and tip.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | The definition or explanation of the word |
| `usage1`     | yes      | Usage context (when/where to use this word) |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | if >=b2  | Extra tip or memory aid |

### deep_dive (Pure Text — Deep Dive)
Shows the word, then reveals definition and example.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | Deep definition or explanation |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | yes      | Extra note |

### formula_table (Pure Text — Formula Table)
Shows the word, then reveals definition and example.

| Column       | Required | Description |
|--------------|----------|-------------|
| `definition` | yes      | The formula, structure, or rule |
| `example1`   | yes      | Example sentence (max 4: `example1` to `example4`) |
| `tip`        | yes      | Extra note |

### multiple_choice (Quiz)
Shows a question with clickable answer options.

| Column           | Required | Description |
|------------------|----------|-------------|
| `question_text`  | yes      | The question to display (e.g. "Which tense is correct?") |
| `opt1`           | yes      | Answer option 1 (max 4 options: `opt1` to `opt4`) |
| `opt2`           | yes      | Answer option 2 |
| `opt3`           | no       | Answer option 3 |
| `opt4`           | no       | Answer option 4 |
| `correct_answer` | yes      | Zero-based index of the correct option (0, 1, 2, or 3) |
| `explanation`    | no       | Text shown after answering explaining why it's correct |

### gap_fill (Quiz)
Shows a sentence with a blank, user types the answer.

| Column           | Required | Description |
|------------------|----------|-------------|
| `sentence`       | yes      | The sentence with `______` indicating the blank |
| `correct_answer` | yes      | One correct answer, or multiple comma-separated (e.g. `go,goes,went`) |
| `example1`       | no       | Example sentence (max 4) |

## Example CSV

```
id,set,type,title,level,question_text,definition,sentence,opt1,opt2,opt3,opt4,correct_answer,explanation,example1,example2,usage1,tip
,Phrasal Verbs,usage_cases,break down,A1,,"To stop functioning (machine) or to lose control emotionally",,,,,,,,"The car broke down on the highway","My computer broke down",When talking about machines or emotions,
,Phrasal Verbs,gap_fill,break up,B1,,,"They decided to ______ after five years",break up,,,,,,"She broke up with him last week",,
,Tenses,multiple_choice,Present Perfect,B1,"Which sentence uses Present Perfect correctly?",,,,,opt1,opt2,opt3,opt4,2,"Present Perfect uses 'have/has + past participle'",,,,
```

## Notes
- Empty cells are fine for unused fields
- The import automatically creates any set name that doesn't exist yet
- Text fields support `\br` (backslash + br) for line breaks
- Max 4 example sentences (`example1`–`example4`) and max 4 multiple-choice options (`opt1`–`opt4`)
- The `correct_answer` for gap_fill accepts comma-separated alternatives: `go,goes,went`
- Import endpoint: `api/import_csv.php` (admin-only, via the admin panel)
