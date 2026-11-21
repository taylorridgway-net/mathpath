// Linear functions paper tests: every answer key re-computed from its calculation with
// exact fractions. Keys may use "−" or "-"; "$" is stripped. Slopes must be in simplest
// form; equations are read as y = mx + b and m and b are checked exactly.
//   f RULE at X              the rule's output for input X           key: a number
//   solve RULE = Y           the input that gives output Y           key: a number
//   table X Y X Y ... at X   the table's line, continued to X        key: a number
//   slope X Y X Y ...        the slope through the points (one line) key: a number
//   rise R run N             R / N                                   key: a number
//   read RULE                m and b of y = RULE                     key: "m = M, b = B"
//   line M B                 the line y = Mx + B                     key: "y = Mx + B"
//   line through X Y X Y     the line through two points             key: "y = Mx + B"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const skills = ['lin.functions', 'lin.slope', 'lin.slope-intercept'];
const papers = skills.map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

// Exact fractions as [n, d], d > 0, reduced.
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const F = (n, d = 1) => {
  assert.ok(d !== 0, 'division by zero');
  const g = gcd(n, d) || 1;
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
};
const sub = ([a, b], [c, d]) => F(a * d - c * b, b * d);
const add = ([a, b], [c, d]) => F(a * d + c * b, b * d);
const mul = ([a, b], [c, d]) => F(a * c, b * d);
const div = ([a, b], [c, d]) => F(a * d, b * c);
const same = ([a, b], [c, d]) => a * d === b * c;
const show = ([n, d]) => (d === 1 ? `${n}` : `${n}/${d}`);
const num = (s) => { const [n, d = '1'] = s.split('/'); return F(Number(n), Number(d)); };

const norm = (s) => s.replace(/−/g, '-');
// A rule in x with whole-number coefficients, e.g. "4-3*x"; must be linear.
const rule = (text) => {
  const f = (x) => Function('x', `"use strict"; return (${text});`)(x);
  assert.ok(Number.isInteger(f(0)) && Number.isInteger(f(1)), `${text}: whole-number coefficients`);
  const [b, m] = [f(0), f(1) - f(0)];
  for (const x of [-3, 2, 7]) assert.equal(f(x), m * x + b, `${text} is not linear`);
  return { m: F(m), b: F(b) };
};
const points = (args) => {
  assert.ok(args.length >= 4 && args.length % 2 === 0, `points: ${args}`);
  const ps = [];
  for (let i = 0; i < args.length; i += 2) ps.push([F(Number(args[i])), F(Number(args[i + 1]))]);
  const m = div(sub(ps[1][1], ps[0][1]), sub(ps[1][0], ps[0][0]));
  for (const p of ps.slice(2)) assert.ok(same(div(sub(p[1], ps[0][1]), sub(p[0], ps[0][0])), m), `points ${args} are not on one line`);
  return { m, b: sub(ps[0][1], mul(m, ps[0][0])) };
};

// Keys. A number: "−3", "2/3", "$62", "0 (...)"; must be in simplest form.
function numberKey(answer) {
  const m = /^\$?(-?\d+)(?:\/(\d+))?(?: |$)/.exec(norm(answer));
  if (!m) return null;
  const [n, d] = [Number(m[1]), Number(m[2] ?? 1)];
  if (m[2] && (d === 1 || gcd(n, d) !== 1)) return null; // not simplest form
  return F(n, d);
}
// "y = 5x − 2", "y = −x + 6", "y = (2/3)x + 1", "y = 4x"; written the usual way (no "1x", "+ −", "+ 0").
function lineKey(answer) {
  const m = /^y = (-)?(?:(\d+)|\((\d+\/\d+)\))?x(?: ([+-]) (\d+))?(?: \(|$)/.exec(norm(answer));
  if (!m || m[2] === '1' || m[5] === '0') return null;
  const slope = m[2] ? num(m[2]) : m[3] ? num(m[3]) : F(1);
  if (m[3] && (slope[1] === 1 || show(slope) !== m[3])) return null; // fraction in simplest form
  return { m: m[1] ? mul(F(-1), slope) : slope, b: m[4] ? F((m[4] === '-' ? -1 : 1) * Number(m[5])) : F(0) };
}
// "m = −3, b = 4"
function readKey(answer) {
  const m = /^m = (-?\d+(?:\/\d+)?), b = (-?\d+(?:\/\d+)?)(?: \(|$)/.exec(norm(answer));
  if (!m) return null;
  const [a, b] = [num(m[1]), num(m[2])];
  return show(a) === m[1] && show(b) === m[2] ? { m: a, b } : null;
}

// Returns [ok, what the calculation gives]; throws on an unknown calculation.
function check(math, answer) {
  const [kind, ...args] = math.split(' ');
  const numberIs = (want) => { const key = numberKey(answer); return [key !== null && same(key, want), show(want)]; };
  const lineIs = ({ m, b }, read = lineKey) => {
    const key = read(answer);
    return [key !== null && same(key.m, m) && same(key.b, b), `m = ${show(m)}, b = ${show(b)}`];
  };
  if (kind === 'f') { // f RULE at X
    assert.equal(args[1], 'at', math);
    const { m, b } = rule(args[0]);
    return numberIs(add(mul(m, F(Number(args[2]))), b));
  }
  if (kind === 'solve') { // solve RULE = Y
    assert.equal(args[1], '=', math);
    const { m, b } = rule(args[0]);
    assert.ok(m[0] !== 0, `${math}: no single answer`);
    return numberIs(div(sub(F(Number(args[2])), b), m));
  }
  if (kind === 'table') { // table X Y ... at X
    assert.equal(args.at(-2), 'at', math);
    const { m, b } = points(args.slice(0, -2));
    return numberIs(add(mul(m, F(Number(args.at(-1)))), b));
  }
  if (kind === 'slope') return numberIs(points(args).m);
  if (kind === 'rise') { // rise R run N
    assert.equal(args[1], 'run', math);
    return numberIs(F(Number(args[0]), Number(args[2])));
  }
  if (kind === 'read') return lineIs(rule(args[0]), readKey);
  if (kind === 'line' && args[0] === 'through') return lineIs(points(args.slice(1)));
  if (kind === 'line') return lineIs({ m: num(args[0]), b: num(args[1]) });
  throw new Error(`unknown calculation: ${math}`);
}

const numbers = (text) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);

  test(`${paper.skill}: every answer key matches its calculation exactly`, () => {
    for (const item of items) {
      const [ok, want] = check(item.math, item.answer);
      assert.ok(ok, `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
    }
  });

  test(`${paper.skill}: the prompt shows every number the calculation uses`, () => {
    for (const item of items) {
      const shown = numbers(item.prompt);
      for (const n of numbers(item.math)) assert.ok(shown.includes(n), `${item.id}: ${n}`);
    }
  });

  test(`${paper.skill}: ${rules.outOf} items per version, 2+ word problems, an 'is this right?' item, no repeats`, () => {
    assert.equal(paper.schemaVersion, 1);
    assert.match(paper.status, /^draft/);
    assert.deepEqual(paper.versions.map((v) => v.id), ['A', 'B']);
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf, v.id);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, `${v.id}: word problems`);
      assert.ok(v.items.some((i) => /Is (s?he|they) right\?/.test(i.prompt)), `${v.id}: 'is this right?' item`);
      assert.ok(v.items.every((i, n) => i.id === `${v.id}${n + 1}`), `${v.id}: item ids`);
      assert.ok(v.items.every((i) => ['word', 'computation'].includes(i.kind)), `${v.id}: item kinds`);
    }
    for (const field of ['prompt', 'math']) {
      const all = items.map((i) => i[field]);
      assert.equal(new Set(all).size, all.length, `A and B repeat a ${field}`);
    }
  });
}

test('the key readers catch wrong and unsimplified keys', () => {
  assert.equal(numberKey('4/6'), null);
  assert.equal(numberKey('3/1'), null);
  assert.deepEqual(numberKey('−2/3 (x)'), [-2, 3]);
  assert.equal(lineKey('y = 1x + 2'), null);
  assert.equal(lineKey('y = 2x + −3'), null);
  assert.equal(lineKey('y = (4/6)x + 1'), null);
  assert.deepEqual(lineKey('y = −x − 4'), { m: [-1, 1], b: [-4, 1] });
  assert.deepEqual(lineKey('y = (2/3)x'), { m: [2, 3], b: [0, 1] });
  assert.ok(!check('line 2 3', 'y = 3x + 2')[0], 'm and b swapped');
  assert.ok(!check('slope 1 2 3 10', '1/4')[0], 'run over rise');
});
