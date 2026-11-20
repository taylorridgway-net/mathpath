// Step-by-step worked solutions for integers, built from the problem as displayed.
// Adding is explained as moves on the number line, then the rule; subtracting as
// adding the opposite; multiplying and dividing as sizes first, then the sign.

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const n = (v) => (v < 0 ? `−${-v}` : String(v));
const p = (v) => (v < 0 ? `(−${-v})` : String(v)); // after an operation sign
const numbers = (e) => (e.type === 'int' ? [e.value] : [...numbers(e.left), ...numbers(e.right)]);

function addSteps(x, y) {
  const value = x + y;
  const move = y < 0 ? `${-y} to the left` : `${y} to the right`;
  const steps = [{ say: `On the number line: start at ${n(x)}. Adding ${n(y)} moves ${move}. You land on ${n(value)}.` }];
  if (Math.sign(x) === Math.sign(y)) {
    steps.push({ say: `Rule: the signs are the same, so add the sizes (${Math.abs(x)} + ${Math.abs(y)} = ${Math.abs(value)}) and keep the sign.` });
  } else if (value !== 0) {
    const big = Math.abs(x) > Math.abs(y) ? x : y;
    steps.push({ say: `Rule: the signs are different, so subtract the sizes (${Math.max(Math.abs(x), Math.abs(y))} − ${Math.min(Math.abs(x), Math.abs(y))} = ${Math.abs(value)}) and keep the sign of the bigger size, ${n(big)}.` });
  }
  return steps;
}

export function solveInt(problem) {
  const e = problem.expression;
  const value = (function evaluate(x) {
    if (x.type === 'int') return x.value;
    const [l, r] = [evaluate(x.left), evaluate(x.right)];
    return { '+': l + r, '-': l - r, '×': l * r, '÷': l / r }[x.op];
  }(e));
  const done = { say: `So the answer is ${n(value)}.`, show: eq(e, int(value)) };

  if (e.op === '+') return [...addSteps(e.left.value, e.right.value), done];
  if (e.op === '-') {
    const [x, y] = [e.left.value, e.right.value];
    return [
      { say: `Subtracting is the same as adding the opposite: ${n(x)} − ${p(y)} = ${n(x)} + ${p(-y)}.`, show: eq(e, op('+', int(x), int(-y))) },
      ...addSteps(x, -y),
      done,
    ];
  }
  // × or ÷: sizes first, then the sign.
  const nums = numbers(e);
  const negatives = nums.filter((v) => v < 0).length;
  const sizes = nums.map(Math.abs);
  const word = e.op === '÷' ? 'Divide' : 'Multiply';
  const sizeText = sizes.join(e.op === '÷' ? ' ÷ ' : ' × ');
  return [
    { say: `${word} the sizes, ignoring the signs: ${sizeText} = ${Math.abs(value)}.` },
    {
      say: negatives % 2 === 0
        ? `Count the negative numbers: ${negatives}. An even number of negatives makes the answer positive.`
        : `Count the negative numbers: ${negatives}. An odd number of negatives makes the answer negative.`,
    },
    done,
  ];
}
