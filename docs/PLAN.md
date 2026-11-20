# MathPath — Approved Plan (v1)

Approved by the owner on 2026-11-19. This plan covers the first milestone: a full-feature prototype (student flow + teacher dashboard) for the **fractions skill area only**. Decisions here are also summarised in `CLAUDE.md`.

---

## 1. Folder structure

```
mathpath/
├── CLAUDE.md
├── docs/
│   ├── BRIEF.md                 vision and requirements (CLAUDE.md wins on conflicts)
│   ├── PLAN.md                  this file
│   └── decisions/               one short note per big decision
│
├── curriculum/                  DATA ONLY. No code.
│   ├── graph/
│   │   ├── domains.json         list of domains and their order
│   │   ├── whole.json           whole-number skills (stubs for now)
│   │   ├── int.json             integer skills (stubs for now)
│   │   └── frac.json            fraction skills
│   ├── lessons/                 authored lesson text, worked examples, misconception feedback
│   ├── paper/                   teacher paper-assessment templates (separate from practice)
│   ├── course-map.json          Integrated Math 1/2/3 units -> skills they rely on
│   └── mastery.json             default mastery rules + per-skill overrides
│
├── engine/                      plain JavaScript. No Apps Script, no DOM.
│   ├── random.js                seeded random numbers
│   ├── math/                    exact fraction arithmetic (never floating point)
│   ├── graph/                   load + check the curriculum; prerequisite queries
│   ├── generators/frac/         practice problem generators, one file per subskill family
│   ├── diagnostic/              adaptive diagnostic
│   ├── mastery/                 mastery rules + retention scheduling
│   ├── feedback/                match wrong answers to known misconceptions
│   ├── grading/                 "seed + answers -> score" (runs in browser AND on server)
│   └── paper/                   builds printable tests from curriculum/paper
│
├── web/
│   ├── student/                 student screens
│   ├── teacher/                 dashboard
│   ├── components/              math keypad, fraction bars, number line
│   ├── storage/                 local save + retry queue
│   └── api/                     the ONLY code that talks to the server (swappable)
│
├── server/apps-script/          thin layer: serve page, login, save with LockService
│   ├── Code.js
│   ├── auth.js                  student-code login (swappable)
│   ├── store-sheets.js          all Sheet reads/writes (swappable for Firebase later)
│   └── appsscript.json
│
├── tests/                       Node tests mirroring engine/, plus curriculum + simulation
├── tools/                       build.js (esbuild), simulate-class.js
└── dist/                        build output (generated, gitignored)
```

Why:

- Curriculum is data, so content can change without touching code.
- `engine/grading/` is bundled into both the page and the Apps Script server, so the server re-checks answers with the exact same code.
- Everything Google-specific is in `server/apps-script/` and reached only via `web/api/`, so a later move to Firebase replaces two folders.
- Apps Script can't serve separate script files or use `import`, so `tools/build.js` (esbuild) bundles everything.

---

## 2. Skill graph schema

One file per domain. Each file holds that domain's skills; each skill holds its diagnostic subskills. Prerequisite links can attach to a whole skill or to one subskill.

### Rules (enforced by a Node test)

- IDs are permanent: student records point to them. Never rename; mark `"status": "retired"` instead. A subskill ID starts with its skill's ID.
- A prerequisite means "you need this before me". Every referenced ID must exist.
- No loops: A can't need B if B needs A (directly or indirectly).
- Every link has `"strength"`:
  - `essential`: you realistically can't do the skill without it. The diagnostic follows these downward when a student misses something; the learning path puts essential gaps first.
  - `supporting`: helps, never blocks. Suggested; probed by the diagnostic only if question budget allows.
- The graph holds structure only. Lesson text, feedback, generators and mastery rules live elsewhere and refer to skills by ID.
- `standards` holds Common Core codes as labels only (for cross-checking against Learning Commons later).

### Example

```json
{
  "schemaVersion": 1,
  "domain": { "id": "frac", "name": "Fractions" },
  "skills": [
    {
      "id": "frac.add-sub",
      "name": "Add and subtract fractions",
      "summary": "Add and subtract fractions with like and unlike denominators.",
      "typicalGrade": 5,
      "standards": ["5.NF.A.1", "5.NF.A.2"],
      "status": "draft",
      "prerequisites": [
        { "id": "frac.meaning", "strength": "essential" },
        { "id": "frac.compare", "strength": "supporting",
          "why": "Helps students judge whether an answer is a reasonable size." }
      ],
      "subskills": [
        {
          "id": "frac.add-sub.common-denom",
          "name": "Find a common denominator",
          "prerequisites": [
            { "id": "whole.mult-div.mult-facts", "strength": "essential" },
            { "id": "whole.factors-multiples.lcm", "strength": "supporting",
              "why": "Multiplying the denominators always works; the LCM just keeps numbers smaller." }
          ]
        },
        {
          "id": "frac.add-sub.rewrite",
          "name": "Rewrite fractions over the common denominator",
          "prerequisites": [ { "id": "frac.equivalent", "strength": "essential" } ]
        },
        {
          "id": "frac.add-sub.combine",
          "name": "Add or subtract numerators, keep the denominator",
          "prerequisites": [ { "id": "whole.add-sub", "strength": "essential" } ]
        },
        {
          "id": "frac.add-sub.simplify-result",
          "name": "Simplify the result",
          "prerequisites": [ { "id": "frac.equivalent.simplify", "strength": "essential" } ]
        }
      ]
    }
  ]
}
```

---

## 3. Fractions skill map

8 instructional skills, 24 subskills. (Mixed-number arithmetic removed by owner decision; `frac.mixed` is a supporting skill outside the diagnostic.) Each lesson has one section per subskill, so a student missing one subskill gets just that section.

### Prerequisite stubs from other areas

| ID | Skill | Subskills |
|---|---|---|
| `whole.add-sub` | Whole-number add/subtract | (assumed) |
| `whole.mult-div` | Multiplication and division | `.mult-facts` (to 12x12), `.div-facts`, `.remainders` |
| `whole.factors-multiples` | Factors and multiples | `.factors`, `.gcf`, `.lcm` |
| `int.add-sub` | Integer add/subtract | (designed with integers area) |
| `int.mult-div` | Integer multiply/divide | (designed with integers area) |

### Fraction skills (E = essential, S = supporting)

| # | Skill | Diagnostic subskills | Prerequisites |
|---|---|---|---|
| 1 | `frac.meaning` Understand fractions | `.read-models` name a fraction from a picture; `.number-line` place on a number line incl. >1; `.division` fraction as division, wholes as fractions | `whole.mult-div` S |
| 2 | `frac.equivalent` Equivalent fractions and simplest form | `.scale`; `.missing` (3/4 = ?/20); `.simplify` | `frac.meaning` E; `whole.mult-div.mult-facts` E; `.simplify` <- `whole.factors-multiples` E |
| 3 | `frac.compare` Compare and order | `.like`; `.benchmark` (0, 1/2, 1); `.unlike` | `frac.meaning` E; `.unlike` <- `frac.equivalent` E |
| 4 | `frac.mixed` Mixed numbers and improper fractions (supporting only, not in the diagnostic) | `.to-improper`; `.to-mixed` | `frac.meaning` E; `.to-mixed` <- `whole.mult-div.remainders` E |
| 5 | `frac.add-sub` Add and subtract | `.common-denom`; `.rewrite`; `.combine`; `.simplify-result` | see example above |
| 6 | `frac.multiply` Multiply | `.by-whole` (incl. "2/3 of 12"); `.by-fraction`; `.simplify` | `frac.meaning` E; `whole.mult-div.mult-facts` E; `.simplify` <- `frac.equivalent.simplify` E |
| 7 | `frac.divide` Divide | `.meaning` (how many 1/2s in 3?); `.reciprocal`; `.multiply-reciprocal` (catches flipping the wrong one) | `frac.multiply` E; `frac.meaning` E |
| 8 | `frac.signed` Negative fractions | `.sign-placement` (-3/4 = (-3)/4 = 3/(-4)); `.add-sub`; `.mult-div` | `.add-sub` <- `int.add-sub` E, `frac.add-sub` E; `.mult-div` <- `int.mult-div` E, `frac.multiply` E, `frac.divide` E |

The diagnostic starts at `frac.add-sub` with an unlike-denominator problem. Right: skills 1-4 get provisional credit; move on to multiply/divide/signed. Wrong: the shape of the wrong answer decides where to go (1/2 + 1/3 = 2/5 points at `.combine`; a bad common denominator goes down to equivalence and multiples).

Integer and whole-number stubs have no lessons in this milestone. If the diagnostic traces a gap to one, the teacher sees it flagged as "needs a skill not built yet".

---

## Where we are (handoff notes)

Updated 2026-11-19 (end of session 2). Read this first in a new session.

- **Done:**
  - Engine: skill graph + checker; fraction math, seeded random, answer checking; add/subtract generators; adaptive diagnostic; worked solutions; practice sessions with feedback and mastery; step boxes for "Putting it together" (`engine/practice/scaffold.js`); learning path, foundations first, lessons in skill-graph order, sections wait while a teacher check is open (`engine/lessons/path.js`).
  - Student app (`web/student/`): diagnostic, path, lesson sections (explanation, fraction bars, worked example, guided practice, check / mastery), local save + outbox, resume. Two columns on wide screens.
  - Teacher dashboard (`web/teacher/`, logic in `engine/teacher/`, all tested): class overview with per-skill bars and a heatmap (8 skills, click for subskills), teach-together groups (same next step / same mistake), participation (effort only, no ranking), paper tests (versions A/B, print view, answer key, score entry with the 5-of-6 rule, teacher's final call), roster (private names, code reset), student profile (platform vs verified mastery, path with "mark checked", every practice problem re-created from its seed, diagnostic report, change log).
  - Pretend class (`tools/synthetic-class.js`): 1-6 periods of 20-45 made-up students run through the real engine. Also the seed of the step 7 load test.
  - 165 tests pass (`npm test`).
- **Preview links** (private, owner only). Refresh: `npm run build`, then publish the file to the same link with the Artifact tool (pass the URL).
  - Student: https://claude.ai/artifact/X3HD7LBaGbrzS8gPPWmWBK, from `dist/student-preview.html`.
  - Teacher dashboard: https://claude.ai/artifact/Y7xWDhWLsAPqZp4aYuqgCd, from `dist/teacher-preview.html`.
  - In the claude.ai viewer the print dialog and pop-ups are blocked, so the dashboard shows an on-screen print view and uses a second tap to confirm a code reset.
- **Waiting on owner:**
  - Try the dashboard; review the paper-test items (`curriculum/paper/frac.add-sub.json`, also visible on the Paper tests tab).
  - Decide the build order after the prototype (see CLAUDE.md "Build order after the prototype").
  - Still open from before: the "rewrite 1/6 over 6" do-nothing step; review lesson text; `docs/SKILL-LIST.md`.
- **Google layer (step 6) built:** `server/core/` (sign-in, saving with re-grading and no rerolls, teacher actions, teachers see only their classes), `server/apps-script/` (entry points, Sheets store with LockService), `web/api/client.js`, sign-in screen, "Not you? Sign out", nickname, upload status and retry, live dashboard (loads from the server; add classes and students; all actions saved and logged). Tested with fake Google services, including the real built `Code.js`, and an end-to-end browser run of the real Google files (teacher adds students, student signs in, diagnostic, teacher clears checks, section done offline then uploaded, teacher sees it).
- **Owner deployed it** to the school Google account and tested as a student (2026-11-20). That test found that a "shaky" result left the path empty; fixed with the Quick review (CLAUDE.md). The owner pastes updated files and makes a new deployment version after each change (docs/SETUP-GOOGLE.md, "Updating later").
- **Not built yet:** teacher assignments and exemptions, path reordering, due dates; retention checks; the simulated-class load test (step 7, next after the owner's first deploy).
- **Load test (step 7) built:** `npm run load-test`. Part 1 runs 6 x 45 pretend students through the real server and Sheets store: 3 reads + 2 writes per save whatever the sheet size, no duplicates with retried saves, Sections rows ~550 chars, dashboard data ~0.5 MB. Part 2 MODELS Google's timing from an assumed time per save (default 1.5 s): a whole period saving at the bell gets some "busy" replies and is fully saved within ~2 minutes by automatic retries. Changes made from it: the dashboard reads only summary columns (answers fetched per student on the profile page), a save never re-reads past saves, columns are read by header name (new columns are added automatically), busy saves retry after 15 s / 30 s / 1 min / 2 min with jitter.
- **Waiting on owner:** run `speedCheck()` in the Apps Script editor (docs/SETUP-GOOGLE.md) and report the "one save takes about N ms" number; Claude reruns `npm run load-test -- --save-ms N`. If the bell scenario looks bad with the real number, the next fix is to do the re-grading outside the lock (shorter lock time).
- **Whole numbers (owner chose them next, 2026-11-20):** plan in `docs/WHOLE-NUMBERS-PLAN.md`. Done: graph, generators (add/subtract with regrouping, facts, remainders, factors, prime factorization, GCF, LCM) with tests, wrong-answer catalog (`curriculum/misconceptions/whole.json`), diagnostic now asks real whole-number questions when it follows a fraction gap down (slow-fact rule included).
- **Whole numbers, also done:** keypad for remainders (9 R 2) and lists (factors, primes); lessons for all three skills (`curriculum/lessons/whole.*.json`, Claude's draft text, owner review pending) with worked solutions, the area model for facts, and the 9-of-10 facts check; whole-number skills on student paths (grouped under skill headings) and in the dashboard heatmap. Lessons now wait only for teacher checks they build on.
- **Waiting on owner:** review the whole-number lesson text in the preview; `speedCheck()` number (load test).
- **Also done (2026-11-20):** students never wait for the teacher (owner decision; one setting); "Send back to redo" a skill (dashboard profile and paper tests; server `resetSkill`, Sheets tab `Resets`); paper tests for the three whole-number skills (versions A/B, answer keys checked by `tests/curriculum/paper-whole.test.js`) with a skill picker on the Paper tests tab.
- **Waiting on owner:** review the whole-number lesson text and paper items in the previews; paste the new files into Apps Script and make a new deployment version (the new `Resets` tab is added automatically on the first save or by running setup() again); `speedCheck()` number.
- **Also done:** "Practice for a check" (owner request): any skill, any time, 6 paper-test-style problems with hints, compared with the 5-of-6 rule at the end; never changes mastery; counts as participation; on the dashboard in Participation ("Practice sets") and each student's profile.
- **Equivalent fractions built (2026-11-20):** generators (scale with an exact-form answer, missing number, simplify) with tests, wrong-answer messages, lesson (Claude's draft, owner review pending), worked solutions, paper test (versions A/B, keys checked). The diagnostic now confirms equivalent-fraction gaps itself. Diagnostic search order changed: all steps of a skill are asked before following a confirmed gap down (a struggling student was running out of the 25 questions before every add/subtract step was checked). A student weak only on multiplication facts now takes ~22 questions (each confirmed gap is asked twice); worth trimming later if the owner finds it long.
- **Understand fractions built (2026-11-20):** pictures in problems (bars, grids, dots, number lines; SVG in `web/components/render-math.js`, black and white on paper), generators for naming a fraction from a picture, number lines (including past 1) and fractions as division, with tests; lesson (draft for owner review), worked solutions, paper test with pictures (`{bar 3/5}`, `{dots 4/9}`, `{line 2 4 7}` markup). Nothing under fraction add/subtract is "with your teacher first" any more.
- **Open question for the owner:** diagnostic length. With more skills checkable, about 1 in 6 random pretend students with several gaps reaches the 25-question limit (each confirmed gap is asked twice). Options are in the chat of 2026-11-20.
- **Next:** compare and order fractions, then multiply, divide, negative fractions (the integer skills those need come first, as stubs today). Later: teacher assignments/exemptions; retention checks.

## 4. Build order for the fractions prototype

1. `frac.json` + whole/int stubs + graph-rules test. **(Done.)**
2. Exact fraction math + seeded random + generators for `frac.add-sub`, with Node tests. **(Done.)**
3. Adaptive diagnostic logic (Node), then a bare test page. **(Logic done; the test page comes with the student UI.)**
4. Student UI: math keypad, lesson player, practice, local save/retry. **(Done for `frac.add-sub`; sending saves to the server comes with step 6.)**
5. Teacher dashboard: class view, heatmap, student profile, printable paper tests, verification entry. **(Done against a pretend class; assignments/exemptions come with step 6.)**
6. Apps Script layer: deploy, code login, teacher Google login, batched save with LockService, server-chosen seeds, server re-grading. **(Built and tested here; owner's first deploy pending.)**
7. Simulated-class load test with synthetic students. **(Built: `npm run load-test`; real Google timing from `speedCheck()` pending.)**
8. Fill in the remaining fraction skills (1-4, 6-8) end to end.

---

## 5. Decisions made

See the "Decided details" section of `CLAUDE.md`. In short: simplest form required with one retry + hint; decimals later; student codes only (no Google for students); teachers use Google; no cross-year profiles yet; esbuild + Node test runner; no framework, system fonts; server-chosen seeds; fractions-only full prototype first.

## 6. Still open

- Which Google account hosts the Apps Script project. Fine to use a personal account during synthetic-data development; must be settled (and the admin told) before any real student data.
- Full skill list across all domains: drafted in `docs/SKILL-LIST.md`, waiting for the owner to keep/cut/merge.
- License (AGPL-3.0 vs MIT). No license file until decided.
