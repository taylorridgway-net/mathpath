// Graph-inequalities paper test. Each item's 'math' is solved here from scratch with exact
// fractions (moving x to one side, dividing by its number and flipping the sign when that
// number is negative, joining a chain or an "or"), and the answer key (graph in words,
// inequality, or both) is read back and checked: same graph, word for word, and true for
// exactly the same x as the item's own inequality (tried at and around every boundary).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(readFileSync(new URL('../../curriculum/paper/alg.inequality-graphs.json', import.meta.url), 'utf8'));
const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const items = paper.versions.flatMap((v) => v.items);

// Exact fractions: [n, d] with d > 0, in lowest terms.
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const Q = (n, d = 1) => { if (d < 0) [n, d] = [-n, -d]; const g = gcd(n, d) || 1; return [n / g, d / g]; };
const qadd = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qsub = (a, b) => qadd(a, [-b[0], b[1]]);
const qmul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const qdiv = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
const qcmp = (a, b) => Math.sign(a[0] * b[1] - b[0] * a[1]);
const qeq = (a, b) => qcmp(a, b) === 0;
const COMPARE = { '<': (c) => c < 0, '≤': (c) => c <= 0, '>': (c) => c > 0, '≥': (c) => c >= 0 };
const FLIP = { '<': '>', '≤': '≥', '>': '<', '≥': '≤' };
const ASCII = { '<=': '≤', '>=': '≥', '<': '<', '>': '>' };

// "5-2x" -> { a: x's number, b: the constant }
function linear(text) {
  let a = Q(0); let b = Q(0);
  for (const t of text.replace(/-/g, '+-').split('+').filter(Boolean)) {
    const m = /^(-?)(\d*)(x?)$/.exec(t);
    assert.ok(m && (m[2] || m[3]), `bad term "${t}" in "${text}"`);
    const n = Q((m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1));
    if (m[3]) a = qadd(a, n); else b = qadd(b, n);
  }
  return { a, b };
}
const at = (e, x) => qadd(qmul(e.a, x), e.b);

// "1<5-2x<=9" -> [[left, sign, right], ...] (one comparison per sign, a chain gives two)
function comparisons(text) {
  const parts = text.split(/(<=|>=|<|>)/);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push([linear(parts[i - 1]), ASCII[parts[i]], linear(parts[i + 1])]);
  return out;
}
// INEQ -> one list of comparisons per "or" part
const parseIneq = (text) => text.split(' or ').map(comparisons);
// Is x a solution? Worked out straight from the inequality as written.
const holds = (ineq, x) => ineq.some((and) => and.every(([l, s, r]) => COMPARE[s](qcmp(at(l, x), at(r, x)))));

// Solve one comparison: ax + b (sign) cx + d -> x (sign) n, flipping when dividing by a negative.
function solveOne([l, sign, r]) {
  const a = qsub(l.a, r.a);
  assert.ok(a[0] !== 0, 'x drops out');
  const n = qdiv(qsub(r.b, l.b), a);
  return { sign: a[0] < 0 ? FLIP[sign] : sign, n };
}
const closedFor = (sign) => sign === '≤' || sign === '≥';
const isUpper = (sign) => sign === '<' || sign === '≤';

// The solution as a graph: { dots: [{ v, closed }], shade } (dots smallest first).
function solve(ineq) {
  const pieces = ineq.map((and) => {
    const conds = and.map(solveOne);
    if (conds.length === 1) return conds[0];
    const up = conds.filter((c) => isUpper(c.sign));
    const low = conds.filter((c) => !isUpper(c.sign));
    assert.ok(up.length === 1 && low.length === 1, 'a chain needs one bound on each side');
    assert.ok(qcmp(low[0].n, up[0].n) < 0, 'a chain with no solutions');
    return { between: [low[0], up[0]] };
  });
  if (pieces.length === 1) {
    const p = pieces[0];
    if (p.between) return { dots: p.between.map((c) => ({ v: c.n, closed: closedFor(c.sign) })), shade: 'between' };
    return { dots: [{ v: p.n, closed: closedFor(p.sign) }], shade: isUpper(p.sign) ? 'left' : 'right' };
  }
  assert.equal(pieces.length, 2, 'at most one "or"');
  const up = pieces.find((p) => !p.between && isUpper(p.sign));
  const low = pieces.find((p) => !p.between && !isUpper(p.sign));
  assert.ok(up && low && qcmp(up.n, low.n) < 0, '"or" needs x < a or x > b with a < b');
  return { dots: [up, low].map((c) => ({ v: c.n, closed: closedFor(c.sign) })), shade: 'outward' };
}

// 'read closed -1 open 4 between' -> the graph it describes
function readGraph(words) {
  const dots = [];
  let i = 0;
  while (words[i] === 'open' || words[i] === 'closed') { dots.push({ v: Q(Number(words[i + 1])), closed: words[i] === 'closed' }); i += 2; }
  assert.equal(i, words.length - 1, 'read: dots then a shading');
  return { dots, shade: words[i] };
}

// Writing numbers, graphs and inequalities in the key's one fixed format.
const num = ([n, d]) => (n < 0 ? '−' : '') + (d === 1 ? String(Math.abs(n)) : `${Math.abs(n)}/${d}`);
const dotText = (d) => `${d.closed ? 'closed' : 'open'} dot at ${num(d.v)}`;
const graphText = (g) => `${g.dots.map(dotText).join(' and ')}, shaded ${g.shade}`;
function ineqText(g) {
  const [p, q] = g.dots;
  if (g.shade === 'left') return `x ${p.closed ? '≤' : '<'} ${num(p.v)}`;
  if (g.shade === 'right') return `x ${p.closed ? '≥' : '>'} ${num(p.v)}`;
  if (g.shade === 'between') return `${num(p.v)} ${p.closed ? '≤' : '<'} x ${q.closed ? '≤' : '<'} ${num(q.v)}`;
  return `x ${p.closed ? '≤' : '<'} ${num(p.v)} or x ${q.closed ? '≥' : '>'} ${num(q.v)}`;
}

// Reading the key back. Numbers: "−2", "3", "5/2".
const NUM = '(−?\\d+(?:/\\d+)?)';
const readNum = (s) => { const [n, d = '1'] = s.replace('−', '-').split('/'); return Q(Number(n), Number(d)); };
function parseGraphKey(text) {
  let m = new RegExp(`^(open|closed) dot at ${NUM}, shaded (left|right)$`).exec(text);
  if (m) return { dots: [{ v: readNum(m[2]), closed: m[1] === 'closed' }], shade: m[3] };
  m = new RegExp(`^(open|closed) dot at ${NUM} and (open|closed) dot at ${NUM}, shaded (between|outward)$`).exec(text);
  assert.ok(m, `graph key "${text}" is not in the fixed format`);
  assert.ok(qcmp(readNum(m[2]), readNum(m[4])) < 0, `graph key "${text}": smaller dot first`);
  return { dots: [{ v: readNum(m[2]), closed: m[1] === 'closed' }, { v: readNum(m[4]), closed: m[3] === 'closed' }], shade: m[5] };
}
// An inequality key -> the graph it means (x is the only letter).
function parseIneqKey(text) {
  const SIGN = '([<≤>≥])';
  let m = new RegExp(`^x ${SIGN} ${NUM}$`).exec(text);
  if (m) return { dots: [{ v: readNum(m[2]), closed: closedFor(m[1]) }], shade: isUpper(m[1]) ? 'left' : 'right' };
  m = new RegExp(`^${NUM} ([<≤]) x ([<≤]) ${NUM}$`).exec(text);
  if (m) return { dots: [{ v: readNum(m[1]), closed: m[2] === '≤' }, { v: readNum(m[4]), closed: m[3] === '≤' }], shade: 'between' };
  m = new RegExp(`^x ([<≤]) ${NUM} or x ([>≥]) ${NUM}$`).exec(text);
  assert.ok(m, `inequality key "${text}" is not in the fixed format`);
  return { dots: [{ v: readNum(m[2]), closed: m[1] === '≤' }, { v: readNum(m[4]), closed: m[3] === '≥' }], shade: 'outward' };
}
// Is x shaded on this graph?
function onGraph(g, x) {
  const [p, q] = g.dots;
  const cp = qcmp(x, p.v);
  if (g.shade === 'left') return cp < 0 || (cp === 0 && p.closed);
  if (g.shade === 'right') return cp > 0 || (cp === 0 && p.closed);
  const cq = qcmp(x, q.v);
  if (g.shade === 'between') return (cp > 0 || (cp === 0 && p.closed)) && (cq < 0 || (cq === 0 && q.closed));
  return cp < 0 || (cp === 0 && p.closed) || cq > 0 || (cq === 0 && q.closed);
}

// What each item asks for, worked out from its math.
function expected(math) {
  const [kind, ...rest] = math.split(' ');
  if (kind === 'read') {
    const g = readGraph(rest);
    return { kind, graph: g, text: ineqText(g), isSolution: (x) => onGraph(g, x) };
  }
  const ineq = parseIneq(rest.join(' '));
  const g = solve(ineq);
  const text = kind === 'graph' ? graphText(g) : `${ineqText(g)}; ${graphText(g)}`;
  assert.ok(kind === 'graph' || kind === 'solve-graph', `unknown math "${math}"`);
  return { kind, ineq, graph: g, text, isSolution: (x) => holds(ineq, x) };
}
const keyOf = (item) => item.answer.split(' (')[0];
// Test points: every boundary, a half either side, and far out.
const samples = (g) => g.dots.flatMap((d) => [d.v, qsub(d.v, Q(1, 2)), qadd(d.v, Q(1, 2)), qsub(d.v, Q(10)), qadd(d.v, Q(10))]);

test('graph inequalities: every key is in the fixed format and matches the worked-out answer exactly', () => {
  for (const item of items) {
    const want = expected(item.math);
    const key = keyOf(item);
    assert.equal(key, want.text, `${item.id}: key "${key}" but ${item.math} gives "${want.text}"`);
    // Read the key back and check it means the same set of numbers as the item itself.
    let keyGraphs;
    if (want.kind === 'graph') keyGraphs = [parseGraphKey(key)];
    else if (want.kind === 'read') keyGraphs = [parseIneqKey(key)];
    else {
      const [ineq, graph] = key.split('; ');
      keyGraphs = [parseIneqKey(ineq), parseGraphKey(graph)];
    }
    for (const g of keyGraphs) {
      assert.deepEqual(g, want.graph, `${item.id}: key reads as a different graph`);
      for (const x of samples(want.graph)) assert.equal(onGraph(g, x), want.isSolution(x), `${item.id} at x = ${num(x)}`);
    }
  }
});

test('graph inequalities: the solver flips the sign when dividing by a negative', () => {
  assert.equal(graphText(solve(parseIneq('-2x>6'))), 'open dot at −3, shaded left');
  assert.equal(ineqText(solve(parseIneq('1<5-2x<=9'))), '−2 ≤ x < 2');
  assert.equal(ineqText(solve(parseIneq('3<x'))), 'x > 3');
  assert.equal(ineqText(solve(parseIneq('2x<=-1 or -x<-4'))), 'x ≤ −1/2 or x > 4');
});

test(`graph inequalities: prompts show every number; ${rules.outOf} items, word problems, an "is this right?", A and B differ`, () => {
  for (const item of items) {
    const shown = item.prompt.match(/\d+/g) || [];
    for (const n of item.math.match(/\d+/g)) assert.ok(shown.includes(n), `${item.id}: ${n} not in the prompt`);
  }
  for (const v of paper.versions) {
    assert.equal(v.items.length, rules.outOf, v.id);
    assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, `${v.id}: word problems`);
    assert.ok(v.items.some((i) => /right\?/.test(i.prompt)), `${v.id}: an "is this right?" item`);
    const want = v.items.map((i) => expected(i.math));
    assert.ok(want.some((w) => w.kind === 'read'), `${v.id}: a write-the-inequality item`);
    assert.ok(want.some((w) => w.graph.shade === 'between'), `${v.id}: a "between" item`);
    assert.ok(want.some((w) => w.graph.shade === 'outward'), `${v.id}: an "or" item`);
    assert.ok(want.some((w) => w.kind === 'solve-graph' && w.ineq.flat().some(([l, , r]) => qcmp(qsub(l.a, r.a), Q(0)) < 0)), `${v.id}: a solve item that flips the sign`);
    const workToDo = (e) => !qeq(e.b, Q(0)) || !(qeq(e.a, Q(1)) || qeq(e.a, Q(-1)));
    assert.ok(want.some((w) => w.kind === 'solve-graph' && w.ineq[0].length === 2 && workToDo(w.ineq[0][0][2])), `${v.id}: a compound inequality to solve first`);
  }
  const [a, b] = paper.versions.map((v) => v.items);
  for (const i of a) for (const j of b) {
    assert.notEqual(i.math, j.math, `${i.id} and ${j.id} repeat`);
    assert.notEqual(keyOf(i), keyOf(j), `${i.id} and ${j.id} have the same answer`);
  }
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'item ids are unique');
});
