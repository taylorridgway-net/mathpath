// Practice sessions with scripted pretend students. Checks the owner-approved
// feedback rules, the similar-problem-after-a-miss rule, and the mastery rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPractice, replayPractice, meetsSkillMastery } from '../../../engine/practice/practice.js';
import { generators, generateProblem } from '../../../engine/generators/index.js';
import { reduce } from '../../../engine/math/fraction.js';

const rules = JSON.parse(readFileSync(new URL('../../../curriculum/mastery.json', import.meta.url), 'utf8')).default;
const section = (generator) => ({ generators, rules, seed: 's1', plan: { generator, mode: 'section' } });
const skill = { generators, rules, seed: 's1', plan: { generator: 'frac.add-sub', mode: 'skill' } };

// ---- answer helpers ----
function right(problem) {
  const a = problem.answer;
  if (a.type === 'choice') return { choice: a.correct };
  if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
  if (a.type === 'linear') return { coef: a.coef, constant: a.constant };
  if (a.type === 'common-multiple') return { whole: a.least };
  const v = reduce(a.value);
  return { ...(v.d === 1 ? { whole: Math.abs(v.n) } : { num: Math.abs(v.n), den: v.d }), ...(v.n < 0 ? { negative: true } : {}) };
}
const unsimplified = (problem) => {
  const r = right(problem);
  return r.num ? { num: r.num * 2, den: r.den * 2 } : { num: r.whole * 2, den: 2 };
};
const wrong = (problem) => {
  const a = problem.answer;
  if (a.type === 'fraction') return { num: Math.abs(a.value.n) + 1, den: a.value.d };
  return { whole: (a.value ?? a.least) + 1 };
};

// Run a session where `answerFor(problem, attempt, index)` picks each answer.
function run(setup, answerFor, maxAnswers = 200) {
  const p = startPractice(setup);
  const answers = [];
  const responses = [];
  for (let cur = p.currentProblem(); cur; cur = p.currentProblem()) {
    const a = answerFor(cur.problem, cur.attempt, cur.index);
    answers.push(a);
    responses.push(p.submit(a));
    if (answers.length > maxAnswers) throw new Error('practice never ended');
  }
  return { p, result: p.result(), answers, responses };
}

test('a student who gets everything right: 2 guided + 3 check, passed', () => {
  const { result } = run(section('frac.add-sub.combine'), (pr) => right(pr));
  assert.equal(result.endedBy, 'passed');
  assert.deepEqual(result.problems.map((x) => x.phase), ['guided', 'guided', 'check', 'check', 'check']);
  assert.equal(result.provisionalMastery, false, 'a section check is not skill mastery');
});

test('not simplified -> simplify hint -> simplified: counts as right on the first try (owner rule)', () => {
  const { result, responses } = run(section('frac.add-sub.simplify-result'), (pr, attempt) => (attempt === 1 ? unsimplified(pr) : right(pr)));
  assert.deepEqual(responses[0], { status: 'not-simplified', retry: true, feedback: { kind: 'simplify' } });
  assert.ok(result.problems.every((x) => x.outcome === 'right-first'));
  assert.equal(result.endedBy, 'passed');
});

test('not simplified twice is a miss', () => {
  const { responses } = run(section('frac.add-sub.simplify-result'), (pr, attempt, i) => (i === 0 ? unsimplified(pr) : right(pr)));
  assert.equal(responses[1].outcome, 'missed');
  assert.equal(responses[1].showSolutionFor, 0);
});

test('known misconception -> its message and a retry; right on the second try', () => {
  const { responses, result } = run(section('frac.add-sub.combine'), (pr, attempt, i) => {
    const m = pr.misconceptions.find((x) => x.id === 'frac.add-across');
    return i === 0 && attempt === 1 && m ? { num: Math.abs(m.value.n), den: m.value.d, ...(m.value.n < 0 ? { negative: true } : {}) } : right(pr);
  });
  assert.deepEqual(responses[0].feedback, { kind: 'misconception', id: 'frac.add-across' });
  assert.equal(result.problems[0].outcome, 'right-second');
});

test('wrong with no known pattern -> a hint and a retry', () => {
  const { responses } = run(section('frac.add-sub.rewrite'), (pr, attempt, i) => (i === 0 && attempt === 1 ? wrong(pr) : right(pr)));
  assert.deepEqual(responses[0].feedback, { kind: 'hint', generator: 'frac.add-sub.rewrite' });
});

test('wrong twice -> worked solution, then a similar problem (same kind, same difficulty, new numbers)', () => {
  const { result, responses } = run(section('frac.add-sub.combine'), (pr, attempt, i) => (i === 0 ? wrong(pr) : right(pr)));
  assert.equal(responses[1].showSolutionFor, 0);
  const [missed, similar] = result.problems;
  assert.equal(missed.outcome, 'missed');
  assert.equal(similar.generator, missed.generator);
  assert.equal(similar.difficulty, missed.difficulty);
  assert.notEqual(similar.seed, missed.seed);
});

test('"I\'m not sure" goes straight to the worked solution (no retry)', () => {
  const { responses } = run(section('frac.add-sub.combine'), (pr, attempt, i) => (i === 0 ? {} : right(pr)));
  assert.equal(responses[0].outcome, 'missed');
  assert.equal(responses[0].retry, false);
});

test('a miss in the check starts the 3-in-a-row count again', () => {
  // Miss the second check problem.
  const { result } = run(section('frac.add-sub.combine'), (pr, attempt, i) => (i === 3 ? {} : right(pr)));
  const check = result.problems.filter((x) => x.phase === 'check');
  assert.deepEqual(check.map((x) => x.outcome), ['right-first', 'missed', 'right-first', 'right-first', 'right-first']);
  assert.equal(result.endedBy, 'passed');
});

test('a student who never answers: session still ends, not passed', () => {
  const { result } = run(section('frac.add-sub.combine'), () => ({}));
  assert.equal(result.endedBy, 'limit');
  assert.equal(result.passed, false);
});

test('skill mastery: perfect student masters in 2 guided + 4 whole problems, reaching the hardest level', () => {
  const { result } = run(skill, (pr) => right(pr));
  assert.equal(result.endedBy, 'mastered');
  assert.equal(result.provisionalMastery, true);
  const mastery = result.problems.filter((x) => x.phase === 'mastery');
  assert.deepEqual(mastery.map((x) => x.difficulty), [2, 2, 3, 3]);
});

test('skill mastery: a miss drops back to the starting difficulty', () => {
  const { result } = run(skill, (pr, attempt, i) => (i === 4 ? {} : right(pr)));
  const mastery = result.problems.filter((x) => x.phase === 'mastery');
  assert.equal(mastery[2].outcome, 'missed');
  assert.equal(mastery[3].difficulty, mastery[2].difficulty, 'similar problem keeps the difficulty');
  assert.equal(mastery[4].difficulty, 2);
  assert.equal(result.endedBy, 'mastered');
});

test('skill mastery: never mastered without enough hardest-level problems', () => {
  // Right at difficulty 2, always wrong at difficulty 3.
  const { result } = run(skill, (pr) => (pr.difficulty === 3 ? {} : right(pr)));
  assert.equal(result.endedBy, 'limit');
  assert.equal(result.provisionalMastery, false);
});

test('mastery rule on its own', () => {
  const r = rules.skill;
  const h = (pairs) => pairs.map(([difficulty, firstTry]) => ({ difficulty, firstTry }));
  assert.equal(meetsSkillMastery(h([[2, 1], [2, 1], [3, 1], [3, 1]]), r), true);
  assert.equal(meetsSkillMastery(h([[2, 1], [2, 0], [3, 1], [3, 1], [2, 1]]), r), true);
  assert.equal(meetsSkillMastery(h([[2, 1], [2, 1], [2, 1], [3, 1]]), r), false, 'only 1 at hardest');
  assert.equal(meetsSkillMastery(h([[3, 1], [3, 0], [3, 1], [3, 0], [3, 1]]), r), false, 'only 3 of 5');
  // Old successes outside the last 5 don't count.
  assert.equal(meetsSkillMastery(h([[3, 1], [3, 1], [3, 1], [2, 0], [2, 0], [2, 1], [2, 1], [2, 1]]), r), false);
});

test('replay from the saved answers gives the identical result (server verification)', () => {
  const answerFor = (pr, attempt, i) => (i % 3 === 1 && attempt === 1 ? wrong(pr) : right(pr));
  const { result, answers } = run(skill, answerFor);
  assert.deepEqual(replayPractice(skill, answers).result(), result);
});

test('problems match what the server regenerates from each saved seed', () => {
  const { p, result } = run(skill, (pr) => right(pr));
  for (const row of result.problems) {
    assert.deepEqual(generateProblem(row.generator, row.seed, row.difficulty), p.problemAt(row.index));
  }
});

// ---- quick review (shaky subskill) ----
const reviewSetup = (generator) => ({ generators, rules, seed: 'r1', plan: { generator, mode: 'section', review: true } });

test('quick review: no guided problems; 3 right in a row passes', () => {
  const { result } = run(reviewSetup('frac.add-sub.combine'), (pr) => right(pr));
  assert.equal(result.endedBy, 'passed');
  assert.equal(result.review, true);
  assert.deepEqual(result.problems.map((x) => x.phase), ['check', 'check', 'check']);
});

test('quick review: one problem not right on the first try ends it (then the full section)', () => {
  const { result } = run(reviewSetup('frac.add-sub.combine'), (pr, attempt, i) => (i === 1 && attempt === 1 ? wrong(pr) : right(pr)));
  assert.equal(result.endedBy, 'review-missed');
  assert.equal(result.passed, false);
  assert.equal(result.problems.length, 2);
});

test('a refresher ("Putting it together" after a slipped memory check) goes straight to the whole problems', () => {
  const p = startPractice({ generators, rules, seed: 'r2', plan: { generator: 'frac.add-sub', mode: 'skill', review: true } });
  assert.equal(p.currentProblem().phase, 'mastery');
  assert.equal(p.currentProblem().problem.difficulty, rules.skill.startDifficulty);
  const { result } = run({ generators, rules, seed: 'r2', plan: { generator: 'frac.add-sub', mode: 'skill', review: true } }, (pr) => right(pr));
  assert.equal(result.provisionalMastery, true);
  assert.equal(result.refresh, true);
  assert.ok(result.problems.every((x) => x.phase === 'mastery'));
});

// ---- a fixed-length check (multiplication facts: 9 of 10 right on the first try, owner decision) ----
const factsSetup = { generators, rules, seed: 'f1', plan: { generator: 'whole.mult-div.mult-facts', mode: 'section', check: { outOf: 10, rightNeeded: 9, difficulty: 3 } } };
const factRight = (pr) => ({ whole: pr.expression.left.value * pr.expression.right.value });

test('facts check: 9 right on the first try passes, even with one miss', () => {
  let checkIndex = 0;
  const { result } = run(factsSetup, (pr, attempt, i) => {
    const p = factsSetup; // eslint-disable-line no-unused-vars
    if (pr.difficulty === 3 && attempt === 1 && checkIndex++ === 4) return { whole: 1 };
    return factRight(pr);
  });
  const check = result.problems.filter((x) => x.phase === 'check');
  assert.equal(result.endedBy, 'passed');
  assert.equal(check.filter((x) => x.outcome === 'right-first').length, 9);
  assert.ok(check.length <= 10);
  assert.ok(check.every((x) => x.difficulty === 3), 'the check uses the hard facts');
});

test('facts check: a second miss ends it, not passed (no 20-problem marathon)', () => {
  let misses = 0;
  const { result } = run(factsSetup, (pr, attempt) => (pr.difficulty === 3 && attempt === 1 && misses++ < 2 ? {} : factRight(pr)));
  assert.equal(result.endedBy, 'limit');
  assert.equal(result.passed, false);
  assert.ok(result.problems.filter((x) => x.phase === 'check').length <= 10);
});

// ---- practice for a check (student's choice) ----
const practiceSetup = { generators, rules, seed: 'p1', plan: { generator: 'frac.add-sub', mode: 'practice', difficulties: [2, 2, 3, 3, 3, 3] } };

test('practice for a check: exactly 6 whole problems at the planned levels; never mastery', () => {
  const { result } = run(practiceSetup, (pr) => right(pr));
  assert.equal(result.endedBy, 'done');
  assert.deepEqual(result.problems.map((x) => x.difficulty), [2, 2, 3, 3, 3, 3]);
  assert.equal(result.provisionalMastery, false);
  assert.equal(result.passed, false);
});

test('practice for a check: a miss gets the usual help, and the set still ends after 6', () => {
  const { result, responses } = run(practiceSetup, (pr, attempt, i) => (i === 1 ? {} : right(pr)));
  assert.equal(responses[1].showSolutionFor, 1, 'worked solution after "not sure"');
  assert.equal(result.problems.length, 6);
  assert.equal(result.problems.filter((x) => x.outcome === 'right-first').length, 5);
});

// ---- memory checks (retention): one try each, no hints ----
const memorySetup = { generators, rules, seed: 'm1', plan: { generator: 'frac.add-sub', mode: 'practice', difficulties: [2, 3, 3], oneTry: true } };

test('memory check: 3 whole problems; a wrong answer gets no retry, just the worked solution', () => {
  const { result, responses } = run(memorySetup, (pr, attempt, i) => (i === 0 ? wrong(pr) : right(pr)));
  assert.equal(result.problems.length, 3);
  assert.equal(responses[0].retry, false);
  assert.equal(responses[0].showSolutionFor, 0);
  assert.deepEqual(result.problems.map((x) => x.outcome), ['missed', 'right-first', 'right-first']);
  assert.equal(result.provisionalMastery, false);
});

test('memory check: an unsimplified answer still gets the "simplify" retry (owner rule), and counts if fixed', () => {
  const { result, responses } = run(memorySetup, (pr, attempt) => (attempt === 1 ? unsimplified(pr) : right(pr)));
  assert.equal(responses[0].retry, true);
  assert.equal(responses[0].feedback.kind, 'simplify');
  assert.ok(result.problems.every((x) => x.outcome === 'right-first'));
});

test('memory check replays identically (server re-grading)', () => {
  const { result, answers } = run(memorySetup, (pr, attempt, i) => (i === 1 ? {} : right(pr)));
  assert.deepEqual(replayPractice(memorySetup, answers).result(), result);
});
