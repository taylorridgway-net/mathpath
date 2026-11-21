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
//   ps M X Y                 y − Y = M(x − X) as y = mx + b          key: "y = Mx + B"
//   std A B C slope|xint|yint|intercepts|line   the line Ax + By = C:
//                            slope, x-intercept, y-intercept         key: a number
//                            both intercepts                         key: "x-intercept P, y-intercept Q"
//                            as y = mx + b                           key: "y = Mx + B"
//   par|perp M               slope of a parallel / perpendicular line key: a number
//   par|perp M through X Y   that line through (X, Y)                key: "y = Mx + B"
//   relation M1 M2           lines with slopes M1 and M2             key: "Parallel", "Perpendicular" or "Neither"
//   linear table X Y X Y ... is the table linear? (x may jump unevenly) key: "Linear" or "Not linear"
//   linear eq RULE           is y = RULE linear? (^ for powers)      key: "Linear" or "Not linear"
// M, X, Y, A, B, C may be fractions like -1/2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const skills = ['lin.functions', 'lin.slope', 'lin.slope-intercept', 'lin.forms', 'lin.parallel'];
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

// A rule in x with whole-number coefficients, any degree ("3*x^2+2"); is it linear?
const isLinearRule = (text) => {
  const f = (x) => Function('x', `"use strict"; return (${text.replace(/\^/g, '**')});`)(x);
  const xs = [-3, -2, -1, 0, 1, 2, 3, 5, 8];
  for (const x of xs) assert.ok(Number.isInteger(f(x)), `${text}: whole-number outputs`);
  const [b, m] = [f(0), f(1) - f(0)];
  return xs.every((x) => f(x) === m * x + b);
};
// A table (x values increasing, maybe unevenly) is linear when every step has the same rate.
const isLinearTable = (args) => {
  assert.ok(args.length >= 6 && args.length % 2 === 0, `table: ${args}`);
  const ps = [];
  for (let i = 0; i < args.length; i += 2) ps.push([num(args[i]), num(args[i + 1])]);
  const rates = ps.slice(1).map((p, i) => {
    assert.ok(sub(p[0], ps[i][0])[0] > 0, `table ${args}: x must go up`);
    return div(sub(p[1], ps[i][1]), sub(p[0], ps[i][0]));
  });
  return rates.every((r) => same(r, rates[0]));
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

// "x-intercept 8, y-intercept 6"
function interceptsKey(answer) {
  const m = /^x-intercept (-?\d+(?:\/\d+)?), y-intercept (-?\d+(?:\/\d+)?)(?: \(|$)/.exec(norm(answer));
  if (!m) return null;
  const [x, y] = [num(m[1]), num(m[2])];
  return show(x) === m[1] && show(y) === m[2] ? { x, y } : null;
}
// One of a few words at the start: "Neither (No: ...)".
const wordKey = (answer, words) => words.find((w) => new RegExp(`^${w}(?: \\(|$)`).test(answer)) ?? null;

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
  if (kind === 'ps') { // ps M X Y
    assert.equal(args.length, 3, math);
    const [m, x, y] = args.map(num);
    return lineIs({ m, b: sub(y, mul(m, x)) });
  }
  if (kind === 'std') { // std A B C what
    assert.equal(args.length, 4, math);
    const [a, b, c] = args.slice(0, 3).map(num);
    assert.ok(a[0] !== 0 && b[0] !== 0, `${math}: needs both x and y`);
    const line = { m: div(mul(F(-1), a), b), b: div(c, b) };
    const xint = div(c, a);
    if (args[3] === 'slope') return numberIs(line.m);
    if (args[3] === 'xint') return numberIs(xint);
    if (args[3] === 'yint') return numberIs(line.b);
    if (args[3] === 'line') return lineIs(line);
    if (args[3] === 'intercepts') {
      const key = interceptsKey(answer);
      return [key !== null && same(key.x, xint) && same(key.y, line.b), `x-intercept ${show(xint)}, y-intercept ${show(line.b)}`];
    }
  }
  if (kind === 'par' || kind === 'perp') { // par|perp M [through X Y]
    const given = num(args[0]);
    assert.ok(kind === 'par' || given[0] !== 0, `${math}: no perpendicular slope`);
    const m = kind === 'par' ? given : div(F(-1), given);
    if (args.length === 1) return numberIs(m);
    assert.ok(args.length === 4 && args[1] === 'through', math);
    return lineIs({ m, b: sub(num(args[3]), mul(m, num(args[2]))) });
  }
  if (kind === 'relation') { // relation M1 M2
    assert.equal(args.length, 2, math);
    const [m1, m2] = args.map(num);
    const want = same(m1, m2) ? 'Parallel' : same(mul(m1, m2), F(-1)) ? 'Perpendicular' : 'Neither';
    return [wordKey(answer, ['Parallel', 'Perpendicular', 'Neither']) === want, want];
  }
  if (kind === 'linear') { // linear table ... | linear eq RULE
    const yes = args[0] === 'table' ? isLinearTable(args.slice(1)) : args[0] === 'eq' && args.length === 2 ? isLinearRule(args[1]) : assert.fail(math);
    const want = yes ? 'Linear' : 'Not linear';
    return [wordKey(answer, ['Linear', 'Not linear']) === want, want];
  }
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
      const shown = numbers(item.prompt.replace(/²/g, '^2').replace(/³/g, '^3'));
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
  assert.ok(check('ps 2 1 4', 'y = 2x + 2')[0]);
  assert.ok(!check('ps 2 1 4', 'y = 2x + 3')[0], 'point-slope: forgot to distribute');
  assert.ok(check('std 2 3 12 slope', '−2/3')[0]);
  assert.ok(check('std 2 3 12 intercepts', 'x-intercept 6, y-intercept 4')[0]);
  assert.ok(!check('std 2 3 12 intercepts', 'x-intercept 4, y-intercept 6')[0], 'intercepts swapped');
  assert.ok(check('std 4 2 10 line', 'y = −2x + 5')[0]);
  assert.ok(!check('std 4 2 10 line', 'y = −4x + 10')[0], 'did not divide by the y number');
  assert.ok(check('perp 2/3', '−3/2')[0]);
  assert.ok(!check('perp 2/3', '3/2')[0], 'flipped but kept the sign');
  assert.ok(check('perp 2 through 4 1', 'y = −(1/2)x + 3')[0]);
  assert.ok(check('relation 2 -1/2', 'Perpendicular')[0]);
  assert.ok(!check('relation 2 1/2', 'Perpendicular')[0], 'reciprocal without the sign');
  assert.ok(check('relation 4 -4', 'Neither (x)')[0]);
  assert.ok(check('linear table 1 5 2 8 4 14 7 23', 'Linear')[0], 'uneven x jumps, same rate');
  assert.ok(check('linear table 1 5 2 8 3 11 5 14', 'Not linear')[0], 'same y jumps, uneven x jumps');
  assert.ok(!check('linear table 1 5 2 8 3 11 5 14', 'Linear')[0]);
  assert.ok(check('linear eq x^2+1', 'Not linear')[0]);
  assert.ok(check('linear eq 5-2*x', 'Linear')[0]);
});
