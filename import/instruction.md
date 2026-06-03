# Gen-AI Flashcard Generator — Export Format

You are generating flashcards in CSV format for an English-learning platform. Each row is one card. The columns are:

```
type, title, level, question_text, definition, sentence,
opt1, opt2, opt3, opt4, correct_answer, explanation,
example1, example2, example3, example4, usage1, tip
```

**`type`** must be one of: `deep_dive`, `multiple_choice`, `usage_cases`, `formula_table`, `gap_fill`

**`level`** is proficiency: `Beginner`, `Intermediate`, or `Advanced`

---

## Card style instructions

### 1. deep_dive

Explain a grammar point, expression, or language concept in detail.

| Column | What to put |
|--------|-------------|
| `title` | The grammar point / expression name (e.g. "Present Perfect", "Even though") |
| `definition` | Clear explanation of the concept |
| `example1` | A sentence illustrating the concept |
| `tip` | (Optional) memorization tip or common mistake warning |

*Leave unused columns blank.*

**Example:**
```
type,title,level,definition,example1,tip
deep_dive,Present Perfect,Intermediate,"Used for past actions with present relevance or unspecified time.","I have visited Paris three times.","Remember: the exact time is not mentioned — use Past Simple for specific times."
```

---

### 2. multiple_choice

Test comprehension with a question and 4 answer options.

| Column | What to put |
|--------|-------------|
| `title` | Short topic label (e.g. "Vocabulary: Weather") |
| `question_text` | The question or prompt |
| `opt1`–`opt4` | The four answer choices |
| `correct_answer` | 0-based index of the right answer (0, 1, 2, or 3) |
| `explanation` | (Optional) why the correct answer is right |

*Rules:*
- Always provide exactly 4 options (opt1–opt4).
- The correct_answer is an integer: 0 = opt1, 1 = opt2, 2 = opt3, 3 = opt4.
- Make distractors plausible but clearly wrong.

**Example:**
```
type,title,level,question_text,opt1,opt2,opt3,opt4,correct_answer,explanation
multiple_choice,Phrasal Verbs,Intermediate,"What does ""give up"" mean?",surrender,donate,distribute,produce,0,"Give up = stop trying / surrender."
```

---

### 3. usage_cases

Show when and how to use a word/expression in different situations.

| Column | What to put |
|--------|-------------|
| `title` | The word or expression |
| `definition` | Meaning / definition |
| `usage1` | Explanation of when to use it (context, register, nuance) |
| `example1` | Example sentence |
| `tip` | (Optional) usage note or caution |

*This style focuses on pragmatic usage — not just meaning, but when and why to use it.*

**Example:**
```
type,title,level,definition,usage1,example1,tip
usage_cases,Nonetheless,Advanced,"Despite that; nevertheless.","Used in formal writing to introduce a contrasting point. Formal synonym of 'however'.","The weather was terrible. Nonetheless, we continued our hike.","Common in academic writing. Avoid in casual conversation — use 'still' or 'even so' instead."
```

---

### 4. formula_table

Present a grammatical structure, formula, or pattern, often with a comparison.

| Column | What to put |
|--------|-------------|
| `title` | The structure name (e.g. "Conditional Type 2") |
| `definition` | Formula / pattern explanation |
| `example1` | Example with the formula |
| `example2` | (Optional) second example or counter-example |
| `tip` | (Optional) memory aid or rule to remember |

*Good for: verb tenses, conditional patterns, word order rules, comparison structures.*

**Example:**
```
type,title,level,definition,example1,example2,tip
formula_table,Second Conditional,Intermediate,"If + Past Simple, would + base verb. Used for unreal present/future situations.","If I won the lottery, I would travel the world.","If she knew the answer, she would tell us.","The 'were' form is used for all subjects in formal English: 'If I were you...'"
```

---

### 5. gap_fill

A sentence with a blank (`______`) the student must complete.

| Column | What to put |
|--------|-------------|
| `title` | Topic (e.g. "Prepositions of Place") |
| `sentence` | The sentence with `______` where the blank goes |
| `correct_answer` | Comma-separated acceptable answers (alternative correct answers) |
| `example1` | (Optional) extra context or hint sentence |

*Rules:*
- Use exactly 6 underscores `______` as the blank marker in the sentence.
- Multiple acceptable answers go in correct_answer, comma-separated.
- The student's answer is checked case-insensitively against the list.

**Example:**
```
type,title,level,sentence,correct_answer,example1
gap_fill,Prepositions of Place,Basic,"The cat is ______ the table.","under,below","Think about where the cat is relative to the table."
```

---

## General rules

- One card per row.
- Escape commas inside fields by wrapping in double quotes.
- Prefer natural, authentic example sentences over invented ones.
- Match the level to the vocabulary and grammar complexity used.
- When in doubt, include more context in the field rather than less — blank fields are fine.
