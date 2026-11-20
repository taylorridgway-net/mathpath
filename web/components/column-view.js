// Draws column addition/subtraction from engine/problem/column.js: a grid with
// the carry (or borrow) row, the two numbers, the line, and the answer so far.
// The column being worked on is highlighted.

import { columnLayout } from '../../engine/problem/column.js';

export function drawColumn({ op, top, bottom, done = Infinity }) {
  const layout = columnLayout(op, top, bottom, done);
  const grid = document.createElement('div');
  grid.className = 'col-grid';
  grid.style.gridTemplateColumns = `repeat(${layout.width + 1}, 1.4em)`;
  grid.setAttribute('aria-hidden', 'true');
  const cell = (text, cls = '') => {
    const c = document.createElement('span');
    c.className = `col-cell ${cls}`;
    c.textContent = text ?? '';
    return c;
  };
  const cols = [...layout.columns].reverse(); // left to right on screen
  const hot = (i) => (layout.current !== null && layout.width - 1 - i === layout.current ? ' col-hot' : '');
  // Row 1: carries, or the new values after borrowing.
  grid.append(cell(''));
  cols.forEach((c, i) => grid.append(cell(op === '+' ? (c.carry ? '1' : '') : (c.newTop ?? ''), `col-small${hot(i)}`)));
  // Row 2: the top number (crossed out where it was borrowed from).
  grid.append(cell(''));
  cols.forEach((c, i) => grid.append(cell(c.top ?? '', `${c.newTop !== null ? 'col-struck' : ''}${hot(i)}`)));
  // Row 3: the operation and the bottom number, underlined.
  grid.append(cell(op === '-' ? '−' : '+', 'col-op col-under'));
  cols.forEach((c, i) => grid.append(cell(c.bottom ?? '', `col-under${hot(i)}`)));
  // Row 4: the answer so far.
  grid.append(cell(''));
  cols.forEach((c, i) => grid.append(cell(c.result ?? '', `col-result${hot(i)}`)));
  return grid;
}
