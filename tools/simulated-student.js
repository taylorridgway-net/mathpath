// A pretend student with known gaps, for testing the diagnostic (and later,
// for the simulated-class load test). NEVER real student data.
//
// The model: a student can do a skill or subskill only if they haven't been
// told they lack it AND they can do everything it essentially depends on.
// So a student who lacks "whole.mult-div.mult-facts" also fails everything built on it.
//
//   lacks            ids the student doesn't know
//   misconceptions   misconception ids they hold (they give that wrong answer when it fits)
//   slipsOn          ids where they make one careless mistake the first time they're asked
//   failsWhole       skill ids where they can do every step when asked separately,
//                    but can't do a whole problem (they don't know the procedure)

import { reduce } from '../engine/math/fraction.js';

export function simulatedStudent({ graph, generators, lacks = [], misconceptions = [], slipsOn = [], failsWhole = [] }) {
  const lacking = new Set(lacks);
  const slipsLeft = new Set(slipsOn);
  const memo = new Map();

  function canDo(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, true); // guards against loops (the graph has none, but be safe)
    const node = graph.get(id);
    const ok = !lacking.has(id) && !failsWhole.includes(id)
      && !(node.kind === 'subskill' && lacking.has(node.skillId))
      && graph.essentialPrereqs(id).every(canDo);
    memo.set(id, ok);
    return ok;
  }

  function correctAnswer(problem) {
    const a = problem.answer;
    if (a.type === 'quotient-remainder') return { whole: a.quotient, rem: a.remainder };
    if (a.type === 'set' || a.type === 'multiset') return { list: [...a.values] };
    if (a.form === 'exact') return { num: a.n, den: a.d };
    if (a.type === 'choice') return { choice: a.correct };
    if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
    if (a.type === 'common-multiple') return { whole: a.least };
    const v = reduce(a.value);
    return v.d === 1 ? { whole: Math.abs(v.n), negative: v.n < 0 } : { num: Math.abs(v.n), den: v.d, negative: v.n < 0 };
  }

  function wrongAnswer(problem) {
    const a = problem.answer;
    if (a.type === 'quotient-remainder') return { whole: a.quotient + 1, rem: a.remainder };
    if (a.type === 'set' || a.type === 'multiset') return { list: a.values.slice(1) };
    if (a.type === 'choice') return { choice: (a.correct + 1) % a.options.length };
    if (a.type === 'integer') return { whole: Math.abs(a.value + 1), ...(a.value + 1 < 0 ? { negative: true } : {}) };
    if (a.type === 'common-multiple') return { whole: a.least + 1 };
    return { num: Math.abs(a.value.n) + 1, den: a.value.d };
  }

  // What this student types for a problem.
  function answer(problem) {
    const id = problem.generator;
    const generator = generators[id];
    const needed = generator.covers ? [id, ...generator.covers] : [id, ...(generator.alsoUses || [])];
    // Simplifying can belong to another skill (dividing simplifies the way multiplying does).
    if (generator.ifNotSimplified && !needed.includes(generator.ifNotSimplified)) needed.push(generator.ifNotSimplified);
    const missing = needed.filter((n) => !canDo(n));

    if (missing.length === 0) {
      if (slipsLeft.has(id)) {
        slipsLeft.delete(id);
        return wrongAnswer(problem);
      }
      return correctAnswer(problem);
    }

    // Knows everything except simplifying: right answer, not simplified.
    const simplifySubskill = generator.ifNotSimplified;
    if (problem.answer.type === 'fraction' && missing.length === 1 && missing[0] === simplifySubskill) {
      const right = correctAnswer(problem);
      const sign = right.negative ? { negative: true } : {};
      return right.num ? { num: right.num * 2, den: right.den * 2, ...sign } : { num: right.whole * 2, den: 2, ...sign };
    }

    const held = (problem.misconceptions || []).find((m) => misconceptions.includes(m.id) && !m.test);
    if (held) {
      if (held.choice !== undefined) return { choice: held.choice };
      if (typeof held.value === 'number') return { whole: Math.abs(held.value), ...(held.value < 0 ? { negative: true } : {}) };
      if (held.value.quotient !== undefined) return { whole: held.value.quotient, rem: held.value.remainder };
      return { num: Math.abs(held.value.n), den: held.value.d, ...(held.value.n < 0 ? { negative: true } : {}) };
    }
    return wrongAnswer(problem);
  }

  return { answer, canDo };
}

// Run a whole diagnostic with a simulated student. Returns the result profile.
export function runWithStudent(diagnostic, student) {
  for (let q = diagnostic.nextQuestion(); q; q = diagnostic.nextQuestion()) {
    diagnostic.submit(student.answer(q.problem));
  }
  return diagnostic.result();
}
