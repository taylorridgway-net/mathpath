// Step-by-step worked solutions for order of operations and exponents: one
// operation at a time, saying which rule picks it, and showing what's left.
// Order: inside parentheses first; then powers; then × and ÷ left to right;
// then + and − left to right. (The expression tree already groups each
// operation with its operands the way the rules say, so the next step is the
// highest-priority operation whose operands are plain numbers.)

import { toText } from '../problem/text.js';

const int = (value) => ({ type: 'int', value });
const n = (v) => (v < 0 ? `−${-v}` : String(v));
const show = (t) => t.replace(/-/g, '−').replace(/\^(\d+)/g, (_, e) => [...e].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join(''));

// Every operation that can be done now: { path, priority, order, text, value }.
function candidates(node, path = [], inGroup = 0, counter = { i: 0 }) {
  const out = [];
  const plain = (x) => x.type === 'int';
  switch (node.type) {
    case 'int':
      counter.i++;
      return out;
    case 'group':
      if (plain(node.of)) out.push({ path, priority: 0, order: counter.i, kind: 'unwrap', value: node.of.value });
      return [...out, ...candidates(node.of, [...path, 'of'], inGroup + 1, counter)];
    case 'neg':
      return candidates(node.of, [...path, 'of'], inGroup, counter).map((c) => (c.kind === 'pow' && c.path.length === path.length + 1 ? { ...c, underNeg: true } : c));
    case 'pow': {
      const base = node.base.type === 'group' && plain(node.base.of) ? node.base.of : node.base;
      if (plain(base)) {
        out.push({ path, priority: 2 - inGroup * 10, order: counter.i, kind: 'pow', base: base.value, exp: node.exp, value: base.value ** node.exp });
      }
      return [...out, ...candidates(node.base, [...path, 'base'], inGroup, counter)];
    }
    case 'op': {
      const left = candidates(node.left, [...path, 'left'], inGroup, counter);
      const at = counter.i;
      const right = candidates(node.right, [...path, 'right'], inGroup, counter);
      if (plain(node.left) && plain(node.right)) {
        const [a, b] = [node.left.value, node.right.value];
        const value = { '+': a + b, '-': a - b, '×': a * b, '÷': a / b }[node.op];
        const level = node.op === '×' || node.op === '÷' ? 3 : 4;
        out.push({ path, priority: level - inGroup * 10, order: at, kind: 'op', op: node.op, a, b, value });
      }
      return [...out, ...left, ...right];
    }
    default:
      throw new Error(`solve: unexpected ${node.type}`);
  }
}

function replaceAt(node, path, value) {
  if (!path.length) return int(value);
  const [k, ...rest] = path;
  return { ...node, [k]: replaceAt(node[k], rest, value) };
}

// (14) is just 14, and −(49) is −49: tidy those up after each step.
function tidy(node) {
  if (node.type === 'group') { const of = tidy(node.of); return of.type === 'int' ? of : { ...node, of }; }
  if (node.type === 'neg') { const of = tidy(node.of); return of.type === 'int' ? int(-of.value) : { ...node, of }; }
  if (node.type === 'op') return { ...node, left: tidy(node.left), right: tidy(node.right) };
  if (node.type === 'pow') return { ...node, base: tidy(node.base) };
  return node;
}

const RULE = {
  group: 'Inside the parentheses first',
  pow: 'Powers next',
  3: 'Multiply and divide, left to right',
  4: 'Add and subtract, left to right',
};

export function solveAlg(problem) {
  let e = problem.expression;
  const steps = [];
  for (let guard = 0; guard < 20 && e.type !== 'int'; guard++) {
    const all = candidates(e);
    all.sort((x, y) => x.priority - y.priority || x.order - y.order);
    const c = all[0];
    e = tidy(replaceAt(e, c.path, c.value));
    if (c.kind === 'unwrap') continue; // (5) is just 5: not a step of its own
    let say;
    if (c.kind === 'pow') {
      const b = c.base < 0 ? `(${n(c.base)})` : n(c.base);
      const power = show(`${b}^${c.exp}`);
      const means = c.exp === 0 ? `${power} = 1 (any number except 0 to the power 0 is 1)`
        : c.exp === 1 ? `${power} = ${b}`
          : `${power} means ${Array(c.exp).fill(b).join(' × ')} = ${n(c.value)}`;
      say = c.underNeg
        ? `The minus sign in front isn't part of the base: only ${b} is raised to the power. ${means}, so the answer is negative.`
        : `${c.priority < 0 ? RULE.group : RULE.pow}: ${means}.`;
    } else {
      const rule = c.priority < 0 ? RULE.group : RULE[c.priority];
      say = `${rule}: ${n(c.a)} ${c.op === '-' ? '−' : c.op} ${c.b < 0 ? `(${n(c.b)})` : n(c.b)} = ${n(c.value)}.`;
    }
    steps.push({ say: e.type === 'int' ? say : `${say} Now it's ${show(toText(e))}.` });
  }
  steps.push({ say: `So the answer is ${n(e.value)}.`, show: { type: 'eq', left: problem.expression, right: e } });
  return steps;
}
