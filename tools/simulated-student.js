// A pretend student with known gaps, for testing the diagnostic (and later,
// for the simulated-class load test). NEVER real student data.
//
// The model: a student can do a skill or subskill only if they haven't been
// told they lack it AND they can do everything it essentially depends on.
// So a student who lacks "whole.mult-div.facts" also fails everything built on it.
//
//   lacks            ids the student doesn't know
//   misconceptions   misconception ids they hold (they give that wrong answer when it fits)
//   slipsOn          ids where they make one careless mistake the first time they're asked

import { reduce } from '../engine/math/fraction.js';

export function simulatedStudent({ graph, generators, lacks = [], misconceptions = [], slipsOn = [] }) {
  const lacking = new Set(lacks);
  const slipsLeft = new Set(slipsOn);
  const memo = new Map();

  function canDo(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, true); // guards against loops (the graph has none, but be safe)
    const node = graph.get(id);
    const ok = !lacking.has(id)
      && !(node.kind === 'subskill' && lacking.has(node.skillId))
      && graph.essentialPrereqs(id).every(canDo);
    memo.set(id, ok);
    return ok;
  }

  function correctAnswer(problem) {
    const a = problem.answer;
    if (a.type === 'integer') return { whole: a.value };
    if (a.type === 'common-multiple') return { whole: a.least };
    const v = reduce(a.value);
    return v.d === 1 ? { whole: Math.abs(v.n), negative: v.n < 0 } : { num: Math.abs(v.n), den: v.d, negative: v.n < 0 };
  }

  function wrongAnswer(problem) {
    const a = problem.answer;
    if (a.type === 'integer') return { whole: a.value + 1 };
    if (a.type === 'common-multiple') return { whole: a.least + 1 };
    return { num: Math.abs(a.value.n) + 1, den: a.value.d };
  }

  // What this student types for a problem.
  function answer(problem) {
    const id = problem.generator;
    const generator = generators[id];
    const needed = generator.covers ? [...generator.covers] : [id, ...(generator.alsoUses || [])];
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
      return right.num ? { num: right.num * 2, den: right.den * 2 } : { num: right.whole * 2, den: 2 };
    }

    const held = (problem.misconceptions || []).find((m) => misconceptions.includes(m.id));
    if (held) {
      return typeof held.value === 'number' ? { whole: held.value } : { num: held.value.n, den: held.value.d };
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
