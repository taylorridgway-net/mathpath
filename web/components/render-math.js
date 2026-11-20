// Draws a problem's expression (see engine/problem/text.js) as real math:
// stacked fractions, mixed numbers, and a box where a blank is.
// The plain-text version is attached as a label for screen readers.
// inline: true draws it at text size, for math inside a sentence.

import { toText } from '../../engine/problem/text.js';

export function renderMath(node, { inline = false } = {}) {
  const root = el('span', inline ? 'math math-inline' : 'math');
  root.removeAttribute('aria-hidden'); // the parts are hidden; the whole is read via its label
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
    case 'model':
      return modelSvg(node);
    case 'numberline':
      return numberLineSvg(node);
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
    .replace(/ × /g, ' times ')
    .replace(/ ÷ /g, ' divided by ')
    .replace(/ = /g, ' equals ');
}

// ---------- pictures (understand fractions) ----------
// Drawn as SVG with the theme's colours (classes in style.css).

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

function modelSvg({ shape, parts, shaded, rows, cols }) {
  if (shape === 'set') {
    const perRow = Math.min(parts, 6);
    const lines = Math.ceil(parts / perRow);
    const root = svg('svg', { viewBox: `0 0 ${perRow * 40} ${lines * 40}`, width: perRow * 40, class: 'm-pic', 'aria-hidden': 'true' });
    for (let i = 0; i < parts; i++) {
      root.append(svg('circle', { cx: (i % perRow) * 40 + 20, cy: Math.floor(i / perRow) * 40 + 20, r: 14, class: i < shaded ? 'pic-on' : 'pic-off' }));
    }
    return root;
  }
  const [r, c] = shape === 'area' ? [rows, cols] : [1, parts];
  const w = shape === 'area' ? c * 34 : 260;
  const h = shape === 'area' ? r * 34 : 48;
  const root = svg('svg', { viewBox: `-2 -2 ${w + 4} ${h + 4}`, width: w + 4, class: 'm-pic', 'aria-hidden': 'true' });
  const cw = w / c;
  const ch = h / r;
  for (let i = 0; i < r * c; i++) {
    root.append(svg('rect', { x: (i % c) * cw, y: Math.floor(i / c) * ch, width: cw, height: ch, class: i < shaded ? 'pic-on' : 'pic-off' }));
  }
  return root;
}

function numberLineSvg({ max, perUnit, point }) {
  const w = 300;
  const step = w / (max * perUnit);
  const root = svg('svg', { viewBox: `-14 0 ${w + 28} 64`, width: w + 28, class: 'm-pic', 'aria-hidden': 'true' });
  root.append(svg('line', { x1: 0, y1: 24, x2: w, y2: 24, class: 'pic-line' }));
  for (let t = 0; t <= max * perUnit; t++) {
    const whole = t % perUnit === 0;
    root.append(svg('line', { x1: t * step, y1: whole ? 12 : 17, x2: t * step, y2: whole ? 36 : 31, class: 'pic-line' }));
    if (whole) {
      const label = svg('text', { x: t * step, y: 58, 'text-anchor': 'middle', class: 'pic-label' });
      label.textContent = String(t / perUnit);
      root.append(label);
    }
  }
  root.append(svg('circle', { cx: point * step, cy: 24, r: 7, class: 'pic-dot' }));
  return root;
}
