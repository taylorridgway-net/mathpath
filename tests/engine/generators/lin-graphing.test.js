// Graphing points and lines: the point is the one shown; a line answer accepts ANY two
// grid points on the line read from the shown equation (worked out here independently),
// and nothing else; mistakes are wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => `gr-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/lin.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const GRID = [];
for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) GRID.push([a, b]);

// "y = (-3/2)x - 1", "y = -x + 3", "y = 2x" -> a test of a grid point (exactly, with whole numbers).
function lineOf(t) {
  const m = /^y = (?:\((-?\d+)\/(\d+)\)|(-?\d*))x(?: ([+-]) (\d+))?$/.exec(t);
  assert.ok(m, t);
  const [num, den] = m[1] ? [Number(m[1]), Number(m[2])] : [m[3] === '' ? 1 : m[3] === '-' ? -1 : Number(m[3]), 1];
  const b = m[4] ? (m[4] === '-' ? -1 : 1) * Number(m[5]) : 0;
  return ([px, py]) => (py - b) * den === num * px;
}

test('plot a point: exactly the shown point; mistakes recognised', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS) {
    const p = generateProblem('lin.graphing.points', seed, d);
    const [, a, b] = /^\((-?\d+), (-?\d+)\)$/.exec(toText(p.expression)).map(Number);
    assert.equal(checkAnswer(p, { points: [[a, b]] }).status, 'correct');
    assert.equal(keypadOptionsFor(p).answerKind, 'grid');
    for (const q of GRID) if (q[0] !== a || q[1] !== b) assert.notEqual(checkAnswer(p, { points: [q] }).status, 'correct');
    for (const m of p.misconceptions) {
      assert.ok(catalog.get(m.id), m.id);
      const r = checkAnswer(p, m.value);
      assert.equal(r.status, 'wrong');
      assert.equal(r.misconception, m.id);
    }
  }
});

test('graph a line: any two different grid points on the line are right, and only those', () => {
  for (const d of DIFFICULTIES) for (const seed of SEEDS.slice(0, 80)) {
    const p = generateProblem('lin.graphing.line', seed, d);
    const on = lineOf(toText(p.expression));
    const good = GRID.filter(on);
    assert.ok(good.length >= 2, `${toText(p.expression)} has two grid points`);
    for (const g of good) for (const h of good) {
      const r = checkAnswer(p, { points: [g, h] }).status;
      assert.equal(r, g === h ? 'invalid' : 'correct', `${toText(p.expression)}: ${g} ${h}`);
    }
    const off = GRID.find((q) => !on(q));
    assert.notEqual(checkAnswer(p, { points: [good[0], off] }).status, 'correct');
    assert.equal(keypadOptionsFor(p).count, 2);
    assert.ok(p.answer.example.every(on));
    // Each mistake: two grid points on the mistaken line (when it has them) are recognised.
    for (const m of p.misconceptions) {
      assert.ok(catalog.get(m.id), m.id);
      const { m: mm, b } = m.value;
      const onMistake = ([px, py]) => (py * b.d - b.n) * mm.d === mm.n * px * b.d;
      const pts = GRID.filter(onMistake);
      if (pts.length < 2) continue;
      const pair = [pts[0], pts.at(-1)];
      if (pair.every(on)) continue; // the lines cross at both... can't happen for different lines
      const r = checkAnswer(p, { points: pair });
      assert.equal(r.status, 'wrong', `${toText(p.expression)}: ${m.id}`);
      assert.equal(r.misconception, m.id);
    }
  }
});

test('graphing: every graphing mistake in the catalog is generated', () => {
  const seen = new Set();
  for (const id of ['lin.graphing.points', 'lin.graphing.line']) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  for (const id of ['lin.plot-swapped', 'lin.plot-sign', 'lin.mb-swapped', 'lin.slope-run-over-rise', 'lin.slope-mixed-order', 'lin.intercept-x']) assert.ok(seen.has(id), id);
});
