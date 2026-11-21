// Generators for "Evaluate expressions" (alg.evaluate): put numbers in for the
// letters and find the value. Uses the order-of-operations evaluator
// (./evaluate.js), so the right answer and the classic mistakes are both worked
// out exactly from the expression.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { evaluate } from './evaluate.js';

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const group = (of) => ({ type: 'group', of });
const pow = (base, exp) => ({ type: 'pow', base, exp });
const neg = (of) => ({ type: 'neg', of });
const v = (name) => ({ type: 'var', name });
const term = (coef, name, exp) => ({ type: 'term', coef, name, ...(exp ? { exp } : {}) });
const scaled = (coef, of) => ({ type: 'scaled', coef, of });
const nonZero = (rng, lo, hi) => { for (;;) { const x = rng.int(lo, hi); if (x !== 0) return x; } };
const shown = (x) => (x < 0 ? `−${-x}` : String(x));

// Replace every letter with its number, as the order-of-operations nodes the evaluator
// (and the worked solution) understand. 3x -> 3 × x; 3x² -> 3 × x²; lw -> l × w.
// how: 'right' | 'concat' (3x read as 34) | 'squareSign' ((−3)² read as −9) | 'abs' (signs dropped)
//      | 'coefSquared' (3x² read as (3x)²)
export function substitute(node, values, how = 'right') {
  const num = (name) => {
    const x = values[name];
    return int(how === 'abs' ? Math.abs(x) : x);
  };
  const power = (base, exp) => (how === 'squareSign' && base.value < 0 ? neg(pow(int(-base.value), exp)) : pow(base, exp));
  switch (node.type) {
    case 'var': return num(node.name);
    case 'term': {
      const letters = node.name.split('');
      const product = letters.map(num).reduce((a, b) => op('×', a, b));
      const c = node.coef;
      if (how === 'concat' && letters.length === 1 && !node.exp && c > 1 && values[node.name] > 0 && values[node.name] < 10) return int(Number(`${c}${values[node.name]}`));
      if (node.exp) {
        if (how === 'coefSquared' && c !== 1 && c !== -1) return pow(group(op('×', int(c), product)), node.exp);
        const p = power(product, node.exp);
        return c === 1 ? p : c === -1 ? neg(p) : op('×', int(c), p);
      }
      return c === 1 ? product : c === -1 ? neg(product) : op('×', int(c), product);
    }
    case 'scaled': return op('×', int(node.coef), group(substitute(node.of, values, how)));
    case 'pow': {
      const base = substitute(node.base, values, how);
      return base.type === 'int' ? power(base, node.exp) : pow(base, node.exp);
    }
    case 'op': return op(node.op, substitute(node.left, values, how), substitute(node.right, values, how));
    case 'group': return group(substitute(node.of, values, how));
    case 'neg': return neg(substitute(node.of, values, how));
    default: return node;
  }
}

function problem(expression, values, extra = []) {
  const right = evaluate(substitute(expression, values));
  const ways = [
    ['alg.eval-concatenate', 'concat'],
    ['alg.eval-square-sign', 'squareSign'],
    ['alg.eval-sign-dropped', 'abs'],
    ['alg.eval-coefficient-squared', 'coefSquared'],
  ];
  const out = [];
  for (const [id, how] of ways) {
    const value = evaluate(substitute(expression, values, how));
    if (Number.isInteger(value) && value !== right && !out.some((m) => m.value === value)) out.push({ id, value });
  }
  for (const m of extra) if (Number.isInteger(m.value) && m.value !== right && !out.some((o) => o.value === m.value)) out.push(m);
  const when = Object.entries(values).map(([k, x]) => `${k} = ${shown(x)}`).join(' and ');
  return {
    instruction: `Find the value when ${when}.`,
    expression,
    values,
    answer: { type: 'integer', value: right, allowNegative: true },
    misconceptions: out,
  };
}

// ---------- put in a number ----------
//   1: 3x + 2, 5x − 4 (x a whole number);  2: x² + 5, 4(x + 3);  3: 2x² + 1, 3x² − x (powers with a number in front)
const substituteOne = {
  version: 1,
  generate(rng, difficulty) {
    const x = rng.int(2, 9);
    let e;
    if (difficulty === 1) {
      const [a, b] = [rng.int(2, 9), rng.int(1, 15)];
      e = rng.chance(0.5) ? op('+', term(a, 'x'), int(b)) : op('-', term(a, 'x'), int(Math.min(b, a * x - 1)));
    } else if (difficulty === 2) {
      e = rng.chance(0.5) ? op('+', term(1, 'x', 2), int(rng.int(1, 12))) : scaled(rng.int(2, 6), op('+', v('x'), int(rng.int(1, 9))));
    } else {
      const a = rng.int(2, 5);
      e = rng.chance(0.5) ? op('+', term(a, 'x', 2), int(rng.int(1, 9))) : op('-', term(a, 'x', 2), term(1, 'x'));
    }
    return problem(e, { x });
  },
};

// ---------- negative numbers ----------
//   1: x + 7, 4x (x negative);  2: 10 − x, 3x + 5 (x negative: 10 − (−2) = 12);
//   3: x² + 3, 2x², −x² (x negative: the square is positive, but −x² is negative)
const negative = {
  version: 1,
  alsoUses: ['alg.evaluate.substitute'],
  generate(rng, difficulty) {
    const x = -rng.int(2, 9);
    let e;
    if (difficulty === 1) e = rng.chance(0.5) ? op('+', v('x'), int(rng.int(1, 12))) : term(rng.int(2, 9), 'x');
    else if (difficulty === 2) e = rng.chance(0.5) ? op('-', int(rng.int(2, 15)), v('x')) : op('+', term(rng.int(2, 6), 'x'), int(rng.int(1, 12)));
    else e = rng.pick([() => op('+', term(1, 'x', 2), int(rng.int(1, 9))), () => term(rng.int(2, 4), 'x', 2), () => term(-1, 'x', 2)])();
    return problem(e, { x });
  },
};

// ---------- two letters, and formulas ----------
//   1: a + b, 2a + b;  2: 3a − 2b, ab − 4 (one of them negative);
//   3: a formula: A = lw, P = 2l + 2w, d = rt, C = 5h + 20
const twoLetters = {
  version: 1,
  alsoUses: ['alg.evaluate.substitute'],
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const pick = rng.pick([
        () => ({ lhs: 'A', e: term(1, 'lw'), values: { l: rng.int(3, 12), w: rng.int(2, 9) } }),
        () => ({ lhs: 'P', e: op('+', term(2, 'l'), term(2, 'w')), values: { l: rng.int(3, 15), w: rng.int(2, 9) } }),
        () => ({ lhs: 'd', e: term(1, 'rt'), values: { r: rng.int(2, 12) * 5, t: rng.int(2, 6) } }),
        () => ({ lhs: 'C', e: op('+', term(5, 'h'), int(20)), values: { h: rng.int(2, 9) } }),
      ])();
      // Worked out from the formula's right side; shown as the whole formula (A = lw).
      const p = problem(pick.e, pick.values);
      return {
        ...p,
        expression: { type: 'eq', left: v(pick.lhs), right: pick.e },
        instruction: `Find ${pick.lhs} when ${Object.entries(pick.values).map(([k, x]) => `${k} = ${x}`).join(' and ')}.`,
      };
    }
    let [a, b] = [rng.int(1, 9), rng.int(1, 9)];
    let e;
    if (difficulty === 1) e = rng.chance(0.5) ? op('+', v('a'), v('b')) : op('+', term(rng.int(2, 5), 'a'), v('b'));
    else {
      if (rng.chance(0.5)) b = -b; else a = -a;
      e = rng.chance(0.5) ? op('-', term(rng.int(2, 5), 'a'), term(rng.int(2, 5), 'b')) : op('-', term(1, 'ab'), int(rng.int(1, 9)));
    }
    // Swapping the two numbers is its own mistake.
    const swapped = evaluate(substitute(e, { a: b, b: a }));
    return problem(e, { a, b }, [{ id: 'alg.eval-swapped', value: swapped }]);
  },
};

// In the diagnostic one problem with a negative number stands for putting in a number too.
const mixed = {
  version: 1,
  mixed: true,
  screener: 'alg.evaluate.negative',
  covers: ['alg.evaluate.substitute', 'alg.evaluate.negative'],
  parts: ['alg.evaluate.substitute', 'alg.evaluate.negative', 'alg.evaluate.two-letters'],
  generate(rng, difficulty) {
    const part = rng.pick(this.parts);
    return { ...parts[part].generate(rng, difficulty), part };
  },
};

const parts = {
  'alg.evaluate.substitute': substituteOne,
  'alg.evaluate.negative': negative,
  'alg.evaluate.two-letters': twoLetters,
};

export const substituteGenerators = { 'alg.evaluate': mixed, ...parts };
