// Paper tests for exponents, roots and scientific notation. Each item's "math" is worked
// out here and the answer key must say exactly that:
//   exponent: <expr>   key "x⁸" (a power of x with that exponent)
//   value: <expr>      key a number or fraction ("1/25", "730000", "0.0025")
//   between: <n>       key "6 and 7" (the whole numbers around √n)
//   kind: rational|irrational
//   sci: <mantissa> <exponent>   key "5.2 × 10⁴" (mantissa between 1 and 10)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (id) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${id}.json`, import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
const unsup = (s) => s.split('').map((c) => SUP[c] ?? c).join('');
const keyOf = (answer) => answer.split(' (')[0].trim();
const evalJs = (e) => Function(`"use strict"; return (${e});`)();
const close = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
const numberOf = (k) => { const m = /^(-?\d+)\/(\d+)$/.exec(k); return m ? m[1] / m[2] : Number(k.replace('−', '-')); };

export function checkKey(math, key) {
  const [kind, rest] = math.split(/:\s*/);
  switch (kind) {
    case 'exponent': {
      const m = /^x([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(key);
      return Boolean(m) && Number(unsup(m[1])) === evalJs(rest);
    }
    case 'value': return /^-?\d+(\.\d+)?(\/\d+)?$/.test(key) && close(numberOf(key), evalJs(rest));
    case 'between': { const n = Number(rest); const lo = Math.floor(Math.sqrt(n)); return key === `${lo} and ${lo + 1}` && lo * lo < n; }
    case 'kind': return key.toLowerCase() === rest;
    case 'sci': {
      const [mant, exp] = rest.split(' ');
      const m = /^(\d+(?:\.\d+)?) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(key);
      return Boolean(m) && m[1] === mant && Number(unsup(m[2])) === Number(exp) && Number(mant) >= 1 && Number(mant) < 10;
    }
    default: throw new Error(`unknown math "${math}"`);
  }
}

for (const id of ['exp.rules', 'exp.roots', 'exp.scinot']) {
  const paper = load(id);
  test(`${id}: every key matches its calculation exactly`, () => {
    for (const v of paper.versions) for (const i of v.items) assert.ok(checkKey(i.math, keyOf(i.answer)), `${i.id}: key "${keyOf(i.answer)}" vs ${i.math}`);
  });
  test(`${id}: 6 items per version, word problems and a "right?" item, A and B don't repeat`, () => {
    const seen = new Set();
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
      assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
      for (const i of v.items) { assert.ok(!seen.has(i.prompt), i.id); seen.add(i.prompt); }
    }
  });
}

test('the key checker catches the classic wrong keys', () => {
  assert.ok(!checkKey('exponent: 4 + 3', 'x¹²'), 'multiplied exponents');
  assert.ok(!checkKey('value: 4 ** -2', '-16'), 'negative exponent as a negative number');
  assert.ok(!checkKey('value: Math.sqrt(100)', '50'), 'halved');
  assert.ok(!checkKey('between: 40', '20 and 21'), 'halved estimate');
  assert.ok(!checkKey('sci: 4.5 3', '45 × 10²'), 'not between 1 and 10');
  assert.ok(!checkKey('sci: 6.1 -3', '6.1 × 10³'), 'sign');
  assert.ok(checkKey('sci: 6.1 -3', '6.1 × 10⁻³'));
});
