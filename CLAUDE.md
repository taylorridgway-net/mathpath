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
- Sections wait for the teacher: while any "with your teacher first" foundation is uncleared, the student's lessons stay locked; the teacher marks it checked in the dashboard (owner decision 2026-11-19).
- Paper tests (teacher verification): 6 items, 5 of 6 suggests "verified"; the teacher makes the final call and both the suggestion and the decision are stored (owner decision). Rule lives in `curriculum/mastery.json` ("verification"). Paper items live in `curriculum/paper/`, authored separately, answer keys checked by a test.
- Dashboard heatmap opens on the 8 whole fraction skills; clicking a skill's heading shows its subskills (owner decision).
- Class sizes to support: 1-6 periods, 20-45 students each (owner). The pretend class and the load test use that range.
- Apps Script project is owned by the owner's school Google account (owner decision). Tell the school admin before any real student data.
- Students each have their own Chromebook; still include a "Not you? Sign out" link on the student page (owner).
- The teacher page may show real names from the private roster tab (only the teacher can open it) (owner).
- Printable login-code slips: not now (owner unsure what they're for; revisit with the Apps Script login).
- Build order after the prototype (Claude's recommendation, owner considering): once the fractions prototype works end to end (dashboard, Apps Script, load test), build whole-number skills (multiplication facts, factors and multiples) before the rest of the fractions map, so foundations come from real diagnostic questions and lessons instead of "check with your teacher".
