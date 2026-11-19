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
      "summary": "Add and subtract fractions and mixed numbers with like and unlike denominators.",
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
        },
        {
          "id": "frac.add-sub.mixed",
          "name": "Add and subtract mixed numbers, including regrouping",
          "prerequisites": [ { "id": "frac.mixed", "strength": "essential" } ]
        }
      ]
    }
  ]
}
```

---

## 3. Fractions skill map

8 instructional skills, 27 subskills. Each lesson has one section per subskill, so a student missing one subskill gets just that section.

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
| 4 | `frac.mixed` Mixed numbers and improper fractions | `.to-improper`; `.to-mixed` | `frac.meaning` E; `.to-mixed` <- `whole.mult-div.remainders` E |
| 5 | `frac.add-sub` Add and subtract | `.common-denom`; `.rewrite`; `.combine`; `.simplify-result`; `.mixed` | see example above |
| 6 | `frac.multiply` Multiply | `.by-whole` (incl. "2/3 of 12"); `.by-fraction`; `.simplify`; `.mixed` (catches 2 1/2 x 3 1/2 = 6 1/4) | `frac.meaning` E; `whole.mult-div.mult-facts` E; `.simplify` <- `frac.equivalent.simplify` E; `.mixed` <- `frac.mixed` E |
| 7 | `frac.divide` Divide | `.meaning` (how many 1/2s in 3?); `.reciprocal`; `.multiply-reciprocal` (catches flipping the wrong one); `.mixed` | `frac.multiply` E; `frac.meaning` E; `.mixed` <- `frac.mixed` E |
| 8 | `frac.signed` Negative fractions | `.sign-placement` (-3/4 = (-3)/4 = 3/(-4)); `.add-sub`; `.mult-div` | `.add-sub` <- `int.add-sub` E, `frac.add-sub` E; `.mult-div` <- `int.mult-div` E, `frac.multiply` E, `frac.divide` E |

The diagnostic starts at `frac.add-sub` with an unlike-denominator problem. Right: skills 1-4 get provisional credit; move on to multiply/divide/signed. Wrong: the shape of the wrong answer decides where to go (1/2 + 1/3 = 2/5 points at `.combine`; a bad common denominator goes down to equivalence and multiples).

Integer and whole-number stubs have no lessons in this milestone. If the diagnostic traces a gap to one, the teacher sees it flagged as "needs a skill not built yet".

---

## 4. Build order for the fractions prototype

1. `frac.json` + whole/int stubs + graph-rules test. **(Done.)**
2. Exact fraction math + seeded random + generators for `frac.add-sub`, with Node tests. **(Done.)**
3. Adaptive diagnostic logic (Node), then a bare test page. **(Logic done; the test page comes with the student UI.)**
4. Student UI: math keypad, lesson player, practice, local save/retry. **(Keypad, diagnostic page and local save/resume done; lessons and practice next.)**
5. Teacher dashboard: class view, heatmap, student profile, printable paper tests, verification entry.
6. Apps Script layer: deploy, code login, teacher Google login, batched save with LockService, server-chosen seeds, server re-grading.
7. Simulated-class load test with synthetic students.
8. Fill in the remaining fraction skills (1-4, 6-8) end to end.

---

## 5. Decisions made

See the "Decided details" section of `CLAUDE.md`. In short: simplest form required with one retry + hint; decimals later; student codes only (no Google for students); teachers use Google; no cross-year profiles yet; esbuild + Node test runner; no framework, system fonts; server-chosen seeds; fractions-only full prototype first.

## 6. Still open

- Improper vs mixed answers (7/4 vs 1 3/4): assumed both accepted unless the question asks for a form. Owner to confirm.
- Which Google account hosts the Apps Script project. Fine to use a personal account during synthetic-data development; must be settled (and the admin told) before any real student data.
- Full skill list across all domains: drafted in `docs/SKILL-LIST.md`, waiting for the owner to keep/cut/merge.
- License (AGPL-3.0 vs MIT). No license file until decided.
