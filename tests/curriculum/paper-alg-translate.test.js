// Translating-words paper test: every answer key re-checked from the item's meaning ('math'),
// with exact fractions. 'expr ...' items: the key is that expression in simplest ax + b form.
// 'eq left = right' items: the key is its solution, or an equation with the same meaning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fraction, reduce, add, sub, mul, div, equals } from '../../engine/math/fraction.js';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.translate.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const items = paper.versions.flatMap((v) => v.items);
const ZERO = fraction(0);
const isZero = (f) => f.n === 0;

// A linear expression in x as { a, b } (a·x + b), exact. Numbers, x, + - * /, parentheses,
// and written-out multiplication ("3x", "2(x + 1)").
function linear(text) {
  const tokens = text.replace(/−/g, '-').match(/\d+|x|[-+*/()]/g);
  assert.equal(tokens.join(''), text.replace(/−/g, '-').replace(/\s+/g, ''), `can't read "${text}"`);
  let i = 0;
  const peek = () => tokens[i];
  const sum = () => {
    let v = product();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[i++]; const w = product();
      v = op === '+' ? { a: add(v.a, w.a), b: add(v.b, w.b) } : { a: sub(v.a, w.a), b: sub(v.b, w.b) };
    }
    return v;
  };
  const times = (v, w) => {
    assert.ok(isZero(v.a) || isZero(w.a), `"${text}" isn't linear`);
    return { a: add(mul(v.a, w.b), mul(w.a, v.b)), b: mul(v.b, w.b) };
  };
  const product = () => {
    let v = unary();
    for (;;) {
      if (peek() === '*') { i++; v = times(v, unary()); } else if (peek() === '/') {
        i++; const w = unary();
        assert.ok(isZero(w.a) && !isZero(w.b), `"${text}": divide by a number only`);
        v = { a: div(v.a, w.b), b: div(v.b, w.b) };
      } else if (peek() === 'x' || peek() === '(') v = times(v, unary()); // 3x, 2(x + 1)
      else return v;
    }
  };
  const unary = () => {
    if (peek() === '-') { i++; const v = unary(); return { a: sub(ZERO, v.a), b: sub(ZERO, v.b) }; }
    const t = tokens[i++];
    if (t === 'x') return { a: fraction(1), b: ZERO };
    if (t === '(') { const v = sum(); assert.equal(tokens[i++], ')', `"${text}": missing )`); return v; }
    assert.match(t ?? '', /^\d+$/, `"${text}": unexpected ${t}`);
    return { a: ZERO, b: fraction(Number(t)) };
  };
  const v = sum();
  assert.equal(i, tokens.length, `"${text}": extra ${tokens.slice(i).join(' ')}`);
  return v;
}

// "left = right" -> left − right as { a, b } (the equation is a·x + b = 0).
function equation(text) {
  const sides = text.split('=');
  assert.equal(sides.length, 2, `"${text}" isn't an equation`);
  const [l, r] = sides.map(linear);
  return { a: sub(l.a, r.a), b: sub(l.b, r.b) };
}

// Simplest ax + b, written the way the keys are: "2x - 5", "-x + 15", "x - 4", "3x".
function written({ a, b }) {
  assert.ok(a.d === 1 && b.d === 1, 'whole-number coefficients');
  const ax = a.n === 1 ? 'x' : a.n === -1 ? '-x' : `${a.n}x`;
  if (a.n === 0) return String(b.n);
  return b.n === 0 ? ax : `${ax} ${b.n < 0 ? '-' : '+'} ${Math.abs(b.n)}`;
}

const keyOf = (item) => item.answer.split(' (')[0];
const kindOf = (item) => (item.math.startsWith('expr ') ? 'expression' : keyOf(item).includes('=') ? 'equation' : 'number');

test('translate: every math is "expr ..." or "eq ... = ..."', () => {
  for (const item of items) assert.match(item.math, /^(expr [^=]+|eq [^=]+=[^=]+)$/, item.id);
});

test('translate: expression keys equal their expression, in simplest ax + b form', () => {
  for (const item of items.filter((i) => kindOf(i) === 'expression')) {
    const want = linear(item.math.slice(5));
    const got = linear(keyOf(item));
    assert.ok(equals(got.a, want.a) && equals(got.b, want.b), `${item.id}: key "${keyOf(item)}" but ${item.math} is ${written(want)}`);
    assert.equal(keyOf(item), written(want), `${item.id}: key not in simplest ax + b form`);
  }
});

test('translate: number keys solve their equation exactly (one solution, simplest form)', () => {
  for (const item of items.filter((i) => kindOf(i) === 'number')) {
    const e = equation(item.math.slice(3));
    assert.ok(!isZero(e.a), `${item.id}: x cancels`);
    const x = div(sub(ZERO, e.b), e.a);
    const m = /^(-?\d+)(?:\/(\d+))?$/.exec(keyOf(item).split(' ')[0]);
    assert.ok(m, `${item.id}: key "${item.answer}" starts with a number`);
    const key = fraction(Number(m[1]), Number(m[2] ?? 1));
    assert.ok(equals(key, x), `${item.id}: key ${m[0]} but ${item.math} gives ${reduce(x).n}/${reduce(x).d}`);
    assert.equal(reduce(key).d, key.d, `${item.id}: simplest form`);
    if (item.kind === 'word') assert.ok(x.n > 0 && x.d === 1, `${item.id}: a story's answer is a whole count`);
  }
});

test('translate: equation keys mean the same as the item\'s equation', () => {
  for (const item of items.filter((i) => kindOf(i) === 'equation')) {
    const want = equation(item.math.slice(3));
    const got = equation(keyOf(item));
    assert.ok(!isZero(want.a) && !isZero(got.a), `${item.id}: x cancels`);
    // Same equation (rearranged or scaled): got = k · want for one number k.
    assert.ok(equals(mul(got.a, want.b), mul(got.b, want.a)), `${item.id}: key "${keyOf(item)}" isn't the equation ${item.math.slice(3)}`);
    const x = div(sub(ZERO, want.b), want.a);
    const note = /x = (-?\d+)/.exec(item.answer);
    if (note) assert.ok(equals(fraction(Number(note[1])), x), `${item.id}: the note's x = ${note[1]}`);
  }
});

const WORDS = { twice: 2, double: 2, doubled: 2, triple: 3, tripled: 3, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
test('translate: prompts show every number (digits or words); 6 items, word problems, "right?" items, an expression or equation to write; A and B differ', () => {
  for (const item of items) {
    const shown = item.prompt.toLowerCase().replace(/[a-z]+/g, (w) => (w in WORDS ? ` ${WORDS[w]} ` : w)).match(/\d+/g);
    for (const n of item.math.match(/\d+/g)) assert.ok(shown.includes(n), `${item.id}: ${n} isn't in the prompt`);
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf, `${v.id}: items`);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 3, `${v.id}: word problems`);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt) && kindOf(i) === 'expression'), `${v.id}: an "is this right?" item`);
    assert.ok(v.items.some((i) => kindOf(i) !== 'number'), `${v.id}: an item asking for the expression or equation`);
    assert.ok(v.items.some((i) => kindOf(i) === 'equation'), `${v.id}: an item asking for the equation`);
    assert.ok(v.items.some((i) => kindOf(i) === 'number' && i.kind === 'word'), `${v.id}: a story to solve`);
  }
  const [a, b] = paper.versions.map((v) => v.items.map((i) => i.math.replace(/\s+/g, '')));
  assert.ok(a.every((m) => !b.includes(m)), 'A and B repeat an item');
  const [pa, pb] = paper.versions.map((v) => v.items.map((i) => i.prompt));
  assert.ok(pa.every((p) => !pb.includes(p)), 'A and B repeat a prompt');
});
