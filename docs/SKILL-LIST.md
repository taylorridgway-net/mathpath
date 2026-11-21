# MathPath — Draft Skill List (all domains)

**Status:** draft for the owner to review. Nothing here is built except the fractions area and its prerequisite stubs.

**How to use this:** for each skill, decide **keep**, **cut**, or **merge** (with what). Write your call in the "Your call" column, or just tell Claude in chat ("cut geo.volume", "merge pct into ratio"). Once decided, each kept domain becomes a file in `curriculum/graph/`.

**What the columns mean**

- **ID**: permanent name the software uses. Changes are free until a skill is built; after that, IDs never change.
- **Needs (essential)**: the main things a student can't do this skill without. Supporting links and subskills come later, when each skill is designed in detail (like fractions was).
- **Pri** (priority):
  - **1**: common high-school gap and a prerequisite for lots of other skills. Build early.
  - **2**: important, but fewer skills depend on it.
  - **3**: Integrated Math course content more than a foundational gap. Build last, or leave to regular class instruction.
- **IM**: where it shows up most in Integrated Math 1/2/3 (rough; to be refined in `course-map.json`).

---

## Suggested changes to the brief's 17 domains

The brief's list is marked "proposed, not finalized". My suggestions (your call on each):

| Brief domain | Suggestion | Why |
|---|---|---|
| 1. Number sense | **Merge into Whole numbers** | At high school level, number-sense gaps are whole-number gaps (place value, rounding). A separate domain would have 1-2 skills. |
| 4. Fractions and decimals | **Split into Fractions and Decimals** | Already decided: decimals come later as their own area. |
| 6. Percentages | **Merge into Ratios** (as its own skills) | Percent is a ratio out of 100; the prerequisites are the same. Keeps the graph simpler. |
| 7. Algebraic foundations + 8. Expressions and properties | **Merge into one: Expressions** | It's hard to say which skills belong to which; one domain avoids arguing over it. |
| 15. Measurement | **Merge into Geometry** (unit conversion goes to Ratios) | Most measurement skills at this level are area/volume, which are geometry. |
| 17. Advanced mathematical reasoning | **Drop as a domain** | Reasoning isn't a gap you diagnose with a generated problem; it's built into word problems and lessons across every domain. |

That gives **13 domains**. The tables below use that structure.

---

## 1. Whole numbers (`whole`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `whole.place-value` | Place value, comparing, and rounding | — | 2 | — | |
| `whole.add-sub` | Add and subtract multi-digit whole numbers | place-value | 1 | — | |
| `whole.mult-div` | Multiplication/division facts, division with remainders, multi-digit | add-sub | 1 | — | |
| `whole.factors-multiples` | Factors, multiples, primes, GCF, LCM | mult-div | 1 | IM1 | |

## 2. Integers (`int`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `int.number-line` | Integers on a number line: opposites, absolute value, comparing | — | 1 | — | |
| `int.add-sub` | Add and subtract integers | int.number-line, whole.add-sub | 1 | — | |
| `int.mult-div` | Multiply and divide integers | whole.mult-div | 1 | — | |

## 3. Fractions (`frac`) — designed, see `curriculum/graph/frac.json`

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `frac.meaning` | Understand fractions | — | 1 | — | |
| `frac.equivalent` | Equivalent fractions and simplest form | frac.meaning, whole.mult-div | 1 | — | |
| `frac.compare` | Compare and order fractions | frac.meaning | 2 | — | |
| `frac.mixed` | Mixed numbers and improper fractions (supporting only, not diagnosed) | frac.meaning | 3 | — | removed (owner, 2026-11-21) |
| `frac.add-sub` | Add and subtract fractions | frac.equivalent | 1 | IM1 | |
| `frac.multiply` | Multiply fractions | frac.meaning | 1 | IM1 | |
| `frac.divide` | Divide fractions | frac.multiply | 1 | IM1 | |
| `frac.signed` | Negative fractions | int.*, frac.add-sub/multiply/divide | 1 | IM1 | |

## 4. Decimals (`dec`) — later

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `dec.place-value` | Decimal place value, comparing, rounding | whole.place-value | 2 | — | |
| `dec.add-sub` | Add and subtract decimals | dec.place-value | 2 | — | |
| `dec.mult-div` | Multiply and divide decimals | dec.place-value, whole.mult-div | 2 | — | |
| `dec.convert` | Convert between fractions and decimals (incl. repeating) | frac.meaning, dec.place-value | 1 | — | |

## 5. Ratios, proportions and percent (`ratio`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `ratio.meaning` | Ratios, rates, and unit rates | frac.meaning, whole.mult-div | 1 | — | |
| `ratio.equivalent` | Equivalent ratios and ratio tables | ratio.meaning, frac.equivalent | 2 | — | |
| `ratio.proportions` | Solve proportions | ratio.equivalent, eq.one-step | 1 | IM1, IM2 | |
| `ratio.unit-conversion` | Convert units (incl. multi-step and rates) | ratio.proportions | 2 | IM1 | |
| `ratio.proportional` | Proportional relationships (y = kx) in tables, graphs, equations | ratio.meaning, fn.coordinate-plane | 2 | IM1 | |
| `ratio.pct-meaning` | Percent as a ratio; convert percent/decimal/fraction | dec.convert | 1 | — | |
| `ratio.pct-of` | Percent problems: part, whole, percent | ratio.pct-meaning, ratio.proportions | 1 | — | |
| `ratio.pct-change` | Percent increase/decrease, discount, tax, simple interest | ratio.pct-of | 2 | IM1 | |

## 6. Expressions (`expr`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `expr.order-ops` | Order of operations (incl. integers and exponents) | int.add-sub, int.mult-div | 1 | — | |
| `expr.evaluate` | Variables; evaluate expressions by substitution (incl. negatives) | expr.order-ops | 1 | IM1 | |
| `expr.translate` | Write expressions from words | — | 2 | IM1 | |
| `expr.distributive` | Apply the distributive property (incl. negatives and subtraction) | int.mult-div | 1 | IM1 | |
| `expr.like-terms` | **Combine like terms** | int.add-sub | 1 | IM1 | |
| `expr.factor-gcf` | Factor out a greatest common factor | expr.distributive, whole.factors-multiples | 2 | IM1, IM2 | |

## 7. Equations and inequalities (`eq`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `eq.meaning` | What equality means; check a solution by substituting | expr.evaluate | 1 | IM1 | |
| `eq.one-step` | Solve one-step equations (inverse operations) | eq.meaning, int.* | 1 | IM1 | |
| `eq.two-step` | Solve two-step equations | eq.one-step | 1 | IM1 | |
| `eq.multi-step` | Multi-step: distribute, combine like terms, variables on both sides, no/infinite solutions | eq.two-step, expr.distributive, expr.like-terms | 1 | IM1 | |
| `eq.with-fractions` | Equations with fractions (incl. clearing denominators) | eq.two-step, frac.* | 2 | IM1 | |
| `eq.literal` | Rearrange formulas for a variable | eq.multi-step | 2 | IM1 | |
| `eq.write` | Write and solve equations from word problems | eq.two-step, expr.translate | 1 | IM1 | |
| `eq.inequality-graph` | Write and graph inequalities on a number line | int.number-line | 2 | IM1 | |
| `eq.inequality-solve` | Solve inequalities (incl. flipping the sign) | eq.multi-step, eq.inequality-graph | 2 | IM1 | |
| `eq.abs-value` | Absolute value equations | eq.two-step, int.number-line | 3 | IM1, IM3 | |

## 8. Exponents and radicals (`exp`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `exp.meaning` | Exponents as repeated multiplication; (−3)² vs −3² | int.mult-div | 1 | — | |
| `exp.laws` | Product, quotient, and power rules | exp.meaning | 1 | IM1, IM2 | |
| `exp.zero-negative` | Zero and negative exponents | exp.laws, frac.meaning | 2 | IM2 | |
| `exp.sci-notation` | Scientific notation | exp.zero-negative, dec.place-value | 2 | — | |
| `exp.roots` | Square and cube roots; perfect squares; estimating | exp.meaning | 1 | — | |
| `exp.simplify-radicals` | Simplify square roots and operate with radicals | exp.roots, whole.factors-multiples | 2 | IM2 | |
| `exp.rational` | Rational exponents | exp.laws, exp.roots | 3 | IM2, IM3 | |

## 9. Polynomials (`poly`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `poly.add-sub` | Add and subtract polynomials | expr.like-terms, expr.distributive | 2 | IM2 | |
| `poly.multiply` | Multiply polynomials (incl. binomial × binomial) | expr.distributive, exp.laws | 1 | IM2 | |
| `poly.factor` | Factor trinomials and special products (difference of squares, perfect squares) | poly.multiply, expr.factor-gcf | 1 | IM2 | |
| `poly.divide` | Divide polynomials | poly.multiply | 3 | IM3 | |

## 10. Functions and graphs (`fn`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `fn.coordinate-plane` | Plot and read points in all four quadrants | int.number-line | 1 | — | |
| `fn.meaning` | What a function is; f(x) notation; evaluate | expr.evaluate | 1 | IM1 | |
| `fn.slope` | Slope from a graph, two points, or a table | fn.coordinate-plane, frac.signed | 1 | IM1 | |
| `fn.linear-graph` | Graph lines from slope-intercept, point-slope, standard form | fn.slope, eq.literal | 1 | IM1 | |
| `fn.linear-write` | Write a linear equation from points, a graph, or a context | fn.slope | 1 | IM1 | |
| `fn.represent` | Connect tables, graphs, equations, and words; domain and range | fn.meaning | 2 | IM1 | |
| `fn.exponential` | Exponential growth and decay | exp.laws, ratio.pct-change | 2 | IM1, IM2 | |
| `fn.quadratic-graph` | Graph quadratics: vertex, intercepts, forms | fn.coordinate-plane, poly.multiply | 2 | IM2 | |
| `fn.quadratic-solve` | Solve quadratics (factoring, square roots, quadratic formula) | poly.factor, exp.roots | 2 | IM2 | |
| `fn.transformations` | Transformations of function graphs | fn.meaning | 3 | IM2, IM3 | |

## 11. Systems of equations (`sys`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `sys.graph` | Solve systems by graphing | fn.linear-graph | 2 | IM1 | |
| `sys.substitution` | Solve systems by substitution | eq.multi-step, eq.literal | 2 | IM1 | |
| `sys.elimination` | Solve systems by elimination | eq.multi-step | 2 | IM1 | |

## 12. Geometry and measurement (`geo`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `geo.angles` | Angle relationships (supplementary, vertical, parallel lines) | eq.two-step | 2 | IM1, IM2 | |
| `geo.area-perimeter` | Area and perimeter of polygons and circles | whole.mult-div, dec.mult-div | 2 | — | |
| `geo.volume-surface` | Volume and surface area | geo.area-perimeter | 3 | IM2 | |
| `geo.pythagorean` | Pythagorean theorem | exp.roots | 1 | IM1, IM2 | |
| `geo.coordinate` | Distance and midpoint on the coordinate plane | fn.coordinate-plane, geo.pythagorean | 2 | IM1 | |
| `geo.transformations` | Translations, reflections, rotations, dilations | fn.coordinate-plane | 3 | IM1, IM2 | |
| `geo.similarity` | Similar figures and scale factor | ratio.proportions | 2 | IM2 | |
| `geo.right-trig` | Right-triangle trigonometry | geo.similarity, eq.literal | 3 | IM2 | |

## 13. Statistics and probability (`stat`)

| ID | Skill | Needs (essential) | Pri | IM | Your call |
|---|---|---|---|---|---|
| `stat.center-spread` | Mean, median, mode, range, IQR | whole.add-sub, dec.mult-div | 2 | IM1 | |
| `stat.displays` | Dot plots, histograms, box plots | stat.center-spread | 3 | IM1 | |
| `stat.scatter` | Scatter plots and trend lines | fn.linear-write | 3 | IM1 | |
| `stat.two-way` | Two-way tables and relative frequency | ratio.pct-of | 3 | IM1, IM3 | |
| `stat.probability` | Simple and compound probability | frac.multiply | 3 | IM2 | |

---

## Totals

**80 instructional skills** across 13 domain files. For comparison: fractions alone has 8 skills and 27 subskills, so the full curriculum would be roughly 250-300 subskills. 38 skills are priority 1.

## Questions for you

1. **Domain count.** With the merges above it's 13 domain files (Whole numbers, Integers, Fractions, Decimals, Ratios, Expressions, Equations, Exponents, Polynomials, Functions, Systems, Geometry, Statistics). Happy with that?
2. **Where to stop.** Priority-3 skills (trig, polynomial division, transformations, statistics displays) are mostly course content, not foundational gaps. Should MathPath cover them at all, or stop at roughly the end of Integrated Math 2 foundations?
3. **Combining like terms** is in as `expr.like-terms` (priority 1). It's essential for `eq.multi-step` and `poly.add-sub`.
4. **Order of operations** is in Expressions, not Whole numbers, because at high school level it's almost always tested with integers and exponents. Agree?
5. **Anything missing** from your classroom experience? Common gaps that don't fit neatly anywhere are exactly what this list needs to catch.
