// Equal groups, used in the division lessons: `total` dots, sorted into groups of
// `size` one group at a time; whatever can't make a full group is the remainder.
// Settings come from the lesson file:
//   "visual": { "widget": "groups", "params": { "total": 47, "size": 5 } }

const NS = 'http://www.w3.org/2000/svg';

export function createGroups({ host, params }) {
  const { total, size } = params;
  const full = Math.floor(total / size);
  const left = total % size;
  let made = 0;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = svg('svg', { class: 'm-pic groups-pic', role: 'img' });
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const row = document.createElement('div');
  row.className = 'actions';
  const one = button('Make a group', () => { made = Math.min(full, made + 1); render(); });
  const all = button('Make all the groups', () => { made = full; render(); });
  const again = button('Start over', () => { made = 0; render(); });
  row.append(one, all, again);
  wrap.append(pic, text, row);
  host.append(wrap);
  render();

  function render() {
    // Groups in rows of up to 4 boxes; each box holds `size` dots. Loose dots below.
    const perRow = 4;
    const box = { w: 26 + Math.min(size, 4) * 18, h: 22 + Math.ceil(size / 4) * 18 };
    const loose = total - made * size;
    const looseRows = Math.ceil(loose / 12);
    const groupRows = Math.ceil(Math.max(made, 1) / perRow);
    const width = perRow * (box.w + 10) + 10;
    const height = (made ? groupRows * (box.h + 10) : 0) + looseRows * 22 + 20;
    pic.setAttribute('viewBox', `0 0 ${width} ${height}`);
    pic.setAttribute('width', String(width));
    pic.replaceChildren();
    for (let g = 0; g < made; g++) {
      const gx = 10 + (g % perRow) * (box.w + 10);
      const gy = 10 + Math.floor(g / perRow) * (box.h + 10);
      pic.append(svg('rect', { x: gx, y: gy, width: box.w, height: box.h, rx: 10, class: 'groups-box' }));
      for (let i = 0; i < size; i++) {
        pic.append(svg('circle', { cx: gx + 22 + (i % 4) * 18, cy: gy + 20 + Math.floor(i / 4) * 18, r: 6.5, class: 'pic-on' }));
      }
    }
    const y0 = (made ? groupRows * (box.h + 10) : 0) + 18;
    for (let i = 0; i < loose; i++) {
      const isLeftover = made === full;
      pic.append(svg('circle', { cx: 18 + (i % 12) * 20, cy: y0 + Math.floor(i / 12) * 22, r: 6.5, class: isLeftover ? 'pic-dot' : 'pic-off' }));
    }
    const sayLeft = left ? ` ${left} left over: that's the remainder.` : ' None left over.';
    text.textContent = made === 0
      ? `${total} dots. How many groups of ${size} can you make?`
      : made < full
        ? `${made} group${made > 1 ? 's' : ''} of ${size} so far (${made * size} dots).`
        : left ? `${full} groups of ${size}, and${sayLeft} So ${total} ÷ ${size} = ${full} R ${left}.` : `${full} groups of ${size}.${sayLeft} So ${total} ÷ ${size} = ${full}.`;
    pic.setAttribute('aria-label', text.textContent);
    one.disabled = all.disabled = made === full;
  }
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
