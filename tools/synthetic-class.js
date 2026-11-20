// A pretend class, for the dashboard preview and (later) the load test.
// NEVER real student data. Every student is made up; names are "Sample Student N".
//
// Each pretend student gets a gap pattern (e.g. "adds across", "weak on
// multiplication facts") and an activity level, then actually runs through the
// real engine: the real diagnostic, then real practice sessions along their real
// path, answering like a student with those gaps who slowly improves. So the
// dashboard sees exactly the kind of records real students would produce.
//
// Deterministic: the same settings and seed always make the same class.

import { createRng } from '../engine/random.js';
import { startDiagnostic, compactResult } from '../engine/diagnostic/diagnostic.js';
import { startPractice } from '../engine/practice/practice.js';
import { buildPath } from '../engine/lessons/path.js';
import { reduce } from '../engine/math/fraction.js';
import { simulatedStudent } from './simulated-student.js';
import { sectionSummary } from '../engine/teacher/section-summary.js';
import { practicePlan, practiceSetPlan } from '../engine/lessons/plan.js';

const DAY = 24 * 60 * 60 * 1000;

// Gap patterns and how common they are (weights).
const PROFILES = [
  { id: 'ready', weight: 18, traits: {} },
  { id: 'adds-across', weight: 16, traits: { lacks: ['frac.add-sub.combine'], misconceptions: ['frac.add-across'] } },
  { id: 'mult-facts', weight: 12, traits: { lacks: ['whole.mult-div.mult-facts'] } },
  { id: 'simplify', weight: 14, traits: { lacks: ['frac.equivalent.simplify'] } },
  { id: 'rewrite', weight: 10, traits: { lacks: ['frac.equivalent'], misconceptions: ['frac.additive-scaling'] } },
  { id: 'whole-procedure', weight: 10, traits: { failsWhole: ['frac.add-sub'] } },
  { id: 'common-denom', weight: 10, traits: { lacks: ['frac.add-sub.common-denom'], misconceptions: ['frac.add-denominators'] } },
  { id: 'many', weight: 10, traits: { lacks: ['frac.add-sub.combine', 'frac.equivalent.simplify', 'frac.add-sub.common-denom'], misconceptions: ['frac.add-across', 'frac.add-denominators'] } },
];

// How often a student works: days between sessions, and chance of quitting early.
const ACTIVITY = [
  { id: 'steady', weight: 40, gapDays: [1, 2] },
  { id: 'some', weight: 35, gapDays: [2, 4] },
  { id: 'rare', weight: 15, gapDays: [5, 8] },
  { id: 'stopped', weight: 10, gapDays: [30, 30] },
];

const WORDS_A = ['maple', 'river', 'cedar', 'stone', 'amber', 'cloud', 'birch', 'coral', 'frost', 'ember', 'meadow', 'harbor', 'canyon', 'willow', 'summit', 'pebble'];
const WORDS_B = ['tiger', 'otter', 'falcon', 'heron', 'fox', 'bison', 'lynx', 'raven', 'panda', 'gecko', 'moose', 'koala', 'eagle', 'shark', 'llama', 'wolf'];
const NICKNAMES = ['Ace', 'Sky', 'JJ', 'Nova', 'Rex', 'Lu', 'Kit', 'Bo', 'Zee', 'Max', 'Jo', 'Remy'];

// periods: [{ name, size }]. now: ISO date string. setup: the real engine pieces.
export function syntheticClass({ periods, seed = 'sample-class', now, setup }) {
  const rng = createRng(`class|${seed}`);
  const { graph, generators, misconceptions, diagnosticConfig, lessons, rules } = setup;
  const end = new Date(now).getTime();
  const classes = [];
  const students = [];
  const roster = [];
  const diagnostics = [];
  const sections = [];
  const verifications = [];
  const clearances = [];
  const practice = [];
  const usedCodes = new Set();
  let n = 0;

  periods.forEach((period, pi) => {
    const classId = `p${pi + 1}`;
    classes.push({ id: classId, name: period.name || `Period ${pi + 1}`, period: pi + 1 });
    for (let k = 0; k < period.size; k++) {
      n++;
      const code = uniqueCode(rng, usedCodes);
      const profile = weighted(rng, PROFILES);
      const activity = weighted(rng, ACTIVITY);
      const nickname = rng.chance(0.4) ? rng.pick(NICKNAMES) : null;
      students.push({ code, nickname, classId, createdAt: iso(end - 24 * DAY), profile: profile.id });
      roster.push({ classId, code, realName: `Sample Student ${n}` });

      // ---- diagnostic: the real engine, answered by a pretend student ----
      const diagSeed = `${seed}:${code}:diag`;
      const pretend = simulatedStudent({ graph, generators, ...profile.traits });
      const diag = startDiagnostic({ graph, generators, misconceptions, config: diagnosticConfig, seed: diagSeed });
      const answers = [];
      const times = [];
      for (let q = diag.nextQuestion(); q; q = diag.nextQuestion()) {
        const a = pretend.answer(q.problem);
        answers.push(a);
        times.push(rng.int(12, 70) * 1000);
        diag.submit(a);
      }
      let t = end - rng.int(9, 15) * DAY + rng.int(8, 14) * 3600 * 1000;
      const result = diag.result();
      diagnostics.push({
        type: 'diagnostic', code, seed: diagSeed, answers, times, curriculumVersion: graph.curriculumVersion,
        startedAt: iso(t - sum(times)), finishedAt: iso(t), result: compactResult(result),
      });

      // ---- the teacher clears foundation checks for some students after a few days ----
      const firstPath = buildPath({ result, lessons, graph });
      const foundations = firstPath.filter((i) => i.kind !== 'section');
      let cleared = [];
      if (foundations.length && rng.chance(0.6)) {
        const at = t + rng.int(2, 5) * DAY;
        if (at < end) {
          cleared = foundations.map((f) => f.gap);
          for (const f of foundations) clearances.push({ code, gap: f.gap, by: 'teacher', at: iso(at) });
          t = at;
        }
      }
      // (Owner decision: students don't wait for the teacher's check; they keep going.)

      // ---- practice along the path, getting better with practice ----
      let skill = rng.int(45, 70) / 100; // chance of getting a problem right on the first try
      const held = profile.traits.misconceptions || [];
      const path = buildPath({ result, lessons, graph, cleared }).filter((i) => i.kind === 'section');
      for (const item of path) {
        let passed = false;
        for (let attemptNo = 1; !passed && attemptNo <= 3; attemptNo++) {
          t += rng.int(...activity.gapDays) * DAY + rng.int(-3, 3) * 3600 * 1000;
          if (t >= end) break;
          const lesson = lessons.find((l) => l.skill === item.lesson);
          const sec = lesson.sections.find((s) => s.id === item.section);
          const record = practiseSection({ rng, generators, rules, sec, lesson, code, seed: `${seed}:${code}:${sec.id}:${attemptNo}`, attemptNo, skill, held, at: t, curriculumVersion: graph.curriculumVersion });
          sections.push(record);
          passed = record.passed;
          skill = Math.min(0.95, skill + 0.12);
        }
        if (!passed || t >= end) break;
      }

      // ---- some students with platform mastery practise for the paper test ----
      for (const m of sections.filter((r) => r.code === code && r.provisionalMastery)) {
        const sets = rng.chance(0.5) ? rng.int(1, 2) : 0;
        for (let k = 1; k <= sets; k++) {
          const at = new Date(m.finishedAt).getTime() + k * DAY;
          if (at >= end) break;
          const pseed = `${seed}:${code}:practice:${m.lesson}:${k}`;
          const pr = startPractice({ generators, rules, seed: pseed, plan: practiceSetPlan(m.lesson, rules) });
          const answers = [];
          const times = [];
          for (let c = pr.currentProblem(); c; c = pr.currentProblem()) {
            const a = rng.chance(c.attempt === 1 ? 0.8 : 0.9) ? correct(c.problem) : mistake(c.problem, []);
            answers.push(a);
            times.push(rng.int(30, 120) * 1000);
            pr.submit(a);
          }
          practice.push({
            type: 'practice-set', code, skillId: m.lesson, attemptNo: k, seed: pseed, answers, times,
            startedAt: iso(at), finishedAt: iso(at + sum(times)), ...sectionSummary(pr.result(), times),
          });
        }
      }

      // ---- some students with platform mastery already took the paper test ----
      const mastered = sections.find((r) => r.code === code && r.provisionalMastery);
      if (mastered && rng.chance(0.6)) {
        const at = new Date(mastered.finishedAt).getTime() + rng.int(1, 4) * DAY;
        if (at < end) {
          const marks = Array.from({ length: rules.verification.outOf }, () => (rng.chance(0.85) ? 1 : 0));
          const score = marks.filter((m) => m === 1).length;
          verifications.push({
            code, skillId: mastered.lesson, assessmentId: mastered.lesson, version: rng.chance(0.5) ? 'A' : 'B',
            marks, score, outOf: marks.length,
            suggested: score >= rules.verification.minScore ? 'verified' : 'not-yet',
            decision: score >= rules.verification.minScore ? 'verified' : 'not-yet',
            attempt: 1, by: 'teacher', at: iso(at),
          });
        }
      }
    }
  });

  return { synthetic: true, generatedFor: now, classes, students, roster, diagnostics, sections, verifications, clearances, practice };
}

// One finished section, played with the real practice engine.
function practiseSection({ rng, generators, rules, sec, lesson, code, seed, attemptNo, skill, held, at, curriculumVersion }) {
  const practice = startPractice({ generators, rules, seed, plan: practicePlan(sec) });
  const answers = [];
  const times = [];
  let p = skill;
  for (let cur = practice.currentProblem(); cur && answers.length < 80; cur = practice.currentProblem()) {
    const chance = cur.attempt === 1 ? p : Math.min(0.95, p + 0.2);
    let a;
    if (rng.chance(chance)) a = correct(cur.problem);
    else if (rng.chance(0.15)) a = {}; // "I'm not sure"
    else a = mistake(cur.problem, held);
    answers.push(a);
    times.push(rng.int(15, 95) * 1000);
    practice.submit(a);
    p = Math.min(0.97, p + 0.03);
  }
  const result = practice.result();
  const finishedAt = at + sum(times);
  return {
    type: 'lesson-section', code, lesson: lesson.skill, section: sec.id, gap: sec.forGap, generator: sec.generator, mode: sec.mode,
    seed, attemptNo, curriculumVersion, startedAt: iso(at), finishedAt: iso(finishedAt),
    answers, times, scaffolds: {}, hintsShown: [],
    endedBy: result.endedBy, passed: result.passed, provisionalMastery: result.provisionalMastery, problems: result.problems,
    ...sectionSummary(result, times),
  };
}

function correct(problem) {
  const a = problem.answer;
  if (a.type === 'quotient-remainder') return { whole: a.quotient, rem: a.remainder };
  if (a.type === 'set' || a.type === 'multiset') return { list: [...a.values] };
  if (a.form === 'exact') return { num: a.n, den: a.d };
  if (a.type === 'choice') return { choice: a.correct };
  if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
  if (a.type === 'common-multiple') return { whole: a.least };
  const v = reduce(a.value);
  return v.d === 1 ? { whole: v.n } : { num: v.n, den: v.d };
}

function mistake(problem, held) {
  const m = (problem.misconceptions || []).find((x) => held.includes(x.id));
  if (m && !m.test) {
    if (typeof m.value === 'number') return { whole: m.value };
    if (m.value.quotient !== undefined) return { whole: m.value.quotient, rem: m.value.remainder };
    return { num: m.value.n, den: m.value.d };
  }
  const a = problem.answer;
  if (m?.test) return { list: [1] };
  if (a.type === 'choice') return { choice: m?.choice ?? (a.correct + 1) % a.options.length };
  if (a.type === 'quotient-remainder') return { whole: a.quotient + 1, rem: a.remainder };
  if (a.type === 'set' || a.type === 'multiset') return { list: a.values.slice(1) };
  if (a.type === 'integer') return { whole: Math.abs(a.value + 1), ...(a.value + 1 < 0 ? { negative: true } : {}) };
  if (a.type === 'common-multiple') return { whole: a.least + 1 };
  return { num: Math.abs(a.value.n) + 1, den: a.value.d };
}

function uniqueCode(rng, used) {
  for (;;) {
    const code = `${rng.pick(WORDS_A)}-${rng.pick(WORDS_B)}-${rng.int(10, 99)}`;
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

function weighted(rng, list) {
  let r = rng.next() * list.reduce((n, x) => n + x.weight, 0);
  for (const x of list) if ((r -= x.weight) < 0) return x;
  return list.at(-1);
}

const sum = (list) => list.reduce((n, x) => n + x, 0);
const iso = (ms) => new Date(ms).toISOString();
