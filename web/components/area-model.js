// The area model, used in the multiplication-facts section: a rectangle of
// rows × cols squares that the student splits into two easier facts
// (7 × 8 = 7 × 5 + 7 × 3). Settings come from the lesson file:
//   "visual": { "widget": "area-model", "params": { "rows": 7, "cols": 8, "split": 5 } }

export function createAreaModel({ host, params }) {
  const { rows, cols } = params;
  let split = Math.min(Math.max(params.split ?? Math.floor(cols / 2), 1), cols - 1);

  const wrap = el('div', 'area');
  const grid = el('div', 'area-grid');
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.setAttribute('role', 'img');
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = el('span', 'area-cell');
      cells.push({ cell, c });
      grid.append(cell);
    }
  }

  const controls = el('div', 'stepper');
  const label = el('span', 'stepper-label', 'Split after column');
  const minus = el('button', 'stepper-btn', '−');
  const out = el('output', 'stepper-value');
  const plus = el('button', 'stepper-btn', '+');
  minus.type = plus.type = 'button';
  minus.setAttribute('aria-label', 'Move the split left');
  plus.setAttribute('aria-label', 'Move the split right');
  minus.addEventListener('click', () => move(-1));
  plus.addEventListener('click', () => move(1));
  controls.append(label, minus, out, plus);

  const sums = el('p', 'area-sums');
  sums.setAttribute('aria-live', 'polite');
  wrap.append(grid, controls, sums);
  host.append(wrap);
  render();

  function move(d) {
    split = Math.min(Math.max(split + d, 1), cols - 1);
    render();
  }

  function render() {
    for (const { cell, c } of cells) {
      cell.classList.toggle('area-left', c < split);
      cell.classList.toggle('area-right', c >= split);
      cell.classList.toggle('area-edge', c === split - 1);
    }
    const left = cols === split ? 0 : split;
    const right = cols - split;
    out.textContent = String(split);
    minus.disabled = split <= 1;
    plus.disabled = split >= cols - 1;
    grid.setAttribute('aria-label', `${rows} rows of ${cols}, split into ${rows} × ${left} and ${rows} × ${right}`);
    sums.textContent = `${rows} × ${left} = ${rows * left}, and ${rows} × ${right} = ${rows * right}. Together: ${rows * left} + ${rows * right} = ${rows * cols}, so ${rows} × ${cols} = ${rows * cols}.`;
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
