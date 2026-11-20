// The math keypad: answer boxes plus on-screen keys, and the same keys on a
// physical keyboard (digits, "/", space, Backspace, Enter, "-", arrow keys).
// All the editing rules live in answer-editor.js; this file only draws and wires.
//
// Three kinds of answer:
//   standard   a whole number, fraction or mixed number (fraction keys only if allowed)
//   remainder  9 R 2: the "R" key (or "r") moves to the remainder box
//   list       factors (1, 2, 3, ...) or primes (2 × 2 × 3): "Next" (or "," / space)
//              adds the number and starts the next one

import { createAnswerState, applyKey, toRawAnswer, describeAnswer, fieldsFor, canSubmit } from './answer-editor.js';
import { readAnswer } from '../../engine/grading/check-answer.js';

// The two tool keys under backspace depend on the kind of answer.
const TOOLS = {
  standard: ['fraction', 'mixed'],
  remainder: ['remainder', null],
  list: ['next', null],
};

const LABELS = {
  backspace: { text: '⌫', aria: 'Delete' },
  fraction: { text: 'a/b', aria: 'Fraction' },
  mixed: { text: '1 a/b', aria: 'Mixed number' },
  remainder: { text: 'R', aria: 'Remainder' },
  next: { text: 'Next', aria: 'Add another number' },
};

// What the keypad needs to know about a problem's answer.
export function keypadOptionsFor(problem) {
  const type = problem.answer.type;
  if (type === 'quotient-remainder') return { answerKind: 'remainder' };
  if (type === 'set' || type === 'multiset') return { answerKind: 'list', separator: type === 'multiset' ? '×' : ',' };
  return { allowFractions: type === 'fraction' };
}

export function createKeypad({
  host, allowFractions = false, allowNegative = false, answerKind = 'standard', separator = ',', onSubmit, onSkip,
}) {
  let state = createAnswerState({ allowFractions, allowNegative, kind: answerKind });
  const keyRows = [
    ['7', '8', '9', 'backspace'],
    ['4', '5', '6', TOOLS[answerKind][0]],
    ['1', '2', '3', TOOLS[answerKind][1]],
  ];

  host.replaceChildren();
  host.classList.add('answer-area');

  // ---- answer boxes ----
  const display = div('answer');
  display.setAttribute('role', 'group');
  display.setAttribute('aria-label', 'Your answer');
  const sign = span('answer-sign', '−');
  const entries = span('answer-entries', ''); // list answers: the numbers added so far
  const boxes = {
    whole: box('whole', answerKind === 'list' ? 'Next number' : 'Whole number'),
    num: box('num', 'Numerator'),
    den: box('den', 'Denominator'),
    rem: box('rem', 'Remainder'),
  };
  const stack = div('answer-stack');
  stack.append(boxes.num, div('answer-bar'), boxes.den);
  const rLabel = span('answer-r', 'R');
  display.append(sign, entries, boxes.whole, stack, rLabel, boxes.rem);
  const live = div('visually-hidden');
  live.setAttribute('aria-live', 'polite');

  // ---- keys ----
  const pad = div('keypad');
  for (const row of keyRows) for (const k of row) pad.append(k ? key(k) : spacer());
  const zero = key('0');
  zero.classList.add('key-wide');
  const check = button('key key-check', 'Check');
  check.addEventListener('click', submit);
  check.classList.add('key-wide');
  pad.append(zero, check);

  const skip = button('skip', 'I’m not sure');
  skip.addEventListener('click', () => onSkip());

  const hint = div('answer-hint');
  hint.textContent = {
    remainder: 'Type the answer, tap R, then type the remainder.',
    list: separator === '×' ? 'Type a prime, tap Next, then type the next one.' : 'Type a number, tap Next, then type the next one.',
  }[answerKind] || (allowFractions ? 'Tap a/b for a fraction, 1 a/b for a mixed number.' : 'Type a whole number.');

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
    if (answerKind === 'remainder') Object.assign(map, { r: 'remainder', R: 'remainder', ArrowRight: 'remainder', ArrowLeft: 'focus:whole' });
    if (answerKind === 'list') Object.assign(map, { ',': 'next', ' ': 'next', '*': 'next', x: 'next' });
    // Space and Enter on a keyboard-focused button press that button, as usual.
    const onButton = document.activeElement?.tagName === 'BUTTON';
    if ((e.key === ' ' || e.key === 'Enter') && onButton) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    let k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
    if (e.key === 'ArrowRight' && answerKind === 'standard') k = state.focus === 'whole' ? 'focus:num' : null;
    if (!k) return;
    e.preventDefault();
    press(k);
  }

  function render() {
    const shown = fieldsFor(state.mode);
    for (const f of ['whole', 'num', 'den', 'rem']) {
      const b = boxes[f];
      b.hidden = !shown.includes(f);
      b.textContent = state[f];
      b.classList.toggle('is-focus', state.focus === f);
      b.setAttribute('aria-pressed', String(state.focus === f));
    }
    stack.hidden = !['fraction', 'mixed'].includes(state.mode);
    rLabel.hidden = state.mode !== 'remainder';
    entries.hidden = state.mode !== 'list' || !state.entries.length;
    entries.textContent = state.entries.length ? `${state.entries.join(separator === '×' ? ' × ' : ', ')} ${separator === '×' ? '×' : ','}` : '';
    sign.hidden = !state.negative;
    display.dataset.mode = state.mode;
    live.textContent = `Your answer: ${describeAnswer(state)}`;
    const ready = canSubmit(state);
    check.disabled = ready === null ? !readAnswer(toRawAnswer(state)).ok : !ready;
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

function spacer() {
  const d = div('key-spacer');
  d.setAttribute('aria-hidden', 'true');
  return d;
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
