// Inequalities on a number line, used in the graphing-inequalities lesson: each tap shows
// the next example: the inequality, its graph (open or closed dots, the shading), and why.
// Settings come from the lesson file:
//   "visual": { "widget": "ineq-line", "params": { "lo": -6, "hi": 6, "examples": [
//     { "text": "x > 3", "points": [{ "v": 3, "closed": false }], "shade": "right", "why": "..." } ] } }

import { drawNumberLine } from './number-line.js';

export function createIneqLine({ host, params }) {
  const { lo = -6, hi = 6, examples } = params;
  let i = 0;
  const wrap = document.createElement('div');
  wrap.className = 'area';
  const title = document.createElement('p');
  title.className = 'ineq-line-title';
  const pic = document.createElement('div');
  pic.className = 'numline-host';
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { i = (i + 1) % examples.length; render(); });
  wrap.append(title, pic, text, button);
  host.append(wrap);
  render();

  function render() {
    const ex = examples[i];
    title.textContent = ex.text;
    pic.replaceChildren(drawNumberLine({ lo, hi, points: ex.points, shade: ex.shade }).root);
    text.textContent = ex.why;
    button.textContent = i === examples.length - 1 ? 'Start over' : 'Next example';
  }
}
