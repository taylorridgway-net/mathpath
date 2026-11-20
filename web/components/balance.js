// The balance, used in the equations lesson: x + a on one side, b on the other
// (as unit blocks). The button takes a away from both sides; the balance stays
// level, and what's left shows x. Settings come from the lesson file:
//   "visual": { "widget": "balance", "params": { "add": 3, "total": 7 } }

const NS = 'http://www.w3.org/2000/svg';

export function createBalance({ host, params }) {
  const { add: a, total: b } = params;
  let taken = false;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = svg('svg', { viewBox: '0 0 360 170', class: 'm-pic balance', role: 'img' });
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { taken = !taken; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();

  function blocks(x0, count, faded) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      out.push(svg('rect', { x: x0 + col * 22, y: 92 - row * 22, width: 18, height: 18, rx: 3, class: faded ? 'pic-off bal-gone' : 'pic-on' }));
    }
    return out;
  }

  function render() {
    pic.replaceChildren();
    // the stand and the beam (always level: both sides are equal)
    pic.append(svg('path', { d: 'M 180 120 L 160 160 L 200 160 Z', class: 'pic-off' }));
    pic.append(svg('line', { x1: 30, y1: 118, x2: 330, y2: 118, class: 'pic-line' }));
    // left pan: the x box, then a blocks; right pan: b blocks
    pic.append(svg('rect', { x: 40, y: 74, width: 36, height: 36, rx: 4, class: 'pic-dot' }));
    const label = svg('text', { x: 58, y: 98, 'text-anchor': 'middle', class: 'pic-label bal-x' });
    label.textContent = 'x';
    pic.append(label);
    pic.append(...blocks(84, a, taken));
    pic.append(...blocks(230, b - a, false));
    // the right side's last a blocks are the ones taken away
    for (let i = b - a; i < b; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      pic.append(svg('rect', { x: 230 + col * 22, y: 92 - row * 22, width: 18, height: 18, rx: 3, class: taken ? 'pic-off bal-gone' : 'pic-on' }));
    }
    text.textContent = taken
      ? `Take ${a} from both sides and it still balances: x = ${b - a}.`
      : `x + ${a} balances ${b}. To find x, do the same thing to both sides.`;
    pic.setAttribute('aria-label', text.textContent);
    button.textContent = taken ? 'Put them back' : `Take ${a} from both sides`;
  }
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
