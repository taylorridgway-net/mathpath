# Decimals plan

Owner (2026-11-20): "What's next to build? Figure it out and go for it ... Decimals or something?"
CLAUDE.md had decimals out of the fractions map, to come later as their own area. This is that area.
Claude's defaults below; the owner can change any of them.

## Skills (graph: `curriculum/graph/dec.json`, area id `dec`)

| Skill | Parts (diagnostic subskills) | Rests on |
|---|---|---|
| Understand decimals (`dec.place-value`) | read place value (0.07 = 7/100, write 3/100 as 0.03); compare (0.5 vs 0.45); round | fractions with 10/100/1000 (`frac.meaning`) |
| Fractions and decimals (`dec.convert`) | fraction to decimal (3/4 = 0.75, 3/8 = 0.375); decimal to fraction in simplest form (0.35 = 7/20) | equivalent fractions, simplifying |
| Add and subtract decimals (`dec.add-sub`) | line up the points (3.5 + 1.25); a whole number and a decimal (6 − 2.35) | whole-number add/subtract with regrouping |
| Multiply decimals (`dec.multiply`) | by 10, 100, 1000 and by 0.1, 0.01 (the point moves); multiply decimals (0.3 × 0.2 = 0.06) | multiplication facts |
| Divide decimals (`dec.divide`) | by a whole number (4.8 ÷ 6); by a decimal (2.4 ÷ 0.3: move both points) | division facts |

Later additions: negative decimals and repeating decimals (built 2026-11-21). Percents are in the ratios area. Long division: not building (owner, calculators).
Division problems keep to fact-sized digits (long division is out for whole numbers too).

## Decisions (Claude's defaults)

- **Answers are typed with a "." key** on the keypad (one box, up to 7 characters). ".5" and "0.5" both count.
  **Trailing zeros are accepted** (0.50 = 0.5 is right, no "simplify" retry): they don't change the value, and
  writing 0.50 is a useful strategy when comparing. Fractions from "decimal to fraction" must be in simplest form (as everywhere).
- **Compare** is answered with the <, =, > buttons, like fractions.
- **Pictures:** a place-value chart (digits slide left/right when multiplying or dividing by 10, 100),
  a hundredths grid, and the column picture lining up the decimal points.
- **Decimals check:** a separate check offered on the path after the pre-algebra check (`moreChecks`),
  same machinery (nothing settled is asked again).
- Wrong-answer patterns: "longer is bigger" (0.45 > 0.5), "shorter is bigger", lining up the right ends
  (3.5 + 1.25 = 1.60), dropping the whole number (6 − 2.35 = 4.35), point placed from one factor (0.3 × 0.2 = 0.6),
  moving the point the wrong way (4.5 × 10 = 0.45), adding a zero (2.5 × 10 = 2.50), moving only one point
  (2.4 ÷ 0.3 = 0.8), place value (3/100 = 0.3), 0.35 = 35/10.

## Progress
- **Built (2026-11-20):** decimal input ("." key, exact decimals), graph, generators (11 parts, 3 levels, 16 wrong-answer patterns),
  worked solutions (column picture with the points lined up), lessons in the picture style (place-value chart, hundredths grids),
  paper tests A/B for all five skills (keys checked by tests/curriculum/paper-dec.test.js), the Decimals check (after the
  pre-algebra check). 400 pretend students: median 10 questions, 90th percentile 14, max 21, none at the limit; one who knows
  everything: 8. No gap reported that the pretend student could actually do.
- Waiting on the owner: review the lessons and paper items; the defaults above.
- **Built (2026-11-21, owner: "decimals ... sound good to build next"):** negative decimals (`dec.signed`: add/subtract,
  multiply/divide; each part asked in the diagnostic, like negative fractions; number line in the lesson) and repeating
  decimals (`dec.convert.repeating`: pick 2/3 = 0.666… from buttons, "does it end or repeat?", 0.555… = 5/9 and
  0.2727… = 3/11 with the 10x − x reasoning in the worked solution). Paper test for negative decimals; one repeating item
  per version in the fractions-and-decimals paper. Decimals check with 400 pretend students: median 13, max 21; knows everything: 11.
