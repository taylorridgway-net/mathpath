# Ratios, rates and percents plan

Owner (2026-11-20): agreed to build this next (Claude's recommendation: the biggest gap left for
Integrated Math 1: unit rates, proportions, percents, percent change; slope is a rate). Claude's
defaults below; the owner can change any of them.

## Skills (graph: `curriculum/graph/rat.json`, area id `rat`, "Ratios and percents")

| Skill | Parts (diagnostic subskills) | Rests on |
|---|---|---|
| Ratios and rates (`rat.ratios`) | equivalent ratios (3 : 4 = 12 : ?); unit rate ($12 for 4 -> $3 each); proportions (x/6 = 10/15) | multiplication and division facts; equivalent fractions |
| Percents (`rat.percent`) | percent ↔ decimal and fraction (35% = 0.35, 3/5 = 60%); percent of a number (15% of 60); what percent? (12 is what percent of 48) | decimal place value; fractions and decimals |
| Percent change (`rat.percent-change`) | the new amount after an increase or decrease (a $40 jacket, 25% off); the percent change (50 -> 40 is a 20% decrease) | percent of a number; what percent |

Out for now: percents over 100% beyond simple cases, ratio tables
as a picture-only question type, graphs of proportional relationships (later, with linear functions).

## Decisions (Claude's defaults)

- Word problems are short and plain (money, recipes, speeds, sports, sales), with the numbers chosen so
  the arithmetic stays fact-sized; the point is the reasoning, not long division.
- Percent answers are typed as the number, with a "%" shown after the box (students don't type the sign).
  Money answers show "$" before the box and accept 2.5 or 2.50.
- Percent change: the student says increase or decrease by the wording of the question
  ("what percent decrease"), so the answer is a plain percent.
- A "Ratios and percents check" comes after the decimals check (one check at a time, as now).

## Progress
- **Built (2026-11-20):** graph, generators (8 parts, 3 levels, 18 wrong-answer patterns), worked solutions, lessons
  (ratio table, hundredths grids), paper tests A/B, the Ratios and percents check (after the decimals check).
  400 pretend students: median 7 questions, max 14, none at the limit; knows everything: 6.
- Waiting on the owner: review of the drafts; the defaults above.
- **Built (2026-11-21, owner: "ratios ... sound good to build next"):** scale drawings and maps (`rat.ratios.scale`; a right
  proportion credits it in the diagnostic, since a scale is a proportion) and simple interest (`rat.percent-change.interest`,
  I = P × r × t, the interest or the total, saving or borrowing; asked on its own). Answers show the unit after the box
  (miles, cm, feet). Lesson steps and paper items added. Ratios check: median 8 questions, max 16; knows everything: 7.
