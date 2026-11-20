// Factor pairs as rectangles, used in the factors lesson: every way to arrange
// n squares in a rectangle is a factor pair (24 = 1 × 24 = 2 × 12 = 3 × 8 = 4 × 6).
// Settings come from the lesson file:
//   "visual": { "widget": "factor-pairs", "params": { "n": 24 } }

export function createFactorPairs({ host, params }) {
  const { n } = params;
  const pairs = [];
  for (let a = 1; a * a <= n; a++) if (n % a === 0) pairs.push([a, n / a]);
  let at = 0;

  const wrap = document.createElement('div');
  wrap.className = 'area';
  const grid = document.createElement('div');
  grid.className = 'area-grid fp-grid';
  grid.setAttribute('role', 'img');
  const text = document.createElement('p');
  text.className = 'area-sums';
  text.setAttribute('aria-live', 'polite');
  const found = document.createElement('p');
  found.className = 'fbars-found';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.addEventListener('click', () => { at = at < pairs.length - 1 ? at + 1 : 0; render(); });
  wrap.append(grid, text, found, button);
  host.append(wrap);
  render();

  function render() {
    const [rows, cols] = pairs[at];
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.maxWidth = `${Math.min(22, cols * 1.6)}rem`;
    grid.replaceChildren(...Array.from({ length: n }, () => {
      const c = document.createElement('span');
      c.className = 'area-cell area-left';
      return c;
    }));
    text.textContent = `${rows} row${rows > 1 ? 's' : ''} of ${cols}: ${rows} × ${cols} = ${n}. So ${rows} and ${cols} are factors of ${n}.`;
    grid.setAttribute('aria-label', text.textContent);
    const soFar = pairs.slice(0, at + 1).flat().sort((a, b) => a - b);
    found.textContent = `Factors found so far: ${[...new Set(soFar)].join(', ')}`;
    button.textContent = at < pairs.length - 1 ? 'Next rectangle' : 'That’s all of them. Start over';
  }
}
