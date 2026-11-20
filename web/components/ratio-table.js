// The ratio table, used in the ratios lesson: two rows (e.g. cups of flour, cups
// of sugar) that grow a column at a time by multiplying BOTH by the same number,
// so students see equivalent ratios are made by multiplying, not adding.
// Settings come from the lesson file:
//   "visual": { "widget": "ratio-table", "params": { "top": [3, "cups of flour"], "bottom": [4, "cups of sugar"], "times": [2, 3, 4] } }

export function createRatioTable({ host, params }) {
  const [a, topLabel] = params.top;
  const [b, bottomLabel] = params.bottom;
  const times = [1, ...params.times];
  let shown = 1;

  const wrap = el('div', 'area');
  const table = el('div', 'rtable');
  table.setAttribute('role', 'img');
  const text = el('p', 'area-sums');
  text.setAttribute('aria-live', 'polite');
  const button = el('button', 'button');
  button.type = 'button';
  button.addEventListener('click', () => { shown = shown < times.length ? shown + 1 : 1; render(); });
  wrap.append(table, text, button);
  host.append(wrap);
  render();

  function render() {
    table.replaceChildren();
    table.style.gridTemplateColumns = `auto repeat(${times.length}, minmax(2.6em, 1fr))`;
    const cells = (label, base) => {
      table.append(el('span', 'rtable-label', label));
      times.forEach((k, i) => table.append(el('span', `rtable-cell${i < shown ? '' : ' is-hidden'}${i === shown - 1 && i > 0 ? ' is-new' : ''}`, i < shown ? String(base * k) : '')));
    };
    cells(topLabel, a);
    cells(bottomLabel, b);
    table.append(el('span', 'rtable-label', ''));
    times.forEach((k, i) => table.append(el('span', 'rtable-times', i > 0 && i < shown ? `× ${k}` : '')));
    const k = times[shown - 1];
    const say = shown === 1
      ? `${a} ${topLabel} for every ${b} ${bottomLabel}. Tap to make more batches.`
      : `× ${k}: ${a} × ${k} = ${a * k} and ${b} × ${k} = ${b * k}. Both numbers are multiplied by ${k}, so ${a * k} : ${b * k} is the same ratio as ${a} : ${b}.`;
    text.textContent = say;
    table.setAttribute('aria-label', say);
    button.textContent = shown < times.length ? `Multiply both by ${times[shown]}` : 'Start over';
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
