// Worked solutions for multiplying and factoring polynomials. A solution is a list of
// steps { say, show? }, built from the problem's own numbers.

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const sgn = (v) => (v < 0 ? `− ${-v}` : `+ ${v}`);
const pn = (v) => (v < 0 ? `(${n(v)})` : n(v)); // a negative after an operation sign, in parentheses
const sx = (c) => `${c < 0 ? '−' : '+'} ${cx(Math.abs(c))}`; // "+ 6x", "− x"
// "3x", "x", "−x" for a coefficient.
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `−${v}` : `${n(c)}${v}`);
// ax² + bx + c as text, zero terms left out.
export function polyText([A, B, C]) {
  const parts = [];
  if (A) parts.push([A, 'x²']);
  if (B) parts.push([B, 'x']);
  if (C) parts.push([C, '']);
  return parts.map(([c, v], i) => (i === 0 ? (v ? cx(c, v) : n(c)) : `${c < 0 ? '−' : '+'} ${v ? cx(Math.abs(c), v) : Math.abs(c)}`)).join(' ');
}
export const binText = (a, b) => `${cx(a)} ${sgn(b)}`;
// The answer written out: "(x + 3)(x + 4)", "3(2x + 3)", "(2x + 1)(x + 3)", "x² + 8x + 15".
export function answerText(a) {
  const b = a.boxes;
  if (a.form === 'product') return polyText(b);
  if (a.form === 'binomials') return `(${binText(1, b[0])})(${binText(1, b[1])})`;
  if (a.form === 'gcf') return `${b[0]}(${binText(b[1], b[2])})`;
  return `(${binText(b[0], b[1])})(${binText(b[2], b[3])})`;
}

export function solvePoly(problem) {
  const kind = problem.part || problem.generator;
  const a = problem.answer;
  const [A, B, C] = a.poly;
  switch (kind) {
    case 'poly.multiply.binomials':
    case 'poly.multiply.leading': {
      const e = problem.expression;
      const bins = e.type === 'pow' ? [e.base.of, e.base.of] : e.items;
      const read = (node) => (node.type === 'op' ? [node.left.coef ?? 1, (node.op === '-' ? -1 : 1) * node.right.value] : [node.coef ?? 1, 0]);
      const [[p, q], [r, s]] = bins.map(read);
      return [
        { say: `Multiply every term in the first by every term in the second: ${cx(p)} · ${cx(r)} = ${cx(p * r, 'x²')}, ${cx(p)} · ${pn(s)} = ${cx(p * s)}, ${n(q)} · ${cx(r)} = ${cx(q * r)}, ${n(q)} · ${pn(s)} = ${n(q * s)}.` },
        { say: `Combine the x terms: ${cx(p * s)} ${sx(q * r)} = ${p * s + q * r === 0 ? '0' : cx(p * s + q * r)}.` },
        { say: `So the answer is ${answerText(a)}.` },
      ];
    }
    case 'poly.factor.gcf': {
      const [k, u, v] = a.boxes;
      return [
        { say: `The greatest common factor of ${Math.abs(B)} and ${Math.abs(C)} is ${k}: the biggest number that divides both.` },
        { say: `Divide each term by ${k}: ${cx(B)} ÷ ${k} = ${cx(u)} and ${n(C)} ÷ ${k} = ${n(v)}.` },
        { say: `So ${polyText(a.poly)} = ${answerText(a)}. Check: ${k} · ${cx(u)} = ${cx(B)} and ${k} · ${pn(v)} = ${n(C)}.` },
      ];
    }
    case 'poly.factor.trinomial': {
      const [p, q] = a.boxes;
      return [
        { say: `Find two numbers that multiply to ${n(C)} and add to ${n(B)}.` },
        { say: `${n(p)} × ${pn(q)} = ${n(C)} and ${n(p)} + ${pn(q)} = ${n(B)}. ${C > 0 ? `Both have the sign of ${n(B)}.` : 'One is negative, one positive.'}` },
        { say: `So ${polyText(a.poly)} = ${answerText(a)}. Check by multiplying it back out.` },
      ];
    }
    case 'poly.factor.diff-squares': {
      const b = a.boxes;
      const [first, last] = a.form === 'binomials' ? ['x', String(Math.abs(b[0]))] : [cx(b[0]), String(Math.abs(b[1]))];
      const mid = a.form === 'binomials' ? Math.abs(b[0]) : Math.abs(b[0] * b[1]); // the x terms that cancel
      return [
        { say: `${polyText(a.poly)} is a square minus a square: (${first})² − ${last}².` },
        { say: `A difference of squares factors as (first + last)(first − last). The middle terms cancel: +${cx(mid)} and −${cx(mid)}.` },
        { say: `So ${polyText(a.poly)} = ${answerText(a)}.` },
      ];
    }
    case 'poly.factor.leading': {
      const [p, q, r, s] = a.boxes; // (px + q)(rx + s)
      const [m1, m2] = [p * s, q * r];
      return [
        { say: `Multiply the first and last numbers: ${A} × ${pn(C)} = ${n(A * C)}. Find two numbers that multiply to ${n(A * C)} and add to ${n(B)}: ${n(m1)} and ${n(m2)}.` },
        { say: `Split the middle term: ${cx(A, 'x²')} ${sx(m1)} ${sx(m2)} ${sgn(C)}.` },
        { say: `Group in pairs and factor each: ${cx(p)}(${binText(r, s)}) ${sgn(q)}(${binText(r, s)}).` },
        { say: `Both have (${binText(r, s)}), so the answer is ${answerText(a)}.` },
      ];
    }
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}
