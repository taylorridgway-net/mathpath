// Decimals paper tests: every answer key re-computed from its calculation.
// Decimal answers are compared with a small tolerance (floating point), fraction
// and rounding answers with exact integer math.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const skills = ['dec.place-value', 'dec.convert', 'dec.add-sub', 'dec.multiply', 'dec.divide'];
const papers = skills.map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const places = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
// "3.096" -> { n: 3096n, p: 3 } (exact: value = n / 10^p)
const exact = (s) => ({ n: BigInt(s.replace('.', '')), p: places(s) });
const PLACE = { whole: 0, tenth: 1, hundredth: 2, thousandth: 3 };
const DIGIT = { tenths: 1, hundredths: 2, thousandths: 3 };
const close = (a, b) => Math.abs(a - b) < 1e-9;
// The key's first token, e.g. "$1.20 (each)" -> "1.20".
const lead = (answer) => answer.split(' ')[0].replace(/^\$/, '');

// Returns a checker for the key, or throws on an unknown calculation.
function check(math, answer) {
  const [kind, ...args] = math.split(' ');
  const key = lead(answer);
  if (kind === 'sign') {
    const d = Number(args[0]) - Number(args[1]);
    return [key === (d < 0 ? '<' : d > 0 ? '>' : '='), `sign ${d}`];
  }
  if (kind === 'order') {
    const want = [...args].sort((a, b) => Number(a) - Number(b)).join(', ');
    return [answer === want || answer.startsWith(`${want} `), want];
  }
  if (kind === 'bigger') {
    const want = Number(args[0]) > Number(args[1]) ? args[0] : args[1];
    return [key === want, want];
  }
  if (kind === 'digit') {
    const [whole, frac = ''] = args[1].split('.');
    const want = args[0] === 'ones' ? whole.at(-1) : frac[DIGIT[args[0]] - 1];
    return [key === want, want];
  }
  if (kind === 'round') {
    // Exact half-up rounding on integers; the key must show exactly that many places.
    const q = PLACE[args[0]];
    const { n, p } = exact(args[1]);
    const div = 10n ** BigInt(Math.max(p - q, 0));
    let r = n / div;
    if ((n % div) * 2n >= div && div > 1n) r += 1n;
    const k = exact(key);
    return [/^\d+(\.\d+)?$/.test(key) && k.p === q && k.n === r, `${r} (${q} places)`];
  }
  if (kind === 'tofrac') {
    // key a/b must equal n/10^p exactly, in simplest form, and not be a whole number.
    const m = /^(\d+)\/(\d+)$/.exec(key);
    if (!m) return [false, 'a fraction a/b'];
    const [a, b] = [BigInt(m[1]), BigInt(m[2])];
    const { n, p } = exact(args[0]);
    const ok = a * 10n ** BigInt(p) === n * b && gcd(Number(a), Number(b)) === 1 && b !== 1n;
    return [ok, `${n}/${10n ** BigInt(p)} in simplest form`];
  }
  if (!/^[\d.+\-*/() ]+$/.test(math)) throw new Error(`unknown calculation: ${math}`);
  const want = Function(`"use strict"; return (${math});`)();
  return [/^\d+(\.\d+)?$/.test(key) && close(Number(key), want), String(want)];
}

const numbers = (text) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);

  test(`${paper.skill}: every answer key matches its calculation`, () => {
    for (const item of items) {
      const [ok, want] = check(item.math, item.answer);
      assert.ok(ok, `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
    }
  });

  test(`${paper.skill}: no answer key is negative`, () => {
    for (const item of items) {
      assert.ok(!/^[-−]/.test(lead(item.answer)), `${item.id}: ${item.answer}`);
      if (/^[\d.+\-*/() ]+$/.test(item.math)) assert.ok(Function(`"use strict"; return (${item.math});`)() >= 0, item.id);
    }
  });

  test(`${paper.skill}: the prompt shows every number the calculation uses`, () => {
    for (const item of items) {
      const shown = numbers(item.prompt);
      for (const n of numbers(item.math)) assert.ok(shown.includes(n), `${item.id}: ${n}`);
    }
  });

  test(`${paper.skill}: ${rules.outOf} items per version, 2+ word problems, an 'is this right?' item, no repeated prompts`, () => {
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf, v.id);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, `${v.id}: word problems`);
      assert.ok(v.items.some((i) => /Is (s?he|they) right\?/.test(i.prompt)), `${v.id}: 'is this right?' item`);
      assert.ok(v.items.every((i, n) => i.id === `${v.id}${n + 1}`), `${v.id}: item ids`);
    }
    const prompts = items.map((i) => i.prompt);
    assert.equal(new Set(prompts).size, prompts.length, 'A and B repeat a prompt');
  });
}

test('dec.divide: no item needs long division (after moving the point: divisor 2-9 or 12, quotient a basic fact)', () => {
  const paper = papers.find((p) => p.skill === 'dec.divide');
  for (const item of paper.versions.flatMap((v) => v.items)) {
    const m = /^([\d.]+) \/ ([\d.]+)$/.exec(item.math);
    assert.ok(m, `${item.id}: one division, "a / b"`);
    const divisor = Number(exact(m[2]).n);
    assert.ok((divisor >= 2 && divisor <= 9) || divisor === 12, `${item.id}: divisor ${divisor}`);
    const digits = Number(m[1].replace('.', '').replace(/^0+/, '').replace(/0+$/, ''));
    assert.equal(digits % divisor, 0, `${item.id}: ${digits} ÷ ${divisor} has a remainder`);
    assert.ok(digits / divisor <= 12, `${item.id}: ${digits} ÷ ${divisor} is not a basic fact`);
  }
});
