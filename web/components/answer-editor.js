// The logic behind the math keypad: what happens to the answer when a key is
// pressed. No screen code here, so it can be tested in Node.
//
// An answer is typed in one of three shapes:
//   number    5              one box
//   fraction  3/4            numerator box over denominator box
//   mixed     2 3/4          whole box, then numerator over denominator
//
// Keys (same on the on-screen keypad and a physical keyboard):
//   '0'-'9'      type a digit into the box that has focus
//   'backspace'  delete a digit; in an empty box, step back to the previous box
//   'fraction'   ("/" on a keyboard) make a fraction, or jump to the denominator.
//                Digits already typed become the numerator, so "3 / 4" just works.
//   'mixed'      (space on a keyboard) make a mixed number; digits already typed
//                become the whole-number part
//   'negate'     ("-") toggle a negative sign, only where negatives are allowed
//   'focus:whole' | 'focus:num' | 'focus:den'   tap a box
//   'clear'      start over
//
// Two other kinds of answer (whole numbers):
//   remainder  9 R 2: a box for the quotient and one for the remainder.
//              'remainder' ("r" on a keyboard) moves to the remainder box.
//   list       all the factors of 24, or 60 as a product of primes: type a number,
//              'next' ("," or space) adds it to the list; backspace in an empty
//              box takes the last number back to edit.

export const MAX_DIGITS = 4;

const FIELDS = {
  number: ['whole'],
  fraction: ['num', 'den'],
  mixed: ['whole', 'num', 'den'],
  remainder: ['whole', 'rem'],
  list: ['whole'],
};

// kind: 'standard' (whole numbers, fractions, mixed numbers), 'remainder' or 'list'.
export function createAnswerState({ allowFractions = true, allowNegative = false, kind = 'standard' } = {}) {
  const mode = kind === 'remainder' ? 'remainder' : kind === 'list' ? 'list' : 'number';
  return Object.freeze({
    mode, kind, negative: false, whole: '', num: '', den: '', rem: '', entries: Object.freeze([]), focus: 'whole',
    allowFractions: kind === 'standard' && allowFractions, allowNegative: kind === 'standard' && allowNegative,
  });
}

export function fieldsFor(mode) {
  return FIELDS[mode];
}

export function applyKey(state, key) {
  const next = (changes) => Object.freeze({ ...state, ...changes });

  if (/^[0-9]$/.test(key)) {
    const value = state[state.focus];
    if (value.length >= MAX_DIGITS) return state;
    return next({ [state.focus]: value === '0' ? key : value + key });
  }

  switch (key) {
    case 'backspace':
      if (state.kind === 'remainder' && state.focus === 'rem' && !state.rem) return next({ focus: 'whole' });
      if (state.kind === 'list' && !state.whole && state.entries.length) {
        return next({ whole: String(state.entries[state.entries.length - 1]), entries: Object.freeze(state.entries.slice(0, -1)) });
      }
      return backspace(state, next);

    case 'remainder':
      return state.kind === 'remainder' ? next({ focus: 'rem' }) : state;

    case 'next':
      if (state.kind !== 'list' || !state.whole) return state;
      return next({ entries: Object.freeze([...state.entries, Number(state.whole)]), whole: '' });

    case 'fraction':
      if (!state.allowFractions) return state;
      if (state.mode === 'number') {
        // Digits typed so far become the numerator.
        return next({ mode: 'fraction', num: state.whole, whole: '', focus: state.whole ? 'den' : 'num' });
      }
      if (state.focus === 'whole') return next({ focus: 'num' });
      return next({ focus: 'den' });

    case 'mixed':
      if (!state.allowFractions) return state;
      if (state.mode === 'number') return next({ mode: 'mixed', focus: state.whole ? 'num' : 'whole' });
      if (state.mode === 'fraction') return next({ mode: 'mixed', focus: 'whole' });
      return next({ focus: 'whole' });

    case 'negate':
      return state.allowNegative ? next({ negative: !state.negative }) : state;

    case 'clear':
      return createAnswerState({ allowFractions: state.allowFractions, allowNegative: state.allowNegative, kind: state.kind });

    default:
      if (key.startsWith('focus:')) {
        const field = key.slice('focus:'.length);
        return FIELDS[state.mode].includes(field) ? next({ focus: field }) : state;
      }
      return state;
  }
}

function backspace(state, next) {
  const { focus, mode } = state;
  if (state[focus]) return next({ [focus]: state[focus].slice(0, -1) });

  // The box with focus is empty: step back.
  if (focus === 'den') return next({ focus: 'num' });
  if (focus === 'num') {
    if (mode === 'mixed') return next({ focus: 'whole' });
    // An empty fraction with nothing in the denominator goes back to a plain number.
    if (!state.den) return next({ mode: 'number', focus: 'whole' });
    return state;
  }
  // focus === 'whole'
  if (mode === 'mixed') {
    return next(state.num || state.den ? { mode: 'fraction', focus: 'num' } : { mode: 'number' });
  }
  return state.negative ? next({ negative: false }) : state;
}

// The answer in the form the grader expects (see engine/grading/check-answer.js).
export function toRawAnswer(state) {
  const n = (s) => (s === '' ? undefined : Number(s));
  if (state.kind === 'list') return { list: [...state.entries, ...(state.whole ? [Number(state.whole)] : [])] };
  if (state.kind === 'remainder') {
    const raw = {};
    if (state.whole !== '') raw.whole = n(state.whole);
    if (state.rem !== '') raw.rem = n(state.rem);
    return raw;
  }
  const raw = {};
  if (state.negative) raw.negative = true;
  if (state.mode !== 'fraction' && state.whole !== '') raw.whole = n(state.whole);
  if (state.mode !== 'number') {
    if (state.num !== '') raw.num = n(state.num);
    if (state.den !== '') raw.den = n(state.den);
  }
  return raw;
}

export function isEmpty(state) {
  if (state.kind === 'list') return !state.whole && !state.entries.length;
  return !state.whole && !state.num && !state.den && !state.rem;
}

// Whether Check can be pressed: a complete answer of the right kind.
export function canSubmit(state) {
  if (state.kind === 'list') return state.entries.length > 0 || state.whole !== '';
  if (state.kind === 'remainder') return state.whole !== '';
  return null; // standard answers: the grader's readAnswer decides
}

// Plain-language reading of the answer, for screen readers and the teacher log.
export function describeAnswer(state) {
  if (isEmpty(state)) return 'empty';
  if (state.kind === 'list') return [...state.entries, ...(state.whole ? [state.whole] : [])].join(', ');
  if (state.kind === 'remainder') return `${state.whole || 'blank'} remainder ${state.rem || 'blank'}`;
  const box = (s) => s || 'blank';
  const sign = state.negative ? 'negative ' : '';
  if (state.mode === 'number') return `${sign}${state.whole}`;
  const frac = `${box(state.num)} over ${box(state.den)}`;
  if (state.mode === 'fraction') return `${sign}${frac}`;
  return `${sign}${box(state.whole)} and ${frac}`;
}

// Text form of a raw answer, e.g. "2 3/4", for logs.
export function rawToText(raw) {
  if (raw && Number.isInteger(raw.choice)) return raw.label ?? `choice ${raw.choice + 1}`;
  if (raw && Array.isArray(raw.list)) return raw.list.length ? raw.list.join(', ') : '(blank)';
  if (raw && raw.rem !== undefined) return `${raw.whole ?? '?'} R ${raw.rem}`;
  if (!raw || (raw.whole === undefined && raw.num === undefined && raw.den === undefined)) return '(blank)';
  const sign = raw.negative ? '-' : '';
  const frac = raw.num !== undefined || raw.den !== undefined ? `${raw.num ?? '?'}/${raw.den ?? '?'}` : '';
  return `${sign}${[raw.whole, frac].filter((x) => x !== undefined && x !== '').join(' ')}`;
}
