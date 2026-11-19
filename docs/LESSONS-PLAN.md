# Lessons and Practice — Plan (draft for owner review)

Status: **approved by the owner (2026-11-19).** Answers to the open questions are at the bottom and in CLAUDE.md ("Decided details").

Scope: lessons and practice for `frac.add-sub` only. Everything is designed to be reused for the other fraction skills.

---

## 1. Where lessons fit in the student flow

1. Student takes the diagnostic.
2. Their path is the diagnostic's root gaps, foundations first (e.g. "Add or subtract numerators" before "Simplify the result").
3. Each item on the path opens the matching lesson section. Students only see sections for their gaps, not the whole lesson.
4. Finishing a section's check marks that subskill as practised. Finishing the "Putting it together" section's mastery check gives **provisional platform mastery** of the skill.
5. The teacher later verifies on paper (separate assessments, not built from these generators).

## 2. Lesson structure for "Add and subtract fractions"

One section per subskill, plus one for the whole procedure (the diagnostic can find a whole-skill gap: "each step fine, whole problem missed twice").

| Section | For students whose gap is | Teaches | Visual |
|---|---|---|---|
| Find a common denominator | `frac.add-sub.common-denom` | Why we need same-size pieces; multiplying the denominators always works; a smaller one (LCM) keeps numbers easier | Fraction bars: cut 1/2 and 1/3 into the same number of pieces |
| Rewrite over the common denominator | `frac.add-sub.rewrite` | Multiply top and bottom by the same number; why adding the same number doesn't work | Same bar, re-cut into smaller pieces |
| Add or subtract numerators | `frac.add-sub.combine` | The denominator names the size of the piece, so it doesn't change; why 1/2 + 1/2 isn't 2/4 | Fraction bars: count pieces of the same size |
| Simplify the result | `frac.add-sub.simplify-result` | Divide top and bottom by a common factor; when you're done | None (text and examples are clearer here) |
| Putting it together | the whole skill | The four steps as a checklist; scaffolding fades: first each step is a separate box, then the student does it all | None |

Interactives: fraction bars only, used in three sections where seeing piece sizes is the point. Per CLAUDE.md, no interactive where it doesn't clearly help.

## 3. Inside a section

Each section follows the brief's sequence, with scaffolding that fades:

1. **Explain**: a few short paragraphs, with stacked fractions in the text.
2. **Visual** (where listed above).
3. **Worked example**: a generated problem solved step by step.
4. **Guided practice**: 2 problems; hints available; for "Putting it together", each step gets its own answer box.
5. **Check**: 3 problems, no hints.

### Feedback rules during practice

| Student answers | What happens |
|---|---|
| Right | Short confirmation, next problem |
| Right but not simplified | "Right value. Can you simplify it?" One more try (already decided) |
| Wrong, matches a known misconception | That misconception's message (e.g. for 2/5: "The bottom number is the size of the pieces...") and one more try |
| Wrong, no known pattern | A hint for this step, and one more try |
| Wrong twice, or "I'm not sure" | Show the full worked solution, step by step, then a similar problem (same kind, same difficulty) |

Worked solutions are produced by code from the problem itself (common denominator, rewrite, add, simplify), with Node tests, so every solution shown is guaranteed to match the problem.

## 4. Mastery (provisional, platform only)

Approved:

- **Section check passed:** 3 right in a row (a right answer after the "simplify" hint counts; a miss starts the count again, after the worked solution and a similar problem).
- **Skill platform mastery:** in "Putting it together", 4 of the last 5 whole problems right **on the first try**, with at least 2 at the hardest difficulty.
- **Retention check:** 2-4 weeks after mastery, 3 whole problems. (Built later, with the dashboard.)
- Platform mastery is always labelled provisional. Verified mastery only comes from the teacher's paper assessment.

## 5. Data and files

```
curriculum/lessons/frac.add-sub.json   lesson text, worked-example settings, hints,
                                       misconception messages (data, editable without code)
curriculum/mastery.json                mastery rules (data)
engine/solutions/frac-add-sub.js       step-by-step worked solutions (tested)
engine/practice/practice.js            practice session: feedback rules, retries, mastery check
                                       (pure logic, replayable from seed + answers, like the diagnostic)
web/components/fraction-bars.js        the one interactive
web/student/lesson.js                  lesson screens
```

Lesson text uses a tiny markup for math: `{3/4}` shows as a stacked fraction, `{1 3/4}` as a mixed number.

Saving: one save per section (seed, answers, timing, attempt count, curriculum version), to the browser now and to the server once the Apps Script layer exists. Never per question.

## 6. Build order

1. Worked-solution code + tests. **(Done.)**
2. Practice session logic (feedback rules, retries, mastery) + tests with simulated students. **(Done.)**
3. Lesson data file for `frac.add-sub` (Claude drafts the text; owner reviews it in the preview). **(Drafted; owner review pending.)**
4. Lesson screens + fraction bars; add to the preview link after the diagnostic.

## 7. Owner's answers (2026-11-19)

1. Mastery bar: approved as written.
2. Simplify retry: counts toward mastery, as long as the student simplifies correctly on the retry.
3. After two misses: show the worked solution, then a similar problem to try.
4. Lesson voice: no special phrases; Claude drafts, owner reviews in the preview.

## 8. Original questions

1. **Mastery bar.** Is "4 of the last 5 whole problems right on the first try, at least 2 at the hardest level" right? Too easy, too hard?
2. **Simplify retry.** Should a right answer after the "simplify" hint count toward mastery, or only toward finishing a section?
3. **After two misses**, is showing the full worked solution and moving on the right call? (Alternative: show the solution, then give a similar problem to try.)
4. **Lesson voice.** Claude will draft the text in plain, direct language for high schoolers who've struggled with this before (no "Great job!!"). Any phrases or explanations you always use in class that should be in there?
