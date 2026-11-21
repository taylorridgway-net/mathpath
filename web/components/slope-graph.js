// Rise over run on a graph, used in the linear functions lessons: a line through two
// marked grid points; each tap draws the run (across), then the rise (up or down),
// then shows slope = rise ÷ run. With "intercept": true it also marks where the line
// crosses the y-axis (b). Settings come from the lesson file:
//   "visual": { "widget": "slope-graph", "params": { "points": [[0, 1], [2, 5]], "intercept": false } }

import { renderMath } from './render-math.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 6;
const UNIT = 18;
const X = (v) => (v + R + 0.5) * UNIT;
const Y = (v) => (R - v + 0.5) * UNIT;
const minus = (v) => (v < 0 ? `−${-v}` : String(v));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

export function createSlopeGraph({ host, params }) {
  const [[x1, y1], [x2, y2]] = params.points;
  const [rise, run] = [y2 - y1, x2 - x1];
  const g = gcd(rise, run) || 1;
  const slope = run / g === 1 ? minus(rise / g) : `${minus(rise / g)}/${run / g}`;
  const b = y1 - (rise / run) * x1;
  let step = 0;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = document.createElement('div');
  pic.className = 'col-pic';
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { step = (step + 1) % 4; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();

  function render() {
    const drawn = renderMath({ type: 'graph', points: params.points });
    const svgEl = drawn.querySelector('svg');
    if (step >= 1) {
      svgEl.append(seg(X(x1), Y(y1), X(x2), Y(y1), 'slope-run'));
      svgEl.append(label((X(x1) + X(x2)) / 2, Y(y1) + (rise >= 0 ? 14 : -6), `run ${run}`));
    }
    if (step >= 2) {
      svgEl.append(seg(X(x2), Y(y1), X(x2), Y(y2), 'slope-rise'));
      svgEl.append(label(X(x2) + 6, (Y(y1) + Y(y2)) / 2 + 4, `rise ${minus(rise)}`, 'start'));
    }
    if (params.intercept && step >= 3) {
      svgEl.append(svg('circle', { cx: X(0), cy: Y(b), r: 7, class: 'slope-b' }));
      svgEl.append(label(X(0) - 10, Y(b) - 8, `b = ${minus(b)}`, 'end'));
    }
    pic.replaceChildren(drawn);
    const says = [
      `A line through (${minus(x1)}, ${minus(y1)}) and (${minus(x2)}, ${minus(y2)}). How steep is it?`,
      `Run: from x = ${minus(x1)} across to x = ${minus(x2)} is ${run}.`,
      `Rise: from y = ${minus(y1)} ${rise >= 0 ? 'up' : 'down'} to y = ${minus(y2)} is ${minus(rise)}${rise < 0 ? ' (down is negative)' : ''}.`,
      `Slope = rise ÷ run = ${minus(rise)}/${run} = ${slope}.${params.intercept ? ` It crosses the y-axis at ${minus(b)}, so y = ${slope === '1' ? '' : slope === '−1' ? '−' : slope}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}.` : ''}`,
    ];
    text.textContent = says[step];
    button.textContent = ['Show the run', 'Show the rise', 'Find the slope', 'Start over'][step];
  }
}

function seg(xa, ya, xb, yb, cls) {
  return svg('line', { x1: xa, y1: ya, x2: xb, y2: yb, class: cls });
}
function label(x, y, t, anchor = 'middle') {
  const e = svg('text', { x, y, 'text-anchor': anchor, class: 'slope-label' });
  e.textContent = t;
  return e;
}
function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
