// Tests for the adaptive diagnostic, using pretend students with known gaps.
// The question in every test: does the diagnostic find exactly the gaps the
// pretend student has, without accusing them of gaps they don't have?

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDiagnostic, replayDiagnostic } from '../../../engine/diagnostic/diagnostic.js';
import { buildGraphIndex } from '../../../engine/graph/graph-index.js';
import { createRng } from '../../../engine/random.js';
import { simulatedStudent, runWithStudent } from '../../../tools/simulated-student.js';
import { loadFractions } from '../../helpers/fractions-setup.js';

const fractions = loadFractions();
const SUB = (name) => `frac.add-sub.${name}`;

function diagnose(studentTraits, { seed = 'test-seed', setup = fractions, config } = {}) {
  const full = { ...setup, config: config || setup.config, seed };
  const student = simulatedStudent({ graph: setup.graph, generators: setup.generators, ...studentTraits });
  return { result: runWithStudent(startDiagnostic(full), student), student, setup: full };
}
const statusOf = (result, id) => result.nodes[id]?.status ?? 'not-tested';
const withStatus = (result, status) => Object.keys(result.nodes).filter((id) => result.nodes[id].status === status).sort();

// ---------- real fractions curriculum: hand-checked scenarios ----------

test('a student who knows everything: no gaps, very few questions', () => {
  const { result } = diagnose({});
  assert.deepEqual(result.rootGaps, []);
  assert.deepEqual(withStatus(result, 'gap'), []);
  assert.equal(result.finishedReason, 'complete');
  // One full add/subtract problem, plus one mixed-number problem (the full problem doesn't cover mixed numbers).
  assert.equal(result.questionCount, 2);
  for (const s of ['common-denom', 'rewrite', 'combine', 'simplify-result', 'mixed']) {
    assert.equal(statusOf(result, SUB(s)), 'known', s);
  }
  // Credited without asking, because add/subtract depends on them.
  assert.equal(statusOf(result, 'frac.equivalent.simplify'), 'known-inferred');
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'known-inferred');
  // Owner decision: adding fractions shows multiplication facts, not division facts.
  assert.equal(statusOf(result, 'whole.mult-div.div-facts'), 'not-tested');
  assert.equal(result.skills['frac.add-sub'], 'known');
});

test('adds across (1/2 + 1/3 = 2/5): finds the combine gap, without blaming simplifying or mixed numbers', () => {
  const { result } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] });
  assert.deepEqual(result.rootGaps, [SUB('combine')]);
  assert.equal(statusOf(result, SUB('common-denom')), 'known');
  assert.equal(statusOf(result, SUB('rewrite')), 'known');
  // These problems also need combining, so they can't be checked yet (not falsely called gaps).
  assert.deepEqual(result.nodes[SUB('simplify-result')].blockedBy, [SUB('combine')]);
  assert.deepEqual(result.nodes[SUB('mixed')].blockedBy, [SUB('combine')]);
  assert.equal(statusOf(result, SUB('simplify-result')), 'not-tested');
  assert.ok(result.misconceptions['frac.add-across'] >= 2);
  // Possible deeper causes that don't have problems yet:
  assert.ok(result.uncheckedCauses.includes('whole.add-sub'));
  assert.ok(result.questionCount <= 6, `took ${result.questionCount} questions`);
});

test('can do everything but simplify: finds the simplifying gap and points below it', () => {
  const { result } = diagnose({ lacks: ['frac.equivalent.simplify'] });
  assert.deepEqual(result.rootGaps, [SUB('simplify-result')]);
  for (const s of ['common-denom', 'rewrite', 'combine', 'mixed']) assert.equal(statusOf(result, SUB(s)), 'known', s);
  assert.ok(result.uncheckedCauses.includes('frac.equivalent.simplify'));
  assert.equal(result.questions[0].status, 'not-simplified');
});

test('only mixed numbers are missing', () => {
  const { result } = diagnose({ lacks: [SUB('mixed')] });
  assert.deepEqual(result.rootGaps, [SUB('mixed')]);
  assert.deepEqual(withStatus(result, 'gap'), [SUB('mixed')]);
  assert.ok(result.uncheckedCauses.includes('frac.mixed'));
});

test('missing multiplication facts: many add/subtract gaps, all traced to the same possible cause', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.mult-facts'] });
  assert.ok(withStatus(result, 'gap').includes(SUB('common-denom')));
  assert.ok(withStatus(result, 'gap').includes(SUB('rewrite')));
  assert.equal(statusOf(result, SUB('combine')), 'known');
  assert.ok(result.uncheckedCauses.includes('whole.mult-div.mult-facts'));
});

test('one careless slip on the first question does not create a gap', () => {
  const { result } = diagnose({ slipsOn: ['frac.add-sub'] });
  assert.deepEqual(withStatus(result, 'gap'), []);
  assert.deepEqual(withStatus(result, 'shaky'), []);
  assert.equal(result.questions[0].status, 'wrong');
});

test('a slip on a subskill makes it "shaky", not a gap', () => {
  const { result } = diagnose({ slipsOn: [SUB('mixed')] });
  assert.equal(statusOf(result, SUB('mixed')), 'shaky');
  assert.deepEqual(result.rootGaps, []);
});

// ---------- replay, resume, limits ----------

test('replaying the saved answers reproduces the exact result (server verification)', () => {
  const { result, setup } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] });
  const replayed = replayDiagnostic(setup, result.questions.map((q) => q.answer)).result();
  assert.deepEqual(replayed, result);
});

test('a tampered answer list produces a different result', () => {
  const { result, setup } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] });
  const answers = result.questions.map((q) => q.answer);
  answers[1] = { whole: 999 };
  assert.notDeepEqual(replayDiagnostic(setup, answers).result(), result);
});

test('resume after a dropped connection: replay part, continue, same final result', () => {
  const traits = { lacks: [SUB('simplify-result')] };
  const { result, setup } = diagnose(traits);
  const firstTwo = result.questions.slice(0, 2).map((q) => q.answer);
  const resumed = replayDiagnostic(setup, firstTwo);
  const student = simulatedStudent({ graph: setup.graph, generators: setup.generators, ...traits });
  assert.deepEqual(runWithStudent(resumed, student), result);
});

test('the question shown is the one the server would regenerate from the seed', async () => {
  const { generateProblem } = await import('../../../engine/generators/index.js');
  const d = startDiagnostic({ ...fractions, seed: 'abc' });
  const q = d.nextQuestion();
  const saved = { generator: q.problem.generator, seed: q.problem.seed, difficulty: q.problem.difficulty };
  assert.deepEqual(generateProblem(saved.generator, saved.seed, saved.difficulty), q.problem);
});

test('nextQuestion() repeats the current question until it is answered', () => {
  const d = startDiagnostic({ ...fractions, seed: 'repeat' });
  assert.deepEqual(d.nextQuestion(), d.nextQuestion());
  assert.throws(() => startDiagnostic({ ...fractions, seed: 'x' }).submit({ whole: 1 }));
});

test('stops at the question limit', () => {
  const config = { ...fractions.config, maxQuestions: 3 };
  const { result } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] }, { config });
  assert.equal(result.questionCount, 3);
  assert.equal(result.finishedReason, 'question-limit');
});

test('a blank answer counts as a miss, not a crash', () => {
  const d = startDiagnostic({ ...fractions, seed: 'blank' });
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) d.submit({});
  const result = d.result();
  assert.ok(result.finished);
  assert.ok(result.questionCount <= 25);
});

// ---------- 300 random pretend students ----------

test('random students: never claims a gap the student does not have; finds every real gap it can check', () => {
  const candidates = [
    SUB('common-denom'), SUB('rewrite'), SUB('combine'), SUB('simplify-result'), SUB('mixed'),
    'frac.equivalent.simplify', 'frac.equivalent', 'frac.mixed', 'whole.mult-div.mult-facts',
    'whole.factors-multiples', 'whole.add-sub', 'frac.meaning',
  ];
  const allMisconceptions = fractions.misconceptions.map((m) => m.id);
  const rng = createRng('random-students');

  for (let i = 0; i < 300; i++) {
    const lacks = candidates.filter(() => rng.chance(0.2));
    const misconceptions = allMisconceptions.filter(() => rng.chance(0.3));
    const slipsOn = rng.chance(0.3) ? [rng.pick([...candidates.slice(0, 5), 'frac.add-sub'])] : [];
    const { result, student } = diagnose({ lacks, misconceptions, slipsOn }, { seed: `student-${i}` });
    const who = `student ${i} lacks [${lacks}] slips [${slipsOn}]`;

    assert.ok(result.finished, who);
    assert.ok(result.questionCount <= 25, `${who}: ${result.questionCount} questions`);

    for (const [id, r] of Object.entries(result.nodes)) {
      // Soundness: every gap is real; every "known" (asked or inferred) is real.
      if (r.status === 'gap') assert.equal(student.canDo(id), false, `${who}: false gap on ${id}`);
      if (r.status === 'known' || r.status === 'known-inferred') {
        assert.equal(student.canDo(id), true, `${who}: wrongly credited ${id}`);
      }
    }
    // Completeness: every add/subtract subskill the student can't do is caught
    // as a gap, or honestly reported as blocked by another gap.
    for (const s of ['common-denom', 'rewrite', 'combine', 'simplify-result', 'mixed'].map(SUB)) {
      if (!student.canDo(s)) {
        const r = result.nodes[s];
        assert.ok(r && (r.status === 'gap' || r.blockedBy), `${who}: missed gap on ${s} (status ${r?.status})`);
      }
    }
  }
});

// ---------- a small made-up graph: multi-level root-cause search ----------

function chainSetup() {
  // t.top needs t.mid, which needs t.base (all essential).
  // t.top also has a SUPPORTING link to t.extra, which must never be followed.
  const skill = (id, prereqs) => ({
    id, name: id, status: 'draft', prerequisites: prereqs,
    subskills: [{ id: `${id}.x`, name: `${id}.x`, prerequisites: [] }],
  });
  const files = {
    't.json': {
      schemaVersion: 1,
      domain: { id: 't', name: 'Test' },
      skills: [
        skill('t.base', []),
        skill('t.mid', [{ id: 't.base', strength: 'essential' }]),
        skill('t.extra', []),
        skill('t.top', [{ id: 't.mid', strength: 'essential' }, { id: 't.extra', strength: 'supporting' }]),
      ],
    },
  };
  const graph = buildGraphIndex({ schemaVersion: 1, curriculumVersion: 'test', domains: [{ id: 't', file: 't.json' }] }, files);
  const simple = { version: 1, generate: (rng) => ({ instruction: 'Type the number.', expression: { type: 'int', value: 0 }, answer: { type: 'integer', value: rng.int(1, 50) }, misconceptions: [] }) };
  const generators = { 't.base.x': simple, 't.mid.x': simple, 't.top.x': simple, 't.extra.x': simple };
  return { graph, generators, misconceptions: [], config: { id: 'chain', targets: ['t.top'], maxQuestions: 25 } };
}

test('follows a gap down two levels to the real root cause', () => {
  const setup = chainSetup();
  const { result } = diagnose({ lacks: ['t.base'] }, { setup });
  assert.deepEqual(withStatus(result, 'gap'), ['t.base.x', 't.mid.x', 't.top.x']);
  assert.deepEqual(result.rootGaps, ['t.base.x']);
  assert.equal(result.questionCount, 6);
});

test('stops descending once it reaches something the student knows', () => {
  const setup = chainSetup();
  const { result } = diagnose({ lacks: ['t.mid'] }, { setup });
  assert.deepEqual(result.rootGaps, ['t.mid.x']);
  assert.equal(statusOf(result, 't.base.x'), 'known');
});

test('supporting prerequisites are never followed', () => {
  const setup = chainSetup();
  const { result } = diagnose({ lacks: ['t.base', 't.extra'] }, { setup });
  assert.equal(statusOf(result, 't.extra.x'), 'not-tested');
});

test('passing the top credits everything below it without asking', () => {
  const setup = chainSetup();
  const { result } = diagnose({}, { setup });
  assert.equal(result.questionCount, 1);
  assert.equal(statusOf(result, 't.base'), 'known-inferred');
  assert.equal(statusOf(result, 't.mid'), 'known-inferred');
});

test('every diagnostic target is a real skill in the graph', () => {
  for (const id of fractions.config.targets) assert.ok(fractions.graph.has(id), id);
});
