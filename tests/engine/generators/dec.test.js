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
  t = t.trim().replace(/^\((.*)\)$/, '$1');
  if (/^[-−]/.test(t)) { const f = num(t.slice(1)); return fraction(-f.n, f.d); }
  // A repeating decimal "0.555…" / "0.2727…" / "0.1666…": find the repeating block and work it out exactly.
  if (t.endsWith('…')) {
    const digits = t.slice(2, -1);
    for (let start = 0; start < digits.length; start++) for (let len = 1; start + 2 * len <= digits.length; len++) {
      const block = digits.slice(start, start + len);
      if (digits.slice(start).split('').every((c, i) => c === block[i % len]) && digits.length - start >= 2 * len) {
        const head = start ? fraction(Number(digits.slice(0, start)), 10 ** start) : fraction(0);
        return add(head, fraction(Number(block), (10 ** len - 1) * 10 ** start));
      }
    }
    assert.fail(`no repeating block in ${t}`);
  }
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
// A decimal the way the keypad sends it: the (−) key is a flag, not part of the digits.
const typedDecimal = (v) => (v.startsWith('-') ? { decimal: v.slice(1), negative: true } : { decimal: v });

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
  const m = /^(.+?) ([+\-×÷]) (.+)$/.exec(text);
  assert.ok(m, `an operation: ${text}`);
  const [a, b] = [num(m[1]), num(m[3])];
  return { '+': add, '-': sub, '×': mul, '÷': div }[m[2]](a, b);
}

for (const id of PARTS) {
  test(`${id}: answers re-worked exactly from the shown problem; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const text = toText(p.expression);
      if (p.answer.type === 'choice' && /end, or repeat/.test(p.instruction)) {
        // Ends exactly when the simplified denominator has no prime factors but 2 and 5.
        let d = reduce(num(text)).d;
        for (const q of [2, 5]) while (d % q === 0) d /= q;
        assert.equal(p.answer.options[p.answer.correct], d === 1 ? 'It ends' : 'It repeats', text);
      } else if (p.answer.type === 'choice' && /Which decimal/.test(p.instruction)) {
        // Exactly one option equals the fraction, and it's the marked one.
        const equal = p.answer.options.map((o, i) => (same(num(o), num(text)) ? i : -1)).filter((i) => i >= 0);
        assert.deepEqual(equal, [p.answer.correct], `${text}: ${p.answer.options}`);
      } else if (p.answer.type === 'choice') {
        const [a, b] = text.split(' ? ').map(num);
        assert.equal(p.answer.correct, compare(a, b) + 1, text);
      } else {
        const want = expected(p);
        assert.ok(same(typedValue(p), want), `${p.instruction} ${text}: ${JSON.stringify(p.answer)} vs ${want.n}/${want.d}`);
        if (p.answer.type === 'fraction') assert.deepEqual(p.answer.value, reduce(want), 'stored in simplest form');
      }
      // The right answer, typed the way the keypad sends it, is accepted.
      const a = p.answer;
      const right = a.type === 'decimal' ? typedDecimal(a.value) : a.type === 'choice' ? { choice: a.correct }
        : a.type === 'fraction' ? { num: a.value.n, den: a.value.d } : { whole: a.value };
      assert.equal(checkAnswer(p, right).status, 'correct', `${text}: ${JSON.stringify(right)}`);
      if (a.type === 'decimal') assert.equal(keypadOptionsFor(p).answerKind, 'decimal');
      for (const mis of p.misconceptions) {
        assert.ok(catalog.get(mis.id)?.startsWith('dec.'), `${mis.id} is in the catalog`);
        const raw = a.type === 'decimal' ? typedDecimal(mis.value) : a.type === 'choice' ? { choice: mis.choice }
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
    if (p.answer.type === 'decimal') assert.match(p.answer.value, id.startsWith('dec.signed') ? /^-?\d+(\.\d{1,4})?$/ : /^\d+(\.\d{1,4})?$/, `${id}: ${p.answer.value}`);
    assert.doesNotMatch(toText(p.expression).replace(/[\d.]+…/, ''), /\d{6,}/, `${id}: ${toText(p.expression)}`);
  }
});

test('negative decimals: every level has negatives where it says; repeating decimals: each kind appears', () => {
  const all = (id, d) => SEEDS.map((s) => generateProblem(id, s, d));
  assert.ok(all('dec.signed.add-sub', 1).every((p) => /-/.test(toText(p.expression))));
  assert.ok(all('dec.signed.add-sub', 3).every((p) => /- \(-/.test(toText(p.expression))), 'level 3 subtracts a negative');
  assert.ok(all('dec.signed.mult-div', 3).every((p) => (toText(p.expression).match(/-/g) || []).length === 2), 'level 3: two negatives');
  assert.ok(all('dec.signed.add-sub', 2).some((p) => p.answer.value.startsWith('-')));
  const kinds = new Set(DIFFICULTIES.flatMap((d) => all('dec.convert.repeating', d).map((p) => p.instruction)));
  assert.equal(kinds.size, 3, [...kinds].join(' / '));
  // Negative answers get the (−) key.
  assert.equal(keypadOptionsFor(generateProblem('dec.signed.add-sub', 'x', 2)).allowNegative, true);
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
