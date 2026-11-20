// Step-by-step worked solutions for "Understand fractions", built from the
// problem as displayed.

const frac = (n, d) => ({ type: 'frac', n, d });
const eq = (left, right) => ({ type: 'eq', left, right });

export function solveMeaning(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  if (kind === 'frac.meaning.read-models') {
    const unit = e.shape === 'set' ? 'dots' : 'equal parts';
    return [
      { say: `Count all the ${unit}: ${e.parts}. That's the bottom number, the denominator.` },
      { say: `Count the shaded ones: ${e.shaded}. That's the top number, the numerator.` },
      { say: `So ${e.shaded}/${e.parts} is shaded.`, show: frac(e.shaded, e.parts) },
    ];
  }
  if (kind === 'frac.meaning.number-line') {
    const { perUnit, point } = e;
    const steps = [
      { say: `Look between 0 and 1: it's cut into ${perUnit} equal spaces (count the spaces, not the marks). So each space is 1/${perUnit}.` },
      { say: `Count spaces from 0 to the dot: ${point}. So the dot is at ${point}/${perUnit}.`, show: frac(point, perUnit) },
    ];
    if (point > perUnit) {
      steps.push({ say: `That's ${Math.floor(point / perUnit)} whole${point >= 2 * perUnit ? 's' : ''} and ${point % perUnit}/${perUnit} more: ${point}/${perUnit} = ${Math.floor(point / perUnit)} ${point % perUnit}/${perUnit}.` });
    }
    return steps;
  }
  if (kind === 'frac.meaning.division') {
    if (e.type === 'frac') {
      return [
        { say: `A fraction bar means divide: ${e.n}/${e.d} = ${e.n} ÷ ${e.d}.` },
        { say: `${e.n} ÷ ${e.d} = ${e.n / e.d}, so ${e.n}/${e.d} = ${e.n / e.d}.`, show: eq(frac(e.n, e.d), { type: 'int', value: e.n / e.d }) },
      ];
    }
    const [a, b] = [e.left.value, e.right.value];
    const steps = [
      { say: `${a} ÷ ${b} means ${a} shared equally into ${b} parts. Each part is ${a}/${b}: the number being divided goes on top.` },
      { say: `So ${a} ÷ ${b} = ${a}/${b}.`, show: eq({ type: 'op', op: '÷', left: { type: 'int', value: a }, right: { type: 'int', value: b } }, frac(a, b)) },
    ];
    if (a > b) steps.push({ say: `As a mixed number: ${b} goes into ${a} ${Math.floor(a / b)} times with ${a % b} left, so ${a}/${b} = ${Math.floor(a / b)} ${a % b}/${b}.` });
    return steps;
  }
  throw new Error(`No worked solution for "${kind}"`);
}
