// Step-by-step worked solutions for dividing fractions, built from the problem as displayed.

const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const val = (x) => (x.type === 'int' ? [x.value, 1] : [x.n, x.d]);
const show = (n, d) => (d === 1 ? int(n) : frac(n, d));
const t = (n, d) => (d === 1 ? String(n) : `${n}/${d}`);
const PIECES = { 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 11: 'elevenths', 12: 'twelfths' };

export function solveDivide(problem) {
  const kind = problem.part || problem.generator;
  if (kind === 'frac.divide.stacked') {
    // The big fraction bar means divide: top ÷ bottom. Then divide as usual.
    const { n: top, d: bottom } = problem.expression;
    const [a, b] = val(top);
    const [c, d] = val(bottom);
    const asDivision = op('÷', top, bottom);
    return [
      { say: `The big fraction bar means divide: the top ÷ the bottom. So this is ${t(a, b)} ÷ ${t(c, d)}.`, show: eq(problem.expression, asDivision) },
      ...solveDivide({ ...problem, part: 'frac.divide.multiply-reciprocal', expression: asDivision }),
    ];
  }
  const e = problem.expression;
  if (kind === 'frac.divide.reciprocal') {
    const [a, b] = val(e);
    const lead = b === 1 ? `Write ${a} as ${a}/1. ` : '';
    return [
      { say: `${lead}To get the reciprocal, flip the fraction: the top and bottom swap places.` },
      { say: `The reciprocal of ${t(a, b)} is ${a === 1 ? `${b}/1, which is ${b}` : t(b, a)}. (Check: ${t(a, b)} × ${t(b, a)} = 1.)`, show: show(b, a) },
    ];
  }
  const [a, b] = val(e.left);
  const [c, d] = val(e.right);
  if (kind === 'frac.divide.meaning') {
    // Count in pieces of size 1/d: rewrite the first number in those pieces.
    const pieces = (a * d) / b;
    const steps = [];
    if (b === 1) steps.push({ say: `Each whole has ${d} ${PIECES[d]}, so ${a} wholes have ${a} × ${d} = ${pieces} ${PIECES[d]}.` });
    else steps.push({ say: `Write ${a}/${b} in ${PIECES[d]}: ${a}/${b} = ${pieces}/${d}. That's ${pieces} ${PIECES[d]}.` });
    if (c === 1) steps.push({ say: `Each 1/${d} is one of those pieces, so ${pieces} of them fit. The answer is ${pieces}.`, show: eq(e, int(pieces)) });
    else steps.push({ say: `Each ${c}/${d} uses ${c} pieces: ${pieces} ÷ ${c} = ${pieces / c}. The answer is ${pieces / c}.`, show: eq(e, int(pieces / c)) });
    return steps;
  }
  const steps = [];
  if (e.right.type === 'int') steps.push({ say: `Write ${c} as ${c}/1.` });
  steps.push({
    say: `Dividing by ${t(c, d)} is the same as multiplying by its reciprocal, ${t(d, c)}. Keep the first number, change ÷ to ×, flip the second.`,
    show: eq(e, op('×', show(a, b), show(d, c))),
  });
  const n = a * d;
  const m = b * c;
  steps.push({ say: `Multiply the tops: ${a} × ${d} = ${n}. Multiply the bottoms: ${b} × ${c} = ${m}. That gives ${n}/${m}.` });
  const g = gcd(n, m);
  if (g > 1) steps.push({ say: `Simplify: ${g} divides both ${n} and ${m}, so ${n}/${m} = ${t(n / g, m / g)}.` });
  steps.push({ say: `So the answer is ${t(n / g, m / g)}.`, show: eq(e, show(n / g, m / g)) });
  return steps;
}
