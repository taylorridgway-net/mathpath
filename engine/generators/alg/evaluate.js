// Evaluating pre-algebra expressions, the right way and some classic wrong ways.
// Expressions use the nodes in engine/problem/text.js: int, op (+ - × ÷), group, pow, neg.
//
// The wrong ways predict a student's answer from a misunderstanding:
//   leftToRight      ignores "× and ÷ before + and −": works strictly left to right
//   ignoreParens     ignores parentheses (but keeps the usual order otherwise)
//   addBeforeSub     does + before − (3 − 1 + 2 as 3 − 3)
//   multBeforeDiv    does × before ÷ (8 ÷ 2 × 4 as 8 ÷ 8)

const STANDARD = { '×': 2, '÷': 2, '+': 1, '-': 1 };
const ORDERS = {
  standard: STANDARD,
  leftToRight: { '×': 1, '÷': 1, '+': 1, '-': 1 },
  addBeforeSub: { '×': 3, '÷': 3, '+': 2, '-': 1 },
  multBeforeDiv: { '×': 3, '÷': 2, '+': 1, '-': 1 },
};

// Flatten into [value, op, value, op, ...]; groups stay as nested lists (unless ignoring them).
function tokens(node, keepGroups, way) {
  if (node.type === 'op') return [...tokens(node.left, keepGroups, way), node.op, ...tokens(node.right, keepGroups, way)];
  if (node.type === 'group') return keepGroups ? [{ group: tokens(node.of, keepGroups, way) }] : tokens(node.of, keepGroups, way);
  return [{ value: evaluate(node, way) }];
}

function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (b === 0 || a % b !== 0) return NaN; // only exact division is used
  return a / b;
}

// Precedence climbing over a token list, left-associative.
function run(list, order) {
  const value = (t) => (t.group ? run(t.group, order) : t.value);
  const vals = [value(list[0])];
  const ops = [];
  const reduce = () => {
    const b = vals.pop();
    const a = vals.pop();
    vals.push(apply(a, ops.pop(), b));
  };
  for (let i = 1; i < list.length; i += 2) {
    const op = list[i];
    while (ops.length && order[ops.at(-1)] >= order[op]) reduce();
    ops.push(op);
    vals.push(value(list[i + 1]));
  }
  while (ops.length) reduce();
  return vals[0];
}

export function evaluate(node, way = 'standard') {
  switch (node.type) {
    case 'int':
      return node.value;
    case 'neg':
      return -evaluate(node.of, way);
    case 'pow':
      return evaluate(node.base, way) ** node.exp;
    case 'group':
      return evaluate(node.of, way);
    case 'op': {
      if (way === 'ignoreParens') return run(tokens(node, false, 'standard'), STANDARD);
      return run(tokens(node, true, way), ORDERS[way] || STANDARD);
    }
    default:
      throw new Error(`evaluate: can't evaluate "${node.type}"`);
  }
}
