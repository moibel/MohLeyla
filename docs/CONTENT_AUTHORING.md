# MohLeyla lesson authoring guide

Lessons live in `src/data/content/<track>/*.json`. Each file is a JSON **array of lessons**.
Tracks: `ar` (Modern Standard Arabic), `sa` (Saudi Arabic), `en` (English), `id` (Indonesian).

Every learner-facing string that explains something is **trilingual**: `{ "ar": "...", "en": "...", "id": "..." }`
(Arabic / English / Indonesian interface language). Strings in the *language being learned* (`target`, `translit`) are single strings.

## Lesson shape

```json
{
  "id": "ar-01",              // keep legacy ids exactly; format track-NN
  "track": "ar",
  "level": "beginner",        // beginner | elementary | intermediate
  "order": 3,                 // 1..30, unique within the track (position in the learning path)
  "topic": "greetings",       // short english slug
  "icon": "👋",               // one emoji
  "title":       {"ar":"","en":"","id":""},
  "description": {"ar":"","en":"","id":""},   // one sentence
  "objectives":  [ {"ar":"","en":"","id":""}, ... ],   // 3 "I can ..." goals
  "intro":       {"ar":"","en":"","id":""},   // 2-3 sentence teacher intro
  "culture":     {"ar":"","en":"","id":""},   // real-world context / when and where to use it
  "grammar": { "title": {...}, "body": {...} },  // short, 2-4 sentences; may be null only if truly no grammar point
  "items": [ ITEM x 6 ],
  "cloze": [ CLOZE x 2 ],
  "conversation": CONVERSATION,
  "summary": {"ar":"","en":"","id":""}        // 2 sentences recapping what was learned
}
```

### ITEM (exactly 6 per lesson, 8 for alphabet lessons if useful)

```json
{
  "id": "a1",                      // legacy ids kept; new ids: <lessonid without dash>n1..n6 e.g. "ar14n1"
  "target": "مَرْحَبًا",            // the phrase in the language being learned
  "translit": "marḥaban",          // Latin pronunciation guide (see below)
  "tr": {"ar":"...","en":"Hello","id":"Halo"},          // meaning in each UI language
  "example": { "target": "...", "translit": "...", "tr": {"ar":"","en":"","id":""} },
  "hint": {"ar":"","en":"","id":""}   // OPTIONAL usage / pronunciation / register tip
}
```

Rules for items:
* `tr` is the meaning in each interface language. For the UI language that equals the language being learned
  (e.g. `tr.en` for an English track, `tr.ar` for Arabic tracks) write a **short plain-language gloss/definition/synonym**
  (e.g. English track: `"en": "a polite way to say hello in the morning"`), never a verbatim copy of `target`.
  For the **Saudi** track `tr.ar` should be the Modern Standard Arabic equivalent where it differs (e.g. `"الآن"` for `الحين`),
  or a short Arabic explanation.
* `translit`: Arabic -> readable romanization with long vowels marked (ā ī ū), ḥ ṣ ḍ ṭ ẓ ʿ ʾ; for Saudi write what is actually said
  (`wesh akhbārak`, `gahwa`). English -> syllable respelling with CAPITALS for the stressed syllable (`heh-LOH`). Indonesian -> syllable
  split (`sa-ya`); mark pepet `ə`.
* MSA (`ar` track) targets and example sentences: **fully vowelised** (tashkeel) - it drives text-to-speech quality.
* Saudi (`sa`) targets: write the way Saudis actually say it (colloquial), diacritics only where they prevent ambiguity.
* Teach natural usage, not literal word-for-word translations. Mark register (formal / informal / to a man / to a woman) in `hint`
  when it matters.
* Each lesson needs real, useful, progressively harder content; items must be distinct. No filler, no copy-paste lessons.
* Where the existing legacy lesson already has items, **keep their ids and their target text and meaning** (you may improve vowelisation),
  and add new items with new ids to reach 6.

### CLOZE (exactly 2 per lesson) - fill in the blank

```json
{ "sentence": "___ ، كَيْفَ حَالُكَ؟", "answer": "مَرْحَبًا", "wrong": ["شُكْرًا","غَدًا"],
  "tr": {"ar":"","en":"Hello, how are you?","id":"Halo, apa kabar?"},   // translation of the FULL sentence
  "why": {"ar":"","en":"","id":""} }                                     // why the answer fits / why the others do not
```
Exactly one `___`. Wrong options must be clearly wrong in context (grammar or meaning) but plausible, and unique.

### CONVERSATION - conversation completion

```json
{ "context": {"ar":"","en":"","id":""},               // the situation (where/who)
  "turns": [ {"who":"A","target":"...","tr":{...}}, {"who":"B","target":"...","tr":{...}}, {"who":"A", ...} ],  // 3-4 turns
  "gap": 1,                                           // index of the turn the learner must choose (>=1)
  "wrong": ["...", "..."],                            // two wrong replies, in the language being learned
  "why": {"ar":"","en":"","id":""} }                  // explain the right reply and why the wrong ones do not fit
```
The correct reply is `turns[gap].target`. Wrong replies must be grammatical, plausible phrases that do not answer the previous turn.

## Quality bar
* Accurate, natural, culturally appropriate. Arabic must be correct; be careful with gender agreement. If unsure of a Saudi
  expression, use a well-known one rather than guessing.
* The three languages must each read natural to a native speaker; the Indonesian is standard everyday Indonesian
  (formal/informal marked where relevant); the Arabic UI text is clear MSA.
* No emojis inside translation strings except the lesson `icon`.
* Strings must not contain raw newlines; use plain text.

## Validate before finishing

```bash
node scripts/validate-content.mjs src/data/content/<track>/<your-file>.json
```
Fix every reported problem. The validator checks structure, scripts (Arabic text must contain Arabic script, `en`/`id` must not),
unique ids, duplicate options, 6+ items, etc.
