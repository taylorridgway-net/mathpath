// Step-by-step worked solutions for multiplying fractions, built from the problem as displayed.

const frac = (n, d) => ({ type: 'frac', n, d });
const int = (value) => ({ type: 'int', value });
const eq = (left, right) => ({ type: 'eq', left, right });
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const show = (n, d) => (d === 1 ? int(n) : frac(n, d));
const t = (n, d) => (d === 1 ? String(n) : `${n}/${d}`);

export function solveMultiply(problem) {
  const e = problem.expression;
  if (e.op === 'of') {
    const { n: a, d: b } = e.left;
    const k = e.right.value;
    return [
      { say: `${a}/${b} of ${k} means: split ${k} into ${b} equal groups, then take ${a} of them.` },
      { say: `One group: ${k} ÷ ${b} = ${k / b}.` },
      { say: `${a} groups: ${a} × ${k / b} = ${(a * k) / b}. So ${a}/${b} of ${k} is ${(a * k) / b}.`, show: int((a * k) / b) },
    ];
  }
  const steps = [];
  const val = (x) => (x.type === 'int' ? [x.value, 1] : [x.n, x.d]);
  const [a, b] = val(e.left);
  const [c, d] = val(e.right);
  if (e.left.type === 'int' || e.right.type === 'int') {
    const k = e.left.type === 'int' ? a : c;
    steps.push({ say: `Write ${k} as a fraction: ${k} = ${k}/1.` });
  }
  const n = a * c;
  const m = b * d;
  steps.push({ say: `Multiply the tops: ${a} × ${c} = ${n}. Multiply the bottoms: ${b} × ${d} = ${m}. That gives ${n}/${m}.` });
  const g = gcd(n, m);
  if (g > 1) {
    steps.push({ say: `Simplify: ${g} divides both ${n} and ${m}, so ${n}/${m} = ${t(n / g, m / g)}. (You can also cancel common factors before multiplying, and get the same answer.)` });
  }
  steps.push({ say: `So the answer is ${t(n / g, m / g)}.`, show: eq(e, show(n / g, m / g)) });
  return steps;
}
