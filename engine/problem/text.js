// Turns a problem's expression into plain text, e.g. "1/4 + 2 1/3".
// Used for tests, debugging, screen readers, and the teacher dashboard.
// (The student screen draws real stacked fractions from the same expression.)
//
// Expression pieces:
//   { type: 'frac', n, d }            n or d may be { type: 'blank' }
//   { type: 'mixed', whole, n, d }
//   { type: 'int', value }            value may be negative
//   { type: 'neg', of }               the negative of a fraction: -3/4 (minus sign in front of the bar)
//   { type: 'op', op: '+' | '-', left, right }
//   { type: 'eq', left, right }
//   { type: 'list', items: [...] }
//   { type: 'blank' }
//   { type: 'model', shape: 'bar' | 'area' | 'set', parts, shaded, rows?, cols? }
//                                     a picture: parts equal pieces (or dots), the first `shaded` shaded
//   { type: 'compare', left, right }  "left ? right": which symbol goes in the box
//   { type: 'numberline', max, perUnit, point }
//                                     0 to max, each whole cut into perUnit; a dot at tick `point`

export function toText(node) {
  switch (node.type) {
    case 'blank':
      return '?';
    case 'int':
      return node.value < 0 ? `-${-node.value}` : String(node.value);
    case 'frac':
      return `${part(node.n)}/${part(node.d)}`;
    case 'neg':
      return `-${toText(node.of)}`;
    case 'mixed':
      return `${node.whole} ${node.n}/${node.d}`;
    case 'op':
      return `${toText(node.left)} ${node.op} ${wrapNegative(node.right)}`;
    case 'eq':
      return `${toText(node.left)} = ${toText(node.right)}`;
    case 'list':
      return node.items.map(toText).join(' and ');
    case 'model': {
      const what = { bar: 'a bar cut into', area: 'a rectangle cut into', set: 'a group of' }[node.shape];
      const unit = node.shape === 'set' ? 'dots' : 'equal parts';
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
  return (node.type === 'int' && node.value < 0) || node.type === 'neg' ? `(${toText(node)})` : toText(node);
}

function part(x) {
  if (typeof x === 'number') return x < 0 ? `(-${-x})` : String(x); // 3/(-5)
  return toText(x);
}
