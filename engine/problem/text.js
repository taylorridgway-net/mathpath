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
    default:
      throw new Error(`toText: unknown expression type "${node.type}"`);
  }
}

function part(x) {
  return typeof x === 'number' ? String(x) : toText(x);
}
