// Worked solutions for multi-step equations: distribute, combine, get the x's on
// one side, then it's a two-step equation. Every step does the same thing to both
// sides, and the last step checks the answer in the original equation.

import { fraction, add, sub, mul, div, reduce } from '../math/fraction.js';

const x = { type: 'var', name: 'x' };
const eq = (left, right) => ({ type: 'eq', left, right });
const t = (f) => { const r = reduce(f); return `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}${r.d === 1 ? '' : `/${r.d}`}`; };
const showNum = (f) => { const r = reduce(f); const size = r.d === 1 ? { type: 'int', value: Math.abs(r.n) } : { type: 'frac', n: Math.abs(r.n), d: r.d }; return r.n < 0 ? (r.d === 1 ? { type: 'int', value: r.n } : { type: 'neg', of: size }) : size; };
const F = (n, d = 1) => fraction(n, d);

// A side as a linear expression: { x, k } meaning x·(coefficient) + k; plus whether it had parentheses.
function linear(node) {
  switch (node.type) {
    case 'int': return { x: F(0), k: F(node.value), paren: [] };
    case 'var': return { x: F(1), k: F(0), paren: [] };
    case 'term': return { x: F(node.coef), k: F(0), paren: [] };
    case 'scaled': {
      const i = linear(node.of);
      return { x: mul(F(node.coef), i.x), k: mul(F(node.coef), i.k), paren: [{ coef: node.coef, inner: i }] };
    }
    case 'op': {
      const a = linear(node.left);
      const b = linear(node.right);
      const s = node.op === '-' ? F(-1) : F(1);
      return { x: add(a.x, mul(s, b.x)), k: add(a.k, mul(s, b.k)), paren: [...a.paren, ...b.paren] };
    }
    default: throw new Error(`multi-step: can't read ${node.type}`);
  }
}

// "3x + 12", "−2x", "5" for a linear expression.
function text({ x: c, k }) {
  const xs = c.n === 0 ? '' : `${reduce(c).n === reduce(c).d ? '' : reduce(c).n === -reduce(c).d ? '−' : t(c)}x`;
  if (!xs) return t(k);
  if (k.n === 0) return xs;
  return `${xs} ${k.n < 0 ? '−' : '+'} ${t(F(Math.abs(k.n), k.d))}`;
}
const termNode = (c) => (reduce(c).n === reduce(c).d ? x : { type: 'term', coef: reduce(c).d === 1 ? reduce(c).n : { type: 'frac', n: reduce(c).n, d: reduce(c).d }, name: 'x' });
function node({ x: c, k }) {
  if (c.n === 0) return showNum(k);
  if (k.n === 0) return termNode(c);
  return { type: 'op', op: k.n < 0 ? '-' : '+', left: termNode(c), right: showNum(F(Math.abs(k.n), k.d)) };
}

export function solveMultiStep(problem) {
  const e = problem.expression;
  const L = linear(e.left);
  const R = linear(e.right);
  const steps = [];
  if (L.paren.length || R.paren.length) {
    const said = [...L.paren, ...R.paren].map((p) => `${p.coef < 0 ? `(${t(F(p.coef))})` : p.coef}(${text(p.inner)}) = ${text({ x: mul(F(p.coef), p.inner.x), k: mul(F(p.coef), p.inner.k) })}`);
    steps.push({ say: `Distribute: multiply every term in the parentheses. ${said.join('; ')}. Now it reads ${text(L)} = ${text(R)}.`, show: eq(node(L), node(R)) });
  } else if (e.left.type === 'op' && linear(e.left.left).x.n && linear(e.left.right).x.n) {
    steps.push({ say: `Combine like terms: ${text(L)} = ${text(R)}.`, show: eq(node(L), node(R)) });
  }
  // Get the x's on the left.
  let A = L.x; const B = L.k; const C = R.x; let D = R.k;
  if (C.n !== 0) {
    const verb = C.n > 0 ? `subtract ${text({ x: C, k: F(0) })} from` : `add ${text({ x: mul(C, F(-1)), k: F(0) })} to`;
    A = sub(A, C);
    steps.push({ say: `Get the x's on one side: ${verb} both sides. ${text({ x: A, k: B })} = ${text({ x: F(0), k: D })}.`, show: eq(node({ x: A, k: B }), showNum(D)) });
  }
  if (B.n !== 0) {
    D = sub(D, B);
    const verb = B.n > 0 ? `subtract ${t(B)} from` : `add ${t(mul(B, F(-1)))} to`;
    steps.push({ say: `Get the numbers on the other side: ${verb} both sides. ${text({ x: A, k: F(0) })} = ${t(D)}.`, show: eq(node({ x: A, k: F(0) }), showNum(D)) });
  }
  const v = div(D, A);
  if (!(A.n === A.d)) steps.push({ say: `Undo multiplying by ${t(A)}: divide both sides by ${t(A)}. x = ${t(D)} ÷ ${A.n < 0 ? `(${t(A)})` : t(A)} = ${t(v)}.`, show: eq(x, showNum(v)) });
  const lv = add(mul(L.x, v), L.k);
  steps.push({ say: `Check in the original: the left side is ${t(lv)} and the right side is ${t(add(mul(R.x, v), R.k))}. They match, so x = ${t(v)}.`, show: eq(x, showNum(v)) });
  return steps;
}
