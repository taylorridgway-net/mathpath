# MathPath

Free, open-source gap-recovery math platform for high school students. Full vision is in `docs/BRIEF.md` (read it first). This file holds the decisions that override or sharpen the brief.

## What it is

Student flow: adaptive diagnostic -> personalized interactive lessons on gaps -> provisional platform mastery -> teacher verifies on paper -> periodic retention check. Teachers monitor everything on a dashboard. The platform proposes, the teacher decides. Teacher-administered paper tests are the source of truth for "verified mastery."

## Scope and audience

- Prototype for the owner's own classes only (a high school math teacher). May expand to the school/district later.
- High school students only (avoids under-13 / COPPA issues).
- No student touches this until a fuller skill set exists.
- First milestone: a complete prototype with every feature (student flow AND teacher dashboard) but only the fractions skill area. Test everything end to end on fractions before building other skills. Within fractions, build `frac.add-sub` completely first, then the rest of the fractions map.
- Skills outside fractions (whole numbers, integers) exist in the graph as prerequisite stubs only until they are built.

## Hard architecture constraints

- Hosted on Google Apps Script (free, and not blocked on student laptops by district filters). Do not suggest GitHub Pages or other hosts for the student app.
- The engine is plain JavaScript with no dependency on Apps Script: question generators, adaptive diagnostic, mastery logic, feedback, curriculum data. Apps Script is a thin layer that serves the page and stores data, so it can be swapped for Firebase/Supabase later.
- Zero server calls per question. Student session state lives in the browser. Send one save per lesson/section containing the seed, answers, and timing.
- Server re-generates problems from the seed and validates answers itself (server-side mastery validation). So generators must be deterministic and seedable.
- Save progress to browser local storage too, and retry on next load, so a dropped connection or sleeping Chromebook doesn't lose work.
- Use LockService around Sheet writes. Never write to Sheets per question (this killed a previous prototype).
- Cache static curriculum content. Don't load whole student tables.
- Curriculum is data (JSON), kept separate from application code.
- Mobile-first, but must work well on Chromebooks and computers. Plan the math input method (fractions, negatives, exponents on a phone) early.
- No required paid AI services. Generation, scoring, and feedback are deterministic code plus authored content.
- No third-party tracking or analytics. Self-host fonts and libraries; don't load from CDNs.

## Login and privacy

- Teacher generates a random personal code per student (e.g. `maple-tiger-42`). The code is both username and password. Device remembers it after first entry.
- Students may set a display nickname. Store no real names, emails, or birthdates. Only the teacher's private roster maps codes to people.
- Teacher can look up/reset a code. No email reset flow.
- Keep the sign-in layer swappable so Google sign-in can be added later if the district allows.
- Teachers sign in with their own Google account (Apps Script handles this). Students never need a Google account.
- Profiles following a student across school years is out of scope for now.
- Teachers see only their own classes' students, enforced server-side. Log who changes mastery records.
- Use synthetic data while developing and testing. Real students only at pilot time, after telling the school admin.

## Curriculum model

Three layers: domains -> instructional skills -> diagnostic subskills. Skills connected by a prerequisite graph; distinguish essential prerequisites from helpful supporting knowledge. The graph drives diagnostics, learning paths, and prioritization. Consider Learning Commons Knowledge Graph and Common Core progressions as starting points rather than building from scratch.

Fraction add/subtract, multiply, and divide are separate instructional skills. Add/subtract diagnostic subskills: equivalent fractions, common denominators, adding numerators correctly, simplifying.

## Diagnostic

Adaptive, short (target roughly 15-25 questions). Start mid-graph; a correct answer skips prerequisites below it, a wrong answer moves to prerequisites. Runs entirely in the browser using the graph JSON; send only the final profile to the server.

## Assessment integrity

- Teacher paper assessments are written separately from the practice generators: different surface forms, some word problems. Don't derive them from the same templates.
- Distinguish platform mastery (provisional) from teacher-verified mastery everywhere in data and UI.
- Students far below grade level may not move grade-level scores soon. Track skill-level gains, grade-level results, and usage/participation separately.
- No public individual leaderboards. Participation credit rewards engagement, not initial proficiency or speed.

## Decided details

- Answers must be in simplest form. If an answer is correct but not simplified, don't mark it wrong: give one more try with a hint to simplify.
- Improper fractions and mixed numbers (7/4 vs 1 3/4) are both accepted as answers unless the question asks for a specific form. (Owner confirmed.)
- Mixed-number arithmetic is out of the fractions map (owner decision). `frac.mixed` (converting mixed <-> improper) stays as a supporting skill: never in the diagnostic, teacher-assignable.
- Decimals are out of the fractions map for now; they come later as their own area.
- Problem seeds are chosen by the server (e.g. from student code + attempt number), never picked by the browser, so students can't reroll for easy problems.
- No front-end framework (no React). Plain HTML/CSS/JS. Use the device's system fonts; no font files.
- Dev-only tooling: esbuild (bundles the engine for Apps Script) and Node's built-in test runner. Nothing else without asking.
- Course mapping (Integrated Math 1/2/3 units -> skills they rely on) lives in its own file, never inside the skill graph. Course never drives a student's path.
- Every saved record stores per-subskill diagnostic verdicts, timestamps, attempt counts, and the curriculum version, so success metrics (diagnostic accuracy, time to mastery, retention) can be measured later.
- Passing fraction add/subtract credits multiplication facts but not division facts (owner decision; that's why they are separate subskills).
- Diagnostic: no retry for an unsimplified answer (it's evidence about simplifying). A blank / "I'm not sure" counts as a miss.
- Diagnostic: if a whole-skill problem is missed but every step checks out, ask one more whole problem. Missed again = gap on the whole skill ("each step fine, whole problem missed"). Found by the owner; never treat that pattern as a slip.
- Practice feedback: wrong with a known misconception -> that message + one retry; wrong otherwise -> hint + one retry; wrong twice or "I'm not sure" -> show the worked solution, then a similar problem.
- Platform mastery of a skill: 4 of the last 5 whole problems right on the first try, at least 2 at the hardest difficulty. A right answer after the "simplify" hint counts as first-try right if the student then simplifies correctly. Section checks: 3 right in a row.
- "Putting it together" guided problems: one box per step (common denominator, rewrite each fraction, combine, simplify). Later steps use the student's own common denominator. A step missed twice is filled in for them; only the final answer counts toward the practice session.
- Learning path: foundations first (owner's requirement: practising fractions won't fix a multiplication gap). Order: foundations with no lesson yet (confirmed gaps, and possible causes the diagnostic can't check yet, shown as "Check with your teacher first"), then lessons in skill-graph order, sections within a lesson in lesson order, then "Putting it together". As foundation lessons get built they take those first slots automatically. Claude's proposal, owner to confirm: "shaky" doesn't put a section on the path.
- Student app layout: phones get one column; screens 900px and wider get two (keypad beside the problem, picture beside the lesson text). Owner asked for desktop to use the space.

## Working style

Lessons learned building this (follow them):

- The owner testing on a real phone finds bugs the tests don't. After every student-facing change, rebuild, republish the preview link (see docs/PLAN.md, "Where we are"), and suggest 1-2 specific things to try.
- Before writing a test that locks in a teaching judgment (e.g. "a miss here is just a slip"), ask the owner. A wrong test is worse than none.
- Look at sample generated problems by eye, not just at passing tests (that's how oversized common denominators like 132 were caught).
- For important logic, plant a deliberate bug once and confirm the tests fail, then restore.
- A subskill's problems must only need that subskill. If they also need another, declare it in the generator's `alsoUses` (and `covers` / `ifNotSimplified` where relevant) so the diagnostic doesn't blame the wrong subskill.
- Skill and subskill IDs can still be renamed or removed freely: no real student data exists yet. Once real data exists, IDs are permanent (mark `retired` instead).
- Keep docs/PLAN.md "Where we are" current at the end of every session, and put every decision made in chat into this file. The owner starts new sessions when context fills up, and only the repository carries over.
- Claude can't create GitHub repositories from a session; the owner does that step.

- Plan before coding on anything non-trivial; propose structure and schemas for review first.
- Write Node tests for every generator and for diagnostic/mastery logic. Math bugs are the main risk.
- Keep generators deterministic given a seed. Never use Math.random() in the engine; use engine/random.js.
- If a generator's output changes on purpose, bump its `version` and run `npm run update-golden`. The golden test exists because the server re-creates problems from saved seeds.
- Generator tests must re-compute answers independently from the displayed problem, never trust the generator's own answer.
- The owner is a teacher, not a professional developer: explain decisions briefly in plain language, keep code readable, and ask before adding dependencies.
- The owner wants Claude to handle git, setup, building and deployment. When the owner must do something themselves (e.g. a click in GitHub or Google), give exact step-by-step instructions.
- Where CLAUDE.md and docs/BRIEF.md disagree, CLAUDE.md wins (it is newer).
- Interactives (fraction bars, number lines, algebra tiles, etc.) only where they genuinely improve understanding.
- Open-source license is undecided (AGPL-3.0 vs MIT). Don't add a license file until told.

## Suggested build order

1. Skill graph JSON schema and the fractions skill map.
2. Fraction question generators with Node tests.
3. Adaptive diagnostic logic (testable in Node, then a bare page).
4. Student UI, including math input.
5. Teacher dashboard and printable assessments.
6. Apps Script wrapper (clasp), save endpoint with LockService and seed validation.
7. Simulated-class load test before any real use.
