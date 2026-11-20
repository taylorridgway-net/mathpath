// The fraction area model, used in the multiply-fractions lesson: a square cut
// into b columns and d rows. Step 1 shades a/b (columns); step 2 takes c/d of
// that (rows); the overlap is a×c of b×d squares, so a/b × c/d = ac/bd.
// Settings come from the lesson file:
//   "visual": { "widget": "fraction-area", "params": { "a": 2, "b": 3, "c": 4, "d": 5 } }

export function createFractionArea({ host, params }) {
  const { a, b, c, d } = params;
  let step = 0;

  const wrap = el('div', 'area');
  const grid = el('div', 'area-grid farea-grid');
  grid.style.gridTemplateColumns = `repeat(${b}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${d}, 1fr)`;
  grid.setAttribute('role', 'img');
  const cells = [];
  for (let r = 0; r < d; r++) for (let col = 0; col < b; col++) {
    const cell = el('span', 'area-cell farea-cell');
    cells.push({ cell, r, col });
    grid.append(cell);
  }
  const text = el('p', 'area-sums');
  text.setAttribute('aria-live', 'polite');
  const next = el('button', 'button');
  next.type = 'button';
  next.addEventListener('click', () => { step = (step + 1) % 3; render(); });
  wrap.append(grid, text, next);
  host.append(wrap);
  render();

  function render() {
    for (const { cell, r, col } of cells) {
      const inA = col < a && step >= 1;
      const inC = r < c && step >= 2;
      cell.classList.toggle('farea-a', inA && !inC);
      cell.classList.toggle('farea-c', inC && !inA);
      cell.classList.toggle('farea-both', inA && inC);
    }
    const lines = [
      `A whole square, cut into ${b} columns and ${d} rows: ${b * d} small pieces.`,
      `Shade ${a}/${b}: ${a} of the ${b} columns.`,
      `Now take ${c}/${d} of that: ${c} of the ${d} rows. The darkest part is ${c}/${d} of ${a}/${b}: ${a * c} of the ${b * d} pieces. So ${a}/${b} × ${c}/${d} = ${a * c}/${b * d}.`,
    ];
    text.textContent = lines[step];
    grid.setAttribute('aria-label', lines[step]);
    next.textContent = [`Shade ${a}/${b}`, `Take ${c}/${d} of it`, 'Start over'][step];
  }
}

function el(tag, className, t) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (t !== undefined) e.textContent = t;
  return e;
}
