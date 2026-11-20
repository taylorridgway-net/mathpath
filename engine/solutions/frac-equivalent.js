// Step-by-step worked solutions for equivalent fractions, built from the
// problem as displayed (like engine/solutions/frac-add-sub.js).

const frac = (n, d) => ({ type: 'frac', n, d });
const eq = (left, right) => ({ type: 'eq', left, right });
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function solveEquivalent(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  if (kind === 'frac.equivalent.scale') {
    const { n: a, d: b } = e.left;
    const k = e.right.n;
    return [
      { say: `Multiplying by ${k}/${k} is multiplying by 1, so the amount stays the same.` },
      { say: `Top: ${a} × ${k} = ${a * k}. Bottom: ${b} × ${k} = ${b * k}.` },
      { say: `So ${a}/${b} = ${a * k}/${b * k}.`, show: eq(frac(a, b), frac(a * k, b * k)) },
    ];
  }
  if (kind === 'frac.equivalent.missing') {
    const { left, right } = e;
    const g = gcd(left.n, left.d);
    const [a, b] = [left.n / g, left.d / g];
    const steps = [];
    if (g > 1) steps.push({ say: `First simplify ${left.n}/${left.d}: divide the top and bottom by ${g} to get ${a}/${b}. It's the same amount and easier to work with.` });
    if (right.n.type === 'blank') {
      const k = right.d / b;
      steps.push({ say: `What do you multiply ${b} by to get ${right.d}? ${b} × ${k} = ${right.d}.` });
      steps.push({ say: `Do the same to the top: ${a} × ${k} = ${a * k}. So ${left.n}/${left.d} = ${a * k}/${right.d}.`, show: eq(frac(left.n, left.d), frac(a * k, right.d)) });
    } else {
      const k = right.n / a;
      steps.push({ say: `What do you multiply ${a} by to get ${right.n}? ${a} × ${k} = ${right.n}.` });
      steps.push({ say: `Do the same to the bottom: ${b} × ${k} = ${b * k}. So ${left.n}/${left.d} = ${right.n}/${b * k}.`, show: eq(frac(left.n, left.d), frac(right.n, b * k)) });
    }
    return steps;
  }
  if (kind === 'frac.equivalent.simplify') {
    const { n, d } = e;
    const g = gcd(n, d);
    return [
      { say: `Find the biggest number that divides both ${n} and ${d}: ${g}. (Dividing by a smaller common factor works too; then keep going.)` },
      { say: `${n} ÷ ${g} = ${n / g} and ${d} ÷ ${g} = ${d / g}. Nothing bigger than 1 divides both ${n / g} and ${d / g}, so it's in simplest form: ${n / g}/${d / g}.`, show: eq(frac(n, d), frac(n / g, d / g)) },
    ];
  }
  throw new Error(`No worked solution for "${kind}"`);
}
