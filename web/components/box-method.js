// The box method for multiplying binomials, used in the multiplying and factoring
// lessons: a 2 × 2 grid with one binomial across the top and the other down the side;
// each tap fills one box (a term times a term), then the last tap combines like terms.
// Settings come from the lesson file:
//   "visual": { "widget": "box-method", "params": { "top": [1, 3], "side": [1, 5] } }   ((x + 3)(x + 5))

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const cx = (c, v) => (c === 1 ? v : c === -1 ? `−${v}` : `${n(c)}${v}`);
const termText = (c, deg) => (deg === 2 ? cx(c, 'x²') : deg === 1 ? cx(c, 'x') : n(c));

export function createBoxMethod({ host, params }) {
  const [a, b] = params.top; // (ax + b) across the top
  const [c, d] = params.side; // (cx + d) down the side
  const cells = [
    { r: 0, k: 0, coef: a * c, deg: 2, says: `${termText(c, 1)} · ${termText(a, 1)}` },
    { r: 0, k: 1, coef: c * b, deg: 1, says: `${termText(c, 1)} · ${n(b)}` },
    { r: 1, k: 0, coef: d * a, deg: 1, says: `${n(d)} · ${termText(a, 1)}` },
    { r: 1, k: 1, coef: d * b, deg: 0, says: `${n(d)} · ${n(b)}` },
  ];
  let step = 0; // 0..4 boxes filled, 5 = combined
  const wrap = document.createElement('div');
  wrap.className = 'area';
  const grid = document.createElement('div');
  grid.className = 'boxm';
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { step = (step + 1) % 6; render(); });
  wrap.append(grid, text, button);
  host.append(wrap);
  render();

  function render() {
    grid.replaceChildren();
    const cell = (cls, t) => { const e = document.createElement('div'); e.className = cls; e.textContent = t; return e; };
    grid.append(cell('boxm-corner', '×'), cell('boxm-head', termText(a, 1)), cell('boxm-head', n(b)));
    for (const r of [0, 1]) {
      grid.append(cell('boxm-head', r === 0 ? termText(c, 1) : n(d)));
      for (const k of [0, 1]) {
        const i = r * 2 + k;
        const filled = step > i;
        const e = cell(`boxm-cell${filled ? ' is-filled' : ''}${step === i + 1 ? ' is-new' : ''}${step === 5 && cells[i].deg === 1 ? ' is-like' : ''}`, filled ? termText(cells[i].coef, cells[i].deg) : '');
        grid.append(e);
      }
    }
    const mid = cells[1].coef + cells[2].coef;
    const result = [[a * c, 2], [mid, 1], [d * b, 0]].filter(([v]) => v !== 0)
      .map(([v, deg], i) => (i === 0 ? termText(v, deg) : `${v < 0 ? '−' : '+'} ${termText(Math.abs(v), deg)}`)).join(' ');
    const bin = (p, q) => `(${termText(p, 1)} ${q < 0 ? '−' : '+'} ${Math.abs(q)})`;
    text.textContent = step === 0 ? `${bin(c, d)}${bin(a, b)}: one binomial across the top, one down the side.`
      : step <= 4 ? `${cells[step - 1].says} = ${termText(cells[step - 1].coef, cells[step - 1].deg)}`
        : `Combine the like terms (the two x boxes): ${termText(cells[1].coef, 1)} ${cells[2].coef < 0 ? '−' : '+'} ${termText(Math.abs(cells[2].coef), 1)} = ${termText(mid, 1)}. So ${result}.`;
    button.textContent = step === 0 ? 'Fill the first box' : step < 4 ? 'Next box' : step === 4 ? 'Combine like terms' : 'Start over';
  }
}
