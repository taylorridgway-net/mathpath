# Whole Numbers — Plan (draft for owner review)

Status: **approved 2026-11-20** with the owner's answers (section 7). Owner chose "whole numbers first" (before the rest of fractions).

Goal: the foundations fractions depend on become real diagnostic questions and
lessons, so "Check with your teacher first" disappears for them. Same pattern
as fractions add/subtract: generators with tests, lesson sections, practice,
mastery, dashboard, paper tests.

## 1. Skills and subskills

Builds on the stubs already in `curriculum/graph/whole.json` (IDs kept where they exist).

| Skill | Subskills (diagnostic + one lesson section each) | Needs (essential) |
|---|---|---|
| `whole.add-sub` Add and subtract | `.add-regroup` 2- and 3-digit addition with carrying; `.sub-regroup` 2- and 3-digit subtraction with borrowing, including across zeros (503 − 278) | — |
| `whole.mult-div` Multiply and divide | `.mult-facts` facts to 12 × 12; `.div-facts` (56 ÷ 7); `.remainders` (47 ÷ 5 = 9 R 2) | `.div-facts` ← `.mult-facts`; `.remainders` ← `.div-facts` |
| `whole.factors-multiples` Factors and multiples | `.factors` list all factors, divisibility by 2, 3, 5, 9, 10; `.primes` prime or not, prime factorization; `.gcf`; `.lcm` | `whole.mult-div.mult-facts`, `.div-facts` |

Not now (owner decision): 2-digit multiplication and long division. Also not now: place value and rounding (needed for decimals, not fractions).

## 2. Diagnostic

No new diagnostic page. The fractions diagnostic already follows a gap down the
graph; once these subskills have questions, it asks them instead of marking
them "can't check yet". Example: a student misses common denominators twice,
and the diagnostic then asks a few multiplication facts. Expected effect: a few
more questions for students with foundation gaps, still within the 25-question cap.

## 3. Wrong-answer patterns (each gets a student message, like fractions)

- Subtracting the smaller digit from the larger in each column (503 − 278 → 375).
- Forgetting to carry; borrowing across a zero wrongly (503 − 278 → 335).
- Neighbouring fact (7 × 8 → 54 or 48: one group off).
- Remainder bigger than the divisor (47 ÷ 5 → 8 R 7).
- GCF/LCM swapped; listing a multiple as a factor.

## 4. Lessons and interactives

One section per subskill, same structure as fractions (explain, worked example,
guided practice with hints, check), plus "Putting it together" per skill.
Interactive, where it clearly helps: an **area model** (an array of squares
that can be split) for multiplication fact strategies, e.g. 7 × 8 = 7 × 5 + 7 × 3.
No interactive for add/subtract or factors (worked examples are clearer).

## 5. Answer input

Whole numbers already work on the keypad. New: a remainder answer, shown as
two boxes "___ R ___". Factor lists ("all factors of 24") are typed one at a
time into a growing list.

## 6. Build order

1. Graph update (`whole.json`) + generators with tests (independently re-computed answers, golden seeds).
2. Diagnostic: check that fraction gaps now trace into whole numbers correctly (simulated students).
3. Keypad: remainder and list answers.
4. Lesson text (Claude drafts; owner reviews in the preview) + area model.
5. Dashboard: whole-number skills in the heatmap; paper tests for each skill (authored separately, answer keys checked).

## 7. Owner's answers (2026-11-20)

1. **Speed for facts:** a right multiplication or division fact answered slowly (more than about 5 seconds) counts as **shaky** (Quick review), not known. Speed is never shown to students and never used for participation.
2. **Facts section check:** 10 facts drawn mostly from the hard ones (6-9 and 12); pass at 9 of 10 right on the first try.
3. **Multi-digit:** 2- and 3-digit addition and subtraction with regrouping, yes. 2-digit multiplication and long division, not now.
4. **Primes:** include prime or not, and prime factorization.
