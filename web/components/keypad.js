// The math keypad: answer boxes plus on-screen keys, and the same keys on a
// physical keyboard (digits, "/", space, Backspace, Enter, "-", arrow keys).
// All the editing rules live in answer-editor.js; this file only draws and wires.

import { createAnswerState, applyKey, toRawAnswer, describeAnswer, fieldsFor } from './answer-editor.js';
import { readAnswer } from '../../engine/grading/check-answer.js';

const KEYS = [
  ['7', '8', '9', 'backspace'],
  ['4', '5', '6', 'fraction'],
  ['1', '2', '3', 'mixed'],
];

const LABELS = {
  backspace: { text: '⌫', aria: 'Delete' },
  fraction: { text: 'a/b', aria: 'Fraction' },
  mixed: { text: '1 a/b', aria: 'Mixed number' },
};

export function createKeypad({ host, allowFractions, allowNegative = false, onSubmit, onSkip }) {
  let state = createAnswerState({ allowFractions, allowNegative });

  host.replaceChildren();
  host.classList.add('answer-area');

  // ---- answer boxes ----
  const display = div('answer');
  display.setAttribute('role', 'group');
  display.setAttribute('aria-label', 'Your answer');
  const sign = span('answer-sign', '−');
  const boxes = {
    whole: box('whole', 'Whole number'),
    num: box('num', 'Numerator'),
    den: box('den', 'Denominator'),
  };
  const stack = div('answer-stack');
  stack.append(boxes.num, div('answer-bar'), boxes.den);
  display.append(sign, boxes.whole, stack);
  const live = div('visually-hidden');
  live.setAttribute('aria-live', 'polite');

  // ---- keys ----
  const pad = div('keypad');
  for (const row of KEYS) for (const k of row) pad.append(key(k));
  const zero = key('0');
  zero.classList.add('key-wide');
  const check = button('key key-check', 'Check');
  check.addEventListener('click', submit);
  check.classList.add('key-wide');
  pad.append(zero, check);

  const skip = button('skip', 'I’m not sure');
  skip.addEventListener('click', () => onSkip());

  const hint = div('answer-hint');
  hint.textContent = allowFractions
    ? 'Tap a/b for a fraction, 1 a/b for a mixed number.'
    : 'Type a whole number.';

  host.append(display, live, hint, pad, skip);
  document.addEventListener('keydown', onKeyDown);
  render();

  // ---------- behaviour ----------

  function press(k) {
    state = applyKey(state, k);
    render();
  }

  function submit() {
    if (check.disabled) return;
    onSubmit(toRawAnswer(state));
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = {
      Backspace: 'backspace', Delete: 'backspace', '/': 'fraction', ' ': 'mixed', '-': 'negate',
      ArrowUp: 'focus:num', ArrowDown: 'focus:den', ArrowLeft: 'focus:whole',
    };
    // Space and Enter on a keyboard-focused button press that button, as usual.
    const onButton = document.activeElement?.tagName === 'BUTTON';
    if ((e.key === ' ' || e.key === 'Enter') && onButton) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    let k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
    if (e.key === 'ArrowRight') k = state.focus === 'whole' ? 'focus:num' : null;
    if (!k) return;
    e.preventDefault();
    press(k);
  }

  function render() {
    const shown = fieldsFor(state.mode);
    for (const f of ['whole', 'num', 'den']) {
      const b = boxes[f];
      b.hidden = !shown.includes(f);
      b.textContent = state[f];
      b.classList.toggle('is-focus', state.focus === f);
      b.setAttribute('aria-pressed', String(state.focus === f));
    }
    stack.hidden = state.mode === 'number';
    sign.hidden = !state.negative;
    display.dataset.mode = state.mode;
    live.textContent = `Your answer: ${describeAnswer(state)}`;
    check.disabled = !readAnswer(toRawAnswer(state)).ok;
  }

  function box(field, label) {
    const b = button(`answer-box answer-${field}`, '');
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => press(`focus:${field}`));
    return b;
  }

  function key(k) {
    const label = LABELS[k];
    const b = button('key', label ? label.text : k);
    if (label) {
      b.setAttribute('aria-label', label.aria);
      b.classList.add('key-tool');
    }
    if ((k === 'fraction' || k === 'mixed') && !allowFractions) b.disabled = true;
    b.addEventListener('click', () => press(k));
    return b;
  }

  return {
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}

function button(className, text) {
  const b = document.createElement('button');
  b.type = 'button';
  // Tapping or clicking doesn't move keyboard focus onto the button, so typing
  // on a physical keyboard keeps working. (Tab still reaches every button.)
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.className = className;
  b.textContent = text;
  return b;
}
function div(className) {
  const d = document.createElement('div');
  d.className = className;
  return d;
}
function span(className, text) {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}
