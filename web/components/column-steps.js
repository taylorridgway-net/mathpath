// Column addition/subtraction, one column at a time: the lesson picture for
// carrying and borrowing. Settings come from the lesson file:
//   "visual": { "widget": "column", "params": { "op": "+", "top": 47, "bottom": 38 } }
// The sentences are the same ones the worked solutions use.

import { solve } from '../../engine/solutions/index.js';
import { renderMath } from './render-math.js';
import { renderLessonText } from './lesson-text.js';

export function createColumnSteps({ host, params }) {
  const { op, top, bottom } = params;
  // Decimals are given as text ("3.5", "1.25"): the points line up.
  const decimal = typeof top === 'string' || typeof bottom === 'string';
  const node = (x) => (String(x).includes('.') ? { type: 'dec', value: String(x) } : { type: 'int', value: Number(x) });
  const steps = solve({
    generator: decimal ? 'dec.add-sub.line-up' : op === '+' ? 'whole.add-sub.add-regroup' : 'whole.add-sub.sub-regroup',
    expression: { type: 'op', op, left: node(top), right: node(bottom) },
  }).filter((s) => s.show?.type === 'column');
  let at = 0;
  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = document.createElement('div');
  pic.className = 'col-pic';
  const text = document.createElement('div');
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { at = at < steps.length - 1 ? at + 1 : 0; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();

  function render() {
    pic.replaceChildren(renderMath(steps[at].show));
    text.replaceChildren(renderLessonText(steps[at].say, { className: 'area-sums' }));
    button.textContent = at === 0 ? (decimal ? 'Start on the right' : 'Start with the ones') : at < steps.length - 1 ? 'Next column' : 'Start over';
  }
}
