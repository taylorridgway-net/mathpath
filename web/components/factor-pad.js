// Answer boxes inside a math template, for multiplying and factoring polynomials:
//   product      [ ]x² + [ ]x + [ ]           (multiply binomials)
//   binomials    (x + [ ])(x + [ ])           (x² + 7x + 12, x² − 25)
//   gcf          [ ]([ ]x + [ ])              (6x + 9)
//   binomials-a  ([ ]x + [ ])([ ]x + [ ])     (2x² + 7x + 3)
// Each box holds a whole number with its own sign; the + or − in front of a box shows its
// sign ((−) changes the box you're in). Tap a box or press Next to move. Keys on a keyboard:
// digits, "-", Backspace, Tab / Space / arrows, Enter.
// raw answer: { boxes: [whole numbers] } in template order.

const TEMPLATES = {
  product: [{ box: 0, lead: true }, 'x²', { box: 1 }, 'x', { box: 2 }],
  binomials: ['(', 'x', { box: 0 }, ')', '(', 'x', { box: 1 }, ')'],
  gcf: [{ box: 0, lead: true }, '(', { box: 1, lead: true }, 'x', { box: 2 }, ')'],
  'binomials-a': ['(', { box: 0, lead: true }, 'x', { box: 1 }, ')', '(', { box: 2, lead: true }, 'x', { box: 3 }, ')'],
};
export const BOX_COUNT = { product: 3, binomials: 2, gcf: 3, 'binomials-a': 4 };
const MAX_DIGITS = 3;

export function createFactorPad({ host, form, onSubmit, onSkip }) {
  const template = TEMPLATES[form];
  const n = BOX_COUNT[form];
  const digits = Array(n).fill('');
  const neg = Array(n).fill(false);
  let focus = 0;

  host.replaceChildren();
  host.classList.add('answer-area');
  const display = document.createElement('div');
  display.className = 'answer factor-answer';
  display.setAttribute('role', 'group');
  display.setAttribute('aria-label', 'Your answer');
  const live = document.createElement('div');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  const hint = document.createElement('div');
  hint.className = 'answer-hint';
  hint.textContent = 'Type a number in each box; tap Next (or a box) to move. (−) makes the box you’re in negative.';
  const pad = document.createElement('div');
  pad.className = 'keypad';
  const keys = [['7', '8', '9', 'backspace'], ['4', '5', '6', 'next'], ['1', '2', '3', null]];
  const LABEL = { backspace: '⌫', next: 'Next', negate: '(−)' };
  for (const row of keys) for (const k of row) pad.append(k ? key(k) : spacer());
  pad.append(key('negate'), key('0'));
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'key key-check key-wide';
  check.textContent = 'Check';
  check.addEventListener('click', submit);
  pad.append(check);
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'I’m not sure';
  skip.addEventListener('click', () => onSkip());
  host.append(display, live, hint, pad, skip);
  document.addEventListener('keydown', onKeyDown);
  render();

  function key(k) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = /^\d$/.test(k) ? 'key' : 'key key-tool';
    b.textContent = LABEL[k] || k;
    if (k === 'backspace') b.setAttribute('aria-label', 'Delete');
    if (k === 'negate') b.setAttribute('aria-label', 'Negative');
    b.addEventListener('click', () => press(k));
    return b;
  }
  function spacer() { const d = document.createElement('div'); d.className = 'key-spacer'; return d; }

  function press(k) {
    if (/^\d$/.test(k)) { if (digits[focus].length < MAX_DIGITS) digits[focus] = digits[focus] === '0' ? k : digits[focus] + k; } else if (k === 'backspace') {
      if (digits[focus]) digits[focus] = digits[focus].slice(0, -1);
      else if (neg[focus]) neg[focus] = false;
      else if (focus > 0) focus -= 1;
    } else if (k === 'negate') neg[focus] = !neg[focus];
    else if (k === 'next') focus = (focus + 1) % n;
    render();
  }
  function ready() { return digits.every((d) => d !== ''); }
  function submit() {
    if (!ready()) return;
    onSubmit({ boxes: digits.map((d, i) => (neg[i] ? -1 : 1) * Number(d)) });
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = document.activeElement?.tagName === 'BUTTON';
    if ((e.key === ' ' || e.key === 'Enter') && onButton) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    const map = { Backspace: 'backspace', Delete: 'backspace', '-': 'negate', ' ': 'next', ArrowRight: 'next', '+': 'next', x: 'next' };
    if (e.key === 'Tab') { if (focus === n - 1) return; e.preventDefault(); press('next'); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focus = Math.max(0, focus - 1); render(); return; }
    const k = /^\d$/.test(e.key) ? e.key : map[e.key];
    if (!k) return;
    e.preventDefault();
    press(k);
  }

  function render() {
    display.replaceChildren();
    for (const t of template) {
      if (typeof t === 'string') {
        const s = document.createElement('span');
        s.className = t === '(' || t === ')' ? 'answer-r factor-paren' : 'answer-x';
        s.textContent = t;
        display.append(s);
        continue;
      }
      const i = t.box;
      if (!t.lead) {
        const pm = document.createElement('span');
        pm.className = 'answer-r answer-pm';
        pm.textContent = neg[i] ? '−' : '+';
        display.append(pm);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `answer-box${focus === i ? ' is-focus' : ''}`;
      b.textContent = `${t.lead && neg[i] ? '−' : ''}${digits[i]}`;
      b.setAttribute('aria-label', `Box ${i + 1}`);
      b.setAttribute('aria-pressed', String(focus === i));
      b.addEventListener('click', () => { focus = i; render(); });
      display.append(b);
    }
    check.disabled = !ready();
    live.textContent = `Your answer: ${describe()}`;
  }
  function describe() {
    return template.map((t) => (typeof t === 'string' ? t : `${t.lead ? '' : neg[t.box] ? 'minus ' : 'plus '}${t.lead && neg[t.box] ? 'negative ' : ''}${digits[t.box] || 'blank'}`)).join(' ');
  }
  return { destroy: () => document.removeEventListener('keydown', onKeyDown) };
}
