// Decimals paper tests: every answer key re-computed from its calculation.
// Everything is exact (integers and fractions, never floating point): arithmetic
// (signed too) with a small parser, repeating decimals by long division.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const skills = ['dec.place-value', 'dec.convert', 'dec.add-sub', 'dec.multiply', 'dec.divide', 'dec.signed'];
const papers = skills.map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const places = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
// "3.096" -> { n: 3096n, p: 3 } (exact: value = n / 10^p)
const exact = (s) => ({ n: BigInt(s.replace('.', '')), p: places(s) });
const PLACE = { whole: 0, tenth: 1, hundredth: 2, thousandth: 3 };
const DIGIT = { tenths: 1, hundredths: 2, thousandths: 3 };
// The key's first token, e.g. "$1.20 (each)" -> "1.20".
const lead = (answer) => answer.split(' ')[0].replace(/^\$/, '');

// Exact fractions { n, d } (BigInt, d > 0, lowest terms).
const big = (x) => BigInt(x);
const babs = (x) => (x < 0n ? -x : x);
const bgcd = (a, b) => (b ? bgcd(b, a % b) : babs(a));
const frac = (n, d = 1n) => {
  if (d === 0n) throw new Error('division by zero');
  const g = bgcd(n, d) || 1n;
  const s = d < 0n ? -1n : 1n;
  return { n: (s * n) / g, d: (s * d) / g };
};
const ops = {
  '+': (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  '-': (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  '*': (a, b) => frac(a.n * b.n, a.d * b.d),
  '/': (a, b) => frac(a.n * b.d, a.d * b.n),
};
const same = (a, b) => a.n === b.n && a.d === b.d;
const show = (f) => (f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`);
// A decimal's text ("-3.25") as an exact fraction.
const decimal = (t) => {
  const neg = t.startsWith('-');
  const { n, p } = exact(neg ? t.slice(1) : t);
  return frac(neg ? -n : n, 10n ** BigInt(p));
};
// Arithmetic like "3.25 - (-1.4)" or "-0.48 / (-0.6)": + - * / ( ), a leading or bracketed minus.
function evaluate(math) {
  const tokens = math.match(/\d+(?:\.\d+)?|[-+*/()]/g);
  if (!tokens || tokens.join('') !== math.replace(/ /g, '')) throw new Error(`unknown calculation: ${math}`);
  let i = 0;
  const factor = () => {
    const t = tokens[i++];
    if (t === '-') return ops['-'](frac(0n), factor());
    if (t === '(') {
      const v = sum();
      if (tokens[i++] !== ')') throw new Error(`missing ) in ${math}`);
      return v;
    }
    if (!/^\d/.test(t ?? '')) throw new Error(`unexpected ${t} in ${math}`);
    return decimal(t);
  };
  const product = () => {
    let v = factor();
    while (tokens[i] === '*' || tokens[i] === '/') v = ops[tokens[i++]](v, factor());
    return v;
  };
  const sum = () => {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '-') v = ops[tokens[i++]](v, product());
    return v;
  };
  const v = sum();
  if (i !== tokens.length) throw new Error(`left over in ${math}`);
  return v;
}
// n/d (positive, less than 1) by long division: digits before the repeat, and the repeating block ('' if it ends).
function expand(n, d) {
  const digits = [];
  const seen = new Map();
  let r = n % d;
  while (r !== 0n && !seen.has(r)) {
    seen.set(r, digits.length);
    digits.push(String((r * 10n) / d));
    r = (r * 10n) % d;
  }
  if (r === 0n) return { start: digits.join(''), block: '' };
  const at = seen.get(r);
  return { start: digits.slice(0, at).join(''), block: digits.slice(at).join('') };
}
// "0.1818…" -> the fraction it stands for: the shortest start, then the shortest block, that the
// digits show at least twice in full (0.1666… = 1/6, 0.1818… = 2/11, 0.666… = 2/3).
function repeatingValue(text) {
  const m = /^0\.(\d+)…$/.exec(text);
  if (!m) throw new Error(`not a repeating decimal: ${text}`);
  const ds = m[1];
  for (let a = 0; a < ds.length; a++) {
    for (let b = 1; a + 2 * b <= ds.length; b++) {
      const [start, block] = [ds.slice(0, a), ds.slice(a, a + b)];
      if ((ds.length - a) % b === 0 && ds === start + block.repeat((ds.length - a) / b)) {
        const s = start ? big(start) : 0n;
        return frac(big(start + block) - s, 10n ** BigInt(a) * (10n ** BigInt(b) - 1n));
      }
    }
  }
  throw new Error(`no repeating block shown twice: ${text}`);
}

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
  if (kind === 'repeat') {
    // "repeat 2/3": key "0.666… (0.6 with a bar over the 6)": the long-division digits, the block
    // shown at least twice in full, and the bar over exactly the repeating block.
    const [n, d] = args[0].split('/').map(big);
    const { start, block } = expand(n, d);
    if (!block || n >= d) return [false, `${args[0]} does not repeat (or is not below 1)`];
    const want = `0.${start}${block} with a bar over the ${block}`;
    const bar = /\((0\.\d+) with a bar over the (\d+)\)/.exec(answer);
    let ok = bar && `${bar[1]} with a bar over the ${bar[2]}` === want;
    try {
      ok = ok && key.startsWith(`0.${start}${block}${block}`) && same(repeatingValue(key), frac(n, d));
    } catch {
      ok = false;
    }
    return [ok, `0.${start}${block.repeat(3)}… (${want})`];
  }
  if (kind === 'ends') {
    // "ends 7/12": key "Ends" or "Repeats": in lowest terms, the denominator has only 2s and 5s.
    let { d } = frac(...args[0].split('/').map(big));
    for (const p of [2n, 5n]) while (d % p === 0n) d /= p;
    const want = d === 1n ? 'Ends' : 'Repeats';
    return [key === want, want];
  }
  if (kind === 'fraction') {
    // "fraction 0.1818…": key a/b in simplest form, exactly the repeating decimal's value.
    const want = repeatingValue(args[0]);
    const m = /^(\d+)\/(\d+)$/.exec(key);
    return [!!m && m[2] !== '1' && bgcd(big(m[1]), big(m[2])) === 1n && same(frac(big(m[1]), big(m[2])), want), show(want)];
  }
  // Arithmetic, exactly; the key is a decimal (may be negative) worth exactly that much.
  const want = evaluate(math);
  return [/^-?\d+(\.\d+)?$/.test(key) && same(decimal(key), want), show(want)];
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

  if (paper.skill !== 'dec.signed') test(`${paper.skill}: no answer key is negative`, () => {
    for (const item of items) {
      assert.ok(!/^[-−]/.test(lead(item.answer)), `${item.id}: ${item.answer}`);
      if (/^[\d.+\-*/() ]+$/.test(item.math)) assert.ok(evaluate(item.math).n >= 0n, item.id);
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

test('dec.signed: each computation prompt shows exactly its calculation, signs and brackets included', () => {
  const paper = papers.find((p) => p.skill === 'dec.signed');
  const items = paper.versions.flatMap((v) => v.items);
  for (const item of items.filter((i) => i.kind === 'computation')) {
    const shown = item.prompt.split(':').at(-1).trim().replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    assert.equal(shown, item.math, item.id);
  }
  // Both versions ask for adding, subtracting a negative, multiplying and dividing, and have a negative answer.
  for (const v of paper.versions) {
    const maths = v.items.map((i) => i.math).join(' ; ');
    for (const re of [/\+/, /- \(-/, /\*/, /\//]) assert.match(maths, re, `${v.id}: ${re}`);
    assert.ok(v.items.some((i) => lead(i.answer).startsWith('-')), `${v.id}: a negative answer`);
  }
});

test('dec.convert: each version has a repeating-decimal item', () => {
  const paper = papers.find((p) => p.skill === 'dec.convert');
  for (const v of paper.versions) assert.ok(v.items.some((i) => /^(repeat|ends|fraction) /.test(i.math)), v.id);
});

test('the checker itself: catches wrong keys for signed and repeating items', () => {
  const good = [
    ['-3.5 + 1.2', '-2.3'], ['2.4 - 5.15', '-2.75'], ['3.25 - (-1.4)', '4.65'], ['-0.3 * 4', '-1.2'], ['-0.48 / (-0.6)', '0.8'],
    ['repeat 2/3', '0.666… (0.6 with a bar over the 6)'], ['repeat 5/9', '0.555… (0.5 with a bar over the 5)'],
    ['repeat 1/6', '0.1666… (0.16 with a bar over the 6)'], ['ends 7/12', 'Repeats'], ['ends 3/15', 'Ends'],
    ['fraction 0.444…', '4/9'], ['fraction 0.1818…', '2/11'],
  ];
  const bad = [
    ['-3.5 + 1.2', '2.3'], ['2.4 - 5.15', '2.75'], ['3.25 - (-1.4)', '1.85'], ['-0.3 * 4', '1.2'], ['-0.48 / (-0.6)', '-0.8'], ['-0.48 / (-0.6)', '0.08'],
    ['repeat 2/3', '0.67 (0.6 with a bar over the 6)'], ['repeat 2/3', '0.666… (0.66 with a bar over the 66)'], ['repeat 2/3', '0.666…'],
    ['repeat 1/6', '0.1666… (0.1 with a bar over the 16)'], ['ends 7/12', 'Ends'], ['ends 3/15', 'Repeats'],
    ['fraction 0.444…', '4/10'], ['fraction 0.1818…', '18/99'], ['fraction 0.1818…', '9/50'],
  ];
  for (const [math, answer] of good) assert.ok(check(math, answer)[0], `${math} -> ${answer}`);
  for (const [math, answer] of bad) assert.ok(!check(math, answer)[0], `${math} -> ${answer} should fail`);
});
