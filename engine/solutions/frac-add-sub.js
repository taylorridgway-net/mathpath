// Step-by-step worked solutions for fraction add/subtract problems.
//
// Built from the problem as displayed (its expression), never from stored
// answers, so the solution always matches what the student saw.
// Used for worked examples in lessons and after a student misses twice.
//
// A solution is a list of steps: { say, show? }
//   say   one or two plain sentences
//   show  an expression to draw (see engine/problem/text.js), usually an equation

import { gcd, lcm } from '../math/fraction.js';

const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });

export function solveAddSub(problem) {
  const e = problem.expression;
  switch (problem.generator) {
    case 'frac.add-sub.common-denom':
      return commonDenominatorSteps(e.items[0].d, e.items[1].d);
    case 'frac.add-sub.rewrite':
      return rewriteSteps(e.left.n, e.left.d, e.right.d);
    case 'frac.add-sub.combine':
    case 'frac.add-sub.simplify-result':
      return combineSteps(e.left, e.right, e.op);
    case 'frac.add-sub':
      return fullSteps(e.left, e.right, e.op);
    default:
      throw new Error(`No worked solution for "${problem.generator}"`);
  }
}

function commonDenominatorSteps(b, d) {
  const [small, big] = b < d ? [b, d] : [d, b];
  const least = lcm(b, d);
  const steps = [];
  if (big % small === 0) {
    steps.push({ say: `${small} divides into ${big} (${small} × ${big / small} = ${big}), so ${big} is a common denominator.` });
  } else {
    const multiples = [];
    for (let m = big; m <= least; m += big) multiples.push(m);
    steps.push({ say: `Count by ${big}: ${multiples.join(', ')}. Stop at the first number ${small} also divides into: ${least} (${small} × ${least / small} = ${least}).` });
    if (b * d !== least) {
      steps.push({ say: `Multiplying the denominators also works: ${b} × ${d} = ${b * d}. ${least} is just smaller and easier.` });
    }
  }
  steps.push({ say: `A common denominator is ${least}.`, show: int(least) });
  return steps;
}

function rewriteSteps(a, b, target) {
  const k = target / b;
  return [
    { say: `What do you multiply ${b} by to get ${target}? ${b} × ${k} = ${target}.`, show: eq(op('×', int(b), int(k)), int(target)) },
    { say: `Multiply the numerator by the same number: ${a} × ${k} = ${a * k}.`, show: eq(op('×', int(a), int(k)), int(a * k)) },
    { say: `So ${a}/${b} = ${a * k}/${target}. Same amount, smaller pieces.`, show: eq(frac(a, b), frac(a * k, target)) },
  ];
}

function combineSteps(x, y, sym) {
  const verb = sym === '+' ? 'Add' : 'Subtract';
  const n = sym === '+' ? x.n + y.n : x.n - y.n;
  const steps = [{
    say: `The denominators are both ${x.d}, so the pieces are the same size. ${verb} the numerators and keep the denominator.`,
    show: eq(op(sym, frac(x.n, x.d), frac(y.n, y.d)), frac(n, x.d)),
  }];
  return steps.concat(simplifySteps(n, x.d));
}

function simplifySteps(n, d) {
  const g = gcd(n, d);
  if (g === 1) return [{ say: `${n} and ${d} have no common factor, so ${n}/${d} is already in simplest form.`, show: frac(n, d) }];
  const result = d / g === 1 ? int(n / g) : frac(n / g, d / g);
  const where = d / g === 1 ? ` That's the whole number ${n / g}.` : '';
  return [{
    say: `${n} and ${d} share a factor of ${g}. Divide the top and bottom by ${g}.${where}`,
    show: eq(frac(n, d), result),
  }];
}

function fullSteps(x, y, sym) {
  const common = lcm(x.d, y.d);
  const kx = common / x.d;
  const ky = common / y.d;
  const steps = [];
  steps.push({ say: `Step 1. Find a common denominator for ${x.d} and ${y.d}: ${common}.`, show: int(common) });
  steps.push({
    say: `Step 2. Rewrite both fractions over ${common}. Multiply top and bottom of ${x.n}/${x.d} by ${kx}, and of ${y.n}/${y.d} by ${ky}.`,
    show: { type: 'list', items: [eq(frac(x.n, x.d), frac(x.n * kx, common)), eq(frac(y.n, y.d), frac(y.n * ky, common))] },
  });
  const [first, ...rest] = combineSteps(frac(x.n * kx, common), frac(y.n * ky, common), sym);
  steps.push({ ...first, say: `Step 3. ${first.say}` });
  for (const s of rest) steps.push({ ...s, say: `Step 4. ${s.say}` });
  return steps;
}
