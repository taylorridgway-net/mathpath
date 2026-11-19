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
