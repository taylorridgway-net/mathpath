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
import { createChoicePad } from './choice-pad.js';
import { createNumberLinePad } from './number-line.js';
import { createGridPad } from './grid-pad.js';
import { createFactorPad } from './factor-pad.js';

// The two tool keys under backspace depend on the kind of answer.
const TOOLS = {
  standard: ['fraction', 'mixed'],
  remainder: ['remainder', null],
  list: ['next', null],
  linear: ['next', null],
  decimal: ['point', null],
  inequality: ['fraction', 'mixed'],
};

const LABELS = {
  backspace: { text: '⌫', aria: 'Delete' },
  fraction: { text: 'a/b', aria: 'Fraction' },
  mixed: { text: '1 a/b', aria: 'Mixed number' },
  remainder: { text: 'R', aria: 'Remainder' },
  next: { text: 'Next', aria: 'Add another number' },
  negate: { text: '(−)', aria: 'Negative' },
  point: { text: '.', aria: 'Decimal point' },
};

// What the keypad needs to know about a problem's answer. A money or percent answer
// shows "$" before the box or "%" after it (answer.prefix / answer.suffix).
export function keypadOptionsFor(problem) {
  const { prefix, suffix } = problem.answer;
  const base = keypadKindFor(problem);
  return prefix || suffix ? { ...base, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) } : base;
}

function keypadKindFor(problem) {
  const type = problem.answer.type;
  if (type === 'choice') return { answerKind: 'choice', options: problem.answer.options };
  if (type === 'factored') return { answerKind: 'factored', form: problem.answer.form };
  if (type === 'gridpoints') return { answerKind: 'grid', count: problem.answer.count, line: problem.answer.mode === 'line' };
  if (type === 'numline') return { answerKind: 'numline', lo: problem.answer.lo, hi: problem.answer.hi, count: problem.answer.points.length };
  if (type === 'quotient-remainder') return { answerKind: 'remainder' };
  if (type === 'linear') return { answerKind: 'linear', allowNegative: true };
  if (type === 'inequality') return { answerKind: 'inequality', allowFractions: true, allowNegative: true };
  if (type === 'decimal') return { answerKind: 'decimal', allowNegative: Boolean(problem.answer.allowNegative) };
  if (type === 'set' || type === 'multiset') return { answerKind: 'list', separator: type === 'multiset' ? '×' : ',' };
  return { allowFractions: type === 'fraction', allowNegative: Boolean(problem.answer.allowNegative) };
}

export function createKeypad({
  host, allowFractions = false, allowNegative = false, answerKind = 'standard', separator = ',', options, onSubmit, onSkip, prefix = '', suffix = '',
  lo, hi, count, line, form,
}) {
  if (answerKind === 'choice') return createChoicePad({ host, options, onSubmit, onSkip });
  if (answerKind === 'numline') return createNumberLinePad({ host, lo, hi, count, onSubmit, onSkip });
  if (answerKind === 'grid') return createGridPad({ host, count, line, onSubmit, onSkip });
  if (answerKind === 'factored') return createFactorPad({ host, form, onSubmit, onSkip });
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
    coef: box('coef', 'Number in front of x'),
    cst: box('cst', 'Number on its own'),
  };
  const stack = div('answer-stack');
  stack.append(boxes.num, div('answer-bar'), boxes.den);
  const rLabel = span('answer-r', 'R');
  // linear: [−][coef] x [+/−] [cst]
  const coefSign = span('answer-sign', '−');
  const xLabel = span('answer-x', 'x');
  const plusMinus = span('answer-r answer-pm', '+');
  // inequality: "x" and the chosen sign come first: x [>] [−3]
  const ineqX = span('answer-x', 'x');
  const ineqSign = span('answer-r answer-ineq', '?');
  const before = span('answer-r answer-unit', prefix);
  const after = span('answer-r answer-unit', suffix);
  before.hidden = !prefix;
  after.hidden = !suffix;
  display.append(ineqX, ineqSign, before, sign, entries, boxes.whole, stack, rLabel, boxes.rem, coefSign, boxes.coef, xLabel, plusMinus, boxes.cst, after);
  const live = div('visually-hidden');
  live.setAttribute('aria-live', 'polite');

  // ---- keys ----
  const pad = div('keypad');
  for (const row of keyRows) for (const k of row) pad.append(k ? key(k) : spacer());
  // With negatives allowed, the bottom row is  − | 0 | Check  (phones have no "-" key).
  const zero = key('0');
  if (allowNegative) pad.append(key('negate'));
  else zero.classList.add('key-wide');
  const check = button('key key-check', 'Check');
  check.addEventListener('click', submit);
  check.classList.add('key-wide');
  pad.append(zero, check);

  const skip = button('skip', 'I’m not sure');
  skip.addEventListener('click', () => onSkip());

  const hint = div('answer-hint');
  hint.textContent = {
    linear: 'Type the number in front of x, tap Next, then the number on its own. (−) makes the box you’re in negative.',
    remainder: 'Type the answer, tap R, then type the remainder.',
    inequality: 'Pick the sign, then type the number. a/b for a fraction; (−) for a negative.',
    decimal: allowNegative ? 'Type the number; tap . for the decimal point and (−) to make it negative.' : 'Type the number. Tap . for the decimal point.',
    list: separator === '×' ? 'Type a prime, tap Next, then type the next one.' : 'Type a number, tap Next, then type the next one.',
  }[answerKind] || (allowFractions ? 'Tap a/b for a fraction, 1 a/b for a mixed number.' : allowNegative ? 'Type a number. Tap (−) to make it negative.' : 'Type a whole number.');
  if (allowNegative && allowFractions && answerKind === 'standard') hint.textContent += ' Tap (−) to make it negative.';

  // inequality: the four signs, as buttons above the answer.
  const signRow = div('sign-row');
  const signButtons = {};
  if (answerKind === 'inequality') {
    signRow.setAttribute('role', 'group');
    signRow.setAttribute('aria-label', 'Sign');
    for (const [sym, aria] of [['<', 'less than'], ['≤', 'less than or equal to'], ['>', 'greater than'], ['≥', 'greater than or equal to']]) {
      const b = button('key key-sign', sym);
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => press(`sign:${sym}`));
      signButtons[sym] = b;
      signRow.append(b);
    }
  }
  host.append(...(answerKind === 'inequality' ? [signRow] : []), display, live, hint, pad, skip);
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
    if (answerKind === 'decimal') Object.assign(map, { '.': 'point', ',': 'point' });
    if (answerKind === 'inequality') Object.assign(map, { '<': 'sign:<', '>': 'sign:>' });
    if (answerKind === 'list') Object.assign(map, { ',': 'next', ' ': 'next', '*': 'next', x: 'next' });
    if (answerKind === 'linear') Object.assign(map, { x: 'next', X: 'next', '+': 'next', Tab: 'next', ArrowRight: 'next', ArrowLeft: 'focus:coef', ' ': 'next' });
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
    if (e.key === 'Tab' && (answerKind !== 'linear' || state.focus === 'cst')) return; // let Tab move on as usual
    if (!k) return;
    e.preventDefault();
    press(k);
  }

  function render() {
    const shown = fieldsFor(state.mode);
    for (const f of ['whole', 'num', 'den', 'rem', 'coef', 'cst']) {
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
    ineqX.hidden = answerKind !== 'inequality';
    ineqSign.hidden = answerKind !== 'inequality';
    ineqSign.textContent = state.sign || '?';
    ineqSign.classList.toggle('is-empty', !state.sign);
    for (const [sym, b] of Object.entries(signButtons)) {
      b.classList.toggle('is-on', state.sign === sym);
      b.setAttribute('aria-pressed', String(state.sign === sym));
    }
    const linear = state.mode === 'linear';
    coefSign.hidden = !linear || !state.negCoef;
    xLabel.hidden = !linear;
    plusMinus.hidden = !linear;
    plusMinus.textContent = state.negCst ? '−' : '+';
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
    const label = k === 'next' && answerKind === 'linear' ? { text: 'Next', aria: 'Next box' } : LABELS[k];
    const b = button('key', label ? label.text : k);
    if (label) {
      b.setAttribute('aria-label', label.aria);
      b.classList.add('key-tool');
    }
    if ((k === 'fraction' || k === 'mixed') && !allowFractions) b.disabled = true;
    if (k === 'point') b.classList.add('key-point');
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
