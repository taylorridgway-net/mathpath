# Teacher Dashboard and Paper Assessments — Plan (draft for owner review)

Status: **draft, waiting for owner review.** Build step 5 in `docs/PLAN.md`.
Scope: everything a teacher needs for the fractions prototype. Built against a
**synthetic class** (pretend students run through the real engine), so it can be
tried before any server or real student exists.

---

## 1. Design idea

The dashboard is built around one question a teacher asks every day:
**"Who needs what, and who can I teach together?"** So the first screen is the
class's gaps, not a gradebook. Proficiency, platform mastery, verified mastery and
participation are always shown as separate things (CLAUDE.md, "Assessment integrity").

Built for a computer or Chromebook first (teachers plan at a desk), and still
usable on a phone. Same look as the student app.

## 2. Screens

| Screen | What the teacher sees | What the teacher can do |
|---|---|---|
| **Class overview** | Heatmap: students (rows) × fraction skills (columns). Click a skill to open its subskills. Cell colours: gap, shaky, platform mastery (provisional), verified mastery, not tested, "can't check yet". Above it: per-skill bars ("8 of 28 have verified mastery of add/subtract"). | Switch class/period; sort by most gaps; filter "inactive this week". |
| **Teach together** | Students grouped by their next path item and by wrong-answer pattern ("6 students add across: 1/2 + 1/3 = 2/5"; "4 students: check multiplication facts first"). | Print a group list; assign a section to the group. |
| **Student profile** | Diagnostic result (the teacher view already in the preview), path with progress, every section attempt with each problem re-created from its seed (answer, time, hints, misconception), platform vs verified mastery per skill, change log. | Assign or exempt sections, reorder the path, mark verified / not yet, reset the student's code. |
| **Paper assessments** | Printable test per skill, versions A and B, separate answer key page. | Print; enter each student's score; approve or reject verified mastery; record another attempt. |
| **Participation** | Per student: days active, sections finished, time on task this week. No ranking, no class leaderboard. | Set a weekly expectation (e.g. 3 sections); see who's below it. |
| **Roster** | Codes (e.g. `maple-tiger-42`), nickname, class period. Real names only in the teacher's private roster column. | Add students (generates codes), print code slips, reset a code. |

## 3. Data (what gets stored)

Everything already saved by the student app stays as is (diagnostic record, one
record per finished section). New records:

```
Student        { code, nickname, classId, createdAt, retired? }
RosterEntry    { classId, code, realName }            teacher-only, never sent to students
Class          { id, name, period, teacherEmail }
Assignment     { id, classId, target: sectionId | skillId, students: [code] | "all",
                 dueDate?, by, at }
Exemption      { code, sectionId | skillId, by, at, reason? }
Verification   { code, skillId, assessmentId, version: "A" | "B", score, outOf,
                 decision: "verified" | "not-yet", by, at, attempt }
ChangeLog      { at, by, code, what, before, after }   every change to mastery or paths
```

Mastery per skill is **worked out from records, never typed in directly**:
platform mastery comes from section records (`provisionalMastery: true`);
verified mastery comes from the latest `Verification` with `decision: "verified"`.
Both carry timestamps and the curriculum version, so time-to-mastery and
retention can be measured later.

All dashboard logic (heatmap statuses, groups, participation numbers) goes in
`engine/teacher/` as plain JavaScript with Node tests, the same way as the
diagnostic. The screens only draw.

## 4. Paper assessments

- Authored content, **not** built from the practice generators (CLAUDE.md):
  `curriculum/paper/frac.add-sub.json`, with different surface forms and some
  word problems (recipes, measuring boards, time).
- Claude drafts versions A and B (about 6 items each: 4 computation in forms the
  practice doesn't use, 2 word problems), plus answer keys. You review and edit.
- Printing uses the browser's print (one test per page, answer key on its own
  page, black and white friendly). No PDF library needed.

## 5. Files

```
engine/teacher/class-status.js     heatmap statuses from records (tested)
engine/teacher/groups.js           "teach together" groups (tested)
engine/teacher/participation.js    activity numbers (tested)
tools/simulate-class.js            synthetic class: 28 pretend students with mixed gaps,
                                   run through the real diagnostic and practice code
                                   (also the start of build step 7's load test)
curriculum/paper/frac.add-sub.json paper test items and answer keys (owner reviews)
web/teacher/                       dashboard screens
dist/teacher-preview.html          a second private preview link, with the synthetic class
```

## 6. Build order

1. Synthetic class generator + `engine/teacher/` logic with tests.
2. Class overview (heatmap) and student profile.
3. Teach-together groups and participation.
4. Paper assessment items (Claude drafts, owner reviews), printing, score entry.
5. Assignments, exemptions, path reordering, change log.
6. Second preview link for the dashboard.

## 7. Questions for the owner

1. **Verified mastery bar.** What score on the paper test counts as verified? (Suggestion: 5 of 6, with both word problems at least partly right.) Or should it always be your call per student, with the score only shown?
2. **Heatmap default.** Open on whole skills (8 columns) or subskills (about 24 columns)?
3. **Foundations flagged "check with your teacher first".** Should the student still be allowed to start the add/subtract sections, or should they wait until you clear the flag in the dashboard?
4. **Code slips.** Do you want printable slips (one code per strip, cut and hand out)?
5. **Class periods.** Roughly how many periods and students per period? (Sizes the synthetic class and the load test.)
