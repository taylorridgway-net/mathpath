// Why the sign flips: two numbers on a number line (2 < 5). The button multiplies
// both by −1: they jump to the other side of 0 and swap order (−2 > −5).
// Settings come from the lesson file:
//   "visual": { "widget": "flip-line", "params": { "a": 2, "b": 5 } }   (0 < a < b ≤ 8)

const NS = 'http://www.w3.org/2000/svg';

export function createFlipLine({ host, params }) {
  const { a, b } = params;
  let flipped = false;
  const lo = -b - 1;
  const hi = b + 1;
  const W = 380;
  const X = (v) => 20 + ((v - lo) / (hi - lo)) * (W - 40);

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = svg('svg', { viewBox: `0 0 ${W} 96`, class: 'm-pic intline', role: 'img' });
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { flipped = !flipped; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();

  function render() {
    pic.replaceChildren();
    pic.append(svg('line', { x1: 10, y1: 50, x2: W - 10, y2: 50, class: 'pic-line' }));
    for (let v = lo; v <= hi; v++) {
      pic.append(svg('line', { x1: X(v), y1: v === 0 ? 40 : 45, x2: X(v), y2: v === 0 ? 60 : 55, class: 'pic-line' }));
      const label = svg('text', { x: X(v), y: 78, 'text-anchor': 'middle', class: 'pic-label' });
      label.textContent = v < 0 ? `−${-v}` : String(v);
      pic.append(label);
    }
    const [p, q] = flipped ? [-a, -b] : [a, b];
    for (const [v, name] of [[p, 'first'], [q, 'second']]) {
      pic.append(svg('circle', { cx: X(v), cy: 50, r: 8, class: name === 'first' ? 'pic-dot' : 'pic-on' }));
      const tag = svg('text', { x: X(v), y: 30, 'text-anchor': 'middle', class: 'pic-label' });
      tag.textContent = v < 0 ? `−${-v}` : String(v);
      pic.append(tag);
    }
    const say = flipped
      ? `Times −1: ${a} becomes −${a} and ${b} becomes −${b}. Now −${a} is to the RIGHT of −${b}, so −${a} > −${b}. The order flipped, so the sign flips.`
      : `${a} < ${b}: ${a} is to the left of ${b}. What happens if you multiply both by −1?`;
    text.textContent = say;
    pic.setAttribute('aria-label', say);
    button.textContent = flipped ? 'Start over' : 'Multiply both by −1';
  }
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
