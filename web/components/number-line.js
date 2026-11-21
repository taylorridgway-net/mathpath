// A number line with dots and shading, for graphing inequalities. Used two ways:
//   - drawn in a problem or a worked solution (render-math's "numline" node), and
//   - as the answer pad (createNumberLinePad): the student taps the line to put a dot,
//     taps a dot to make it open (then to remove it), and picks which way to shade.
// A graph is { points: [{ v, closed }], shade } where shade is 'left' | 'right' for
// one dot, or 'between' | 'outside' for two. Whole numbers only.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 26;
const PAD = 22;

export function drawNumberLine({ lo, hi, points = [], shade = null }, { interactive = false } = {}) {
  const width = (hi - lo) * UNIT + 2 * PAD;
  const x = (v) => PAD + (v - lo) * UNIT;
  const root = svg('svg', { viewBox: `0 0 ${width} 64`, width, class: `m-pic numline${interactive ? ' numline-pad' : ''}`, role: 'img' });
  root.append(svg('line', { x1: 4, y1: 30, x2: width - 4, y2: 30, class: 'pic-line' }));
  // arrowheads: the line goes on forever
  root.append(svg('path', { d: `M 4 30 l 8 -5 m -8 5 l 8 5`, class: 'pic-line', fill: 'none' }));
  root.append(svg('path', { d: `M ${width - 4} 30 l -8 -5 m 8 5 l -8 5`, class: 'pic-line', fill: 'none' }));
  for (let v = lo; v <= hi; v++) {
    root.append(svg('line', { x1: x(v), y1: v === 0 ? 22 : 25, x2: x(v), y2: v === 0 ? 38 : 35, class: 'pic-line' }));
    const label = svg('text', { x: x(v), y: 56, 'text-anchor': 'middle', class: 'numline-label' });
    label.textContent = v < 0 ? `−${-v}` : String(v);
    root.append(label);
  }
  const vs = points.map((p) => p.v).sort((a, b) => a - b);
  const ray = (from, to) => root.append(svg('line', { x1: from, y1: 30, x2: to, y2: 30, class: 'numline-shade' }));
  const arrow = (at, dir) => root.append(svg('path', { d: `M ${at} 30 l ${-dir * 10} -7 l 0 14 z`, class: 'numline-arrow' }));
  if (shade && vs.length) {
    if (shade === 'left' || shade === 'outside') { ray(6, x(vs[0])); arrow(4, -1); }
    if (shade === 'right' || shade === 'outside') { ray(x(vs.at(-1)), width - 6); arrow(width - 4, 1); }
    if (shade === 'between' && vs.length === 2) ray(x(vs[0]), x(vs[1]));
  }
  for (const p of points) {
    root.append(svg('circle', { cx: x(p.v), cy: 30, r: 7, class: p.closed ? 'numline-dot' : 'numline-open' }));
  }
  const words = points.length
    ? `Number line with ${points.map((p) => `${p.closed ? 'a closed' : 'an open'} dot at ${p.v}`).join(' and ')}${shade ? `, shaded ${shade === 'between' ? 'between them' : shade === 'outside' ? 'outward from both' : `to the ${shade}`}` : ''}.`
    : `Number line from ${lo} to ${hi}.`;
  root.setAttribute('aria-label', words);
  return { root, x, width, words };
}

// The answer pad. options: { lo, hi, count (1 or 2 dots) }. onSubmit(raw) with
// raw = { points: [{ v, closed }], shade }; onSkip().
export function createNumberLinePad({ host, lo, hi, count = 1, onSubmit, onSkip }) {
  let points = [];
  let shade = null;
  host.replaceChildren();
  host.classList.add('answer-area');
  const pic = document.createElement('div');
  pic.className = 'numline-host';
  const help = document.createElement('p');
  help.className = 'keypad-help';
  help.textContent = `Tap the line to put ${count === 1 ? 'a dot' : 'two dots'}. Tap a dot to make it open (tap again to remove it). Then choose the shading.`;
  const shades = document.createElement('div');
  shades.className = 'choices choices-wide';
  const shadeOptions = count === 1 ? [['left', '← Shade left'], ['right', 'Shade right →']] : [['between', 'Between'], ['outside', '← Outside →']];
  const shadeButtons = shadeOptions.map(([value, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice numline-choice';
    b.textContent = label;
    b.addEventListener('click', () => { shade = value; render(); });
    shades.append(b);
    return [value, b];
  });
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'key key-check numline-check';
  check.textContent = 'Check';
  check.addEventListener('click', () => { if (ready()) onSubmit({ points: points.map((p) => ({ ...p })), shade }); });
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'I’m not sure';
  skip.addEventListener('click', () => onSkip());
  const live = document.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  host.append(pic, help, shades, check, skip, live);

  const ready = () => points.length === count && shade !== null;
  function tap(v) {
    const at = points.findIndex((p) => p.v === v);
    if (at >= 0) {
      if (points[at].closed) points[at].closed = false; // closed -> open
      else points.splice(at, 1); // open -> gone
    } else if (points.length < count) points.push({ v, closed: true });
    else points[points.length - 1] = { v, closed: points[points.length - 1].closed }; // move the last dot
    points.sort((a, b) => a.v - b.v);
    render();
  }
  function render() {
    const drawn = drawNumberLine({ lo, hi, points, shade }, { interactive: true });
    drawn.root.addEventListener('click', (e) => {
      const box = drawn.root.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * drawn.width;
      const v = Math.round((sx - 22) / UNIT) + lo;
      if (v >= lo && v <= hi) tap(v);
    });
    pic.replaceChildren(drawn.root);
    // Keyboard: a button per number, hidden visually but reachable by Tab.
    const keys = document.createElement('div');
    keys.className = 'visually-hidden';
    for (let v = lo; v <= hi; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Dot at ${v}`;
      b.addEventListener('click', () => tap(v));
      keys.append(b);
    }
    pic.append(keys);
    for (const [value, b] of shadeButtons) b.classList.toggle('chosen', value === shade);
    check.disabled = !ready();
    live.textContent = drawn.words;
  }
  render();
  return { destroy() {} };
}

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
