// The balance with x on both sides, used in the multi-step equations lesson:
// a x-boxes and b unit blocks on the left, c x-boxes and d blocks on the right
// (3x + 4 = x + 10). Each tap does the same thing to both sides: take c x-boxes
// off both, take b blocks off both, then share what's left among the x-boxes.
// The beam stays level the whole time. Settings come from the lesson file:
//   "visual": { "widget": "balance-steps", "params": { "left": [3, 4], "right": [1, 10] } }
// (whole numbers, a > c, d > b, and (d − b) shared evenly by (a − c)).

const NS = 'http://www.w3.org/2000/svg';

export function createBalanceSteps({ host, params }) {
  const [a, b] = params.left;
  const [c, d] = params.right;
  const v = (d - b) / (a - c);
  let step = 0;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = svg('svg', { viewBox: '0 0 420 180', class: 'm-pic balance', role: 'img' });
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

  // x-boxes (first `gone` faded), then unit blocks (first `goneBlocks` faded), from x0.
  function pan(x0, xs, gone, units, goneBlocks) {
    const out = [];
    for (let i = 0; i < xs; i++) {
      const faded = i < gone;
      out.push(svg('rect', { x: x0 + i * 30, y: 86, width: 26, height: 26, rx: 4, class: faded ? 'pic-off bal-gone' : 'pic-dot' }));
      const label = svg('text', { x: x0 + i * 30 + 13, y: 104, 'text-anchor': 'middle', class: `pic-label bal-x${faded ? ' bal-gone' : ''}` });
      label.textContent = 'x';
      out.push(label);
    }
    const ux = x0 + xs * 30 + 6;
    for (let i = 0; i < units; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      out.push(svg('rect', { x: ux + col * 15, y: 100 - row * 15, width: 12, height: 12, rx: 2, class: i < goneBlocks ? 'pic-off bal-gone' : 'pic-on' }));
    }
    return out;
  }

  function render() {
    pic.replaceChildren();
    pic.append(svg('path', { d: 'M 210 122 L 190 168 L 230 168 Z', class: 'pic-off' }));
    pic.append(svg('line', { x1: 10, y1: 120, x2: 410, y2: 120, class: 'pic-line' }));
    const goneX = step >= 1 ? c : 0;
    const goneB = step >= 2 ? b : 0;
    pic.append(...pan(14, a, goneX, b, goneB));
    pic.append(...pan(222, c, goneX, d, goneB));
    const says = [
      `${eqText(a, b, c, d)}. Do the same thing to both sides, and it stays balanced.`,
      `Take ${c === 1 ? 'an x' : `${c} x's`} off both sides: ${eqText(a - c, b, 0, d)}.`,
      `Take ${b} off both sides: ${eqText(a - c, 0, 0, d - b)}.`,
      `Share the ${d - b} among the ${a - c} x's: each x is ${v}. x = ${v}.`,
    ];
    text.textContent = says[step];
    pic.setAttribute('aria-label', says[step]);
    button.textContent = ['Take the x’s off both sides', 'Take the numbers off both sides', 'Share them out', 'Start over'][step];
  }
}

function eqText(a, b, c, d) {
  const side = (x, k) => [x ? `${x === 1 ? '' : x}x` : '', k ? String(k) : ''].filter(Boolean).join(' + ') || '0';
  return `${side(a, b)} = ${side(c, d)}`;
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val);
  return e;
}
