// Step-by-step worked solutions for negative fractions, built from the problem as displayed.

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;
const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const show = (n, d) => {
  const f = d === 1 ? int(Math.abs(n)) : frac(Math.abs(n), d);
  return n < 0 ? (d === 1 ? int(n) : { type: 'neg', of: f }) : f;
};
const eq = (left, right) => ({ type: 'eq', left, right });
const t = (n, d) => (d === 1 ? (n < 0 ? `−${-n}` : String(n)) : `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`);
const p = (n, d) => (n < 0 ? `(${t(n, d)})` : t(n, d)); // after an operation sign
const val = (x) => (x.type === 'neg' ? [-x.of.n, x.of.d] : [x.n, x.d]);

function simplifySteps(n, d) {
  const g = gcd(Math.abs(n), d);
  return g > 1 ? [{ say: `Simplify: ${g} divides both ${Math.abs(n)} and ${d}, so ${t(n, d)} = ${t(n / g, d / g)}.` }] : [];
}

function done(e, n, d) {
  const g = gcd(Math.abs(n), d);
  return { say: `So the answer is ${t(n / g, d / g)}.`, show: eq(e, show(n / g, d / g)) };
}

export function solveSigned(problem) {
  const e = problem.expression;
  if (e.type === 'frac') {
    const { n, d } = e;
    const steps = [];
    if (n < 0 && d < 0) steps.push({ say: `A negative divided by a negative is positive, so (−${-n})/(−${-d}) = ${-n}/${-d}.` });
    else steps.push({ say: `A negative divided by a positive (or a positive divided by a negative) is negative. Put the sign in front: ${t(n < 0 || d < 0 ? -Math.abs(n) : n, Math.abs(d))}.` });
    const top = n < 0 && d < 0 ? -n : -Math.abs(n);
    return [...steps, ...simplifySteps(top, Math.abs(d)), done(e, top, Math.abs(d))];
  }
  let [a, b] = val(e.left);
  let [c, d] = val(e.right);
  const steps = [];
  if (e.op === '+' || e.op === '-') {
    if (e.op === '-') {
      steps.push({ say: `Subtracting is the same as adding the opposite: ${t(a, b)} − ${p(c, d)} = ${t(a, b)} + ${p(-c, d)}.` });
      c = -c;
    }
    const m = lcm(b, d);
    if (b !== d) steps.push({ say: `Common denominator ${m}: ${t(a, b)} = ${t((a * m) / b, m)} and ${t(c, d)} = ${t((c * m) / d, m)}.` });
    const [x, y] = [(a * m) / b, (c * m) / d];
    steps.push({ say: `Add the tops with the integer rules: ${t(x, 1)} + ${p(y, 1)} = ${t(x + y, 1)}. Keep the bottom: ${t(x + y, m)}.` });
    return [...steps, ...simplifySteps(x + y, m), done(e, x + y, m)];
  }
  // × or ÷: the sign first, then the sizes.
  const negatives = [a, c].filter((v) => v < 0).length;
  steps.push({ say: negatives === 1 ? 'Sign first: one negative, so the answer is negative.' : 'Sign first: two negatives, so the answer is positive.' });
  const sign = negatives === 1 ? -1 : 1;
  [a, c] = [Math.abs(a), Math.abs(c)];
  if (e.op === '÷') {
    steps.push({ say: `Dividing by ${c}/${d} is multiplying by its reciprocal, ${d}/${c}.` });
    [c, d] = [d, c];
  }
  steps.push({ say: `Multiply the sizes: ${a} × ${c} = ${a * c} on top, ${b} × ${d} = ${b * d} on the bottom: ${t(sign * a * c, b * d)}.` });
  return [...steps, ...simplifySteps(sign * a * c, b * d), done(e, sign * a * c, b * d)];
}
