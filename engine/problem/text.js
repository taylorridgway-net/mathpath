// Turns a problem's expression into plain text, e.g. "1/4 + 2 1/3".
// Used for tests, debugging, screen readers, and the teacher dashboard.
// (The student screen draws real stacked fractions from the same expression.)
//
// Expression pieces:
//   { type: 'frac', n, d }            n or d may be { type: 'blank' }
//   { type: 'mixed', whole, n, d }
//   { type: 'int', value }            value may be negative
//   { type: 'dec', value }            a decimal, as text: "3.25", "-0.4" (exact; never a float)
//   { type: 'neg', of }               the negative of a fraction or power: -3/4, -3^2
//   { type: 'group', of }             parentheses around part of an expression: (2 + 3)
//   { type: 'pow', base, exp }        a power: 2^4; a negative base gets parentheses: (-3)^2
//   { type: 'var', name }             a variable: x
//   { type: 'term', coef, name }      a number times a variable: 3x, -x; coef may be a frac node: (2/3)x
//   { type: 'scaled', coef, of }      a number times parentheses: 3(x + 4), -(x - 2)
//   { type: 'column', op, top, bottom, done }   column addition/subtraction on paper (engine/problem/column.js)
//   { type: 'op', op: '+' | '-', left, right }
//   { type: 'eq', left, right }
//   { type: 'ineq', op: '<' | '≤' | '>' | '≥', left, right }   an inequality: 3x - 2 > 7
//   { type: 'list', items: [...] }
//   { type: 'blank' }
//   { type: 'ratio', a, b }           a ratio a : b (either may be a blank)
//   { type: 'pct', value }            a percent: "35%" (value is decimal text)
//   { type: 'words', text }           a short word problem's question, shown as text
//   { type: 'model', shape: 'bar' | 'area' | 'set', parts, shaded, rows?, cols? }
//                                     a picture: parts equal pieces (or dots), the first `shaded` shaded
//   { type: 'compare', left, right }  "left ? right": which symbol goes in the box
//   { type: 'numberline', max, perUnit, point }
//                                     0 to max, each whole cut into perUnit; a dot at tick `point`

import { fromScaled } from '../math/decimal.js';

export function toText(node) {
  switch (node.type) {
    case 'blank':
      return '?';
    case 'words':
      return node.text;
    case 'ratio':
      return `${toText(node.a)} : ${toText(node.b)}`;
    case 'pct':
      return `${node.value}%`;
    case 'int':
      return node.value < 0 ? `-${-node.value}` : String(node.value);
    case 'dec':
      return node.value;
    case 'frac':
      return `${part(node.n)}/${part(node.d)}`;
    case 'neg':
      return `-${toText(node.of)}`;
    case 'group':
      return `(${toText(node.of)})`;
    case 'var':
      return node.name;
    case 'term': {
      const c = node.coef;
      if (typeof c === 'number') return c === 1 ? node.name : c === -1 ? `-${node.name}` : `${c < 0 ? `-${-c}` : c}${node.name}`;
      return `(${toText(c)})${node.name}`;
    }
    case 'column': {
      const show = (n) => (node.places ? fromScaled(n, node.places, { keepZeros: true }) : String(n));
      return `${show(node.top)} ${node.op} ${show(node.bottom)}`;
    }
    case 'scaled':
      return `${node.coef === 1 ? '' : node.coef === -1 ? '-' : node.coef < 0 ? `-${-node.coef}` : node.coef}(${toText(node.of)})`;
    case 'pow':
      return `${node.base.type === 'int' && node.base.value < 0 ? `(${toText(node.base)})` : toText(node.base)}^${node.exp}`;
    case 'mixed':
      return `${node.whole} ${node.n}/${node.d}`;
    case 'op':
      return `${toText(node.left)} ${node.op} ${wrapNegative(node.right)}`;
    case 'eq':
      return `${toText(node.left)} = ${toText(node.right)}`;
    case 'ineq':
      return `${toText(node.left)} ${node.op} ${toText(node.right)}`;
    case 'list':
      return node.items.map(toText).join(' and ');
    case 'model': {
      const what = { bar: 'a bar cut into', area: 'a rectangle cut into', set: 'a group of' }[node.shape];
      const unit = node.shape === 'set' ? 'dots' : 'equal parts';
      if (node.shape === 'area' && node.parts === 100) return `[a hundredths grid, ${node.shaded} of 100 squares shaded]`;
      return `[${what} ${node.parts} ${unit}, ${node.shaded} shaded]`;
    }
    case 'compare':
      return `${toText(node.left)} ? ${toText(node.right)}`;
    case 'numberline':
      return `[a number line from 0 to ${node.max}, each whole cut into ${node.perUnit} equal parts, with a dot ${node.point} ${node.point === 1 ? 'part' : 'parts'} from 0]`;
    default:
      throw new Error(`toText: unknown expression type "${node.type}"`);
  }
}

// 5 - (-3): a negative number after an operation sign gets parentheses.
function wrapNegative(node) {
  const negative = (node.type === 'int' && node.value < 0) || (node.type === 'dec' && node.value.startsWith('-')) || node.type === 'neg'
    || (node.type === 'term' && typeof node.coef === 'number' && node.coef < 0);
  return negative ? `(${toText(node)})` : toText(node);
}

function part(x) {
  if (typeof x === 'number') return x < 0 ? `(-${-x})` : String(x); // 3/(-5)
  return toText(x);
}
