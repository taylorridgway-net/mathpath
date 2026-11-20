// Negative fractions: answers worked out here by evaluating the expression exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `sg-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const IDS = ['frac.signed', 'frac.signed.sign-placement', 'frac.signed.add-sub', 'frac.signed.mult-div'];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// [n, d] with d > 0, not simplified.
function value(e) {
  if (e.type === 'frac') return e.d < 0 ? [-e.n, -e.d] : [e.n, e.d];
  if (e.type === 'neg') { const [n, d] = value(e.of); return [-n, d]; }
  const [a, b] = value(e.left);
  const [c, d] = value(e.right);
  if (e.op === '+') return [a * d + c * b, b * d];
  if (e.op === '-') return [a * d - c * b, b * d];
  if (e.op === '×') return [a * c, b * d];
  if (e.op === '÷') return c < 0 ? [-a * d, -b * c] : [a * d, b * c];
  throw new Error(e.op);
}
const typed = (n, d) => ({ ...(d === 1 ? { whole: Math.abs(n) } : { num: Math.abs(n), den: d }), ...(n < 0 ? { negative: true } : {}) });
const simplest = ([n, d]) => { const g = gcd(Math.abs(n), d); return [n / g, d / g]; };

for (const id of IDS) {
  test(`${id}: the answer is the exact value in simplest form; mistakes are this skill's, wrong, and recognised`, () => {
    for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, diff);
      const [n, d] = simplest(value(p.expression));
      assert.equal(checkAnswer(p, typed(n, d)).status, 'correct', JSON.stringify(p.expression));
      assert.equal(checkAnswer(p, typed(-n, d)).status, 'wrong', 'the opposite sign is wrong');
      assert.equal(keypadOptionsFor(p).allowNegative, true);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id)?.startsWith('frac.signed.'), m.id);
        const r = checkAnswer(p, typed(m.value.n, m.value.d));
        assert.equal(r.status, 'wrong');
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('every problem has a negative in it; shown fractions are simplest except where simplifying is the point', () => {
  for (const diff of DIFFICULTIES) for (const seed of SEEDS) {
    for (const id of ['frac.signed.add-sub', 'frac.signed.mult-div']) {
      const e = generateProblem(id, seed, diff).expression;
      assert.ok([e.left, e.right].some((x) => x.type === 'neg'), JSON.stringify(e));
      for (const x of [e.left, e.right]) { const f = x.type === 'neg' ? x.of : x; assert.equal(gcd(f.n, f.d), 1); }
    }
    const e = generateProblem('frac.signed.sign-placement', seed, diff).expression;
    assert.ok(e.n < 0 || e.d < 0);
  }
});

test('the classic sign mistakes are all generated', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of IDS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  for (const id of [...catalog].filter(([, to]) => to.startsWith('frac.signed.')).map(([k]) => k)) assert.ok(seen.has(id), id);
});
