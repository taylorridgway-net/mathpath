// Draws column addition/subtraction from engine/problem/column.js: a grid with
// the carry (or borrow) row, the two numbers, the line, and the answer so far.
// The column being worked on is highlighted.

import { columnLayout } from '../../engine/problem/column.js';

// Decimals (places > 0): a column for the decimal point, lined up in every row; the
// point in the answer row is there from the start ("bring the point straight down").
export function drawColumn({ op, top, bottom, done = Infinity, places = 0, topPlaces = places, bottomPlaces = places }) {
  const layout = columnLayout(op, top, bottom, done, { places, topPlaces, bottomPlaces });
  const grid = document.createElement('div');
  grid.className = 'col-grid';
  grid.style.gridTemplateColumns = places
    ? `repeat(${layout.width - places + 1}, 1.4em) 0.5em repeat(${places}, 1.4em)`
    : `repeat(${layout.width + 1}, 1.4em)`;
  grid.setAttribute('aria-hidden', 'true');
  const cell = (text, cls = '') => {
    const c = document.createElement('span');
    c.className = `col-cell ${cls}`;
    c.textContent = text ?? '';
    return c;
  };
  const cols = [...layout.columns].reverse(); // left to right on screen
  const hot = (i) => (layout.current !== null && layout.width - 1 - i === layout.current ? ' col-hot' : '');
  // A row: one cell per column, with the decimal point's column after the ones.
  const row = (first, each, point = '', pointClass = '') => {
    grid.append(first);
    cols.forEach((c, i) => {
      if (places && i === layout.width - places) grid.append(cell(point, `col-point ${pointClass}`));
      grid.append(each(c, i));
    });
  };
  // Row 1: carries, or the new values after borrowing.
  row(cell(''), (c, i) => cell(op === '+' ? (c.carry ? '1' : '') : (c.newTop ?? ''), `col-small${hot(i)}`));
  // Row 2: the top number (crossed out where it was borrowed from; filled-in zeros lighter).
  row(cell(''), (c, i) => cell(c.top ?? '', `${c.newTop !== null ? 'col-struck' : ''}${c.topPadded ? ' col-pad' : ''}${hot(i)}`), '.');
  // Row 3: the operation and the bottom number, underlined.
  row(cell(op === '-' ? '−' : '+', 'col-op col-under'), (c, i) => cell(c.bottom ?? '', `col-under${c.bottomPadded ? ' col-pad' : ''}${hot(i)}`), '.', 'col-under');
  // Row 4: the answer so far.
  row(cell(''), (c, i) => cell(c.result ?? '', `col-result${hot(i)}`), '.', 'col-result');
  return grid;
}
