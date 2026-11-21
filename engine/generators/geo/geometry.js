// Generators for geometry (area geo, grades 7-8): angle relationships (complementary,
// supplementary, vertical, triangle sum, parallel lines and a transversal) and the
// Pythagorean theorem. Pictures are "shape" nodes; angle answers are typed with "°" after the box.
// See engine/generators/frac/add-sub.js for what a generator returns.

const shape = (kind, labels) => ({ type: 'shape', kind, labels });
const words = (text) => ({ type: 'words', text });
const deg = (v) => `${v}°`;

function numberProblem(instruction, expression, value, suffix, mistakes) {
  const out = [];
  for (const m of mistakes) {
    if (!m || m.value == null || m.value <= 0 || !Number.isInteger(m.value)) continue;
    if (m.value === value || out.some((o) => o.v === m.value)) continue;
    out.push({ id: m.id, v: m.value });
  }
  return { instruction, expression, answer: { type: 'decimal', value: String(value), suffix }, misconceptions: out.map(({ id, v }) => ({ id, value: String(v) })) };
}

// ======================= Angles =======================

// ---------- complementary, supplementary and vertical angles ----------
//   1: supplementary (a straight line);  2: complementary (a right angle) or vertical;  3: any of them, named in words
const pairs = {
  version: 1,
  generate(rng, difficulty) {
    const kind = difficulty === 1 ? 'supp' : difficulty === 2 ? rng.pick(['comp', 'vertical']) : rng.pick(['comp', 'supp', 'vertical']);
    const a = kind === 'comp' ? rng.int(12, 78) : rng.int(25, 155);
    const value = kind === 'comp' ? 90 - a : kind === 'supp' ? 180 - a : a;
    if (difficulty === 3) {
      const name = { comp: 'complementary', supp: 'supplementary', vertical: 'vertical' }[kind];
      return numberProblem('Find the angle.', words(`Two angles are ${name}. One of them is ${a}°. What is the other?`), value, '°', [
        { id: 'geo.comp-supp-swap', value: kind === 'comp' ? 180 - a : kind === 'supp' ? 90 - a : null },
        { id: 'geo.vertical-supplementary', value: kind === 'vertical' ? 180 - a : null },
      ]);
    }
    return numberProblem('Find x.', shape(`angles-${kind}`, { a: deg(a), b: 'x' }), value, '°', [
      { id: 'geo.comp-supp-swap', value: kind === 'comp' ? 180 - a : kind === 'supp' ? 90 - a : null },
      { id: 'geo.vertical-supplementary', value: kind === 'vertical' ? 180 - a : null }, // vertical angles thought to add to 180
    ]);
  },
};

// ---------- the angles of a triangle ----------
//   1: two angles given;  2: a right triangle with one more angle;  3: an isosceles triangle (two equal angles)
const triangle = {
  version: 1,
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const apex = rng.int(10, 80) * 2;
      const base = (180 - apex) / 2;
      return numberProblem('Find one of the two equal angles.', words(`An isosceles triangle has two equal angles. The third angle is ${apex}°. How big is each of the equal angles?`), base, '°', [
        { id: 'geo.triangle-360', value: (360 - apex) / 2 },
        { id: 'geo.isosceles-not-halved', value: 180 - apex }, // forgot there are two equal angles
      ]);
    }
    const a = difficulty === 2 ? 90 : rng.int(30, 100);
    const b = rng.int(20, 170 - a - 10);
    const value = 180 - a - b;
    return numberProblem('Find x.', shape('triangle-angles', { a: deg(a), b: deg(b), c: 'x' }), value, '°', [
      { id: 'geo.triangle-360', value: 360 - a - b },
      { id: 'geo.triangle-90', value: 90 - a - b > 0 ? 90 - a - b : null },
    ]);
  },
};

// ---------- parallel lines and a transversal ----------
// Angles 1-4 at the top crossing, 5-8 at the bottom (1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right).
// With the transversal leaning right, angles 2, 3, 6, 7 are one size and 1, 4, 5, 8 the other.
//   1: corresponding angles (equal: 2 and 6);  2: alternate interior (equal) or vertical;  3: same-side interior (add to 180)
const GROUP = { 1: 'A', 4: 'A', 5: 'A', 8: 'A', 2: 'B', 3: 'B', 6: 'B', 7: 'B' };
const parallel = {
  version: 1,
  generate(rng, difficulty) {
    const pairsBy = {
      1: [[1, 5], [2, 6], [3, 7], [4, 8]], // corresponding
      2: [[3, 6], [4, 5], [1, 4], [2, 3], [5, 8], [6, 7]], // alternate interior, vertical
      3: [[3, 5], [4, 6], [1, 7], [2, 8]], // same-side interior, and an unequal pair across
    };
    let [known, ask] = rng.pick(pairsBy[difficulty]);
    if (rng.chance(0.5)) [known, ask] = [ask, known];
    const acute = rng.int(35, 80);
    const size = (n) => (GROUP[n] === 'B' ? acute : 180 - acute);
    const value = size(ask);
    return numberProblem('The two lines are parallel. Find x.', shape('parallel', { [known]: deg(size(known)), [ask]: 'x' }), value, '°', [
      { id: 'geo.parallel-equal-supp', value: GROUP[known] === GROUP[ask] ? 180 - value : size(known) }, // equal vs. adding to 180 mixed up
    ]);
  },
};

// ======================= The Pythagorean theorem =======================

const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [20, 21, 29]];

// ---------- find the hypotenuse ----------
//   1: 3-4-5 and 6-8-10;  2: other triples;  3: a word problem (a ladder, a TV's diagonal)
const hypotenuse = {
  version: 1,
  generate(rng, difficulty) {
    const [a, b, c] = difficulty === 1 ? rng.pick(TRIPLES.slice(0, 2)) : rng.pick(TRIPLES.slice(2));
    const u = rng.pick(['cm', 'm', 'in', 'ft']);
    const expression = difficulty === 3
      ? words(`A park path goes ${a} ${u} east and then ${b} ${u} north. How far is it in a straight line back to the start?`)
      : shape('right-triangle', { a: `${a} ${u}`, b: `${b} ${u}`, c: '?' });
    return numberProblem('Find the length of the longest side.', expression, c, u, [
      { id: 'geo.pythag-added', value: a + b }, // added the legs
      { id: 'geo.pythag-no-root', value: a * a + b * b }, // forgot the square root
    ]);
  },
};

// ---------- find a leg ----------
//   1: from 3-4-5 / 6-8-10;  2: other triples;  3: a word problem (a ladder against a wall)
const leg = {
  version: 1,
  alsoUses: ['geo.pythag.hypotenuse'],
  generate(rng, difficulty) {
    let [a, b, c] = difficulty === 1 ? rng.pick(TRIPLES.slice(0, 2)) : rng.pick(TRIPLES.slice(2));
    if (rng.chance(0.5)) [a, b] = [b, a];
    const u = rng.pick(['cm', 'm', 'ft']);
    const expression = difficulty === 3
      ? words(`A ${c} ${u} ladder leans against a wall. Its foot is ${a} ${u} from the wall. How high up the wall does it reach?`)
      : shape('right-triangle', { a: '?', b: `${a} ${u}`, c: `${c} ${u}` });
    return numberProblem('Find the missing side.', expression, b, u, [
      { id: 'geo.pythag-subtract-sides', value: c - a }, // subtracted the sides, not their squares
      { id: 'geo.pythag-no-root', value: c * c - a * a },
      { id: 'geo.pythag-added', value: c + a },
    ]);
  },
};

// ---------- is it a right triangle? ----------
//   1-3: three sides, in any order; right exactly when the two shorter squared add to the longest squared
const converse = {
  version: 1,
  alsoUses: ['geo.pythag.hypotenuse'],
  generate(rng, difficulty) {
    const right = rng.chance(0.5);
    let sides;
    if (right) sides = [...rng.pick(difficulty === 1 ? TRIPLES.slice(0, 2) : TRIPLES)];
    else {
      const [a, b, c] = rng.pick(TRIPLES);
      sides = [a, b, c + rng.pick([-1, 1])];
    }
    // List them with the longest side not last (level 3), so "the last one is the hypotenuse" fails.
    let shown = [...sides];
    if (difficulty === 3) shown = [sides[2], sides[0], sides[1]];
    else if (rng.chance(0.5)) shown = [sides[1], sides[0], sides[2]];
    const [p, q, r] = shown;
    const lastAsLongest = p * p + q * q === r * r;
    const misconceptions = [];
    if (lastAsLongest !== right) misconceptions.push({ id: 'geo.pythag-wrong-side', choice: lastAsLongest ? 0 : 1 });
    return {
      instruction: 'Can these be the sides of a right triangle?',
      expression: words(`The sides are ${shown.join(', ')}.`),
      answer: { type: 'choice', options: ['Yes', 'No'], correct: right ? 0 : 1 },
      misconceptions,
    };
  },
};

const parts = {
  'geo.angles.pairs': pairs,
  'geo.angles.triangle': triangle,
  'geo.angles.parallel': parallel,
  'geo.pythag.hypotenuse': hypotenuse,
  'geo.pythag.leg': leg,
  'geo.pythag.converse': converse,
};

const mixedOf = ({ covers, screener, parts: own }) => ({
  version: 1,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  ...(own ? { parts: own } : {}),
  generate(rng, difficulty) {
    const part = rng.pick(own || covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

export const geometryGenerators = {
  // Each angle idea is its own: all three asked.
  'geo.angles': mixedOf({ covers: ['geo.angles.pairs', 'geo.angles.triangle', 'geo.angles.parallel'] }),
  // Finding a leg needs the theorem the same way as the hypotenuse: it stands for both; the converse is asked too.
  'geo.pythag': mixedOf({ screener: 'geo.pythag.leg', covers: ['geo.pythag.hypotenuse', 'geo.pythag.leg'], parts: ['geo.pythag.hypotenuse', 'geo.pythag.leg', 'geo.pythag.converse'] }),
  ...parts,
};
