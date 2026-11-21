// A coordinate grid to answer on: the student taps grid points (plot a point, or two
// points on a line, which then draws the line through them). Tapping a point again
// removes it. Also draws a finished answer for a worked solution (drawGridAnswer).
// raw answer: { points: [[x, y], ...] } in tapping order.

const NS = 'http://www.w3.org/2000/svg';
const R = 6;
const UNIT = 24;
const SIZE = (2 * R + 1) * UNIT;
const X = (v) => (v + R + 0.5) * UNIT;
const Y = (v) => (R - v + 0.5) * UNIT;

export function drawGrid({ points = [], line = false } = {}) {
  const root = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, class: 'm-pic gridpad', role: 'img' });
  for (let v = -R; v <= R; v++) {
    root.append(svg('line', { x1: X(v), y1: Y(-R), x2: X(v), y2: Y(R), class: v === 0 ? 'pic-line' : 'graph-grid' }));
    root.append(svg('line', { x1: X(-R), y1: Y(v), x2: X(R), y2: Y(v), class: v === 0 ? 'pic-line' : 'graph-grid' }));
  }
  for (const v of [-5, 5]) {
    const lx = svg('text', { x: X(v), y: Y(0) + 16, 'text-anchor': 'middle', class: 'graph-label' });
    lx.textContent = v < 0 ? `−${-v}` : String(v);
    const ly = svg('text', { x: X(0) - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'graph-label' });
    ly.textContent = v < 0 ? `−${-v}` : String(v);
    root.append(lx, ly);
  }
  for (const [name, x, y] of [['x', X(R) - 4, Y(0) - 6], ['y', X(0) + 8, Y(R) + 4]]) {
    const t = svg('text', { x, y, 'text-anchor': name === 'x' ? 'end' : 'start', class: 'graph-axis' });
    t.textContent = name;
    root.append(t);
  }
  if (line && points.length === 2 && (points[0][0] !== points[1][0] || points[0][1] !== points[1][1])) {
    // Through both points, clipped to the grid.
    const [[x1, y1], [x2, y2]] = points;
    const [dx, dy] = [x2 - x1, y2 - y1];
    let lo = -Infinity; let hi = Infinity;
    for (const [p, d] of [[x1, dx], [y1, dy]]) {
      if (d === 0) continue;
      const [a, b] = [(-R - p) / d, (R - p) / d];
      lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    }
    root.append(svg('line', { x1: X(x1 + lo * dx), y1: Y(y1 + lo * dy), x2: X(x1 + hi * dx), y2: Y(y1 + hi * dy), class: 'graph-line' }));
  }
  for (const [px, py] of points) root.append(svg('circle', { cx: X(px), cy: Y(py), r: 6, class: 'pic-dot' }));
  const say = (v) => (v < 0 ? `−${-v}` : String(v));
  root.setAttribute('aria-label', points.length ? `Grid with ${points.map(([a, b]) => `(${say(a)}, ${say(b)})`).join(' and ')}${line && points.length === 2 ? ', and the line through them' : ''}.` : 'An empty coordinate grid from −6 to 6.');
  return root;
}

// The answer pad. count: how many points (1 for a point, 2 for a line); line: draw the line.
export function createGridPad({ host, count = 1, line = false, onSubmit, onSkip }) {
  let points = [];
  host.replaceChildren();
  host.classList.add('answer-area');
  const pic = document.createElement('div');
  pic.className = 'numline-host';
  const help = document.createElement('p');
  help.className = 'keypad-help';
  help.textContent = count === 1 ? 'Tap the grid to plot the point. Tap it again to take it away.'
    : 'Tap two points that are on the line; the line is drawn through them. Tap a point again to take it away.';
  const where = document.createElement('p');
  where.className = 'gridpad-where';
  where.setAttribute('aria-live', 'polite');
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'key key-check numline-check';
  check.textContent = 'Check';
  check.addEventListener('click', () => { if (points.length === count) onSubmit({ points: points.map((p) => [...p]) }); });
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'I’m not sure';
  skip.addEventListener('click', () => onSkip());
  host.append(pic, where, help, check, skip);

  function tap(gx, gy) {
    const at = points.findIndex(([a, b]) => a === gx && b === gy);
    if (at >= 0) points.splice(at, 1);
    else if (points.length < count) points.push([gx, gy]);
    else points[points.length - 1] = [gx, gy]; // move the last point
    render();
  }
  function render() {
    const root = drawGrid({ points, line });
    root.classList.add('gridpad-live');
    root.addEventListener('click', (e) => {
      const box = root.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * SIZE;
      const sy = ((e.clientY - box.top) / box.height) * SIZE;
      const gx = Math.round(sx / UNIT - 0.5 - R);
      const gy = Math.round(R - (sy / UNIT - 0.5));
      if (Math.abs(gx) <= R && Math.abs(gy) <= R) tap(gx, gy);
    });
    pic.replaceChildren(root);
    // Keyboard: type a point as "x, y" and press Enter.
    const form = document.createElement('form');
    form.className = 'visually-hidden';
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Type a point as x, y and press Enter');
    form.append(input);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const m = /^\s*\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?\s*$/.exec(input.value.replace(/−/g, '-'));
      if (m) tap(Number(m[1]), Number(m[2]));
    });
    pic.append(form);
    const say = (v) => (v < 0 ? `−${-v}` : String(v));
    where.textContent = points.length ? `You put: ${points.map(([a, b]) => `(${say(a)}, ${say(b)})`).join(' and ')}` : '';
    check.disabled = points.length !== count;
  }
  render();
  return { destroy() {} };
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
