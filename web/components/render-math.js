// Draws a problem's expression (see engine/problem/text.js) as real math:
// stacked fractions, mixed numbers, and a box where a blank is.
// The plain-text version is attached as a label for screen readers.
// inline: true draws it at text size, for math inside a sentence.

import { drawNumberLine } from './number-line.js';
import { drawGrid } from './grid-pad.js';
import { drawShape } from './shapes.js';
import { drawColumn } from './column-view.js';
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
    case 'group': {
      const wrap = el('span', 'm-row m-group');
      wrap.append(el('span', 'm-paren', '('), build(node.of), el('span', 'm-paren', ')'));
      return wrap;
    }
    case 'var':
      return el('span', 'm-var', node.name);
    case 'column':
      return drawColumn(node);
    case 'scaled': {
      const wrap = el('span', 'm-row m-group');
      const c = node.coef;
      if (c !== 1) wrap.append(el('span', 'm-num', c === -1 ? '\u2212' : c < 0 ? `\u2212${-c}` : String(c)));
      wrap.append(el('span', 'm-paren', '('), build(node.of), el('span', 'm-paren', ')'));
      return wrap;
    }
    case 'term': {
      const wrap = el('span', 'm-term');
      const c = node.coef;
      if (typeof c === 'number') {
        if (c === -1) wrap.append(el('span', 'm-num', '\u2212'));
        else if (c !== 1) wrap.append(el('span', 'm-num', c < 0 ? `\u2212${-c}` : String(c)));
      } else wrap.append(build(c));
      wrap.append(el('span', 'm-var', node.name));
      if (node.exp) wrap.append(el('sup', 'm-exp', String(node.exp)));
      return wrap;
    }
    case 'pow': {
      const wrap = el('span', 'm-pow');
      const negBase = node.base.type === 'int' && node.base.value < 0;
      if (negBase) wrap.append(el('span', 'm-paren', '('), build(node.base), el('span', 'm-paren', ')'));
      else wrap.append(build(node.base));
      // The exponent: a number (negatives with a real minus sign) or a box to fill in.
      if (node.exp === 'blank') wrap.append(el('sup', 'm-exp m-exp-blank', '?'));
      else wrap.append(el('sup', 'm-exp', node.exp < 0 ? `\u2212${-node.exp}` : String(node.exp)));
      return wrap;
    }
    case 'root': {
      // The radical sign is drawn (not a font character), stretched to the radicand's height,
      // so its top stroke runs straight into the bar over the number.
      const wrap = el('span', 'm-root');
      if (node.index === 3) wrap.append(el('span', 'm-root-index', '3'));
      const sign = svg('svg', { viewBox: '0 0 12 24', preserveAspectRatio: 'none', class: 'm-root-sign', 'aria-hidden': 'true' });
      sign.append(svg('path', { d: 'M0.5 14 L3 12.5 L6.5 22.5 L11.5 1 L12 1', class: 'm-root-path' }));
      wrap.append(sign);
      const inside = el('span', 'm-radicand');
      inside.append(build(node.of));
      wrap.append(inside);
      return wrap;
    }
    case 'neg': {
      const wrap = el('span', 'm-row m-neg');
      wrap.append(el('span', 'm-op', '\u2212'), build(node.of));
      return wrap;
    }
    case 'int':
      return el('span', 'm-num', node.value < 0 ? `−${-node.value}` : String(node.value));
    case 'words':
      return el('span', 'm-words', node.text);
    case 'call': {
      const wrap = el('span', 'm-row');
      wrap.append(el('span', 'm-var', node.name), el('span', 'm-paren', '('), build(node.arg), el('span', 'm-paren', ')'));
      return wrap;
    }
    case 'point':
      return el('span', 'm-num', `(${minus(node.x)}, ${minus(node.y)})`);
    case 'table':
      return xyTable(node.rows);
    case 'graph':
      return lineGraph(node.points);
    case 'shape':
      return drawShape(node);
    case 'factors': {
      const wrap = el('span', 'm-row m-factors');
      for (const item of node.items) wrap.append(el('span', 'm-paren', '('), build(item), el('span', 'm-paren', ')'));
      return wrap;
    }
    case 'numline':
      return drawNumberLine(node).root;
    case 'gridanswer':
      return drawGrid({ points: node.points, line: node.line });
    case 'ratio': {
      const wrap = el('span', 'm-row');
      wrap.append(build(node.a), el('span', 'm-op', ':'), build(node.b));
      return wrap;
    }
    case 'pct':
      return el('span', 'm-num', `${node.value}%`);
    case 'dec':
      return el('span', 'm-num', node.value.startsWith('-') ? `−${node.value.slice(1)}` : node.value);
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
    case 'eq':
    case 'ineq': {
      const wrap = el('span', 'm-row');
      const sym = node.type === 'eq' ? '=' : node.op === '-' ? '−' : node.op;
      const right = build(node.right);
      // 5 − (−3): a negative number after an operation sign gets parentheses.
      const paren = node.type === 'op' && ((node.right.type === 'int' && node.right.value < 0) || node.right.type === 'neg'
        || (node.right.type === 'dec' && node.right.value.startsWith('-'))
        || (node.right.type === 'term' && typeof node.right.coef === 'number' && node.right.coef < 0));
      wrap.append(build(node.left), el('span', 'm-op', sym), ...(paren ? [el('span', 'm-num', '('), right, el('span', 'm-num', ')')] : [right]));
      return wrap;
    }
    case 'list': {
      const wrap = el('span', 'm-row');
      node.items.forEach((item, i) => {
        if (i > 0) wrap.append(el('span', 'm-word', node.word || 'and'));
        wrap.append(build(item));
      });
      return wrap;
    }
    case 'compare': {
      const wrap = el('span', 'm-row');
      wrap.append(build(node.left), el('span', 'm-blank m-cmp', '?'), build(node.right));
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

const minus = (v) => (v < 0 ? `\u2212${-v}` : String(v));

// An x/y table, two rows.
function xyTable(rows) {
  const t = el('span', 'm-table');
  for (const [label, i] of [['x', 0], ['y', 1]]) {
    const row = el('span', 'm-table-row');
    row.append(el('span', 'm-table-head', label), ...rows.map((r) => el('span', 'm-table-cell', minus(r[i]))));
    t.append(row);
  }
  return t;
}

// A line on a −6..6 grid through two marked points, drawn right across the grid.
function lineGraph([[x1, y1], [x2, y2]]) {
  const R = 6;
  const unit = 18;
  const size = (2 * R + 1) * unit;
  const X = (v) => (v + R + 0.5) * unit;
  const Y = (v) => (R - v + 0.5) * unit;
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: 280, class: 'm-pic m-graph', 'aria-hidden': 'true' });
  for (let v = -R; v <= R; v++) {
    root.append(svg('line', { x1: X(v), y1: Y(-R), x2: X(v), y2: Y(R), class: v === 0 ? 'pic-line' : 'graph-grid' }));
    root.append(svg('line', { x1: X(-R), y1: Y(v), x2: X(R), y2: Y(v), class: v === 0 ? 'pic-line' : 'graph-grid' }));
  }
  for (const v of [-5, 5]) {
    const lx = svg('text', { x: X(v), y: Y(0) + 14, 'text-anchor': 'middle', class: 'graph-label' });
    lx.textContent = minus(v);
    const ly = svg('text', { x: X(0) - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'graph-label' });
    ly.textContent = minus(v);
    root.append(lx, ly);
  }
  // Extend the line to the edges of the grid, and no further (clip to the square).
  const [dx, dy] = [x2 - x1, y2 - y1];
  let lo = -Infinity; let hi = Infinity;
  for (const [p, d] of [[x1, dx], [y1, dy]]) {
    if (d === 0) continue;
    const [a, b] = [(-R - p) / d, (R - p) / d];
    lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
  }
  const [ax, ay, bx, by] = [x1 + lo * dx, y1 + lo * dy, x1 + hi * dx, y1 + hi * dy];
  root.append(svg('line', { x1: X(ax), y1: Y(ay), x2: X(bx), y2: Y(by), class: 'graph-line' }));
  for (const [px, py] of [[x1, y1], [x2, y2]]) root.append(svg('circle', { cx: X(px), cy: Y(py), r: 5, class: 'pic-dot' }));
  return root;
}

function fractionEl(n, d) {
  // A stacked fraction (a fraction above or below the bar) gets a longer, heavier main bar.
  const stacked = [n, d].some((x) => typeof x === 'object' && (x.type === 'frac' || x.type === 'neg'));
  const f = el('span', stacked ? 'm-frac m-frac-stacked' : 'm-frac');
  const part = (x) => (typeof x === 'number' ? el('span', 'm-num', x < 0 ? `\u2212${-x}` : String(x)) : build(x));
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
    .replace(/\((-\d+)\)(?!\^)/g, '$1') // 3/(-5) -> 3/-5, 5 - (-3) -> 5 - -3 (but not (-3)^2)
    .replace(/(\d+) (\d+)\/(\d+)/g, '$1 and $2 over $3')
    .replace(/(-?\d+|\?)\/(-?\d+|\?)/g, '$1 over $2')
    .replace(/\?/g, 'blank')
    .replace(/ \+ /g, ' plus ')
    .replace(/ - /g, ' minus ')
    .replace(/-(\d)/g, 'negative $1')
    .replace(/\^(\d+)/g, ' to the power $1')
    .replace(/(\d)\(/g, '$1 times (')
    .replace(/(^|[^\w)])-\(/g, '$1negative (')
    .replace(/\(/g, 'open parenthesis, ')
    .replace(/\)/g, ', close parenthesis')
    .replace(/ \u00d7 /g, ' times ')
    .replace(/ \u00f7 /g, ' divided by ')
    .replace(/ : /g, ' to ')
    .replace(/ = /g, ' equals ')
    .replace(/ ≤ /g, ' is less than or equal to ')
    .replace(/ ≥ /g, ' is greater than or equal to ')
    .replace(/ < /g, ' is less than ')
    .replace(/ > /g, ' is greater than ');
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
  const size = r * c >= 50 ? 14 : 34; // a hundredths grid gets small squares
  const w = shape === 'area' ? c * size : 260;
  const h = shape === 'area' ? r * size : 48;
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
