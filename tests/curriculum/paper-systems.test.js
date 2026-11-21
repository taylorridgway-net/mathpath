// Paper test for systems of equations: each item's two equations ("system") are read here;
// the key's (x, y) must make both true (fractions allowed), and "how many solutions" keys
// must match the equations. The prompt must show the same equations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.systems.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;

function side(text) {
  const out = { x: 0, y: 0, c: 0 };
  let sign = 1;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '+') { sign = 1; continue; }
    if (tok === '-') { sign = -1; continue; }
    const m = /^(-?)(\d*)([xy]?)$/.exec(tok);
    assert.ok(m, `can't read ${tok}`);
    out[m[3] || 'c'] += sign * (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    sign = 1;
  }
  return out;
}
const equation = (t) => { const [l, r] = t.split(' = ').map(side); return [l.x - r.x, l.y - r.y, r.c - l.c]; };
const num = (s) => { const [n, d = 1] = s.split('/').map(Number); return n / d; };

export function keyMatches(system, answer) {
  const [e1, e2] = system.map(equation);
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  if (det === 0) {
    const same = e1[0] * e2[2] === e2[0] * e1[2] && e1[1] * e2[2] === e2[1] * e1[2];
    return answer.startsWith(same ? 'Infinitely many' : 'No solution');
  }
  const m = /^\((-?[\d/]+), (-?[\d/]+)\)/.exec(answer);
  if (!m) return false;
  const [x, y] = [num(m[1]), num(m[2])];
  return [e1, e2].every(([a, b, c]) => Math.abs(a * x + b * y - c) < 1e-9);
}

test('alg.systems: every key solves its system', () => {
  for (const v of paper.versions) for (const i of v.items) {
    assert.ok(keyMatches(i.system, i.answer), `${i.id}: ${i.answer}`);
    // The prompt shows the same equations (− written as -).
    for (const e of i.system) assert.ok(i.prompt.replace(/−/g, '-').includes(e), `${i.id}: prompt doesn't show ${e}`);
  }
});

test('alg.systems: 6 items per version, word problems and an "is ... right?" item, no repeats', () => {
  const seen = new Set();
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt)));
    for (const i of v.items) { assert.ok(!seen.has(i.prompt), i.id); seen.add(i.prompt); }
  }
});

test('the key checker catches wrong keys', () => {
  assert.ok(!keyMatches(['y = x + 2', '2x + y = 11'], '(5, 3)'), 'swapped');
  assert.ok(!keyMatches(['y = 4x + 1', 'y = 4x - 6'], 'Infinitely many'));
  assert.ok(!keyMatches(['y = -2x + 3', '4x + 2y = 6'], 'No solution'));
  assert.ok(keyMatches(['y = 3x + 1', 'x + y = 6'], '(5/4, 19/4)'));
});
