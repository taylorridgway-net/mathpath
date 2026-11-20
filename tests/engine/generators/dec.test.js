// Decimals: every answer re-worked here independently, with exact fractions read
// from the problem's own text (never floating point), and every wrong-answer
// pattern checked to be wrong, recognised, and pointing at a decimals subskill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';
import { fraction, add, sub, mul, div, compare, reduce } from '../../../engine/math/fraction.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `dec-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/dec.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('dec.') && !generators[id].mixed);
const SKILLS = Object.keys(generators).filter((id) => id.startsWith('dec.') && generators[id].mixed);

// A number in the problem's text, as an exact fraction: "3.25", "7", "3 45/100", "7/100".
function num(t) {
  t = t.trim();
  let m = /^(\d+) (\d+)\/(\d+)$/.exec(t);
  if (m) return fraction(Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3]));
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return fraction(Number(m[1]), Number(m[2]));
  m = /^(\d*)\.(\d+)$/.exec(t);
  if (m) return fraction(Number(`${m[1]}${m[2]}`), 10 ** m[2].length);
  assert.match(t, /^\d+$/, `a number: "${t}"`);
  return fraction(Number(t), 1);
}
const typedValue = (p) => {
  const a = p.answer;
  if (a.type === 'decimal') return num(a.value);
  if (a.type === 'fraction') return a.value;
  return fraction(a.value, 1);
};
// Exact text of a fraction's value, for comparing (ends: only 2s and 5s below).
const same = (x, y) => compare(x, y) === 0;

function expected(p) {
  const text = toText(p.expression);
  const ins = p.instruction;
  if (/^Write as a decimal|^Write as a fraction/.test(ins)) return num(text);
  if (/^Which digit is in the (\w+) place/.test(ins)) {
    const place = ['tenths', 'hundredths', 'thousandths'].indexOf(/the (\w+) place/.exec(ins)[1]);
    return fraction(Number(text.split('.')[1][place]), 1);
  }
  if (/^Round to the nearest (\w+)/.test(ins)) {
    const to = ['whole number', 'tenth', 'hundredth'].findIndex((w) => ins.includes(w));
    const x = num(text);
    const scale = 10 ** to;
    // Round half up, exactly: floor(x * scale + 1/2) / scale.
    const shifted = add(mul(x, fraction(scale)), fraction(1, 2));
    return fraction(Math.floor(shifted.n / shifted.d), scale);
  }
  const m = /^(.+) ([+\-×÷]) (.+)$/.exec(text);
  assert.ok(m, `an operation: ${text}`);
  const [a, b] = [num(m[1]), num(m[3])];
  return { '+': add, '-': sub, '×': mul, '÷': div }[m[2]](a, b);
}

for (const id of PARTS) {
  test(`${id}: answers re-worked exactly from the shown problem; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const text = toText(p.expression);
      if (p.answer.type === 'choice') {
        const [a, b] = text.split(' ? ').map(num);
        assert.equal(p.answer.correct, compare(a, b) + 1, text);
      } else {
        const want = expected(p);
        assert.ok(same(typedValue(p), want), `${p.instruction} ${text}: ${JSON.stringify(p.answer)} vs ${want.n}/${want.d}`);
        if (p.answer.type === 'fraction') assert.deepEqual(p.answer.value, reduce(want), 'stored in simplest form');
      }
      // The right answer, typed the way the keypad sends it, is accepted.
      const a = p.answer;
      const right = a.type === 'decimal' ? { decimal: a.value } : a.type === 'choice' ? { choice: a.correct }
        : a.type === 'fraction' ? { num: a.value.n, den: a.value.d } : { whole: a.value };
      assert.equal(checkAnswer(p, right).status, 'correct', `${text}: ${JSON.stringify(right)}`);
      if (a.type === 'decimal') assert.equal(keypadOptionsFor(p).answerKind, 'decimal');
      for (const mis of p.misconceptions) {
        assert.ok(catalog.get(mis.id)?.startsWith('dec.'), `${mis.id} is in the catalog`);
        const raw = a.type === 'decimal' ? { decimal: mis.value } : a.type === 'choice' ? { choice: mis.choice }
          : a.type === 'fraction' ? { num: mis.value.n, den: mis.value.d } : { whole: mis.value };
        const r = checkAnswer(p, raw);
        assert.equal(r.status, 'wrong', `${text}: ${mis.id} ${JSON.stringify(raw)}`);
        assert.equal(r.misconception, mis.id);
      }
    }
  });
}

test('levels do what they say: hundredths and thousandths, traps, zeros', () => {
  const texts = (id, d) => SEEDS.map((s) => generateProblem(id, s, d));
  // Compare level 2 always has the "longer is bigger" trap.
  assert.ok(texts('dec.place-value.compare', 2).every((p) => p.misconceptions.some((m) => m.id === 'dec.longer-is-larger')));
  // Place value level 2 has 7/100-style questions; level 3 thousandths.
  assert.ok(texts('dec.place-value.read', 2).some((p) => p.answer.value === '0.0' + p.expression.n));
  assert.ok(texts('dec.place-value.read', 3).some((p) => p.expression.d === 1000));
  // Adding: level 2 mixes 1 and 2 decimal places.
  assert.ok(texts('dec.add-sub.line-up', 2).every((p) => toText(p.expression).split(/ [+-] /).map((x) => x.split('.')[1]?.length).sort().join() === '1,2'));
  // Dividing by a decimal: level 3 has decimal answers.
  assert.ok(texts('dec.divide.by-decimal', 3).some((p) => p.answer.value.includes('.')));
  // No answer is negative, and none uses floating-point junk (0.30000000000000004).
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const p of texts(id, d)) {
    if (p.answer.type === 'decimal') assert.match(p.answer.value, /^\d+(\.\d{1,4})?$/, `${id}: ${p.answer.value}`);
    assert.doesNotMatch(toText(p.expression), /\d{6,}/, `${id}: ${toText(p.expression)}`);
  }
});

test('whole skills: a mix of their parts; the diagnostic screeners are parts the graph knows', () => {
  for (const id of SKILLS) {
    const g = generators[id];
    if (g.screener) assert.ok(PARTS.includes(g.screener), id);
    const seen = new Set(SEEDS.slice(0, 120).map((s) => generateProblem(id, s, 2).part));
    assert.deepEqual([...seen].sort(), [...(g.parts || g.covers)].sort(), id);
  }
});

test('every wrong-answer pattern in the catalog is generated somewhere', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of PARTS) for (const d of DIFFICULTIES) for (const m of generateProblem(id, seed, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});
