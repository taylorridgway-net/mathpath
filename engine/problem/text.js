// Turns a problem's expression into plain text, e.g. "1/4 + 2 1/3".
// Used for tests, debugging, screen readers, and the teacher dashboard.
// (The student screen draws real stacked fractions from the same expression.)
//
// Expression pieces:
//   { type: 'frac', n, d }            n or d may be { type: 'blank' }
//   { type: 'mixed', whole, n, d }
//   { type: 'int', value }
//   { type: 'op', op: '+' | '-', left, right }
//   { type: 'eq', left, right }
//   { type: 'list', items: [...] }
//   { type: 'blank' }
//   { type: 'model', shape: 'bar' | 'area' | 'set', parts, shaded, rows?, cols? }
//                                     a picture: parts equal pieces (or dots), the first `shaded` shaded
//   { type: 'numberline', max, perUnit, point }
//                                     0 to max, each whole cut into perUnit; a dot at tick `point`

export function toText(node) {
  switch (node.type) {
    case 'blank':
      return '?';
    case 'int':
      return String(node.value);
    case 'frac':
      return `${part(node.n)}/${part(node.d)}`;
    case 'mixed':
      return `${node.whole} ${node.n}/${node.d}`;
    case 'op':
      return `${toText(node.left)} ${node.op} ${toText(node.right)}`;
    case 'eq':
      return `${toText(node.left)} = ${toText(node.right)}`;
    case 'list':
      return node.items.map(toText).join(' and ');
    case 'model': {
      const what = { bar: 'a bar cut into', area: 'a rectangle cut into', set: 'a group of' }[node.shape];
      const unit = node.shape === 'set' ? 'dots' : 'equal parts';
      return `[${what} ${node.parts} ${unit}, ${node.shaded} shaded]`;
    }
    case 'numberline':
      return `[a number line from 0 to ${node.max}, each whole cut into ${node.perUnit} equal parts, with a dot ${node.point} ${node.point === 1 ? 'part' : 'parts'} from 0]`;
    default:
      throw new Error(`toText: unknown expression type "${node.type}"`);
  }
}

function part(x) {
  return typeof x === 'number' ? String(x) : toText(x);
}
