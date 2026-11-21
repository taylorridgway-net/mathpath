// Labelled shape pictures for geometry and measurement problems (a "shape" node):
//   { type: 'shape', kind, labels: { ... } } with labels like "8 cm" or "?".
// kinds: rect (w, h) · parallelogram (base, height, side) · triangle (base, height) ·
// trapezoid (top, bottom, height) · lshape (w, h, a, b: the cut corner) · circle (r or d) ·
// prism (l, w, h) · cylinder (r, h) · cone (r, h) · right-triangle (a, b, c).
// Pictures are not to scale; the labels carry the numbers.

const NS = 'http://www.w3.org/2000/svg';

export function drawShape(node) {
  const L = node.labels || {};
  const root = svg('svg', { viewBox: '0 -6 240 176', width: 240, class: 'm-pic m-shape', role: 'img' });
  const line = (pts, cls = 'shape-edge', extra = {}) => root.append(svg('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: cls, ...extra }));
  const poly = (pts) => root.append(svg('polygon', { points: pts.map((p) => p.join(',')).join(' '), class: 'shape-fill' }));
  const text = (x, y, t, anchor = 'middle') => { if (t === undefined) return; const e = svg('text', { x, y, 'text-anchor': anchor, class: t === '?' ? 'shape-label shape-ask' : 'shape-label' }); e.textContent = t; root.append(e); };
  const dashed = (pts) => line(pts, 'shape-dash');
  const rightMark = (x, y, dx, dy) => line([[x + dx, y], [x + dx, y + dy], [x, y + dy]], 'shape-thin');

  switch (node.kind) {
    case 'rect': {
      poly([[40, 30], [200, 30], [200, 130], [40, 130]]);
      text(120, 150, L.w); text(208, 85, L.h, 'start');
      break;
    }
    case 'parallelogram': {
      poly([[70, 30], [210, 30], [170, 130], [30, 130]]);
      dashed([[70, 30], [70, 130]]); rightMark(70, 130, 10, -10);
      text(100, 150, L.base); text(74, 85, L.height, 'start'); text(200, 85, L.side, 'start');
      break;
    }
    case 'triangle': {
      poly([[30, 130], [210, 130], [140, 30]]);
      dashed([[140, 30], [140, 130]]); rightMark(140, 130, 10, -10);
      text(120, 150, L.base); text(146, 90, L.height, 'start');
      break;
    }
    case 'trapezoid': {
      poly([[80, 30], [170, 30], [215, 130], [25, 130]]);
      dashed([[80, 30], [80, 130]]); rightMark(80, 130, 10, -10);
      text(125, 22, L.top); text(120, 150, L.bottom); text(86, 85, L.height, 'start');
      break;
    }
    case 'lshape': {
      // A w × h rectangle with an a × b corner cut from the top right.
      poly([[40, 20], [130, 20], [130, 75], [200, 75], [200, 140], [40, 140]]);
      text(120, 160, L.w); text(30, 85, L.h, 'end'); text(85, 14, L.top); text(206, 110, L.right, 'start');
      break;
    }
    case 'circle': {
      root.append(svg('circle', { cx: 120, cy: 85, r: 62, class: 'shape-fill' }));
      root.append(svg('circle', { cx: 120, cy: 85, r: 3, class: 'shape-dot' }));
      if (L.d !== undefined) { line([[58, 85], [182, 85]], 'shape-thin'); text(120, 78, L.d); } else { line([[120, 85], [182, 85]], 'shape-thin'); text(151, 78, L.r); }
      break;
    }
    case 'prism': {
      poly([[40, 60], [160, 60], [160, 140], [40, 140]]);
      line([[40, 60], [80, 25], [200, 25], [160, 60]]); line([[200, 25], [200, 105], [160, 140]]);
      dashed([[80, 25], [80, 105], [40, 140]]); dashed([[80, 105], [200, 105]]);
      text(100, 158, L.l); text(208, 70, L.h, 'start'); text(188, 52, L.w, 'start');
      break;
    }
    case 'cylinder': {
      root.append(svg('rect', { x: 60, y: 35, width: 120, height: 100, class: 'shape-fill shape-noedge' }));
      root.append(svg('ellipse', { cx: 120, cy: 135, rx: 60, ry: 16, class: 'shape-fill' }));
      root.append(svg('ellipse', { cx: 120, cy: 35, rx: 60, ry: 16, class: 'shape-fill' }));
      line([[60, 35], [60, 135]]); line([[180, 35], [180, 135]]);
      if (L.d !== undefined) { line([[60, 35], [180, 35]], 'shape-thin'); text(120, 13, L.d); } else { line([[120, 35], [180, 35]], 'shape-thin'); text(150, 13, L.r); }
      text(188, 90, L.h, 'start');
      break;
    }
    case 'cone': {
      root.append(svg('ellipse', { cx: 120, cy: 135, rx: 60, ry: 16, class: 'shape-fill' }));
      line([[60, 135], [120, 20], [180, 135]]);
      dashed([[120, 20], [120, 135]]); line([[120, 135], [180, 135]], 'shape-thin');
      text(126, 85, L.h, 'start'); text(150, 155, L.r);
      break;
    }
    case 'right-triangle': {
      poly([[50, 135], [190, 135], [50, 35]]);
      rightMark(50, 135, 12, -12);
      text(120, 155, L.b); text(42, 88, L.a, 'end'); text(128, 78, L.c, 'start');
      break;
    }
    case 'angles-comp': {
      // A right angle split by a ray: known + x = 90.
      line([[60, 140], [210, 140]]); line([[60, 140], [60, 15]]); line([[60, 140], [190, 45]]);
      rightMark(60, 140, 12, -12);
      text(140, 128, L.a, 'start'); text(92, 70, L.b);
      break;
    }
    case 'angles-supp': {
      // A straight line with a ray: known + x = 180.
      line([[15, 125], [225, 125]]); line([[120, 125], [175, 30]]);
      text(170, 113, L.a, 'start'); text(85, 105, L.b, 'end');
      root.append(svg('circle', { cx: 120, cy: 125, r: 3, class: 'shape-dot' }));
      break;
    }
    case 'angles-vertical': {
      // Two crossing lines; the angle on the left and the one on the right are vertical angles.
      line([[25, 40], [215, 130]]); line([[25, 130], [215, 40]]);
      text(70, 90, L.a, 'end'); text(170, 90, L.b, 'start');
      break;
    }
    case 'triangle-angles': {
      poly([[30, 135], [210, 135], [120, 25]]);
      text(58, 128, L.a, 'start'); text(182, 128, L.b, 'end'); text(120, 55, L.c);
      break;
    }
    case 'parallel': {
      // Two parallel lines (arrows) cut by a transversal; angles numbered 1-4 at the top crossing,
      // 5-8 at the bottom: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right.
      const ys = [50, 120];
      const xAt = (y) => 70 + (165 - y) * (110 / 160); // the transversal leans to the right going up
      for (const y of ys) { line([[10, y], [230, y]]); line([[200, y - 5], [210, y], [200, y + 5]], 'shape-thin'); }
      line([[xAt(165), 165], [xAt(0), 0]]);
      // Each angle sits between two rays; its label goes out along the ray halfway between them,
      // with a small arc marking the angle. Ray directions (degrees, counterclockwise from "right"):
      const up = (Math.atan2(160, 110) * 180) / Math.PI; // the transversal going up and to the right
      const region = { 1: [up, 180], 2: [0, up], 3: [180, 180 + up], 4: [180 + up, 360] };
      for (const [k, v] of Object.entries(L)) {
        const n = Number(k);
        const y = n <= 4 ? ys[0] : ys[1];
        const x0 = xAt(y);
        const [from, to] = region[n <= 4 ? n : n - 4];
        const pt = (deg, r) => [x0 + r * Math.cos((deg * Math.PI) / 180), y - r * Math.sin((deg * Math.PI) / 180)];
        const [ax, ay] = pt(from, 13);
        const [bx, by] = pt(to, 13);
        root.append(svg('path', { d: `M ${ax} ${ay} A 13 13 0 0 0 ${bx} ${by}`, class: 'shape-thin' }));
        const mid = (from + to) / 2;
        const [lx, ly] = pt(mid, 36);
        text(lx, ly + 5, v);
      }
      break;
    }
    case 'dotplot': {
      // counts: { value: how many } on a number line from lo to hi; one dot per data value.
      const { lo, hi, counts } = node;
      const step = 200 / (hi - lo);
      const X = (v) => 20 + (v - lo) * step;
      line([[10, 140], [230, 140]]);
      for (let v = lo; v <= hi; v++) { line([[X(v), 136], [X(v), 144]], 'shape-thin'); text(X(v), 160, String(v)); }
      for (const [v, c] of Object.entries(counts)) for (let i = 0; i < c; i++) root.append(svg('circle', { cx: X(Number(v)), cy: 128 - i * 14, r: 5.5, class: 'shape-dot' }));
      // Crop the empty space above the tallest column.
      const top = Math.min(100, 128 - (Math.max(...Object.values(counts)) - 1) * 14 - 16);
      root.setAttribute('viewBox', `0 ${top} 240 ${170 - top}`);
      break;
    }
    case 'bars': {
      // bars: [[name, value], ...] with a scale from 0 to max (gridlines every step).
      const { bars, max, step: gs } = node;
      const Y = (v) => 140 - (v / max) * 120;
      for (let v = 0; v <= max; v += gs) { line([[34, Y(v)], [230, Y(v)]], 'shape-grid'); text(28, Y(v) + 4, String(v), 'end'); }
      const w = 190 / bars.length;
      bars.forEach(([name, v], i) => {
        root.append(svg('rect', { x: 40 + i * w + w * 0.15, y: Y(v), width: w * 0.7, height: 140 - Y(v), class: 'shape-fill' }));
        text(40 + i * w + w / 2, 158, name);
      });
      break;
    }
    case 'boxplot': {
      const { lo, hi, min, q1, med, q3, max } = node;
      const X = (v) => 20 + ((v - lo) / (hi - lo)) * 200;
      line([[10, 130], [230, 130]]);
      const tick = Math.max(1, Math.round((hi - lo) / 10));
      const every = (hi - lo) / tick > 7 ? 2 : 1; // label every other tick when they'd crowd
      for (let v = lo, i = 0; v <= hi; v += tick, i++) { line([[X(v), 126], [X(v), 134]], 'shape-thin'); if (i % every === 0) text(X(v), 150, String(v)); }
      line([[X(min), 70], [X(q1), 70]]); line([[X(q3), 70], [X(max), 70]]);
      line([[X(min), 60], [X(min), 80]]); line([[X(max), 60], [X(max), 80]]);
      root.append(svg('rect', { x: X(q1), y: 45, width: X(q3) - X(q1), height: 50, class: 'shape-fill' }));
      line([[X(med), 45], [X(med), 95]]);
      root.setAttribute('viewBox', '0 35 240 125');
      break;
    }
    default: throw new Error(`drawShape: unknown kind "${node.kind}"`);
  }
  root.setAttribute('aria-label', shapeWords(node));
  return root;
}

// Plain words for a shape (screen readers and the text form).
export function shapeWords(node) {
  const { kind, labels: L = {} } = node;
  if (kind === 'dotplot') return `A dot plot: ${Object.entries(node.counts).filter(([, c]) => c).map(([v, c]) => `${c} at ${v}`).join(', ')}.`;
  if (kind === 'bars') return `A bar graph: ${node.bars.map(([n, v]) => `${n} ${v}`).join(', ')}.`;
  if (kind === 'boxplot') return `A box plot: minimum ${node.min}, first quartile ${node.q1}, median ${node.med}, third quartile ${node.q3}, maximum ${node.max}.`;
  const name = { rect: 'a rectangle', parallelogram: 'a parallelogram', triangle: 'a triangle', trapezoid: 'a trapezoid', lshape: 'an L-shape', circle: 'a circle', prism: 'a box (rectangular prism)', cylinder: 'a cylinder', cone: 'a cone', 'right-triangle': 'a right triangle', 'angles-comp': 'a right angle split in two', 'angles-supp': 'a straight angle split in two', 'angles-vertical': 'two crossing lines', 'triangle-angles': 'a triangle', parallel: 'two parallel lines cut by a transversal' }[kind];
  const parts = Object.entries(L).filter(([, v]) => v !== undefined).map(([k, v]) => `${({ w: 'width', h: 'height', l: 'length', r: 'radius', d: 'diameter', a: 'leg', b: 'leg', c: 'hypotenuse', top: 'top', bottom: 'bottom', right: 'right side', base: 'base', height: 'height', side: 'side' })[k] || k} ${v}`);
  return `[${name}: ${parts.join(', ')}]`;
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
