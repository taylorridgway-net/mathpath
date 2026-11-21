// Graphing inequalities: every answer graph is checked against the inequality itself.
// The shown text is turned into a JavaScript test of x (chains and "and"/"or" included)
// and compared with the graph at every half-step along the line, so dots, open/closed and
// shading are all checked independently. Mistakes are wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { keypadOptionsFor } from '../../../web/components/keypad.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `ig-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/alg.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('alg.inequality-graphs.'));
const CMP = /(<=|>=|<|>)/g;

// "x < -3 or x ≥ 4", "-4 ≤ x ≤ 0", "4 < 3x + 4 < 22", "3 > x" -> a function of x.
function inequality(text) {
  const js = (one) => {
    const s = one.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/(\d)x/g, '$1*x');
    const pieces = s.split(CMP).map((p) => p.trim());
    if (pieces.length === 5) return `(${pieces[0]} ${pieces[1]} ${pieces[2]}) && (${pieces[2]} ${pieces[3]} ${pieces[4]})`; // a chain
    return s;
  };
  const body = text.split(/ (and|or) /).map((p) => (p === 'and' ? '&&' : p === 'or' ? '||' : `(${js(p)})`)).join(' ');
  return Function('x', `"use strict"; return ${body};`);
}
// A graph's membership: is t shaded (or a closed dot)?
function onGraph({ points, shade }, t) {
  const [a, b] = [points[0], points[1]];
  const at = (p) => t === p.v && p.closed;
  if (points.some((p) => t === p.v)) return points.some(at);
  if (shade === 'left') return t < a.v;
  if (shade === 'right') return t > a.v;
  if (shade === 'between') return t > a.v && t < b.v;
  return t < a.v || t > b.v;
}
const grid = (lo, hi) => Array.from({ length: (hi - lo + 6) * 2 + 1 }, (_, i) => lo - 3 + i / 2);
const sameSet = (f, g, lo, hi) => grid(lo, hi).every((t) => Boolean(f(t)) === Boolean(g(t)));

for (const id of PARTS) {
  test(`${id}: the graph (or inequality) matches the problem exactly; mistakes are wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const a = p.answer;
      if (a.type === 'numline') {
        const truth = inequality(t);
        assert.ok(sameSet(truth, (v) => onGraph(a, v), a.lo, a.hi), `${t}: ${JSON.stringify(a)}`);
        // Every dot is on the line shown, not at its very ends.
        for (const q of a.points) assert.ok(q.v > a.lo && q.v < a.hi, t);
        assert.equal(keypadOptionsFor(p).answerKind, 'numline');
        assert.equal(keypadOptionsFor(p).count, a.points.length);
        // In any order, the right graph is accepted.
        assert.equal(checkAnswer(p, { points: [...a.points].reverse(), shade: a.shade }).status, 'correct');
        for (const m of p.misconceptions) {
          assert.ok(catalog.get(m.id), m.id);
          assert.ok(!sameSet(truth, (v) => onGraph(m.value, v), a.lo, a.hi), `${t}: ${m.id} is right`);
          const r = checkAnswer(p, m.value);
          assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
          assert.equal(r.misconception, m.id);
        }
      } else {
        // Reading a graph: the inequality typed must describe the same set.
        assert.equal(a.type, 'inequality');
        const shown = p.expression;
        const typed = inequality(`x ${a.sign} ${a.value.n / a.value.d}`);
        assert.ok(sameSet(typed, (v) => onGraph(shown, v), shown.lo, shown.hi), `${t}: x ${a.sign} ${a.value.n}`);
        const raw = (sign, v) => ({ sign, whole: Math.abs(v.n), ...(v.n < 0 ? { negative: true } : {}) });
        assert.equal(checkAnswer(p, raw(a.sign, a.value)).status, 'correct');
        for (const m of p.misconceptions) {
          assert.ok(catalog.get(m.id), m.id);
          const r = checkAnswer(p, raw(m.sign, m.value));
          assert.equal(r.status, 'wrong', `${t}: ${m.id}`);
          assert.equal(r.misconception, m.id);
        }
      }
    }
  });
}

test('graphing: levels do what they say; every catalog mistake for graphs is generated', () => {
  const all = (id, d) => SEEDS.map((s) => generateProblem(id, s, d));
  assert.ok(all('alg.inequality-graphs.graph', 2).every((p) => /^-?\d+ /.test(toText(p.expression))), 'level 2: the number first');
  assert.ok(all('alg.inequality-graphs.graph', 3).some((p) => p.misconceptions.some((m) => m.id === 'alg.ineq-no-flip')), 'level 3: some need a flip');
  assert.ok(all('alg.inequality-graphs.compound', 2).some((p) => p.answer.shade === 'outside'));
  assert.ok(all('alg.inequality-graphs.compound', 2).some((p) => / and /.test(toText(p.expression))));
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const p of all(id, d)) for (const m of p.misconceptions) seen.add(m.id);
  for (const id of ['alg.ineq-graph-dot', 'alg.ineq-graph-direction', 'alg.ineq-graph-reversed', 'alg.compound-and-or']) assert.ok(seen.has(id), id);
});

test('number-line answers: wrong count or missing shading is not graded', () => {
  const p = generateProblem('alg.inequality-graphs.compound', 'x', 1);
  assert.equal(checkAnswer(p, { points: [p.answer.points[0]], shade: 'between' }).status, 'invalid');
  assert.equal(checkAnswer(p, { points: p.answer.points }).status, 'invalid');
  assert.equal(checkAnswer(p, {}).status, 'invalid');
});
