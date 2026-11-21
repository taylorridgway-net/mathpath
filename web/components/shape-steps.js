// A labelled shape with steps to tap through, for the geometry and measurement lessons.
// Settings come from the lesson file:
//   "visual": { "widget": "shape-steps", "params": { "shape": { "kind": "rect", "labels": { "w": "8 cm", "h": "5 cm" } },
//               "steps": ["Area counts the squares inside.", "8 × 5 = 40", "So the area is 40 cm²."] } }
// Or a coordinate graph instead of a shape (systems of equations): "graph": { "lines": [[[x1, y1], [x2, y2]], ...] }.

import { drawShape } from './shapes.js';
import { renderMath } from './render-math.js';

export function createShapeSteps({ host, params }) {
  const { shape, graph, steps } = params;
  let i = 0;
  const wrap = document.createElement('div');
  wrap.className = 'area';
  const pic = document.createElement('div');
  pic.className = 'numline-host';
  pic.append(graph ? renderMath({ type: 'graph', ...graph }) : drawShape({ type: 'shape', ...shape }));
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { i = (i + 1) % steps.length; render(); });
  wrap.append(pic, text, button);
  host.append(wrap);
  render();
  function render() {
    text.textContent = steps[i];
    button.textContent = i === steps.length - 1 ? 'Start over' : 'Next step';
  }
}
