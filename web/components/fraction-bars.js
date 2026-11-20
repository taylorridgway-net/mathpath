// The fraction-bars interactive, used in three lesson sections.
// Settings come from the lesson file ("visual": { "widget": "fraction-bars", "params": ... }).
//
// Tasks:
//   cut-to-match  bars [[1,2],[1,3]]: the student picks one number of pieces for
//                 every bar and sees whether the shading lines up with the cuts
//                 in all of them (it does exactly when that number is a common
//                 denominator). Numbers that work are collected in a list.
//   recut         bars [[1,4]], recutInto 12: cut each piece into k smaller
//                 pieces; the shaded amount stays the same (1/4 = 3/12).
//   combine       bars [[2,7],[3,7]]: put the shaded pieces together into one
//                 bar; the piece size doesn't change (2/7 + 3/7 = 5/7).
//   count-pieces  wholes 4: cut every whole into k pieces and count them
//                 (how many 1/3s fit into 4? 4 × 3 = 12).

import { renderMath } from './render-math.js';

const frac = (n, d) => ({ type: 'frac', n, d });
const eq = (left, right) => ({ type: 'eq', left, right });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });

// For cut-to-match: does cutting a/b's bar into `pieces` pieces put a cut where the shading ends?
export function shadingLinesUp(d, pieces) {
  return pieces % d === 0;
}

export function createFractionBars({ host, params }) {
  const wrap = el('div', 'fbars');
  host.append(wrap);
  const draw = { 'cut-to-match': cutToMatch, recut, combine, 'count-pieces': countPieces }[params.task];
  if (!draw) throw new Error(`fraction-bars: unknown task "${params.task}"`);
  draw(wrap, params);
}

// ---------- cut-to-match ----------

function cutToMatch(wrap, { bars }) {
  let pieces = null; // null: each bar is cut into its own denominator
  const found = new Set();
  const rows = el('div', 'fbars-rows');
  const status = el('p', 'fbars-status');
  status.setAttribute('aria-live', 'polite');
  const foundLine = el('p', 'fbars-found');
  const stepper = makeStepper({
    label: 'Pieces in each bar',
    unit: '',
    min: 1,
    max: 24,
    start: null,
    first: 2,
    onChange(v) {
      pieces = v;
      render();
    },
  });
  wrap.append(rows, stepper.el, status, foundLine);
  render();

  function render() {
    rows.replaceChildren();
    for (const [n, d] of bars) {
      const cuts = pieces ?? d;
      const fits = shadingLinesUp(d, cuts);
      const label = fits && cuts !== d ? eq(frac(n, d), frac((n * cuts) / d, cuts)) : frac(n, d);
      rows.append(barRow({ n, d, cuts, label, mark: pieces === null ? null : fits }));
    }
    if (pieces === null) {
      status.textContent = 'Right now the pieces are different sizes. Use + to cut both bars into the same number of pieces.';
    } else if (bars.every(([, d]) => shadingLinesUp(d, pieces))) {
      found.add(pieces);
      status.textContent = `${pieces} works: the shading ends on a cut in every bar. ${pieces} is a common denominator.`;
    } else {
      const off = bars.filter(([, d]) => !shadingLinesUp(d, pieces)).map(([n, d]) => `${n}/${d}`);
      status.textContent = `${pieces} doesn't work: the shading for ${off.join(' and ')} ends in the middle of a piece.`;
    }
    foundLine.textContent = found.size ? `Numbers that work so far: ${[...found].sort((a, b) => a - b).join(', ')}` : '';
  }
}

// ---------- recut ----------

function recut(wrap, { bars, recutInto }) {
  const [[n, d]] = bars;
  const maxK = Math.max(2, Math.floor((recutInto || d * 4) / d) + 1);
  let k = 1;
  const rows = el('div', 'fbars-rows');
  const status = el('p', 'fbars-status');
  status.setAttribute('aria-live', 'polite');
  const stepper = makeStepper({
    label: 'Cut each piece into',
    unit: '',
    min: 1,
    max: maxK,
    start: 1,
    onChange(v) {
      k = v;
      render();
    },
  });
  wrap.append(rows, stepper.el, status);
  render();

  function render() {
    const label = k === 1 ? frac(n, d) : eq(frac(n, d), frac(n * k, d * k));
    rows.replaceChildren(barRow({ n, d, cuts: d * k, major: d, label }));
    status.textContent = k === 1
      ? `${n} of ${d} pieces shaded.`
      : `Each piece cut into ${k}: now ${n * k} of ${d * k} pieces are shaded. The shaded amount didn't change.`;
  }
}

// ---------- count-pieces ----------

const PIECE_NAMES = { 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths' };

function countPieces(wrap, { wholes }) {
  let k = 1;
  const rows = el('div', 'fbars-rows');
  const status = el('p', 'fbars-status');
  status.setAttribute('aria-live', 'polite');
  const stepper = makeStepper({
    label: 'Cut each whole into',
    unit: '',
    min: 1,
    max: 8,
    start: 1,
    onChange(v) {
      k = v;
      render();
    },
  });
  wrap.append(rows, stepper.el, status);
  render();

  function render() {
    rows.replaceChildren(barRow({ n: 1, d: 1, cuts: wholes * k, major: wholes, label: { type: 'int', value: wholes } }));
    status.textContent = k === 1
      ? `${wholes} wholes. Use + to cut each whole into pieces.`
      : `${wholes} wholes, each cut into ${k}: ${wholes} × ${k} = ${wholes * k} ${PIECE_NAMES[k]}. So ${wholes * k} pieces of size 1/${k} fit into ${wholes}.`;
  }
}

// ---------- combine ----------

function combine(wrap, { bars }) {
  const [[a, d], [b]] = bars;
  let together = false;
  const rows = el('div', 'fbars-rows');
  const status = el('p', 'fbars-status');
  status.setAttribute('aria-live', 'polite');
  const toggle = el('button', 'button fbars-action', 'Put them together');
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    together = !together;
    render();
  });
  wrap.append(rows, toggle, status);
  render();

  function render() {
    rows.replaceChildren();
    if (!together) {
      rows.append(barRow({ n: a, d, cuts: d, label: frac(a, d) }));
      rows.append(barRow({ n: b, d, cuts: d, label: frac(b, d), tone: 2 }));
      status.textContent = `${a} pieces and ${b} pieces. Every piece is one ${ordinal(d)}.`;
      toggle.textContent = 'Put them together';
    } else {
      rows.append(barRow({ n: a, extra: b, d, cuts: d, label: eq(op('+', frac(a, d), frac(b, d)), frac(a + b, d)) }));
      status.textContent = `${a + b} pieces, and each one is still one ${ordinal(d)}. The size of the pieces didn't change, so the denominator stays ${d}.`;
      toggle.textContent = 'Take them apart';
    }
  }
}

// ---------- drawing ----------

// One bar: `cuts` equal pieces, the first n/d of the length shaded.
//   major  draw thicker lines at this many pieces (the original cuts, for recut)
//   extra  a second shaded run right after the first (combine), in another colour
//   mark   true/false: show a check or a cross next to the label
function barRow({ n, d, cuts, major, extra = 0, label, tone = 1, mark = null }) {
  const row = el('div', 'fbar-row');
  const bar = el('div', 'fbar');
  bar.setAttribute('role', 'img');
  const shaded = extra ? `${n} + ${extra} of ${d}` : `${n} of ${d}`;
  bar.setAttribute('aria-label', `Bar cut into ${cuts} pieces; ${shaded} parts shaded`);

  const fill = el('div', `fbar-fill fbar-tone-${tone}`);
  fill.style.width = `${(n / d) * 100}%`;
  bar.append(fill);
  if (extra) {
    const fill2 = el('div', 'fbar-fill fbar-tone-2');
    fill2.style.left = `${(n / d) * 100}%`;
    fill2.style.width = `${(extra / d) * 100}%`;
    bar.append(fill2);
  }
  const lines = el('div', 'fbar-cuts');
  for (let i = 1; i < cuts; i++) {
    const line = el('span', 'fbar-cut');
    if (major && (i * major) % cuts === 0) line.classList.add('fbar-cut-major');
    line.style.left = `${(i / cuts) * 100}%`;
    lines.append(line);
  }
  bar.append(lines);

  const tag = el('div', 'fbar-label');
  tag.append(renderMath(label, { inline: true }));
  if (mark !== null) {
    const m = el('span', `fbar-mark ${mark ? 'is-yes' : 'is-no'}`, mark ? '✓' : '✗');
    m.setAttribute('aria-label', mark ? 'lines up' : 'does not line up');
    tag.append(m);
  }
  row.append(bar, tag);
  return row;
}

function makeStepper({ label, unit, min, max, start, first = min, onChange }) {
  let value = start;
  const box = el('div', 'stepper');
  const text = el('span', 'stepper-label', label);
  const minus = el('button', 'stepper-btn', '−');
  const plus = el('button', 'stepper-btn', '+');
  const out = el('output', 'stepper-value');
  minus.type = plus.type = 'button';
  minus.setAttribute('aria-label', 'Fewer pieces');
  plus.setAttribute('aria-label', 'More pieces');
  minus.addEventListener('click', () => set(value === null ? null : value - 1));
  plus.addEventListener('click', () => set(value === null ? first : value + 1));
  const unitEl = el('span', 'stepper-unit', unit);
  box.append(text, minus, out, plus, unitEl);
  render();
  return { el: box };

  function set(v) {
    if (v === null || v < min || v > max) return;
    value = v;
    render();
    onChange(v);
  }
  function render() {
    out.textContent = value === null ? '–' : String(value);
    minus.disabled = value === null || value <= min;
    plus.disabled = value !== null && value >= max;
  }
}

function ordinal(d) {
  return { 2: 'half', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth' }[d] || `1/${d}`;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
