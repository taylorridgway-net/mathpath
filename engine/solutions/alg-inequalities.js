// Worked solutions for inequalities: solve like an equation, doing the same to both
// sides; when dividing both sides by a negative number, flip the sign. Then check
// with a number that should work.

import { fraction, add, sub, mul, div, reduce, compare } from '../math/fraction.js';

const x = { type: 'var', name: 'x' };
const F = (n, d = 1) => fraction(n, d);
const t = (f) => { const r = reduce(f); return `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}${r.d === 1 ? '' : `/${r.d}`}`; };
const showNum = (f) => { const r = reduce(f); const size = r.d === 1 ? { type: 'int', value: Math.abs(r.n) } : { type: 'frac', n: Math.abs(r.n), d: r.d }; return r.n < 0 ? (r.d === 1 ? { type: 'int', value: r.n } : { type: 'neg', of: size }) : size; };
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const holds = (l, sign, r) => { const c = compare(l, r); return { '<': c < 0, '≤': c <= 0, '>': c > 0, '≥': c >= 0 }[sign]; };

export function solveInequality(problem) {
  const e = problem.expression;
  const sign0 = e.op;
  const left = e.left;
  const c = F(e.right.value);
  const xNode = left.type === 'op' ? left.left : left;
  const a = xNode.type === 'var' ? 1 : xNode.coef;
  const b = left.type === 'op' ? (left.op === '+' ? left.right.value : -left.right.value) : 0;
  const ax = a === 1 ? 'x' : a === -1 ? '−x' : `${t(F(a))}x`;
  const steps = [];
  let rhs = c;
  if (b !== 0) {
    rhs = sub(c, F(b));
    steps.push({ say: `${b > 0 ? `Subtract ${b} from` : `Add ${-b} to`} both sides, just like an equation. ${ax} ${sign0} ${t(rhs)}.`, show: { type: 'ineq', op: sign0, left: xNode, right: showNum(rhs) } });
  }
  const v = div(rhs, F(a));
  const sign = a < 0 ? FLIP[sign0] : sign0;
  if (a !== 1) {
    steps.push({
      say: a < 0
        ? `Divide both sides by ${t(F(a))}. Dividing by a negative number flips the sign: ${sign0} becomes ${sign}. x ${sign} ${t(v)}.`
        : `Divide both sides by ${a}. Dividing by a positive number keeps the sign. x ${sign} ${t(v)}.`,
      show: { type: 'ineq', op: sign, left: x, right: showNum(v) },
    });
  }
  // Check with a whole number that should work (and is easy to put in).
  const lo = Math.floor(v.n / v.d);
  const tryN = sign === '>' || sign === '≥' ? lo + (sign === '≥' && v.d === 1 ? 0 : 1) + 1 : lo - 1;
  const lv = add(mul(F(a), F(tryN)), F(b));
  steps.push({
    say: `Check with a number that should work, like ${tryN}: ${t(lv)} ${sign0} ${t(c)} is ${holds(lv, sign0, c) ? 'true' : 'false'}. So x ${sign} ${t(v)}.`,
    show: { type: 'ineq', op: sign, left: x, right: showNum(v) },
  });
  return steps;
}
