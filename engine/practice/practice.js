// A practice session for one lesson section. Pure logic, no screen code.
//
// Like the diagnostic, it's fully determined by (setup, seed, answers), so the
// server can replay it to verify mastery and the browser can resume it.
//
// PHASES
//   guided   problems with hints until `rightNeeded` are solved (max `maxProblems`)
//   then, for a subskill section ("section" mode):
//     check    no new rules, just counting: pass at `rightInARow` first-try rights in a row
//   or, for the whole-skill section ("skill" mode):
//     mastery  whole problems; difficulty rises after 2 first-try rights in a row and
//              drops after a miss; provisional mastery at 4 of the last 5 right on the
//              first try with at least 2 at the hardest difficulty (numbers from mastery.json)
//
// ONE PROBLEM (owner-approved feedback rules)
//   right                              -> done ("right-first")
//   right but not simplified           -> hint "simplify", one more try; right then = "right-first"
//   wrong, known misconception         -> that misconception's message, one more try
//   wrong, no known pattern            -> a hint for this kind of problem, one more try
//   right on the second try            -> "right-second"
//   wrong twice, or blank ("not sure") -> "missed": show the worked solution, then a
//                                         similar problem (same kind, same difficulty)
//
// Each call to submit() is one answer; an answer list replays the whole session.

import { checkAnswer } from '../grading/check-answer.js';
import { createRng } from '../random.js';

export function startPractice({ generators, plan, rules, seed }) {
  const { generator: generatorId, mode } = plan;
  const guidedRule = { ...rules.guided, ...plan.guided };
  const checkRule = { ...rules.sectionCheck, ...plan.check };
  const skillRule = { ...rules.skill, ...plan.skill };

  const problems = []; // { index, phase, generator, seed, difficulty, problem, attempts: [], outcome }
  let phase = 'guided';
  let current = null;
  let endedBy = null;
  let skillDifficulty = skillRule.startDifficulty;

  newProblem(guidedRule.difficulty);

  function newProblem(difficulty) {
    const index = problems.length;
    const questionSeed = `${seed}:${index}`;
    const generator = generators[generatorId];
    const problem = {
      generator: generatorId,
      version: generator.version,
      difficulty,
      seed: questionSeed,
      ...generator.generate(createRng(`${generatorId}|${difficulty}|${questionSeed}`), difficulty),
    };
    current = { index, phase, generator: generatorId, seed: questionSeed, difficulty, problem, attempts: [], outcome: null };
    problems.push(current);
  }

  // ---------- after a problem is finished, decide what's next ----------

  function finishProblem(outcome) {
    current.outcome = outcome;
    const missedDifficulty = current.difficulty;
    const inPhase = problems.filter((p) => p.phase === phase && p.outcome);

    if (phase === 'guided') {
      const right = inPhase.filter((p) => p.outcome !== 'missed').length;
      if (outcome === 'missed' && inPhase.length < guidedRule.maxProblems) return newProblem(missedDifficulty);
      if (right >= guidedRule.rightNeeded || inPhase.length >= guidedRule.maxProblems) {
        phase = mode === 'skill' ? 'mastery' : 'check';
        return newProblem(mode === 'skill' ? skillDifficulty : checkRule.difficulty);
      }
      return newProblem(guidedRule.difficulty);
    }

    if (phase === 'check') {
      if (rightInARow(inPhase) >= checkRule.rightInARow) return end('passed');
      if (inPhase.length >= checkRule.maxProblems) return end('limit');
      return newProblem(checkRule.difficulty); // after a miss this is the "similar problem"
    }

    // mastery
    const history = inPhase.map((p) => ({ difficulty: p.difficulty, firstTry: p.outcome === 'right-first' }));
    if (meetsSkillMastery(history, skillRule)) return end('mastered');
    if (inPhase.length >= skillRule.maxProblemsPerSitting) return end('limit');
    if (outcome === 'missed') {
      skillDifficulty = skillRule.startDifficulty;
      return newProblem(missedDifficulty); // similar problem
    }
    if (outcome !== 'right-first') {
      skillDifficulty = skillRule.startDifficulty;
    } else if (history.length >= 2 && history.slice(-2).every((h) => h.firstTry)) {
      skillDifficulty = Math.min(skillDifficulty + 1, skillRule.hardestDifficulty);
    }
    return newProblem(skillDifficulty);
  }

  function end(reason) {
    endedBy = reason;
    current = null;
  }

  // ---------- public interface ----------

  // The problem to show now (with feedback from the last try, if retrying), or null when done.
  function currentProblem() {
    if (!current) return null;
    const last = current.attempts.at(-1);
    return {
      index: current.index,
      phase: current.phase,
      attempt: current.attempts.length + 1,
      problem: current.problem,
      feedback: last ? last.feedback : null,
    };
  }

  // Grade one answer. Returns what the screen should do next:
  //   { status, outcome?, retry, feedback?, showSolutionFor? }
  function submit(rawAnswer) {
    if (!current) throw new Error('Practice is finished');
    const entry = current;
    const result = checkAnswer(entry.problem, rawAnswer);
    const attempt = entry.attempts.length + 1;
    const record = { answer: rawAnswer ?? null, status: result.status, misconception: result.misconception };
    entry.attempts.push(record);

    const right = result.status === 'correct' || result.status === 'wrong-form';
    const blank = result.status === 'invalid';

    if (right) {
      const simplifiedOnRetry = attempt === 2 && entry.attempts[0].status === 'not-simplified';
      const outcome = attempt === 1 || simplifiedOnRetry ? 'right-first' : 'right-second';
      finishProblem(outcome);
      return { status: result.status, outcome, retry: false };
    }

    if (attempt === 1 && !blank) {
      if (result.status === 'not-simplified') record.feedback = { kind: 'simplify' };
      else if (result.misconception) record.feedback = { kind: 'misconception', id: result.misconception };
      else record.feedback = { kind: 'hint', generator: entry.generator };
      return { status: result.status, retry: true, feedback: record.feedback };
    }

    finishProblem('missed');
    return { status: result.status, outcome: 'missed', retry: false, showSolutionFor: entry.index };
  }

  function result() {
    const rows = problems.map((p) => ({
      index: p.index,
      phase: p.phase,
      generator: p.generator,
      seed: p.seed,
      difficulty: p.difficulty,
      attempts: p.attempts.map((a) => ({ answer: a.answer, status: a.status, misconception: a.misconception })),
      outcome: p.outcome,
    }));
    return {
      generator: generatorId,
      mode,
      seed,
      finished: Boolean(endedBy),
      endedBy,
      passed: endedBy === 'passed' || endedBy === 'mastered',
      // Provisional only: verified mastery comes from the teacher's paper assessment.
      provisionalMastery: endedBy === 'mastered',
      problemCount: rows.filter((r) => r.outcome).length,
      answerCount: rows.reduce((n, r) => n + r.attempts.length, 0),
      problems: rows,
    };
  }

  // Look up a finished problem (e.g. to show its worked solution).
  function problemAt(index) {
    return problems[index]?.problem ?? null;
  }

  return { currentProblem, submit, result, problemAt };
}

// Right on the first try, counted backwards from the latest problem.
function rightInARow(finished) {
  let n = 0;
  for (let i = finished.length - 1; i >= 0 && finished[i].outcome === 'right-first'; i--) n++;
  return n;
}

// history: [{ difficulty, firstTry }] for whole-skill problems, oldest first.
export function meetsSkillMastery(history, rule) {
  const recent = history.slice(-rule.window);
  const right = recent.filter((h) => h.firstTry);
  return right.length >= rule.rightOnFirstTry
    && right.filter((h) => h.difficulty >= rule.hardestDifficulty).length >= rule.minAtHardest;
}

export function replayPractice(setup, answers) {
  const p = startPractice(setup);
  for (const a of answers) p.submit(a);
  return p;
}
