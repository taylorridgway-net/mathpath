# Linear functions plan

Owner (2026-11-21): "keep working on whatever is next" (while away). Claude's pick: linear functions, the core of
Integrated Math 1 and the biggest area not covered. Claude's defaults below; the owner can change any of them.

## Skills (graph: `curriculum/graph/lin.json`, area id `lin`, "Linear functions")

| Skill | Parts (diagnostic subskills) | Rests on |
|---|---|---|
| Function inputs and outputs (`lin.functions`) | f(x) notation: find f(3) for f(x) = 2x − 5; read a table (the output for an input) | evaluating expressions |
| Slope (`lin.slope`) | from two points ((1, 3) and (4, 9) -> 2); from a table; from a graph (a picture of a line on a grid) | integer subtract/divide; simplifying fractions |
| Slope-intercept form (`lin.slope-intercept`) | read m and b from y = mx + b; write the equation from a slope and a y-intercept, or from a graph; from two points | slope; evaluating; two-step equations |

Answers: numbers (whole, negative, or a fraction in simplest form for slopes), and equations typed in the
two boxes `y = [ ]x + [ ]` (the expressions keypad), so classic mistakes like swapping m and b are recognised.
Graphs are pictures to read (a line through grid points), not something students draw: no new input method.

Out for now: plotting points or drawing lines, point-slope form, standard form, parallel/perpendicular,
systems of equations, linear vs. nonlinear tables, domain and range.

## Decisions (Claude's defaults)

- Slopes are exact: fractions in simplest form (−2/3), whole numbers when they divide evenly.
- Lines on graphs always pass through grid points, with the y-intercept on the grid.
- A "Linear functions check" comes after the ratios and percents check (one check at a time).
- Wrong-answer patterns: run over rise (x-change ÷ y-change), subtracting the points in mixed order
  (sign error), m and b swapped, the y-intercept read as the x-intercept, f(3) read as f × 3, input and output
  swapped in a table.

## Progress
- Built 2026-11-21: generators (seven parts, three whole skills; one "line through two points" problem screens all
  of slope-intercept form), 11 wrong-answer patterns, worked solutions, three lessons in the key-idea style,
  paper tests (A and B, answer keys checked by `tests/curriculum/paper-lin.test.js`), and the "Linear functions
  check" after the ratios and percents check.
- New pictures: x/y tables, a line on a −6..6 grid (two marked points), and the `slope-graph` lesson widget
  (tap: run, rise, slope = rise ÷ run, and where it crosses the y-axis).
- Equations are typed in `y = [ ]x + [ ]` (two boxes, each with its own sign); integer slopes there. Fraction
  slopes are answered on their own (slope questions).
- 400 pretend students, Linear functions check: median 6 questions, max 12; knows everything: 5.
