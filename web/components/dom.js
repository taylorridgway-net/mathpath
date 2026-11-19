// Tiny DOM helpers shared by the student screens.

export function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function section(className) {
  return h('section', className);
}

export function btn(className, text, onClick) {
  const b = h('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export function pill(text, tone) {
  return h('span', `pill pill-${tone}`, text);
}

export function list(items, emptyText) {
  if (!items.length) return h('p', 'empty', emptyText);
  const ul = h('ul', 'plain-list');
  for (const item of items) ul.append(h('li', '', item));
  return ul;
}

// Show a new screen, scroll to the top, and move focus to its heading so
// screen readers announce it.
export function swap(app, screen, { focus = 'h1, .instruction' } = {}) {
  app.replaceChildren(screen);
  window.scrollTo(0, 0);
  const heading = screen.querySelector(focus);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

// Two columns on a wide screen (computer, Chromebook), one on a phone.
// `main` holds the problem or explanation; `side` the keypad or picture.
// On a phone the side column comes after the main one, as before.
//   variant 'keypad'  side column is keypad-width
//   variant 'even'    two equal columns
export function split(variant = 'keypad') {
  const el = h('div', `split split-${variant}`);
  const main = h('div', 'split-main');
  const side = h('div', 'split-side');
  el.append(main, side);
  return { el, main, side };
}
