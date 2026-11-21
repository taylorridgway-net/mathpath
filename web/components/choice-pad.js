// Answer buttons, for questions answered by choosing (compare: <, =, >; or
// "closest to 0, 1/2 or 1"). Same contract as the keypad: onSubmit(raw), onSkip().
// raw is { choice: index, label }. Keyboard: the symbol itself ("<", "=", ">") or 1, 2, 3.

import { renderLessonText } from './lesson-text.js';

export function createChoicePad({ host, options, onSubmit, onSkip }) {
  host.replaceChildren();
  host.classList.add('answer-area');
  const row = document.createElement('div');
  // Longer labels (0.777…, It repeats) get wider buttons, two to a row on a phone.
  row.className = options.some((o) => o.length > 4) ? 'choices choices-wide' : 'choices';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Choose your answer');
  options.forEach((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.append(renderLessonText(label, { tag: 'span', autoFractions: true }));
    b.setAttribute('aria-label', { '<': 'less than', '>': 'greater than', '=': 'equal to' }[label] || label);
    b.addEventListener('click', () => onSubmit({ choice: i, label }));
    row.append(b);
  });
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'I’m not sure';
  skip.addEventListener('click', () => onSkip());

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let i = options.indexOf(e.key);
    if (i < 0 && /^[1-9]$/.test(e.key)) i = Number(e.key) - 1;
    if (i < 0 || i >= options.length) return;
    e.preventDefault();
    onSubmit({ choice: i, label: options[i] });
  }
  document.addEventListener('keydown', onKeyDown);
  host.append(row, skip);
  return { destroy: () => document.removeEventListener('keydown', onKeyDown) };
}
