// Multiplying and factoring polynomials: the test reads the shown expression itself,
// multiplies independently, and checks that every right factoring is accepted (any
// order, both signs flipped), the GCF must be the greatest, and every wrong-answer
// pattern is wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `po-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/poly.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('poly.') && !generators[id].mixed);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const coef = (s) => (s === '' ? 1 : s === '-' ? -1 : Number(s));

// "(x + 8)(x + 2)", "(4x - 1)(5x + 5)", "(x - 6)^2" -> [A, B, C]
function multiplyShown(t) {
  const bins = [...t.matchAll(/\((-?\d*)x ([+-]) (\d+)\)/g)].map((m) => [coef(m[1]), (m[2] === '-' ? -1 : 1) * Number(m[3])]);
  if (t.endsWith('^2')) bins.push(bins[0]);
  assert.equal(bins.length, 2, t);
  const [[a, b], [c, d]] = bins;
  return [a * c, a * d + b * c, b * d];
}
// "3x^2 - 11x - 4", "12x + 8", "x^2 - 16" -> [A, B, C]
function readPoly(t) {
  const out = [0, 0, 0];
  for (const m of `+ ${t}`.matchAll(/([+-]) (\d*)(x\^2|x)?/g)) {
    const v = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    out[m[3] === 'x^2' ? 0 : m[3] === 'x' ? 1 : 2] += v;
  }
  return out;
}
const times = (form, b) => (form === 'binomials' ? [1, b[0] + b[1], b[0] * b[1]] : form === 'gcf' ? [0, b[0] * b[1], b[0] * b[2]]
  : form === 'product' ? b : [b[0] * b[2], b[0] * b[3] + b[1] * b[2], b[1] * b[3]]);
// Some boxes that multiply out to a polynomial (for typing a misconception's answer).
function boxesFor(form, poly) {
  const R = 40;
  if (form === 'binomials') { for (let p = -R; p <= R; p++) for (let q = -R; q <= R; q++) if (poly.every((v, i) => v === times(form, [p, q])[i])) return [p, q]; }
  if (form === 'binomials-a') {
    for (let a = 1; a <= 25; a++) for (let c = 1; c <= 25; c++) for (let b = -R; b <= R; b++) for (let d = -R; d <= R; d++) {
      if (a * c !== poly[0] || b * d !== poly[2]) continue;
      if (a * d + b * c === poly[1]) return [a, b, c, d];
    }
  }
  return null;
}

for (const id of PARTS) {
  test(`${id}: matches the shown expression; right factorings accepted; mistakes recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const a = p.answer;
      assert.equal(keypadOptionsFor(p).answerKind, 'factored');
      if (a.form === 'product') assert.deepEqual(a.boxes, multiplyShown(t), t);
      else {
        assert.deepEqual(a.poly, readPoly(t), t);
        assert.deepEqual(times(a.form, a.boxes), a.poly, `${t}: ${a.boxes}`);
      }
      assert.equal(checkAnswer(p, { boxes: a.boxes }).status, 'correct', t);
      // Any order, and both factors' signs flipped, are right too.
      if (a.form === 'binomials') assert.equal(checkAnswer(p, { boxes: [a.boxes[1], a.boxes[0]] }).status, 'correct');
      if (a.form === 'binomials-a') {
        const [w, x, y, z] = a.boxes;
        assert.equal(checkAnswer(p, { boxes: [y, z, w, x] }).status, 'correct');
        assert.equal(checkAnswer(p, { boxes: [-w, -x, -y, -z] }).status, 'correct');
      }
      if (a.form === 'gcf') {
        const [k, x, y] = a.boxes;
        assert.equal(k, gcd(a.poly[1], a.poly[2]), `${t}: the greatest common factor`);
        assert.equal(gcd(x, y), 1);
        // A smaller common factor: right but not finished.
        for (const f of [2, 3, 5]) if (k % f === 0 && k !== f) assert.equal(checkAnswer(p, { boxes: [f, (k / f) * x, (k / f) * y] }).status, 'not-simplified', t);
      }
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id), m.id);
        const boxes = m.value.boxes || boxesFor(a.form, m.value.poly);
        if (!boxes) continue; // the mistaken polynomial doesn't factor over whole numbers: nothing to type
        const r = checkAnswer(p, { boxes });
        assert.equal(r.status, 'wrong', `${t}: ${m.id} ${boxes}`);
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('factoring: wrong box counts are not graded; every catalog mistake is generated', () => {
  const p = generateProblem('poly.factor.trinomial', 'z', 1);
  assert.equal(checkAnswer(p, { boxes: [1] }).status, 'invalid');
  assert.equal(checkAnswer(p, {}).status, 'invalid');
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});
