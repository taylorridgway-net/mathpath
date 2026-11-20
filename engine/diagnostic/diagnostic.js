// The adaptive diagnostic.
//
// Runs entirely in the browser: no server calls while the student works.
// Given the same setup (graph, generators, config, seed) and the same answers,
// it asks the same questions and produces the same profile. So:
//   - the server can re-run it from the saved seed + answers to verify the result;
//   - a student whose Chromebook sleeps can resume by replaying saved answers.
//
// HOW IT DECIDES WHAT TO ASK
//   1. Work through the target skills in the config (e.g. frac.add-sub first).
//   2. If a skill has a whole-skill "screener" problem, ask it.
//      - Right: credit the subskills it covers, plus everything they depend on.
//        Then check any subskills the screener doesn't cover.
//      - Right but not simplified: credit the rest, check the simplify subskill.
//      - Wrong: if the wrong answer matches a known misconception, check the
//        subskill it points to first; then check the other covered subskills.
//      - Not right, but every step checks out on its own: ask one more whole
//        problem. Right -> the first miss was a slip. Missed again -> a gap on
//        the whole skill: the student can do each step but not put them together.
//   3. Checking a subskill ("probe"): one question.
//      - Right: known. Credit everything it depends on.
//      - Wrong: one easier question to rule out a slip.
//          Right -> "shaky".   Wrong again -> "gap", and go down to that
//          subskill's essential prerequisites to look for the root cause.
//   Some subskills' problems also use another subskill (e.g. "simplify the
//   result" problems need "combine" too). That other subskill is checked first;
//   if it's a gap, the dependent subskill is skipped and reported as blocked,
//   so a miss is never blamed on the wrong subskill.
//   4. A prerequisite with no problems yet (not built) is marked "unchecked":
//      a possible cause the teacher should know about, not a confirmed gap.
//   5. Stop when there's nothing left to check, or at the question limit.
//
// Supporting (non-essential) prerequisites are never followed.
// In the diagnostic an unsimplified answer gets NO retry (unlike practice):
// it's recorded as evidence about simplifying.
//
// NODE STATUSES in the result
//   known           answered correctly
//   known-inferred  not asked, but credited because the student did something that needs it
//   shaky           missed once, then got an easier one right
//   gap             missed twice (on a whole skill: each step fine, whole problem missed twice)
//   unchecked       a possible cause of a gap, but no problems exist for it yet
//   not-tested      never reached (or question limit hit); `blockedBy` lists
//                   gaps that made it impossible to check

import { checkAnswer } from '../grading/check-answer.js';
import { createRng } from '../random.js';

// prior: the saved result of an earlier diagnostic (compactResult: nodes { id: { status,
// blockedBy?, slow? } } and the wrong-answer patterns seen).
// A catch-up check starts from it: nothing already settled is asked again, and the
// final result covers both (see catchUpTargets below).
export function startDiagnostic({ graph, generators, misconceptions = [], config, seed, prior = null }) {
  const pointsTo = new Map(misconceptions.map((m) => [m.id, m.pointsTo]));
  const difficulty = { screen: 2, probe: 2, confirm: 1, ...config.difficulty };
  const maxQuestions = config.maxQuestions ?? 25;

  const nodes = new Map(); // id -> { status, evidence: [] }
  const expandedSkills = new Set();
  const questions = []; // everything needed to replay and verify
  const misconceptionCounts = { ...(prior?.misconceptions || {}) };
  let tasks = config.targets.map((id) => ({ kind: 'skill', id, fromDescent: false }));
  let pending = null; // { task, problem, question }
  let finishedReason = null;

  // ---------- small helpers ----------

  const record = (id) => {
    if (!nodes.has(id)) nodes.set(id, { status: 'not-tested', evidence: [] });
    return nodes.get(id);
  };
  const statusOf = (id) => nodes.get(id)?.status ?? 'not-tested';
  for (const [id, n] of Object.entries(prior?.nodes || {})) {
    if (!graph.has(id)) continue; // a skill that no longer exists
    nodes.set(id, { status: n.status, evidence: [], ...(n.blockedBy ? { blockedBy: [...n.blockedBy] } : {}), ...(n.slow ? { slow: true } : {}) });
  }
  // Confirmed gaps this node is built on (essential links). If there are any, a
  // question here can't tell us anything new: report "can't check yet" instead.
  // Prerequisites that are gaps, or can't be checked yet because of a gap under them
  // (either way, a question on top of them can't tell us anything new).
  const stuck = (s) => statusOf(s) === 'gap' || (statusOf(s) === 'not-tested' && Boolean(nodes.get(s)?.blockedBy));
  const gapsUnder = (id) => graph.essentialPrereqs(id).filter((p) => stuck(p)
    || (graph.get(p).kind === 'skill' && graph.subskillsOf(p).some(stuck)));
  const hasGenerator = (id) => Boolean(generators[id]);
  const subskillsWithProblems = (skillId) => graph.subskillsOf(skillId).filter(hasGenerator);
  const isSettled = (id) => statusOf(id) !== 'not-tested' && statusOf(id) !== 'unchecked';

  // Do these next (before anything already waiting), in the order given.
  const doNext = (newTasks) => {
    tasks = [...newTasks, ...tasks];
  };

  // Credit a node (and, recursively, its essential prerequisites) as known,
  // without asking. Never overrides a tested result.
  function credit(id) {
    const r = record(id);
    if (r.status === 'gap' || r.status === 'shaky' || r.status === 'known-inferred') return;
    if (r.status !== 'known') r.status = 'known-inferred';
    for (const p of graph.essentialPrereqs(id)) credit(p);
  }

  function markKnown(id) {
    record(id).status = 'known';
    for (const p of graph.essentialPrereqs(id)) credit(p);
  }

  function markUnchecked(id) {
    if (statusOf(id) === 'not-tested') record(id).status = 'unchecked';
  }

  // Look for root causes below a gap.
  // Follow a confirmed gap down to its prerequisites, but only after the other
  // steps of the same skill still waiting to be asked: with many gaps, checking
  // every step of the skill the student is on matters more than going deep on
  // the first one (the question limit can run out).
  function descendFrom(id) {
    // A link to a whole skill may name the parts that matter ("check"): only those are asked.
    const node = graph.get(id);
    const links = [...(node.prerequisites || []), ...(node.kind === 'subskill' ? graph.get(node.skillId).prerequisites || [] : [])];
    const only = (p) => links.find((l) => l.id === p && l.check)?.check;
    const descent = graph.essentialPrereqs(id).map((p) => (
      graph.get(p).kind === 'skill' ? { kind: 'skill', id: p, fromDescent: true, only: only(p) } : { kind: 'probe', id: p, stage: 1, single: true }
    ));
    const skillId = graph.get(id).skillId;
    let after = 0;
    while (after < tasks.length && tasks[after].kind === 'probe' && graph.get(tasks[after].id).skillId === skillId) after++;
    tasks = [...tasks.slice(0, after), ...descent, ...tasks.slice(after)];
  }

  // ---------- turning tasks into questions ----------

  // Returns a question to ask for this task, or null if the task is resolved without asking.
  function handleTask(task) {
    if (task.kind === 'skill') {
      const id = task.id;
      if (expandedSkills.has(id) || isSettled(id)) return null;
      expandedSkills.add(id);
      // A mixed-review skill (whole numbers) has no single "whole problem": one
      // right fact says nothing about remainders. Ask each part instead.
      // ...unless it names one part whose right answer shows the rest (compare: one
      // hard comparison stands for the easier ones; owner: "unless proven otherwise").
      if (hasGenerator(id) && !generators[id].mixed) return ask(task, id, difficulty.screen);
      if (hasGenerator(id) && generators[id].screener && !gapsUnder(generators[id].screener).length) {
        return ask(task, generators[id].screener, difficulty.screen);
      }
      const subs = subskillsWithProblems(id).filter((s) => !task.only || task.only.includes(s));
      if (subs.length === 0) {
        // Not built yet. As a possible cause of a gap, flag it; as a target, just skip it.
        if (task.fromDescent) markUnchecked(id);
        return null;
      }
      doNext(subs.map((s) => ({ kind: 'probe', id: s, stage: 1, single: task.fromDescent })));
      return null;
    }

    if (task.kind === 'recheck') {
      // Only needed if the steps don't explain the miss on the whole problem.
      const g = generators[task.id];
      const explained = [...(g.covers || []), ...(g.ifNotSimplified ? [g.ifNotSimplified] : [])]
        .some((s) => statusOf(s) === 'gap' || nodes.get(s)?.blockedBy);
      return explained ? null : ask(task, generators[task.id].screener || task.id, difficulty.screen);
    }

    // probe
    const id = task.id;
    if (task.stage === 1 && isSettled(id)) return null;
    if (task.stage === 1 && gapsUnder(id).length) {
      record(id).blockedBy = gapsUnder(id);
      return null;
    }
    if (!hasGenerator(id)) {
      markUnchecked(id);
      return null;
    }
    if (task.stage === 1) {
      const uses = generators[id].alsoUses || [];
      // Shaky only because it was slow (right, but over the time limit) doesn't block:
        // the answers it leads to aren't in doubt.
        const blocked = (u) => statusOf(u) === 'gap' || (statusOf(u) === 'shaky' && !nodes.get(u)?.slow) || Boolean(nodes.get(u)?.blockedBy);
      const blockers = uses.filter(blocked);
      if (blockers.length) {
        record(id).blockedBy = blockers;
        return null;
      }
      const unsure = uses.filter((u) => !isSettled(u) && hasGenerator(u));
      if (unsure.length) {
        // Check what this subskill relies on first, then come back to it.
        doNext([...unsure.map((u) => ({ kind: 'probe', id: u, stage: 1 })), task]);
        return null;
      }
    }
    // A generator can ask for its own level (facts: only the hard ones tell us anything).
      const own = generators[id].diagnosticDifficulty || {};
      return ask(task, id, task.stage === 1 ? own.probe ?? difficulty.probe : own.confirm ?? difficulty.confirm);
  }

  function ask(task, generatorId, level) {
    const index = questions.length;
    const questionSeed = `${seed}:${index}`;
    const generator = generators[generatorId];
    const problem = {
      generator: generatorId,
      version: generator.version,
      difficulty: level,
      seed: questionSeed,
      ...generator.generate(createRng(`${generatorId}|${level}|${questionSeed}`), level),
    };
    const question = { index, nodeId: generatorId, generator: generatorId, seed: questionSeed, difficulty: level };
    return { task, problem, question };
  }

  // ---------- reacting to answers ----------

  function onScreenerAnswer(task, result) {
    const skillId = task.id;
    const generator = generators[skillId];
    const covered = generator.covers || [];
    const uncovered = subskillsWithProblems(skillId).filter((s) => !covered.includes(s));
    // If the screening question was one of the parts, its miss counts as that part's first try.
    const probe = (id) => (id === generator.screener
      ? { kind: 'probe', id, stage: 2, single: task.fromDescent }
      : { kind: 'probe', id, stage: 1, single: task.fromDescent });

    if (result.status === 'correct') {
      covered.forEach(markKnown);
      credit(skillId);
      doNext(uncovered.map(probe));
      return;
    }

    // Not right. Check the steps, then (if the steps all check out) the whole
    // problem once more. The recheck comes after any root-cause searching.
    const recheck = { kind: 'recheck', id: skillId };
    if (result.status === 'not-simplified') {
      const suspect = generator.ifNotSimplified;
      covered.filter((s) => s !== suspect).forEach(markKnown);
      doNext([...(suspect ? [probe(suspect)] : []), ...uncovered.map(probe), recheck]);
    } else {
      const first = result.misconception && pointsTo.get(result.misconception);
      const order = first && covered.includes(first) ? [first, ...covered.filter((s) => s !== first)] : covered;
      doNext([...[...order, ...uncovered].map(probe), recheck]);
    }
  }

  function onRecheckAnswer(skillId, result) {
    if (result.status === 'correct') {
      credit(skillId);
    } else {
      // Each step is fine on its own, but the whole problem was missed twice.
      record(skillId).status = 'gap';
    }
  }

  function onProbeAnswer(task, result, slow) {
    const id = task.id;
    const generator = generators[id];
    let outcome = result.status;
    // A right fact that took too long is shaky, not known (owner decision, whole-number facts).
    if (slow && outcome === 'correct') {
      record(id).status = 'shaky';
      record(id).slow = true;
      return;
    }
    if (outcome === 'not-simplified') {
      if (generator.ifNotSimplified === id) {
        outcome = 'wrong';
      } else {
        outcome = 'correct';
        if (generator.ifNotSimplified) doNext([{ kind: 'probe', id: generator.ifNotSimplified, stage: 1 }]);
      }
    }
    const right = outcome === 'correct' || outcome === 'wrong-form';

    if (task.stage === 1) {
      if (right) markKnown(id);
      else if (task.single) {
        // Below a gap that's already confirmed, one miss is enough (owner decision
        // 2026-11-20): keeps the diagnostic short for students with many gaps.
        record(id).status = 'gap';
        descendFrom(id);
      } else doNext([{ kind: 'probe', id, stage: 2 }]);
    } else if (right) {
      record(id).status = 'shaky';
    } else {
      record(id).status = 'gap';
      descendFrom(id);
    }
  }

  // ---------- public interface ----------

  // Work through tasks until there's a question to ask or nothing left.
  // Runs right after every answer, so the state is always settled (which keeps
  // saved progress and server replays consistent).
  function advance() {
    let steps = 0;
    while (!pending && !finishedReason) {
      if (++steps > 10000) throw new Error('Diagnostic stuck in a loop (bug): too many steps without a question');
      if (!tasks.length) {
        finishedReason = 'complete';
      } else if (questions.length >= maxQuestions) {
        finishedReason = 'question-limit';
      } else {
        pending = handleTask(tasks.shift());
      }
    }
  }

  // The next question to show, or null when the diagnostic is finished.
  // Calling it again before submitting returns the same question.
  function nextQuestion() {
    advance();
    return pending ? { index: pending.question.index, problem: pending.problem } : null;
  }

  // Grade the student's answer to the current question and decide what's next.
  // ms: how long the student took on this question (for the slow-fact rule).
  function submit(rawAnswer, ms) {
    if (!pending) throw new Error('submit() called with no question showing; call nextQuestion() first');
    const { task, problem, question } = pending;
    pending = null;

    const result = checkAnswer(problem, rawAnswer);
    const slow = Boolean(problem.slowAfterMs) && Number.isFinite(ms) && ms > problem.slowAfterMs;
    questions.push({ ...question, answer: rawAnswer ?? null, status: result.status, misconception: result.misconception, ...(slow ? { slow } : {}) });
    record(question.nodeId).evidence.push({ question: question.index, status: result.status });
    if (result.misconception) {
      misconceptionCounts[result.misconception] = (misconceptionCounts[result.misconception] || 0) + 1;
    }

    if (task.kind === 'skill') onScreenerAnswer(task, result);
    else if (task.kind === 'recheck') onRecheckAnswer(task.id, result);
    else onProbeAnswer(task, result, slow);
    advance();
    return result;
  }

  function result() {
    const nodeResults = {};
    for (const [id, r] of nodes) {
      nodeResults[id] = { status: r.status, evidence: [...r.evidence] };
      if (r.blockedBy) nodeResults[id].blockedBy = [...r.blockedBy];
      if (r.slow) nodeResults[id].slow = true;
    }

    // Skill summaries for the teacher: the worst status among a skill's subskills.
    const skills = {};
    const touchedSkills = new Set([...nodes.keys()].map((id) => graph.get(id).skillId));
    for (const skillId of touchedSkills) skills[skillId] = summarizeSkill(skillId);

    // Root gaps: gaps with no gap underneath them. These are where to start teaching.
    // A prerequisite skill counts as a gap if any of its subskills is one.
    const hasGap = (id) => statusOf(id) === 'gap'
      || (graph.get(id).kind === 'skill' && graph.subskillsOf(id).some((s) => statusOf(s) === 'gap'));
    const rootGaps = [...nodes]
      .filter(([id, r]) => r.status === 'gap' && !graph.essentialPrereqs(id).some(hasGap))
      .map(([id]) => id);

    return {
      diagnosticId: config.id,
      curriculumVersion: graph.curriculumVersion,
      seed,
      finished: Boolean(finishedReason),
      finishedReason,
      questionCount: questions.length,
      nodes: nodeResults,
      skills,
      rootGaps,
      uncheckedCauses: [...nodes].filter(([, r]) => r.status === 'unchecked').map(([id]) => id),
      misconceptions: { ...misconceptionCounts },
      questions: questions.map((q) => ({ ...q })),
    };
  }

  function summarizeSkill(skillId) {
    const subs = graph.subskillsOf(skillId).map(statusOf);
    const own = statusOf(skillId);
    if (own === 'gap') return 'gap';
    for (const s of ['gap', 'shaky']) if (subs.includes(s)) return s;
    if (subs.length && subs.every((s) => s === 'known' || s === 'known-inferred')) {
      return subs.includes('known') ? 'known' : 'known-inferred';
    }
    if (own === 'known-inferred' || own === 'unchecked') return own;
    if (subs.includes('known')) return 'partly-known';
    return 'not-tested';
  }

  return { nextQuestion, submit, result };
}

// Re-run a diagnostic from its setup and the student's answers, in order.
// Used by the server to verify a submitted result, and by the browser to resume.
// Returns the live diagnostic (call .result() for the profile; it may continue
// with more questions if the answers ran out before it finished).
// times: milliseconds per answer (needed to replay the slow-fact rule exactly).
export function replayDiagnostic(setup, answers, times = []) {
  const d = startDiagnostic(setup);
  answers.forEach((answer, i) => {
    if (!d.nextQuestion()) throw new Error('More answers than the diagnostic asked for');
    d.submit(answer, times[i]);
  });
  return d;
}

// ---------- saved results and the catch-up check ----------

// What's kept of a finished diagnostic: everything the path and the teacher's
// report need, without re-running it (re-running old answers through a newer
// diagnostic can ask different questions).
export function compactResult(result) {
  const nodes = {};
  for (const [id, n] of Object.entries(result.nodes)) {
    nodes[id] = { status: n.status, ...(n.blockedBy ? { blockedBy: n.blockedBy } : {}), ...(n.slow ? { slow: true } : {}) };
  }
  return {
    diagnosticId: result.diagnosticId,
    curriculumVersion: result.curriculumVersion,
    seed: result.seed,
    finished: result.finished,
    finishedReason: result.finishedReason,
    questionCount: result.questionCount,
    nodes,
    skills: result.skills,
    rootGaps: result.rootGaps,
    uncheckedCauses: result.uncheckedCauses,
    misconceptions: result.misconceptions,
    questions: result.questions.map(({ index, nodeId, generator, seed, difficulty, answer, status, misconception, slow }) => ({
      index, nodeId, generator, seed, difficulty, answer, status, ...(misconception ? { misconception } : {}), ...(slow ? { slow } : {}),
    })),
  };
}

// Target skills that have questions now but had none when this result was made:
// nothing about the skill or its parts was asked, credited or blocked. These are
// what a catch-up check asks about. That covers skills added after the student's
// check, and the later checks in config.moreChecks (e.g. the pre-algebra check).
export function catchUpTargets({ graph, generators, config, prior }) {
  const nothingKnown = (id) => {
    const n = prior?.nodes?.[id];
    return !n || ((n.status === 'not-tested' || n.status === 'unchecked') && !n.blockedBy);
  };
  const all = [...config.targets, ...(config.moreChecks || []).flatMap((c) => c.targets)];
  return all.filter((id) => graph.has(id)
    && (generators[id] || graph.subskillsOf(id).some((s) => generators[s]))
    && [id, ...graph.subskillsOf(id)].every(nothingKnown));
}

// For diagnostics saved before whole results were kept: the verdicts recorded at
// the time ({ id: status }), plus the gaps and wrong-answer patterns.
export function resultFromVerdicts(row) {
  const nodes = Object.fromEntries(Object.entries(row.verdicts || {}).map(([id, status]) => [id, { status }]));
  return {
    curriculumVersion: row.curriculumVersion,
    seed: row.seed,
    finished: true,
    questionCount: row.questionCount,
    nodes,
    skills: {},
    rootGaps: row.rootGaps || [],
    uncheckedCauses: Object.keys(nodes).filter((id) => nodes[id].status === 'unchecked'),
    misconceptions: row.misconceptions || {},
    questions: [],
  };
}

// The name to show for a catch-up: a later check's own name when the skills are all
// from it (e.g. "Pre-algebra check"); otherwise a catch-up of new topics.
export function catchUpName(config, targets) {
  const check = (config.moreChecks || []).find((c) => targets.length && targets.every((t) => c.targets.includes(t)));
  return check ? check.name : null;
}

// ---------- the quick re-check (after a foundation gap is fixed) ----------
// A question that "can't be checked yet" because of a gap underneath gets
// checked once that gap is fixed: its lesson section passed, its skill
// mastered, or (a foundation with no lesson yet) the teacher marked it checked.

// Gaps in this result that the student has since fixed. summary: the server's
// student summary (sectionsPassed, mastered, cleared). lessons: lesson files.
export function fixedGaps({ graph, prior, summary, lessons }) {
  const passed = new Set(summary.sectionsPassed || []);
  const mastered = new Set(summary.mastered || []);
  const cleared = new Set(summary.cleared || []);
  const passedFor = new Set(lessons.flatMap((l) => l.sections.filter((s) => passed.has(s.id)).map((s) => s.forGap)));
  return Object.entries(prior?.nodes || {})
    .filter(([id, n]) => n.status === 'gap' && graph.has(id))
    .filter(([id]) => {
      const skill = graph.get(id).kind === 'skill' ? id : graph.get(id).skillId;
      return cleared.has(id) || passedFor.has(id) || mastered.has(skill);
    })
    .map(([id]) => id);
}

// What a re-check asks, given the fixed gaps: every "can't check yet" question
// whose blockers are all fixed (or are themselves being reopened). The fixed gaps
// count as known; the reopened questions are asked again from scratch.
export function recheckPlan({ graph, generators, prior, fixed }) {
  const fixedSet = new Set(fixed);
  const nodes = {};
  for (const [id, n] of Object.entries(prior?.nodes || {})) nodes[id] = { ...n };
  for (const id of fixedSet) if (nodes[id]?.status === 'gap') nodes[id] = { status: 'known' };
  const reopened = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, n] of Object.entries(nodes)) {
      if (reopened.has(id) || n.status !== 'not-tested' || !n.blockedBy) continue;
      if (n.blockedBy.every((b) => fixedSet.has(b) || reopened.has(b))) {
        reopened.add(id);
        changed = true;
      }
    }
  }
  for (const id of reopened) nodes[id] = { status: 'not-tested' };
  const hasQuestions = (skill) => generators[skill] || graph.subskillsOf(skill).some((s) => generators[s]);
  // Deeper skills first, so a reopened foundation is asked before what builds on it.
  const memo = new Map();
  const depth = (id) => {
    if (!memo.has(id)) {
      memo.set(id, 0); // the graph has no loops (checked), but be safe
      memo.set(id, 1 + Math.max(0, ...graph.essentialPrereqs(id).map(depth)));
    }
    return memo.get(id);
  };
  const skills = [...new Set([...reopened].map((id) => (graph.get(id).kind === 'skill' ? id : graph.get(id).skillId)))]
    .filter(hasQuestions)
    .sort((a, b) => depth(a) - depth(b));
  return { targets: skills, prior: { ...prior, nodes } };
}
