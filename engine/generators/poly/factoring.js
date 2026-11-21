// Generators for "Polynomials and factoring" (area poly): multiplying binomials, and
// factoring (greatest common factor, x² + bx + c, difference of squares, ax² + bx + c).
// Answers are typed into a factored-form template (web/components/factor-pad.js):
// answer type 'factored' with a form ('product' | 'binomials' | 'gcf' | 'binomials-a'),
// the polynomial [A, B, C] (Ax² + Bx + C) and one right way to fill the boxes. The grader
// accepts any boxes whose product is the polynomial (either order, both signs flipped);
// a common factor that isn't the greatest gets one more try ("not-simplified").
// See engine/generators/frac/add-sub.js for what a generator returns.

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const x = { type: 'var', name: 'x' };
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const termX = (c, exp) => (c === 1 && !exp ? x : { type: 'term', coef: c, name: 'x', ...(exp ? { exp } : {}) });

// Ax² + Bx + C as an expression node (zero terms left out; signs as operations).
export function polyNode([A, B, C]) {
  const parts = [];
  if (A) parts.push({ c: A, node: (v) => termX(v, 2) });
  if (B) parts.push({ c: B, node: (v) => termX(v) });
  if (C) parts.push({ c: C, node: (v) => int(v) });
  let e = parts[0].node(parts[0].c);
  for (const p of parts.slice(1)) e = op(p.c < 0 ? '-' : '+', e, p.node(Math.abs(p.c)));
  return e;
}
// (ax + b) as a node.
const binomial = (a, b) => (b === 0 ? termX(a) : op(b < 0 ? '-' : '+', termX(a), int(Math.abs(b))));
const factorsNode = (pairs) => ({ type: 'factors', items: pairs.map(([a, b]) => binomial(a, b)) });
const timesOut = ([a, b], [c, d]) => [a * c, a * d + b * c, b * d];

function factored(instruction, expression, form, poly, boxes, mistakes) {
  const same = (p, q) => p.every((v, i) => v === q[i]);
  const out = [];
  for (const m of mistakes) {
    if (!m || (!m.poly && !m.boxes)) continue;
    if (m.poly && same(m.poly, poly)) continue;
    if (m.boxes && same(m.boxes, boxes)) continue;
    const key = JSON.stringify(m.poly || m.boxes);
    if (out.some((o) => JSON.stringify(o.value.poly || o.value.boxes) === key)) continue;
    out.push({ id: m.id, value: m.poly ? { poly: m.poly } : { boxes: m.boxes } });
  }
  return { instruction, expression, answer: { type: 'factored', form, poly, boxes }, misconceptions: out };
}

// ======================= Multiply binomials =======================

// ---------- (x + a)(x + b) ----------
//   1: both positive;  2: negatives;  3: squares and conjugates ((x + 4)², (x + 5)(x − 5))
const multiplyBinomials = {
  version: 1,
  generate(rng, difficulty) {
    let a; let b; let square = false;
    if (difficulty === 1) [a, b] = [rng.int(1, 9), rng.int(1, 9)];
    else if (difficulty === 2) { [a, b] = [nonZero(rng, -9, 9), nonZero(rng, -9, 9)]; if (a > 0 && b > 0) b = -b; } else {
      a = nonZero(rng, -9, 9);
      if (rng.chance(0.5)) { b = a; square = true; } else b = -a;
    }
    const poly = timesOut([1, a], [1, b]);
    const expression = square ? { type: 'pow', base: { type: 'group', of: binomial(1, a) }, exp: 2 } : factorsNode([[1, a], [1, b]]);
    return factored('Multiply. Write the answer as ax² + bx + c.', expression, 'product', poly, poly, [
      { id: 'poly.foil-middle', boxes: [1, 0, a * b] }, // (x + 4)² = x² + 16
      { id: 'poly.foil-last-added', boxes: [1, a + b, a + b] }, // added the last terms
      { id: 'poly.foil-sign', boxes: a * b < 0 ? [1, a + b, -a * b] : null }, // lost the sign of the last term
    ]);
  },
};

// ---------- (ax + b)(cx + d) ----------
//   1: (2x + 3)(x + 4);  2: with negatives;  3: both leading numbers over 1 ((2x − 1)(3x + 5))
const multiplyLeading = {
  version: 1,
  alsoUses: ['poly.multiply.binomials'],
  generate(rng, difficulty) {
    const a = rng.int(2, 5);
    const c = difficulty === 3 ? rng.int(2, 4) : 1;
    let [b, d] = difficulty === 1 ? [rng.int(1, 7), rng.int(1, 7)] : [nonZero(rng, -7, 7), nonZero(rng, -7, 7)];
    if (difficulty > 1 && b > 0 && d > 0) d = -d;
    const pairs = rng.chance(0.5) ? [[a, b], [c, d]] : [[c, d], [a, b]];
    const poly = timesOut([a, b], [c, d]);
    return factored('Multiply. Write the answer as ax² + bx + c.', factorsNode(pairs), 'product', poly, poly, [
      { id: 'poly.foil-middle', boxes: [a * c, 0, b * d] },
      { id: 'poly.foil-one-middle', boxes: [a * c, a * d, b * d] }, // only the outer product
      { id: 'poly.foil-one-middle', boxes: [a * c, b * c, b * d] }, // only the inner product
      { id: 'poly.foil-last-added', boxes: [a * c, a * d + b * c, b + d] },
    ]);
  },
};

// ======================= Factoring =======================

// ---------- greatest common factor ----------
//   1: 6x + 9 = 3(2x + 3);  2: a minus sign (10x − 15) and bigger factors;  3: the GCF hides (12x + 18 = 6(2x + 3), not 2 or 3)
const gcfFactor = {
  version: 1,
  ifNotSimplified: 'whole.factors-multiples.gcf',
  generate(rng, difficulty) {
    let k; let a; let b;
    do {
      k = difficulty === 3 ? rng.pick([6, 8, 9, 10, 12]) : rng.int(2, difficulty === 1 ? 5 : 9);
      a = rng.int(1, difficulty === 3 ? 5 : 6);
      b = difficulty === 1 ? rng.int(1, 7) : nonZero(rng, -7, 7);
    } while (gcd(a, b) !== 1 || (a === 1 && difficulty === 3));
    const poly = [0, k * a, k * b];
    return factored('Factor out the greatest common factor.', polyNode(poly), 'gcf', poly, [k, a, b], [
      { id: 'poly.gcf-one-term', boxes: [k, a, k * b] }, // divided only the first term
      { id: 'poly.gcf-one-term', boxes: [k, k * a, b] },
      { id: 'poly.gcf-subtracted', boxes: [k, k * a - k, k * b - k] }, // took k away instead of dividing
    ]);
  },
};

// ---------- x² + bx + c ----------
//   1: both numbers positive (x² + 7x + 12);  2: c negative (x² + 2x − 15);  3: both negative, bigger (x² − 13x + 36)
const trinomial = {
  version: 1,
  alsoUses: ['poly.multiply.binomials'],
  generate(rng, difficulty) {
    let p; let q;
    do {
      if (difficulty === 1) [p, q] = [rng.int(1, 9), rng.int(1, 9)];
      else if (difficulty === 2) [p, q] = [rng.int(1, 9), -rng.int(1, 9)];
      else [p, q] = [-rng.int(2, 12), -rng.int(2, 9)];
    } while (p + q === 0);
    const poly = timesOut([1, p], [1, q]);
    // Another factor pair of c, with the wrong sum.
    const c = p * q;
    const pairs = [];
    for (let r = 1; r <= Math.abs(c); r++) if (c % r === 0) for (const s of [r, -r]) pairs.push([s, c / s]);
    const other = pairs.find(([r, s]) => r + s !== p + q && Math.sign(r + s) === Math.sign(p + q));
    return factored('Factor.', polyNode(poly), 'binomials', poly, [p, q], [
      { id: 'poly.factor-signs', poly: timesOut([1, -p], [1, -q]) }, // both signs flipped
      other ? { id: 'poly.factor-sum', poly: timesOut([1, other[0]], [1, other[1]]) } : null, // multiply to c, wrong sum
    ]);
  },
};

// ---------- difference of squares ----------
//   1: x² − 25;  2: x² − 81, x² − 1;  3: 4x² − 9 ((2x + 3)(2x − 3))
const diffSquares = {
  version: 1,
  alsoUses: ['poly.factor.trinomial'],
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const [a, b] = rng.pick([[2, 3], [2, 5], [3, 1], [3, 2], [3, 4], [2, 1], [5, 2], [4, 3]]);
      const poly = [a * a, 0, -b * b];
      return factored('Factor.', polyNode(poly), 'binomials-a', poly, [a, b, a, -b], [
        { id: 'poly.diff-squares-same-sign', poly: timesOut([a, -b], [a, -b]) },
        { id: 'poly.diff-squares-same-sign', poly: timesOut([a, b], [a, b]) },
      ]);
    }
    const a = difficulty === 1 ? rng.int(2, 6) : rng.pick([1, 7, 8, 9, 10, 11, 12]);
    const poly = [1, 0, -a * a];
    return factored('Factor.', polyNode(poly), 'binomials', poly, [a, -a], [
      { id: 'poly.diff-squares-same-sign', poly: timesOut([1, -a], [1, -a]) }, // (x − 5)(x − 5)
      { id: 'poly.diff-squares-same-sign', poly: timesOut([1, a], [1, a]) },
    ]);
  },
};

// ---------- ax² + bx + c ----------
//   1: (2x + 1)(x + 3) = 2x² + 7x + 3;  2: with negatives;  3: both leading numbers over 1 (6x² + 7x − 3)
const leading = {
  version: 1,
  alsoUses: ['poly.factor.trinomial', 'poly.multiply.leading'],
  generate(rng, difficulty) {
    for (;;) {
      const a = difficulty === 3 ? rng.int(2, 3) : rng.pick([2, 3, 5]);
      const c = difficulty === 3 ? rng.int(2, 3) : 1;
      let [b, d] = difficulty === 1 ? [rng.int(1, 5), rng.int(1, 5)] : [nonZero(rng, -5, 5), nonZero(rng, -5, 5)];
      if (difficulty > 1 && b > 0 && d > 0) d = -d;
      if (gcd(a, b) !== 1 || gcd(c, d) !== 1) continue; // each factor has no common factor of its own
      const poly = timesOut([a, b], [c, d]);
      if (poly[1] === 0) continue;
      const swapped = timesOut([a, d], [c, b]); // the right numbers in the wrong places
      return factored('Factor.', polyNode(poly), 'binomials-a', poly, [a, b, c, d], [
        { id: 'poly.factor-placement', poly: swapped[1] !== poly[1] ? swapped : null },
        { id: 'poly.factor-signs', poly: timesOut([a, -b], [c, -d]) },
      ]);
    }
  },
};

const parts = {
  'poly.multiply.binomials': multiplyBinomials,
  'poly.multiply.leading': multiplyLeading,
  'poly.factor.gcf': gcfFactor,
  'poly.factor.trinomial': trinomial,
  'poly.factor.diff-squares': diffSquares,
  'poly.factor.leading': leading,
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

export const factoringGenerators = {
  // (2x − 1)(3x + 5) needs everything (x + a)(x + b) does: it stands for both.
  'poly.multiply': mixedOf({ screener: 'poly.multiply.leading', covers: ['poly.multiply.binomials', 'poly.multiply.leading'] }),
  // Factoring 2x² + 7x + 3 shows x² + bx + c too; the GCF and difference of squares are their own ideas: asked.
  'poly.factor': mixedOf({ screener: 'poly.factor.leading', covers: ['poly.factor.trinomial', 'poly.factor.leading'], parts: ['poly.factor.gcf', 'poly.factor.trinomial', 'poly.factor.diff-squares', 'poly.factor.leading'] }),
  ...parts,
};
