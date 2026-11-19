// Draws a problem's expression (see engine/problem/text.js) as real math:
// stacked fractions, mixed numbers, and a box where a blank is.
// The plain-text version is attached as a label for screen readers.

import { toText } from '../../engine/problem/text.js';

export function renderMath(node) {
  const root = el('span', 'math');
  root.setAttribute('role', 'math');
  root.setAttribute('aria-label', spoken(toText(node)));
  root.append(build(node));
  return root;
}

function build(node) {
  switch (node.type) {
    case 'int':
      return el('span', 'm-num', String(node.value));
    case 'blank':
      return el('span', 'm-blank', '?');
    case 'frac':
      return fractionEl(node.n, node.d);
    case 'mixed': {
      const wrap = el('span', 'm-mixed');
      wrap.append(el('span', 'm-num', String(node.whole)), fractionEl(node.n, node.d));
      return wrap;
    }
    case 'op':
    case 'eq': {
      const wrap = el('span', 'm-row');
      const sym = node.type === 'eq' ? '=' : node.op === '-' ? '−' : node.op;
      wrap.append(build(node.left), el('span', 'm-op', sym), build(node.right));
      return wrap;
    }
    case 'list': {
      const wrap = el('span', 'm-row');
      node.items.forEach((item, i) => {
        if (i > 0) wrap.append(el('span', 'm-word', 'and'));
        wrap.append(build(item));
      });
      return wrap;
    }
    default:
      throw new Error(`renderMath: unknown expression type "${node.type}"`);
  }
}

function fractionEl(n, d) {
  const f = el('span', 'm-frac');
  const part = (x) => (typeof x === 'number' ? el('span', 'm-num', String(x)) : build(x));
  const top = el('span', 'm-top');
  top.append(part(n));
  const bottom = el('span', 'm-bottom');
  bottom.append(part(d));
  f.append(top, bottom);
  return f;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  e.setAttribute('aria-hidden', 'true');
  if (text !== undefined) e.textContent = text;
  return e;
}

// "3/4 + 1 1/2" -> "3 over 4 plus 1 and 1 over 2"
function spoken(text) {
  return text
    .replace(/(\d+) (\d+)\/(\d+)/g, '$1 and $2 over $3')
    .replace(/(\d+|\?)\/(\d+|\?)/g, '$1 over $2')
    .replace(/\?/g, 'blank')
    .replace(/ \+ /g, ' plus ')
    .replace(/ - /g, ' minus ')
    .replace(/ = /g, ' equals ');
}
