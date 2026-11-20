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
- Learning path: foundations first (owner's requirement: practising fractions won't fix a multiplication gap). Order: foundations with no lesson yet (confirmed gaps, and possible causes the diagnostic can't check yet, shown as "Check with your teacher first"), then lessons in skill-graph order, sections within a lesson in lesson order, then "Putting it together". As foundation lessons get built they take those first slots automatically.
- "Shaky" (diagnostic: missed once, then right) puts a **Quick review** of that section on the path (owner decision 2026-11-20): straight to the 3-in-a-row check, no explanation or guided practice. Any problem not right on the first try ends the review, and the student does the full section next. Shaky alone doesn't add "Putting it together".
- Student app layout: phones get one column; screens 900px and wider get two (keypad beside the problem, picture beside the lesson text). Owner asked for desktop to use the space.
- Diagnostic length (owner decision 2026-11-20): the first gap is confirmed with a second question; below a confirmed gap, one miss is enough to call a prerequisite a gap. A right answer credits everything it depends on unless later answers say otherwise ("a kid who can add fractions shows integer multiplication too"). Result with 400 pretend students: median 8 questions, max 20, none at the 25 limit.
- Diagnostic order (2026-11-20): all the steps of a skill are asked before following a confirmed gap down to its prerequisites, so a struggling student doesn't use up the 25 questions on the first gap.
- Students never wait for the teacher (owner decision 2026-11-20, replacing the 2026-11-19 "wait" decision): "with your teacher first" items stay on the path as a flag for the teacher, but lessons stay open. Setting: `paths.waitForTeacherChecks` in `curriculum/mastery.json` (false; true brings back locking of lessons that build on an unchecked foundation). Likewise students move on after platform mastery while the paper check is pending; it's only "verified" once the teacher confirms.
- Send back to redo (owner, 2026-11-20): if a student doesn't hold up on paper, the teacher resets that skill: platform mastery is cleared, "Putting it together" for that skill counts as not done (earlier attempts and paper tests before the reset no longer count), and the student redoes it. Logged with who did it. Server call `resetSkill`; Sheets tab `Resets`.
- Practice for a check (owner request 2026-11-20): a student can practise any built skill whenever they like, to get ready for the paper test. A set is 6 whole problems like the paper test (2 warm-ups, then 4 at the hardest level; `practice` in `curriculum/mastery.json`), with hints and the usual feedback, and ends by comparing the score with the paper rule (5 of 6). It never changes mastery or the path; it counts as participation (shown separately as "Practice sets"). Server-chosen seeds (`practice:<skill>`), re-graded, Sheets tab `Practice`.
- Paper tests (teacher verification): 6 items, 5 of 6 suggests "verified"; the teacher makes the final call and both the suggestion and the decision are stored (owner decision). Rule lives in `curriculum/mastery.json` ("verification"). Paper items live in `curriculum/paper/`, authored separately, answer keys checked by a test.
- Dashboard heatmap opens on the 8 whole fraction skills; clicking a skill's heading shows its subskills (owner decision).
- Class sizes to support: 1-6 periods, 20-45 students each (owner). The pretend class and the load test use that range.
- Apps Script project is owned by the owner's school Google account (owner decision). Tell the school admin before any real student data.
- Students each have their own Chromebook; still include a "Not you? Sign out" link on the student page (owner).
- The teacher page may show real names from the private roster tab (only the teacher can open it) (owner).
- Server layer (built 2026-11-19): all server logic is plain JS in `server/core/` (tested in Node); `server/apps-script/` is a thin wrapper (entry points + `store-sheets.js`, the only file touching the Sheet). The browser talks to the server only through `web/api/client.js`; in the claude.ai preview that runs the same server code in the browser (pretend student code `maple-tiger-42`).
- Seeds are `studentId|kind|attemptNo` (`engine/seeds.js`). Student ids are permanent and never shown; codes can be reset. The server rejects any save whose seed or attempt number isn't the next one it expects, re-grades every save, and stores its own result.
- Deployment: the owner pastes the four files from `dist/apps-script/` into the Apps Script editor (`docs/SETUP-GOOGLE.md`); no clasp. Web app runs as the owner, access "anyone within the school domain". The dashboard is the same URL with `?page=teacher`.
- Printable login-code slips: not now (owner unsure what they're for; revisit with the Apps Script login).
- Build order after the prototype: whole-number skills next, before the rest of fractions (owner decision 2026-11-20). Plan: `docs/WHOLE-NUMBERS-PLAN.md`.
- Whole numbers (owner decisions 2026-11-20): a right multiplication/division fact answered in more than about 5 seconds counts as shaky (never shown to students, never used for participation); the facts section check is 10 facts drawn mostly from 6-9 and 12, passed at 9 of 10 right on the first try; 2- and 3-digit add/subtract with regrouping is in, 2-digit multiplication and long division are out for now; prime factorization is in.
- Compare fractions (2026-11-20): answered with buttons (<, =, >; or closest to 0, 1/2, 1). In the diagnostic one comparison with different denominators stands for the whole skill (owner's "a right answer shows what it depends on"); if missed, it counts as the first try and each part is then checked. Any question with a confirmed gap underneath is reported "can't check yet" rather than asked.
- Multiply fractions (2026-11-20): one multiplication (needing simplifying) screens the skill in the diagnostic; whole numbers times fractions and "a fraction of an amount" are their own part; answers in simplest form, improper or mixed both accepted. The lesson uses an area picture (fraction × fraction = overlap).
- Divide fractions (2026-11-20): parts are "how many fit?" (whole-number answers), reciprocals (answer as a fraction; a mixed number gets a "write it as a fraction" retry), and dividing by flipping ("keep, change, flip"). Only the flipping step depends on multiplying, so a student who can't multiply is still checked on the other two. An unsimplified division answer points to multiplying's simplifying step.
- Diagnostic (2026-11-20): anything resting on a "can't check yet" step is also "can't check yet". With add/subtract, compare, multiply and divide built: 400 pretend students, median 12 questions, max 24, none at the 25 limit.
- Fractions times whole numbers (owner asked 2026-11-20): part of multiplying (`frac.multiply.by-whole`: 3 × 2/7, "2/3 of 12") and dividing (6 ÷ 2/3, 4/5 ÷ 6, reciprocal of a whole number).
- Integers (2026-11-20): taught with the number line (Claude's default; owner didn't pick between number line and chips). Subtracting = adding the opposite. Integer multiplying rests on multiplication facts and dividing on division facts, separately (same as the fractions rule). Keypad shows a (−) key when an answer may be negative.
- Google files (found 2026-11-20 from the owner's screenshot): Google's page server cuts JavaScript lines at "//" even inside quotes ("http://www.w3.org/2000/svg" broke the student page). The build writes the Google copies in plain ASCII, with "//" escaped and comment lines dropped, and refuses to build if any "//" remains. The pages also show "This page could not start" with the error instead of going blank.
- Catch-up check (owner, 2026-11-20; no teacher "retake diagnostic" button, owner said not needed): when built skills had no questions at the time of a student's diagnostic, the path offers a short "catch-up check" on just those skills. It starts from the saved result (nothing settled is asked again) and the server works out the new skills itself and re-grades. Diagnostic results are now saved whole when finished (Diagnostics row `result`; the student's summary keeps a slim copy) and never re-run from old answers; older saves are rebuilt once from their recorded verdicts at sign-in.
- Negative fractions (2026-11-20): the last fractions skill. The diagnostic asks each of its three parts (sign placement, add/subtract, multiply/divide) because they rest on different integer skills; misses lead to the exact integer step. A skill-graph link to a whole skill can carry "check": [parts] so the diagnostic only asks those parts when looking for a cause, without changing what a right answer credits (used for simplifying -> factors and GCF; keeps "fraction work doesn't credit division facts"). With every fractions skill built: 400 pretend students, median 13 questions, max 24; a student who knows everything takes 7.
- Removing students and classes (owner, 2026-11-20): hides them, nothing is deleted. A removed student's code stops working; their work stays and "Bring back" restores everything. Logged. Server calls removeStudent/restoreStudent/removeClass/restoreClass; Classes tab column `archived`.
- Co-teachers (owner, 2026-11-20): a class can be shared with a co-teacher's school Google email (Roster tab). She opens the same dashboard link and can do everything the teacher can for that class; every change is logged with her email. Sharing adds her to the Teachers tab. Server calls shareClass/unshareClass; Classes column `coTeachers`.
- Lessons tab on the dashboard (owner request 2026-11-20): every lesson by area, with how many students have each step on their path; "Open" shows it exactly as a student sees it (same screens, practice and feedback), new problems each time, nothing saved.
- Next content area (owner, 2026-11-20): pre-algebra (order of operations, exponents, distributive property, combining like terms, one- and two-step equations). Plan: docs/PREALGEBRA-PLAN.md.
- Pre-algebra (owner answers 2026-11-20): a separate "Pre-algebra check", offered on the path after the fractions check (`moreChecks` in `curriculum/diagnostic/frac.json`; it reuses the catch-up machinery, so nothing settled is asked again). Whole-number exponents only, including 0 (no negative exponents for now). Equations with fractions at the hardest level. Area id `alg` (`curriculum/graph/alg.json`, `curriculum/misconceptions/alg.json`). Built so far: order of operations, exponents.
- Quick re-check (owner OK 2026-11-20): a question marked "can't check yet" because of a gap underneath is checked once every gap under it is fixed (its section passed, its skill mastered, or the teacher marked the foundation checked); chains reopen together. Offered on the path as "Ready for a quick check" (after any pending catch-up/pre-algebra check, and only when everything is uploaded). The server accepts only fixes it can confirm from its own records, and re-grades.
