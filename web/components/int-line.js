// The integer number line, used in the integer lessons: a dot at `start`; the
// button shows the move for adding `move` (right for positive, left for negative)
// and where you land. Settings come from the lesson file:
//   "visual": { "widget": "int-line", "params": { "start": -3, "move": 7 } }

const NS = 'http://www.w3.org/2000/svg';

export function createIntLine({ host, params }) {
  const { start, move } = params;
  const end = start + move;
  const lo = Math.min(start, end, 0) - 1;
  const hi = Math.max(start, end, 0) + 1;
  const unit = 30;
  const width = (hi - lo) * unit + 40;
  const x = (v) => 20 + (v - lo) * unit;
  let shown = false;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = svg('svg', { viewBox: `0 0 ${width} 90`, class: 'm-pic intline', role: 'img' });
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { shown = !shown; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();

  function render() {
    pic.replaceChildren();
    pic.append(svg('line', { x1: x(lo) - 10, y1: 60, x2: x(hi) + 10, y2: 60, class: 'pic-line' }));
    for (let v = lo; v <= hi; v++) {
      pic.append(svg('line', { x1: x(v), y1: v === 0 ? 50 : 54, x2: x(v), y2: v === 0 ? 70 : 66, class: 'pic-line' }));
      const label = svg('text', { x: x(v), y: 86, 'text-anchor': 'middle', class: 'pic-label' });
      label.textContent = v < 0 ? `−${-v}` : String(v);
      pic.append(label);
    }
    if (shown) {
      // An arc from start to end, with an arrowhead, and the landing dot.
      const mid = (x(start) + x(end)) / 2;
      pic.append(svg('path', { d: `M ${x(start)} 52 Q ${mid} ${10} ${x(end)} 52`, class: 'pic-line', fill: 'none' }));
      const dir = Math.sign(move);
      pic.append(svg('path', { d: `M ${x(end)} 54 l ${-dir * 9} -9 m ${dir * 9} 9 l ${-dir * 2} -12`, class: 'pic-line', fill: 'none' }));
      pic.append(svg('circle', { cx: x(end), cy: 60, r: 7, class: 'pic-dot' }));
    }
    pic.append(svg('circle', { cx: x(start), cy: 60, r: 7, class: shown ? 'pic-off' : 'pic-dot' }));
    const say = (v) => (v < 0 ? `−${-v}` : String(v));
    const way = move < 0 ? `${-move} to the left` : `${move} to the right`;
    text.textContent = shown
      ? `Start at ${say(start)}, move ${way}: you land on ${say(end)}. So ${say(start)} + ${move < 0 ? `(${say(move)})` : say(move)} = ${say(end)}.`
      : `Start at ${say(start)}. Adding ${say(move)} means moving ${way}.`;
    pic.setAttribute('aria-label', text.textContent);
    button.textContent = shown ? 'Start over' : 'Make the move';
  }
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
