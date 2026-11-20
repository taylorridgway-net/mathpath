// A worked example one step at a time: each line is the math after a step, with
// the part that changes highlighted ([[...]]), and a short note. Settings come
// from the lesson file ("worked" lines, or a "steps" visual):
//   [ { "math": "2 + [[3 × 4]]", "note": "Multiply first" }, { "math": "2 + 12" }, ... ]

import { renderLessonText } from './lesson-text.js';

export function createStepThrough({ host, params }) {
  const lines = params.lines;
  let shown = 1;
  const wrap = document.createElement('div');
  wrap.className = 'steps-through';
  const list = document.createElement('ol');
  list.className = 'math-lines';
  list.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { shown = shown < lines.length ? shown + 1 : 1; render(); });
  wrap.append(list, button);
  host.append(wrap);
  render();

  function render() {
    list.replaceChildren(...lines.slice(0, shown).map((l, i) => mathLine(l, i === shown - 1)));
    button.textContent = shown < lines.length ? 'Next step' : 'Start over';
  }
}

// One line of worked math, big, with its note.
export function mathLine({ math, note }, current = false) {
  const li = document.createElement('li');
  li.className = `math-line${current ? ' is-current' : ''}`;
  li.append(renderLessonText(math, { tag: 'span', className: 'math-line-math', autoFractions: true }));
  if (note) li.append(renderLessonText(note, { tag: 'span', className: 'math-line-note', autoFractions: true }));
  return li;
}
