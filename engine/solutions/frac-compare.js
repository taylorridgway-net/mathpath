// Step-by-step worked solutions for comparing fractions, built from the problem as displayed.

const lcm = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return (a / g(a, b)) * b; };
const SAY = { '<': 'is less than', '=': 'is equal to', '>': 'is greater than' };
const text = (f) => (f.type === 'int' ? String(f.value) : `${f.n}/${f.d}`);
const val = (f) => (f.type === 'int' ? [f.value, 1] : [f.n, f.d]);

export function solveCompare(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  if (kind === 'frac.compare.benchmark' && e.type === 'frac') {
    const { n, d } = e;
    const near = ['0', '1/2', '1'][problem.answer.correct];
    return [
      { say: `Think of ${n}/${d} next to 0 (0/${d}), one half (${d / 2}/${d}) and 1 (${d}/${d}).` },
      { say: `${n} is closest to ${['0', String(d / 2), String(d)][problem.answer.correct]}, so ${n}/${d} is closest to ${near}.` },
    ];
  }
  const [a, b] = val(e.left);
  const [c, d] = val(e.right);
  const sym = problem.answer.options[problem.answer.correct];
  const steps = [];
  if (b === d) {
    steps.push({ say: `Both are ${b}ths of the same size, so compare how many pieces: ${a} and ${c}.` });
  } else if (e.right.type === 'int') {
    steps.push({ say: `1 is ${b}/${b}. Compare the tops: ${a} and ${b}.` });
  } else if (a === c) {
    steps.push({ say: `Both have ${a} pieces. ${b < d ? `${b}ths are bigger pieces than ${d}ths` : `${d}ths are bigger pieces than ${b}ths`}, so ${b < d ? text(e.left) : text(e.right)} is bigger.` });
  } else if (d === 2 && c === 1) {
    steps.push({ say: `Half of ${b} is ${b / 2}. Compare the top, ${a}, with ${b / 2}.` });
  } else {
    const m = lcm(b, d);
    steps.push({ say: `Rewrite both over a common denominator, ${m}: ${a}/${b} = ${(a * m) / b}/${m} and ${c}/${d} = ${(c * m) / d}/${m}.` });
    steps.push({ say: `Now the pieces are the same size, so compare the tops: ${(a * m) / b} and ${(c * m) / d}.` });
  }
  steps.push({ say: `So ${text(e.left)} ${SAY[sym]} ${text(e.right)}: ${text(e.left)} ${sym} ${text(e.right)}.` });
  return steps;
}
