# Apps Script Layer — Plan (draft for owner review)

Status: **draft, waiting for owner review.** Build step 6 in `docs/PLAN.md`.
Goal: the same student page and dashboard, but served by Google Apps Script and
saving to a Google Sheet, so work is no longer stuck on one device.

## 1. What Apps Script does (and nothing more)

- Serves two pages: the student app and the teacher dashboard (the same single-file builds as the previews).
- Student login with a code (`maple-tiger-42`); the device remembers it.
- Teacher login with their own Google account (Apps Script does this).
- Hands out problem seeds (from student code + attempt number), so students can't reroll for easy problems.
- Receives **one save per finished section or diagnostic**, re-grades it with the same engine code, and stores it. Never one save per question.
- Wraps every Sheet write in LockService.

All math, grading and mastery logic stays in `engine/` (already tested). Apps Script is a thin layer that can be swapped for Firebase/Supabase later.

## 2. Sheet layout (one spreadsheet, owned by the teacher)

| Tab | One row per | Columns (main ones) |
|---|---|---|
| Students | student | code, nickname, classId, createdAt, retired |
| Roster (private) | student | classId, code, realName — read only by the teacher page |
| Classes | class period | id, name, period, teacherEmail |
| Diagnostics | finished diagnostic | code, seed, answers (JSON), times, curriculumVersion, startedAt, finishedAt |
| Sections | finished section | code, section, seed, attemptNo, answers (JSON), times, scaffolds, hints, endedBy, passed, provisionalMastery, curriculumVersion, startedAt, finishedAt |
| Verifications | paper test entered | code, skillId, version, marks, score, suggested, decision, attempt, by, at |
| Clearances | foundation checked | code, gap, by, at |
| Log | change | at, by, code, what, before, after |

Answers are stored as JSON text in one cell, so a section is one row. The dashboard reads only the rows for the teacher's own classes (checked on the server), never the whole tables.

## 3. Saving (and not losing work)

1. The student finishes a section. The page saves the record to the browser first (already built), then sends it.
2. The server checks the student's code, re-creates the problems from the seed, re-grades the answers, and stores one row under LockService.
3. If the send fails (dropped Wi-Fi, sleeping Chromebook), the record stays in the outbox and is retried on the next load. Saves are tagged with an ID, so a retry never makes a duplicate row.

## 4. Files

```
server/apps-script/Code.js          doGet (serves pages), routes
server/apps-script/auth.js          student code login, teacher check (swappable)
server/apps-script/store-sheets.js  all Sheet reads/writes (swappable for Firebase later)
server/apps-script/appsscript.json  manifest
web/api/                            the ONLY browser code that talks to the server
tools/build.js                      also bundles the engine for the server
```

Tooling: `clasp` (Google's command-line tool for Apps Script) to upload the code. It's a new dev dependency, so Claude asks before adding it.

## 5. What the owner will need to do (Claude gives exact steps when it's time)

1. Choose the Google account that owns the project. A personal account is fine with pretend data; settle this and tell the school admin before any real students.
2. Create the Apps Script project and the spreadsheet (a few clicks), and allow the permissions it asks for.
3. Log in to clasp once on a computer, or paste code in by hand. Claude will recommend the simpler option.

## 6. Questions for the owner

1. Which Google account should own it for now: personal or school?
2. Should students on the same Chromebook (shared carts) be able to switch codes easily, e.g. with a "Not you? Sign out" link?
3. Is it OK for the teacher page to show real names from the private roster tab, as long as only you can open that page?
