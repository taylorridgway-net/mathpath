// Step-by-step boxes for a whole add/subtract problem, used in the guided part
// of "Putting it together". Pure logic, no screen code.
//
// The student solves one step at a time:
//   1. common-denom   find a common denominator (any one works)
//   2. rewrite-1      rewrite the first fraction over it
//   3. rewrite-2      rewrite the second fraction over it
//   4. combine        add or subtract the numerators
//   5. final          write the answer in simplest form
//
// Steps 1-4 are checked here. The final step's answer IS the answer to the whole
// problem, so the screen sends it to the practice session (engine/practice/practice.js),
// which applies the usual feedback rules and counts it toward the guided phase.
//
// Later steps use the student's own common denominator: if they pick 24 for
// 1/4 + 1/6, they rewrite over 24, and simplify more at the end.
//
// Feedback per step: wrong with a known pattern -> that message and one retry;
// wrong otherwise -> a hint and one retry; wrong twice or "I'm not sure" -> the
// step is filled in for them (shown as "revealed") and they go on.
//
// Fully determined by (problem, step answers), so it can be replayed on resume.

import { checkAnswer } from '../grading/check-answer.js';
import { lcm } from '../math/fraction.js';

const frac = (n, d) => ({ type: 'frac', n, d });
const blank = { type: 'blank' };
const eq = (left, right) => ({ type: 'eq', left, right });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });

// Which lesson hint goes with each step.
export const STEP_HINTS = {
  'common-denom': 'frac.add-sub.common-denom',
  'rewrite-1': 'frac.add-sub.rewrite',
  'rewrite-2': 'frac.add-sub.rewrite',
  combine: 'frac.add-sub.combine',
  final: 'frac.add-sub.simplify-result',
};

export function startScaffold(problem) {
  if (problem.generator !== 'frac.add-sub') throw new Error('Step boxes are only for whole add/subtract problems');
  const { left: x, right: y, op: sym } = problem.expression;
  const done = []; // { id, value, revealed, attempts: [{ answer, status, misconception }] }
  let attempts = [];
  let common = null; // the common denominator in use (student's, or the least if revealed)

  // The step the student is on, built from the steps already done.
  function stepAt(i) {
    switch (i) {
      case 0:
        return {
          id: 'common-denom',
          label: 'Find a common denominator',
          instruction: `Find a common denominator for ${x.d} and ${y.d}.`,
          expression: { type: 'list', items: [frac(x.n, x.d), frac(y.n, y.d)] },
          answer: { type: 'common-multiple', of: [x.d, y.d], least: lcm(x.d, y.d) },
          misconceptions: commonDenominatorMistakes(x.d, y.d),
        };
      case 1:
      case 2: {
        const f = i === 1 ? x : y;
        const k = common / f.d;
        return {
          id: i === 1 ? 'rewrite-1' : 'rewrite-2',
          label: `Rewrite ${f.n}/${f.d} over ${common}`,
          instruction: `Fill in the missing numerator.`,
          expression: eq(frac(f.n, f.d), frac(blank, common)),
          answer: { type: 'integer', value: f.n * k },
          misconceptions: dropIf(f.n * k, [
            { id: 'frac.additive-scaling', value: f.n + (common - f.d) },
            { id: 'frac.numerator-unchanged', value: f.n },
          ]),
        };
      }
      case 3: {
        const [a, c] = [done[1].value, done[2].value];
        return {
          id: 'combine',
          label: `${sym === '+' ? 'Add' : 'Subtract'} the numerators`,
          instruction: `${sym === '+' ? 'Add' : 'Subtract'} the numerators. Keep the denominator.`,
          expression: eq(op(sym, frac(a, common), frac(c, common)), frac(blank, common)),
          answer: { type: 'integer', value: sym === '+' ? a + c : a - c },
          misconceptions: [],
        };
      }
      case 4:
        return {
          id: 'final',
          label: 'Simplify',
          instruction: 'Write your answer in simplest form.',
          expression: eq(frac(done[3].value, common), blank),
          isFinal: true,
        };
      default:
        return null;
    }
  }

  // What the screen shows now. Null never happens: the final step stays until
  // the practice session takes over.
  function current() {
    const step = stepAt(done.length);
    const last = attempts[attempts.length - 1];
    return { index: done.length, ...step, attempt: attempts.length + 1, feedback: last ? last.feedback : null };
  }

  // Check one answer to the current step (not the final step).
  // Returns { status, retry, feedback?, revealed?, note? }.
  function submit(rawAnswer) {
    const step = stepAt(done.length);
    if (step.isFinal) throw new Error('The final step is checked by the practice session');
    const result = checkAnswer(step, rawAnswer);
    const record = { answer: rawAnswer ?? null, status: result.status, misconception: result.misconception };
    attempts.push(record);

    if (result.status === 'correct') {
      const value = step.id === 'common-denom' ? rawAnswer.whole : step.answer.value;
      finishStep(step, value, false);
      return { status: 'correct', retry: false, note: result.note };
    }
    const blankAnswer = result.status === 'invalid';
    if (attempts.length === 1 && !blankAnswer) {
      record.feedback = result.misconception
        ? { kind: 'misconception', id: result.misconception }
        : { kind: 'hint', step: step.id };
      return { status: result.status, retry: true, feedback: record.feedback };
    }
    const value = step.id === 'common-denom' ? step.answer.least : step.answer.value;
    finishStep(step, value, true);
    return { status: result.status, retry: false, revealed: value };
  }

  function finishStep(step, value, revealed) {
    if (step.id === 'common-denom') common = value;
    done.push({ id: step.id, value, revealed, attempts });
    attempts = [];
  }

  // Steps done so far, for the screen's checklist.
  function completed() {
    return done.map((d, i) => ({ ...stepAt(i), value: d.value, revealed: d.revealed }));
  }

  // What gets saved: the student's answers to each step.
  function record() {
    return done.map((d) => ({
      step: d.id,
      value: d.value,
      revealed: d.revealed,
      attempts: d.attempts.map((a) => ({ answer: a.answer, status: a.status, misconception: a.misconception })),
    }));
  }

  return { current, submit, completed, record, steps: STEP_IDS };
}

export const STEP_IDS = ['common-denom', 'rewrite-1', 'rewrite-2', 'combine', 'final'];

export function replayScaffold(problem, answers) {
  const s = startScaffold(problem);
  for (const a of answers) s.submit(a);
  return s;
}

function commonDenominatorMistakes(b, d) {
  const isCommon = (v) => v % b === 0 && v % d === 0;
  return [
    { id: 'frac.add-denominators', value: b + d },
    { id: 'frac.larger-denominator', value: Math.max(b, d) },
  ].filter((m) => !isCommon(m.value));
}

function dropIf(correct, list) {
  const seen = new Set([correct]);
  return list.filter((m) => !seen.has(m.value) && seen.add(m.value));
}
