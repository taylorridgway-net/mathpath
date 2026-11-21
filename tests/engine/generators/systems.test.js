// Systems of equations: the answer is checked against the system itself (both equations,
// read back from the problem's text, or both lines on the graph); "how many solutions" is
// worked out from the equations; every wrong-answer pattern is wrong, recognised, in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `sys-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = ['alg.systems.graph', 'alg.systems.substitute', 'alg.systems.eliminate'];

// "2x - 3y" -> { x: 2, y: -3, c: 0 }
function side(text) {
  const out = { x: 0, y: 0, c: 0 };
  let sign = 1;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '+') { sign = 1; continue; }
    if (tok === '-') { sign = -1; continue; }
    const m = /^(-?)(\d*)([xy]?)$/.exec(tok);
    assert.ok(m, `can't read "${tok}" in "${text}"`);
    const k = (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    out[m[3] || 'c'] += sign * k;
    sign = 1;
  }
  return out;
}
// "a = b" -> ax + by = c, as [a, b, c]
function equation(text) {
  const [l, r] = text.split(' = ').map(side);
  return [l.x - r.x, l.y - r.y, r.c - l.c];
}
const holds = ([a, b, c], x, y) => a * x + b * y === c;

for (const id of PARTS) {
  test(`${id}: the answer solves the system; mistakes wrong, recognised, and point here`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const a = p.answer;
      if (a.type === 'choice') {
        const [e1, e2] = t.split(' and ').map(equation);
        const det = e1[0] * e2[1] - e1[1] * e2[0];
        const sameLine = det === 0 && e1[0] * e2[2] === e2[0] * e1[2] && e1[1] * e2[2] === e2[1] * e1[2];
        assert.equal(a.options[a.correct], det !== 0 ? 'One solution' : sameLine ? 'Infinitely many' : 'No solution', t);
        for (const m of p.misconceptions) {
          assert.equal(catalog.get(m.id), id, m.id);
          assert.equal(checkAnswer(p, { choice: m.choice }).misconception, m.id, t);
        }
        continue;
      }
      assert.equal(a.type, 'point');
      if (p.expression.type === 'graph') {
        for (const [[x1, y1], [x2, y2]] of p.expression.lines) {
          // (x, y) is on the line through the two points.
          assert.equal((a.x - x1) * (y2 - y1), (a.y - y1) * (x2 - x1), `${t}: (${a.x}, ${a.y})`);
        }
      } else {
        const eqs = t.split(' and ').map(equation);
        assert.equal(eqs.length, 2);
        for (const e of eqs) assert.ok(holds(e, a.x, a.y), `${t}: (${a.x}, ${a.y})`);
        assert.notEqual(eqs[0][0] * eqs[1][1] - eqs[0][1] * eqs[1][0], 0, `${t}: exactly one solution`);
      }
      assert.equal(checkAnswer(p, { boxes: [a.x, a.y] }).status, 'correct');
      for (const m of p.misconceptions) {
        // Writing (y, x) can happen in any part; it points to the graph part (the solution is a point).
        assert.equal(catalog.get(m.id), m.id === 'alg.systems-swapped' ? 'alg.systems.graph' : id, m.id);
        const r = checkAnswer(p, { boxes: [m.value.x, m.value.y] });
        assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
        assert.equal(r.misconception, m.id, t);
      }
    }
  });
}

test('systems: every catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].filter((k) => PARTS.includes(catalog.get(k))).sort());
  assert.ok(seen.has('alg.systems-swapped'));
});

test('the planted mistakes are what they say: multiplying one side, not distributing', () => {
  for (const seed of SEEDS) {
    const p = generateProblem('alg.systems.eliminate', seed, 3);
    const m = p.misconceptions.find((x) => x.id === 'alg.systems-multiply-one-side');
    if (!m) continue;
    const [e1, e2] = toText(p.expression).split(' and ').map(equation);
    const k = e1[0]; // the second equation (x ± y) multiplied by the first one's x-coefficient, left side only
    assert.ok(holds(e1, m.value.x, m.value.y), 'the wrong answer still fits the first equation');
    assert.ok(holds([k * e2[0], k * e2[1], e2[2]], m.value.x, m.value.y), 'and the half-multiplied second one');
  }
});

test('the skill: one hard elimination stands for solving (any method); the graph is asked too', () => {
  const g = generators['alg.systems'];
  assert.equal(g.screener, 'alg.systems.eliminate');
  assert.deepEqual(g.covers, ['alg.systems.substitute', 'alg.systems.eliminate']);
  assert.deepEqual(g.parts, PARTS);
});
