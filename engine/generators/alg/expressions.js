// Generators for "Simplify expressions" (alg.expressions): combine like terms and
// use the distributive property. Every answer is ax + b, typed in two boxes
// (the number in front of x, and the number on its own): answer type 'linear'.
// See engine/generators/frac/add-sub.js for what a generator returns.

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const term = (coef) => ({ type: 'term', coef, name: 'x' });
const scaled = (coef, of) => ({ type: 'scaled', coef, of });
const nonZero = (rng, lo, hi) => { for (;;) { const v = rng.int(lo, hi); if (v !== 0) return v; } };

// Simplify to { a, b } meaning ax + b, the right way or a classic wrong way:
//   signDropped   every "−" between terms treated as "+"
//   loneXIsZero   x (or −x) with no number in front counted as nothing
//   firstOnly     a(…) multiplies only the first term inside
//   secondSign    a negative outside: the second term's sign comes out wrong
export function simplify(node, way = 'right') {
  switch (node.type) {
    case 'int': return { a: 0, b: node.value };
    case 'term': return { a: way === 'loneXIsZero' && Math.abs(node.coef) === 1 ? 0 : node.coef, b: 0 };
    case 'op': {
      // "− k(…)" is "+ (−k)(…)", so a wrong second sign shows up there too (12 − (x + 3) as 12 − x + 3).
      if (node.op === '-' && node.right.type === 'scaled' && way === 'secondSign') {
        const l = simplify(node.left, way);
        const r = simplify(scaled(-node.right.coef, node.right.of), way);
        return { a: l.a + r.a, b: l.b + r.b };
      }
      const l = simplify(node.left, way);
      const r = simplify(node.right, way);
      const s = node.op === '-' && way !== 'signDropped' ? -1 : 1;
      return { a: l.a + s * r.a, b: l.b + s * r.b };
    }
    case 'scaled': {
      const inner = node.of;
      const k = node.coef;
      if (way === 'firstOnly') {
        const first = simplify(inner.left, 'right');
        const rest = simplify(op(inner.op, int(0), inner.right), 'right');
        return { a: k * first.a + rest.a, b: k * first.b + rest.b };
      }
      if (way === 'secondSign' && k < 0) {
        const first = simplify(inner.left, 'right');
        const rest = simplify(op(inner.op, int(0), inner.right), 'right');
        return { a: k * first.a - k * rest.a, b: k * first.b - k * rest.b };
      }
      const v = simplify(inner, way);
      return { a: k * v.a, b: k * v.b };
    }
    default:
      throw new Error(`simplify: unexpected ${node.type}`);
  }
}

// A term or number with its sign written as an operation: "+ 3", "− 2x".
function chain(first, ...rest) {
  let e = first;
  for (const t of rest) {
    const negative = (t.type === 'int' && t.value < 0) || (t.type === 'term' && t.coef < 0);
    const size = t.type === 'int' ? int(Math.abs(t.value)) : term(Math.abs(t.coef));
    e = op(negative ? '-' : '+', e, size);
  }
  return e;
}

function problem(e, ways) {
  const clean = (v) => ({ a: v.a + 0, b: v.b + 0 }); // no -0
  const right = clean(simplify(e));
  const out = [];
  for (const [id, way] of ways) {
    const v = clean(simplify(e, way));
    if ((v.a !== right.a || v.b !== right.b) && !out.some((m) => m.value.coef === v.a && m.value.constant === v.b)) {
      out.push({ id, value: { coef: v.a, constant: v.b } });
    }
  }
  return {
    instruction: 'Simplify. Write it as (number)x + (number).',
    expression: e,
    answer: { type: 'linear', coef: right.a, constant: right.b },
    misconceptions: out,
  };
}

// ---------- combine like terms ----------
//   1: 4x + 3 + 2x (adding only);  2: with subtraction (5x − 7 − 2x + 3);
//   3: a lone x, and the x part can come out negative (2x + 9 − 5x − x)
const likeTerms = {
  version: 1,
  generate(rng, difficulty) {
    for (;;) {
      let terms;
      if (difficulty === 1) terms = rng.pick([[term(rng.int(2, 9)), int(rng.int(1, 12)), term(rng.int(2, 9))], [int(rng.int(1, 12)), term(rng.int(2, 9)), term(rng.int(2, 9)), int(rng.int(1, 9))]]);
      else if (difficulty === 2) terms = [term(rng.int(3, 9)), int(-rng.int(1, 12)), term(-rng.int(2, 5)), int(rng.int(1, 12))];
      else terms = rng.pick([[term(rng.int(2, 6)), int(rng.int(2, 12)), term(-rng.int(3, 9)), int(-rng.int(1, 9))], [term(rng.int(2, 9)), int(nonZero(rng, -9, 9)), term(-1), int(rng.int(1, 9))]]);
      const e = chain(...terms);
      const v = simplify(e);
      if (v.a === 0 || v.b === 0) continue; // keep both boxes meaningful
      return problem(e, [['alg.expr-sign-dropped', 'signDropped'], ['alg.expr-lone-x', 'loneXIsZero']]);
    }
  },
};

// ---------- distributive property ----------
//   1: 3(x + 4);  2: 4(x − 3), 2(3x + 5);  3: a negative outside: −2(x − 5), −(x + 4)
const distribute = {
  version: 1,
  generate(rng, difficulty) {
    let k;
    let inner;
    if (difficulty === 1) [k, inner] = [rng.int(2, 9), op('+', term(1), int(rng.int(1, 9)))];
    else if (difficulty === 2) [k, inner] = [rng.int(2, 6), op(rng.pick(['+', '-']), term(rng.pick([1, 1, 2, 3])), int(rng.int(1, 9)))];
    else [k, inner] = [rng.pick([-1, -rng.int(2, 6)]), op(rng.pick(['+', '-']), term(rng.pick([1, 2, 3])), int(rng.int(1, 9)))];
    return problem(scaled(k, inner), [['alg.expr-first-only', 'firstOnly'], ['alg.expr-second-sign', 'secondSign']]);
  },
};

// ---------- whole skill: distribute, then combine ----------
//   1: 2(x + 3) + 4x;  2: 3(x − 2) + 5 − x;  3: subtract a group: 4x − 2(x + 3), 5 − (x − 4) + 2x
const full = {
  version: 1,
  covers: ['alg.expressions.like-terms', 'alg.expressions.distribute'],
  generate(rng, difficulty) {
    for (;;) {
      let e;
      const inner = () => op(rng.pick(['+', '-']), term(1), int(rng.int(1, 9)));
      if (difficulty === 1) e = op('+', scaled(rng.int(2, 6), op('+', term(1), int(rng.int(1, 9)))), term(rng.int(2, 9)));
      else if (difficulty === 2) e = op('-', op('+', scaled(rng.int(2, 6), inner()), int(rng.int(1, 12))), term(rng.int(1, 3) === 1 ? 1 : rng.int(2, 3)));
      else e = rng.chance(0.5) ? op('-', term(rng.int(3, 9)), scaled(rng.int(2, 5), inner())) : op('+', op('-', int(rng.int(2, 12)), scaled(1, inner())), term(rng.int(2, 6)));
      const v = simplify(e);
      if (v.a === 0 || v.b === 0) continue;
      return problem(e, [['alg.expr-whole-first-only', 'firstOnly'], ['alg.expr-whole-subtract-group', 'secondSign']]);
    }
  },
};

export const expressionGenerators = {
  'alg.expressions': full,
  'alg.expressions.like-terms': likeTerms,
  'alg.expressions.distribute': distribute,
};
