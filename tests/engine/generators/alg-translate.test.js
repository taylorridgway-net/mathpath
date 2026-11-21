// Writing expressions and equations from words: the test has its own small reader for
// the phrases ("5 less than twice a number" -> 2x − 5), written separately from the
// generator, and checks every answer and every wrong-answer pattern against it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `tr-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const MULT = { twice: 2, 'three times': 3, 'four times': 4, 'five times': 5, 'six times': 6 };

// A phrase about "a number" as [a, b] meaning ax + b.
function read(p) {
  p = p.toLowerCase();
  const times = (w) => MULT[w];
  let m;
  if ((m = /^(\d+) more than a number$/.exec(p))) return [1, +m[1]];
  if ((m = /^a number increased by (\d+)$/.exec(p))) return [1, +m[1]];
  if ((m = /^a number decreased by (\d+)$/.exec(p))) return [1, -m[1]];
  if ((m = /^(\d+) less than a number$/.exec(p))) return [1, -m[1]];
  if ((m = /^the product of (\d+) and a number$/.exec(p))) return [+m[1], 0];
  if ((m = /^(twice|\w+ times) a number$/.exec(p))) return [times(m[1]), 0];
  if ((m = /^(\d+) less than (twice|\w+ times) a number$/.exec(p))) return [times(m[2]), -m[1]];
  if ((m = /^(\d+) more than (twice|\w+ times) a number$/.exec(p))) return [times(m[2]), +m[1]];
  if ((m = /^(twice|\w+ times) a number, decreased by (\d+)$/.exec(p))) return [times(m[1]), -m[2]];
  if ((m = /^the product of (\d+) and a number, plus (\d+)$/.exec(p))) return [+m[1], +m[2]];
  if ((m = /^(\d+) decreased by (twice|\w+ times) a number$/.exec(p))) return [-times(m[2]), +m[1]];
  if ((m = /^subtract (twice|\w+ times) a number from (\d+)$/.exec(p))) return [-times(m[1]), +m[2]];
  if ((m = /^(twice|\w+ times) the sum of a number and (\d+)$/.exec(p))) return [times(m[1]), times(m[1]) * m[2]];
  if ((m = /^(twice|\w+ times) the difference of a number and (\d+)$/.exec(p))) return [times(m[1]), -times(m[1]) * m[2]];
  throw new Error(`can't read "${p}"`);
}

function expected(p) {
  const t = toText(p.expression);
  if (p.answer.type === 'linear') return read(t);
  let m;
  if ((m = /^(.+) is (negative )?(\d+)\. What is the number\?$/.exec(t))) {
    const [a, b] = read(m[1]);
    const total = (m[2] ? -1 : 1) * Number(m[3]);
    return (total - b) / a;
  }
  // Stories: start + rate × n = total. The start, rate and total are the money/size amounts in order.
  const nums = [...t.matchAll(/\$?(\d+)/g)].map((x) => Number(x[1]));
  const [start, rate, total] = nums;
  return (total - start) / rate;
}

for (const id of ['alg.translate.expression', 'alg.translate.equation']) {
  test(`${id}: answers match an independent reading of the words; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(p);
      const a = p.answer;
      if (a.type === 'linear') {
        assert.deepEqual([a.coef, a.constant], want, t);
        assert.equal(keypadOptionsFor(p).answerKind, 'linear');
        assert.equal(checkAnswer(p, { coef: a.coef, constant: a.constant }).status, 'correct');
      } else {
        assert.ok(Number.isInteger(want) && want > 0, `${t}: ${want}`);
        assert.equal(a.value.n / a.value.d, want, t);
        assert.equal(checkAnswer(p, { whole: want }).status, 'correct');
      }
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id), m.id);
        const raw = a.type === 'linear' ? { coef: m.value.coef, constant: m.value.constant }
          : m.value.d === 1 ? { whole: Math.abs(m.value.n), ...(m.value.n < 0 ? { negative: true } : {}) } : { num: Math.abs(m.value.n), den: m.value.d, ...(m.value.n < 0 ? { negative: true } : {}) };
        const r = checkAnswer(p, raw);
        assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
        assert.equal(r.misconception, m.id);
      }
    }
  });
}

test('translating: the classic order mistake is caught ("4 less than x" written 4 − x)', () => {
  const p = SEEDS.map((s) => generateProblem('alg.translate.expression', s, 1)).find((q) => / less than a number/.test(toText(q.expression)));
  const r = checkAnswer(p, { coef: -1, constant: -p.answer.constant });
  assert.equal(r.misconception, 'alg.translate-order');
});

test('translating: every translating mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const id of ['alg.translate.expression', 'alg.translate.equation']) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  for (const id of [...catalog].filter(([, to]) => to.startsWith('alg.translate')).map(([k]) => k)) assert.ok(seen.has(id), id);
});
