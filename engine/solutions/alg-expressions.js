// Step-by-step worked solutions for simplifying expressions: distribute first
// (multiply the number outside by EACH term inside), then group the x terms and
// the numbers, using the integer rules for the signs.

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const p = (v) => (v < 0 ? `(${n(v)})` : n(v));
const xt = (a) => (a === 1 ? 'x' : a === -1 ? '−x' : `${n(a)}x`);
const linear = (a, b) => `${xt(a)} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;

// The expression as a list of signed terms: { kind: 'x' | 'num', value }.
function terms(node, sign = 1, steps = []) {
  switch (node.type) {
    case 'int': return [{ kind: 'num', value: sign * node.value }];
    case 'term': return [{ kind: 'x', value: sign * node.coef }];
    case 'op': return [...terms(node.left, sign, steps), ...terms(node.right, node.op === '-' ? -sign : sign, steps)];
    case 'scaled': {
      const k = sign * node.coef;
      const inside = terms(node.of, 1, steps);
      const out = inside.map((t) => ({ kind: t.kind, value: k * t.value }));
      const say = (t) => (t.kind === 'x' ? xt(t.value) : n(t.value));
      const outside = sign === -1 && node.coef === 1 ? 'Subtracting the parentheses means multiplying each term inside by −1'
        : `Multiply ${n(k)} by each term inside`;
      steps.push({ say: `${outside}: ${inside.map((t, i) => `${p(k)} × ${p(t.kind === 'x' ? t.value : t.value)}${t.kind === 'x' ? 'x' : ''} = ${say(out[i])}`).join(', and ')}.` });
      return out;
    }
    default:
      throw new Error(`solve: unexpected ${node.type}`);
  }
}

export function solveExpression(problem) {
  const steps = [];
  const all = terms(problem.expression, 1, steps);
  const xs = all.filter((t) => t.kind === 'x');
  const nums = all.filter((t) => t.kind === 'num');
  const a = xs.reduce((s, t) => s + t.value, 0);
  const b = nums.reduce((s, t) => s + t.value, 0);
  if (xs.length > 1) {
    const lone = xs.some((t) => Math.abs(t.value) === 1) ? ' (x on its own is 1x)' : '';
    steps.push({ say: `Combine the x terms${lone}: ${xs.map((t, i) => (i === 0 ? n(t.value) : `${t.value < 0 ? '−' : '+'} ${Math.abs(t.value)}`)).join(' ')} = ${n(a)}, so ${xt(a)}.` });
  }
  if (nums.length > 1) {
    steps.push({ say: `Combine the numbers: ${nums.map((t, i) => (i === 0 ? n(t.value) : `${t.value < 0 ? '−' : '+'} ${Math.abs(t.value)}`)).join(' ')} = ${n(b)}.` });
  }
  steps.push({ say: `So it simplifies to ${linear(a, b)}.` });
  return steps;
}
