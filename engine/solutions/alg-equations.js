// Step-by-step worked solutions for one- and two-step equations: undo what was
// done to x, in reverse order, doing the same to both sides; then check.

import { fraction, add, sub, mul, div, reduce } from '../math/fraction.js';

const x = { type: 'var', name: 'x' };
const eq = (left, right) => ({ type: 'eq', left, right });
const t = (f) => { const r = reduce(f); return `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}${r.d === 1 ? '' : `/${r.d}`}`; };
const p = (f) => (f.n < 0 ? `(${t(f)})` : t(f)); // after an operation sign
const show = (f) => { const r = reduce(f); const size = r.d === 1 ? { type: 'int', value: Math.abs(r.n) } : { type: 'frac', n: Math.abs(r.n), d: r.d }; return r.n < 0 ? (r.d === 1 ? { type: 'int', value: r.n } : { type: 'neg', of: size }) : size; };

const value = (node) => {
  if (node.type === 'int') return fraction(node.value);
  if (node.type === 'frac' && typeof node.n === 'number') return fraction(node.n, node.d);
  if (node.type === 'neg') return mul(value(node.of), fraction(-1));
  throw new Error(`not a number: ${node.type}`);
};
// The x part: what multiplies x (x/4 is x times 1/4), and how it's written.
function xPart(node) {
  if (node.type === 'var') return { coef: fraction(1), text: 'x' };
  if (node.type === 'term') {
    const c = typeof node.coef === 'number' ? fraction(node.coef) : fraction(node.coef.n, node.coef.d);
    return { coef: c, text: typeof node.coef === 'number' ? `${node.coef === -1 ? '−' : t(c)}x` : `(${t(c)})x` };
  }
  if (node.type === 'frac' && node.n.type === 'var') return { coef: fraction(1, node.d), text: `x/${node.d < 0 ? `(${node.d})` : node.d}`, over: node.d };
  return null;
}

function undoMultiply(part, rhs) {
  const { coef } = part;
  const v = div(rhs, coef);
  if (part.over !== undefined) {
    return { v, say: `Undo dividing by ${t(fraction(part.over))}: multiply both sides by ${t(fraction(part.over))}. x = ${t(rhs)} × ${p(fraction(part.over))} = ${t(v)}.` };
  }
  if (coef.d !== 1) {
    const r = fraction(coef.d * Math.sign(coef.n), Math.abs(coef.n));
    return { v, say: `Undo multiplying by ${t(coef)}: multiply both sides by its reciprocal, ${t(r)}. x = ${t(rhs)} × ${p(r)} = ${t(v)}.` };
  }
  return { v, say: `Undo multiplying by ${t(coef)}: divide both sides by ${t(coef)}. x = ${t(rhs)} ÷ ${p(coef)} = ${t(v)}.` };
}

export function solveEquation(problem) {
  const { left, right } = problem.expression;
  const rhs = value(right);
  const steps = [];
  let v;
  const one = xPart(left);
  if (one) {
    const r = undoMultiply(one, rhs);
    v = r.v;
    steps.push({ say: r.say, show: eq(x, show(v)) });
  } else {
    // left is an op: (x part) ± number, or number + x
    const xOnLeft = Boolean(xPart(left.left));
    const part = xPart(xOnLeft ? left.left : left.right);
    const k = value(xOnLeft ? left.right : left.left);
    const added = left.op === '+';
    const kText = t(k);
    const afterFirst = added ? sub(rhs, k) : add(rhs, k);
    const undo = added
      ? `Undo adding ${kText}: subtract ${kText} from both sides. ${part.text} = ${t(rhs)} − ${p(k)} = ${t(afterFirst)}.`
      : `Undo subtracting ${kText}: add ${kText} to both sides. ${part.text} = ${t(rhs)} + ${p(k)} = ${t(afterFirst)}.`;
    const twoSteps = part.coef.n !== part.coef.d;
    steps.push({ say: twoSteps ? `${part.text} had ${added ? kText + ' added' : kText + ' subtracted'} last, so undo that first. ${undo}` : undo });
    if (twoSteps) {
      const r = undoMultiply(part, afterFirst);
      v = r.v;
      steps.push({ say: `Now ${r.say[0].toLowerCase()}${r.say.slice(1)}`, show: eq(x, show(v)) });
    } else {
      v = afterFirst;
      steps[0].show = eq(x, show(v));
    }
  }
  steps.push({ say: `Check: put ${t(v)} in for x, and both sides come out to ${t(rhs)}. So x = ${t(v)}.`, show: eq(x, show(v)) });
  return steps;
}
