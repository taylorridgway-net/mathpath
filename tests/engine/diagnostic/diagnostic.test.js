// Tests for the adaptive diagnostic, using pretend students with known gaps.
// The question in every test: does the diagnostic find exactly the gaps the
// pretend student has, without accusing them of gaps they don't have?

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDiagnostic, replayDiagnostic, compactResult, catchUpTargets, catchUpName, fixedGaps, recheckPlan } from '../../../engine/diagnostic/diagnostic.js';
import { loadClassSetup } from '../../helpers/class-setup.js';
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
  // One full add/subtract problem covers every add/subtract subskill, one
  // comparison with different denominators covers comparing, and one
  // multiplication covers multiplying, one division covers dividing (owner: "unless proven otherwise").
  // Negative fractions: one question per part (they rest on different integer skills).
  assert.equal(result.questionCount, 7);
  for (const s of ['common-denom', 'rewrite', 'combine', 'simplify-result']) {
    assert.equal(statusOf(result, SUB(s)), 'known', s);
  }
  // Credited without asking, because add/subtract depends on them.
  assert.equal(statusOf(result, 'frac.equivalent.simplify'), 'known-inferred');
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'known-inferred');
  // Owner decision: adding fractions shows multiplication facts, not division facts.
  assert.equal(statusOf(result, 'whole.mult-div.div-facts'), 'not-tested');
  assert.equal(result.skills['frac.add-sub'], 'known');
});

test('adds across (1/2 + 1/3 = 2/5): finds the combine gap, without blaming simplifying', () => {
  const { result } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] });
  assert.deepEqual(result.rootGaps, [SUB('combine')]);
  assert.equal(statusOf(result, SUB('common-denom')), 'known');
  assert.equal(statusOf(result, SUB('rewrite')), 'known');
  // These problems also need combining, so they can't be checked yet (not falsely called gaps).
  assert.deepEqual(result.nodes[SUB('simplify-result')].blockedBy, [SUB('combine')]);
  assert.equal(statusOf(result, SUB('simplify-result')), 'not-tested');
  assert.ok(result.misconceptions['frac.add-across'] >= 2);
  // The deeper cause (whole-number add/subtract) now has questions: checked, and fine.
  assert.equal(statusOf(result, 'whole.add-sub.add-regroup'), 'known');
  assert.equal(statusOf(result, 'whole.add-sub.sub-regroup'), 'known');
  assert.ok(!result.uncheckedCauses.includes('whole.add-sub'));
  assert.ok(result.questionCount <= 12, `took ${result.questionCount} questions`);
});

test('can do everything but simplify: finds the simplifying gap and points below it', () => {
  const { result } = diagnose({ lacks: ['frac.equivalent.simplify'] });
  // Simplifying now has questions of its own: confirmed as the root, under the add/subtract step.
  assert.deepEqual(result.rootGaps, ['frac.equivalent.simplify']);
  assert.equal(statusOf(result, SUB('simplify-result')), 'gap');
  for (const s of ['common-denom', 'rewrite', 'combine']) assert.equal(statusOf(result, SUB(s)), 'known', s);
  assert.equal(result.questions[0].status, 'not-simplified');
});

test('missing multiplication facts: confirmed with real fact questions, as the root under the common-denominator gap', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.mult-facts'] });
  assert.ok(withStatus(result, 'gap').includes(SUB('common-denom')));
  assert.ok(withStatus(result, 'gap').includes(SUB('rewrite')));
  assert.equal(statusOf(result, SUB('combine')), 'known');
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'gap');
  assert.ok(result.rootGaps.includes('whole.mult-div.mult-facts'));
  assert.ok(!result.rootGaps.includes(SUB('common-denom')), 'common denominators has a gap underneath it');
  assert.ok(result.questions.some((q) => q.generator === 'whole.mult-div.mult-facts'), 'actually asked a fact');
});

// ---------- whole numbers ----------

const wholeConfig = { ...fractions.config, targets: ['whole.mult-div'] };
const right = (p) => {
  const e = p.expression;
  const [a, b] = [e.left.value, e.right.value];
  if (e.op === '×') return { whole: a * b };
  return a % b === 0 && !p.generator.endsWith('remainders') ? { whole: a / b } : { whole: Math.floor(a / b), rem: a % b };
};
function runWhole(msFor) {
  const d = startDiagnostic({ ...fractions, config: wholeConfig, seed: 'whole-seed' });
  const answers = [];
  const times = [];
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) {
    answers.push(right(q.problem));
    times.push(msFor(q.problem));
    d.submit(answers.at(-1), times.at(-1));
  }
  return { result: d.result(), answers, times };
}

test('a mixed-review skill (whole numbers) is checked part by part, not with one "whole problem"', () => {
  const { result } = runWhole(() => 2000);
  assert.ok(result.questions.every((q) => q.generator !== 'whole.mult-div'));
  for (const s of ['mult-facts', 'div-facts', 'remainders']) assert.equal(statusOf(result, `whole.mult-div.${s}`), 'known', s);
});

test('owner decision: a right fact that took more than 5 seconds is shaky, not known; slow non-facts don\'t count', () => {
  const { result, answers, times } = runWhole(() => 8000);
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'shaky');
  assert.equal(statusOf(result, 'whole.mult-div.div-facts'), 'shaky');
  assert.equal(statusOf(result, 'whole.mult-div.remainders'), 'known', 'remainders aren\'t timed');
  // The server replays with the saved times and must get the same result.
  const replayed = replayDiagnostic({ ...fractions, config: wholeConfig, seed: 'whole-seed' }, answers, times).result();
  assert.deepEqual(replayed.nodes, result.nodes);
});

test('a slip on the first question: steps check out, a second whole problem is right, no gap', () => {
  const { result } = diagnose({ slipsOn: ['frac.add-sub'] });
  assert.deepEqual(withStatus(result, 'gap'), []);
  assert.deepEqual(withStatus(result, 'shaky'), []);
  assert.equal(result.questions[0].status, 'wrong');
  const last = result.questions.filter((q) => q.generator === 'frac.add-sub').at(-1);
  assert.equal(result.questions.filter((q) => q.generator === 'frac.add-sub').length, 2, 'should finish add/subtract with a second whole problem');
  assert.equal(last.status, 'correct');
  assert.equal(result.skills['frac.add-sub'], 'known');
});

test('owner\'s case: can do every step on its own, but not the whole problem -> gap on the whole skill', () => {
  // Found by the owner testing on a phone: "I'm not sure" on the full problem, then every
  // step right, and the diagnostic reported nothing to work on. It must report the skill.
  const { result } = diagnose({ failsWhole: ['frac.add-sub'] });
  for (const s of ['common-denom', 'rewrite', 'combine', 'simplify-result']) {
    assert.equal(statusOf(result, SUB(s)), 'known', s);
  }
  assert.equal(statusOf(result, 'frac.add-sub'), 'gap');
  assert.deepEqual(result.rootGaps, ['frac.add-sub']);
  assert.equal(result.skills['frac.add-sub'], 'gap');
  // Full problem, four steps, full problem again; plus one comparison, one multiplication, one division,
  // and negative fractions' sign and multiply/divide parts (adding with negatives rests on the gap: not asked).
  assert.equal(result.questionCount, 11);
});

test('multiply: cross-multiplies (2/3 × 4/5 = 10/12) -> gap on multiplying two fractions, nothing else blamed', () => {
  const { result } = diagnose({ lacks: ['frac.multiply.by-fraction'], misconceptions: ['frac.mult-cross'] });
  assert.deepEqual(result.rootGaps, ['frac.multiply.by-fraction']);
  assert.equal(statusOf(result, 'frac.multiply.by-whole'), 'known');
  assert.equal(result.skills['frac.add-sub'], 'known');
  assert.ok(result.misconceptions['frac.mult-cross'] >= 1);
  // Dividing needs this step, so "multiply by the reciprocal" is "can't check yet", not asked.
  assert.deepEqual(result.nodes['frac.divide.multiply-reciprocal'].blockedBy, ['frac.multiply.by-fraction']);
  assert.equal(statusOf(result, 'frac.divide.reciprocal'), 'known');
  assert.ok(result.questionCount <= 11, `took ${result.questionCount} questions`);
});

test('multiply: can multiply but never simplifies the product -> gap on simplifying products', () => {
  const { result } = diagnose({ lacks: ['frac.multiply.simplify'] });
  assert.deepEqual(result.rootGaps, ['frac.multiply.simplify']);
  assert.equal(statusOf(result, 'frac.multiply.by-fraction'), 'known');
});

test('the same case with blank answers ("I\'m not sure") on both whole problems', () => {
  const d = startDiagnostic({ ...fractions, seed: 'not-sure' });
  const student = simulatedStudent({ graph: fractions.graph, generators: fractions.generators });
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) {
    d.submit(q.problem.generator === 'frac.add-sub' ? {} : student.answer(q.problem));
  }
  assert.deepEqual(d.result().rootGaps, ['frac.add-sub']);
});

test('no extra whole problem when a step already explains the miss', () => {
  const { result } = diagnose({ lacks: [SUB('combine')], misconceptions: ['frac.add-across'] });
  assert.equal(result.questions.filter((q) => q.generator === 'frac.add-sub').length, 1);
});

test('a slip on a subskill makes it "shaky", not a gap', () => {
  // The combine gap makes the diagnostic check each subskill; a slip on one of them is "shaky".
  const { result } = diagnose({ lacks: [SUB('combine')], slipsOn: [SUB('rewrite')] });
  assert.equal(statusOf(result, SUB('rewrite')), 'shaky');
  assert.deepEqual(result.rootGaps, [SUB('combine')]);
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
    SUB('common-denom'), SUB('rewrite'), SUB('combine'), SUB('simplify-result'),
    'frac.equivalent.simplify', 'frac.equivalent', 'whole.mult-div.mult-facts',
    'whole.factors-multiples', 'whole.add-sub', 'frac.meaning',
  ];
  const allMisconceptions = fractions.misconceptions.map((m) => m.id);
  const rng = createRng('random-students');

  for (let i = 0; i < 300; i++) {
    const lacks = candidates.filter(() => rng.chance(0.2));
    const misconceptions = allMisconceptions.filter(() => rng.chance(0.3));
    const slipsOn = rng.chance(0.3) ? [rng.pick([...candidates.slice(0, 4), 'frac.add-sub'])] : [];
    const failsWhole = rng.chance(0.2) ? ['frac.add-sub'] : [];
    const { result, student } = diagnose({ lacks, misconceptions, slipsOn, failsWhole }, { seed: `student-${i}` });
    const who = `student ${i} lacks [${lacks}] slips [${slipsOn}] failsWhole [${failsWhole}]`;

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
    for (const s of ['common-denom', 'rewrite', 'combine', 'simplify-result'].map(SUB)) {
      if (!student.canDo(s)) {
        const r = result.nodes[s];
        assert.ok(r && (r.status === 'gap' || r.blockedBy), `${who}: missed gap on ${s} (status ${r?.status})`);
      }
    }
    // ...and a student who can't do the whole problem is caught even when every step is fine.
    if (!student.canDo('frac.add-sub')) {
      const someStepFound = ['common-denom', 'rewrite', 'combine', 'simplify-result']
        .some((s) => statusOf(result, SUB(s)) === 'gap' || result.nodes[SUB(s)]?.blockedBy);
      assert.ok(someStepFound || statusOf(result, 'frac.add-sub') === 'gap', `${who}: missed whole-skill gap`);
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
  // Two questions confirm the first gap; below it, one question per level (owner decision).
  assert.equal(result.questionCount, 4);
});

test('owner decision: the first gap needs two misses; below a confirmed gap, one miss is enough', () => {
  const setup = chainSetup();
  const { result } = diagnose({ lacks: ['t.base'] }, { setup });
  const asked = (id) => result.questions.filter((q) => q.nodeId === id || q.generator === id).length;
  assert.equal(asked('t.top.x'), 2, 'the first gap is confirmed with a second question');
  assert.equal(asked('t.mid.x'), 1);
  assert.equal(asked('t.base.x'), 1);
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

test('the diagnostic asks hard facts (6-9 and 12), never easy ones like 4 × 2', () => {
  const { result } = runWhole(() => 2000);
  const facts = result.questions.filter((q) => q.generator.endsWith('-facts'));
  assert.ok(facts.length >= 2);
  assert.ok(facts.every((q) => q.difficulty === 3));
});

test('owner decision, real curriculum: under a confirmed common-denominator gap, multiplication facts are asked once', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.mult-facts'] });
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'gap');
  assert.equal(result.questions.filter((q) => q.generator === 'whole.mult-div.mult-facts').length, 1);
  assert.ok(result.questionCount <= 18, `took ${result.questionCount} questions`);
});

test('divide: can divide by flipping, but not simplify the answer -> the simplifying gap is in multiplying', () => {
  const { result } = diagnose({ lacks: ['frac.multiply.simplify'] });
  assert.deepEqual(result.rootGaps, ['frac.multiply.simplify']);
  // The division was right apart from simplifying: dividing is fine, and no extra division question.
  assert.equal(statusOf(result, 'frac.divide.multiply-reciprocal'), 'known');
  assert.notEqual(statusOf(result, 'frac.divide'), 'gap');
  assert.equal(result.questions.filter((q) => q.generator === 'frac.divide').length, 1);
});

test('anything resting on a "can\'t check yet" step is also "can\'t check yet"', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.mult-facts'] });
  // Multiplying two fractions can't be checked (facts are a gap); dividing by flipping rests on it.
  assert.ok(result.nodes['frac.multiply.by-fraction'].blockedBy);
  assert.ok(result.nodes['frac.divide.multiply-reciprocal'].blockedBy);
  assert.ok(!result.questions.some((q) => q.generator === 'frac.divide.multiply-reciprocal'));
  // "How many 1/3s fit into 4?" needs facts too (4 × 3 = 12); reciprocals don't, and are still checked.
  assert.ok(result.nodes['frac.divide.meaning'].blockedBy);
  assert.equal(statusOf(result, 'frac.divide.reciprocal'), 'known');
});

test('compare: one hard comparison stands for all; when it\'s missed, that miss counts as the first try', () => {
  const { result } = diagnose({ lacks: ['frac.compare.unlike'] });
  const unlikeAsked = result.questions.filter((q) => q.generator === 'frac.compare.unlike').length;
  assert.equal(unlikeAsked, 2, 'the screening miss plus one confirming question, not three');
  assert.equal(statusOf(result, 'frac.compare.unlike'), 'gap');
  assert.equal(statusOf(result, 'frac.compare.like'), 'known');
});

test('a question with a confirmed gap underneath is reported "can\'t check yet" instead of being asked', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.mult-facts'] });
  // Comparing different denominators needs equivalent fractions, which needs facts: not asked.
  assert.ok(!result.questions.some((q) => q.generator === 'frac.compare.unlike'));
  assert.ok(result.nodes['frac.compare.unlike'].blockedBy.length > 0);
  assert.equal(statusOf(result, 'frac.compare.like'), 'known', 'the parts that don\'t need it are still checked');
});

// ---------- integers (reached through negative fractions; tested here as targets) ----------
const integers = { ...fractions, config: { ...fractions.config, targets: ['int.add-sub', 'int.mult-div'] } };

test('integers: knows everything -> one subtraction for adding/subtracting, one each for multiplying and dividing', () => {
  const { result } = diagnose({}, { setup: integers });
  assert.deepEqual(result.rootGaps, []);
  assert.equal(result.questionCount, 3);
  assert.equal(statusOf(result, 'int.add-sub.same-sign'), 'known');
  // A right integer multiplication shows multiplication facts; dividing shows division facts.
  assert.equal(statusOf(result, 'whole.mult-div.mult-facts'), 'known-inferred');
  assert.equal(statusOf(result, 'whole.mult-div.div-facts'), 'known-inferred');
});

test('integers: 4 - (-6) = -2 -> gap on subtracting, the adding parts still checked and fine', () => {
  const { result } = diagnose({ lacks: ['int.add-sub.subtract'], misconceptions: ['int.sub-ignored-sign'] }, { setup: integers });
  assert.deepEqual(result.rootGaps, ['int.add-sub.subtract']);
  assert.equal(statusOf(result, 'int.add-sub.same-sign'), 'known');
  assert.equal(statusOf(result, 'int.add-sub.different-signs'), 'known');
});

test('integers: division facts missing -> found under integer division; multiplying is fine', () => {
  const { result } = diagnose({ lacks: ['whole.mult-div.div-facts'] }, { setup: integers });
  assert.deepEqual(result.rootGaps, ['whole.mult-div.div-facts']);
  assert.equal(statusOf(result, 'int.mult-div.multiply'), 'known');
  assert.ok(result.questionCount <= 8, `took ${result.questionCount} questions`);
});

// ---------- catch-up check (skills added after the student's diagnostic) ----------
// "Before": the diagnostic as it was when only adding/subtracting had questions.
const before = { ...fractions, config: { ...fractions.config, targets: ['frac.add-sub'] } };
function earlier(traits) {
  const student = simulatedStudent({ graph: fractions.graph, generators: fractions.generators, ...traits });
  return { student, prior: compactResult(runWithStudent(startDiagnostic({ ...before, seed: 'old' }), student)) };
}

test('catch-up: finds exactly the skills that had no questions back then', () => {
  const { prior } = earlier({});
  // New skills in the first check come first, on their own.
  assert.deepEqual(catchUpTargets({ ...fractions, prior }), ['frac.multiply', 'frac.divide', 'frac.signed', 'frac.compare']);
  // After today's fractions check: the later checks, one at a time (pre-algebra, then decimals).
  const now = compactResult(diagnose({}).result);
  const ALG = ['alg.order-ops', 'alg.exponents', 'alg.evaluate', 'alg.equations', 'alg.expressions', 'alg.multi-step', 'alg.inequalities'];
  assert.deepEqual(catchUpTargets({ ...fractions, prior: now }), ALG);
  assert.equal(catchUpName(fractions.config, ALG), 'Pre-algebra check');
  const afterAlg = { ...now, nodes: { ...now.nodes, ...Object.fromEntries(ALG.map((id) => [id, { status: 'known' }])) } };
  const DEC = ['dec.place-value', 'dec.convert', 'dec.add-sub', 'dec.multiply', 'dec.divide', 'dec.signed'];
  assert.deepEqual(catchUpTargets({ ...fractions, prior: afterAlg }), DEC);
  assert.equal(catchUpName(fractions.config, DEC), 'Decimals check');
  const afterDec = { ...afterAlg, nodes: { ...afterAlg.nodes, ...Object.fromEntries(DEC.map((id) => [id, { status: 'known' }])) } };
  const RAT = ['rat.ratios', 'rat.percent', 'rat.percent-change'];
  assert.deepEqual(catchUpTargets({ ...fractions, prior: afterDec }), RAT);
  assert.equal(catchUpName(fractions.config, RAT), 'Ratios and percents check');
  const afterRat = { ...afterDec, nodes: { ...afterDec.nodes, ...Object.fromEntries(RAT.map((id) => [id, { status: 'known' }])) } };
  const LIN = ['lin.functions', 'lin.slope', 'lin.slope-intercept', 'lin.forms', 'lin.parallel'];
  assert.deepEqual(catchUpTargets({ ...fractions, prior: afterRat }), LIN);
  assert.equal(catchUpName(fractions.config, LIN), 'Linear functions check');
  const afterLin = { ...afterRat, nodes: { ...afterRat.nodes, ...Object.fromEntries(LIN.map((id) => [id, { status: 'known' }])) } };
  assert.deepEqual(catchUpTargets({ ...fractions, prior: afterLin }), []);
  assert.equal(catchUpName(fractions.config, ['frac.multiply', 'alg.order-ops']), null);
});

test('catch-up: asks only about the new skills, and the result keeps everything from before', () => {
  const { student, prior } = earlier({ lacks: ['frac.add-sub.combine'], misconceptions: ['frac.add-across'] });
  const targets = catchUpTargets({ ...fractions, prior }).filter((t) => t.startsWith('frac.'));
  const result = runWithStudent(startDiagnostic({ ...fractions, config: { ...fractions.config, targets }, seed: 'catch', prior }), student);
  assert.ok(result.questions.every((q) => !q.generator.startsWith('frac.add-sub')), 'nothing about adding asked again');
  assert.equal(result.nodes['frac.add-sub.combine'].status, 'gap', 'the old gap is still there');
  assert.ok(result.misconceptions['frac.add-across'] >= 1, 'old wrong-answer patterns kept');
  assert.equal(result.skills['frac.multiply'], 'known');
  // multiply, divide, compare, and the sign and multiply/divide parts of negative fractions
  // (adding with negatives rests on the adding gap found the first time: not asked).
  assert.equal(result.questionCount, 5);
  assert.ok(result.nodes['frac.signed.add-sub'].blockedBy);
});

test('catch-up: a gap found the first time blocks new questions that rest on it', () => {
  const { student, prior } = earlier({ lacks: ['whole.mult-div.mult-facts'] });
  assert.equal(prior.nodes['whole.mult-div.mult-facts'].status, 'gap');
  const targets = catchUpTargets({ ...fractions, prior });
  const result = runWithStudent(startDiagnostic({ ...fractions, config: { ...fractions.config, targets }, seed: 'catch', prior }), student);
  assert.ok(!result.questions.some((q) => q.generator === 'whole.mult-div.mult-facts'), 'facts not asked again');
  assert.ok(result.nodes['frac.multiply.by-fraction'].blockedBy);
  assert.ok(result.questionCount <= 12, `took ${result.questionCount}`);
});

test('a saved (compact) result is what the path needs, without re-running anything', () => {
  const full = diagnose({ lacks: [SUB('combine')] }).result;
  const saved = compactResult(full);
  assert.deepEqual(saved.rootGaps, full.rootGaps);
  assert.deepEqual(Object.fromEntries(Object.entries(saved.nodes).map(([k, v]) => [k, v.status])), Object.fromEntries(Object.entries(full.nodes).map(([k, v]) => [k, v.status])));
  assert.equal(saved.questions.length, full.questionCount);
  assert.ok(!JSON.stringify(saved).includes('evidence'));
});

test('looking under a simplifying gap: only factors and GCF are checked, not primes or LCM', () => {
  const { result } = diagnose({ lacks: ['frac.equivalent.simplify'] });
  const asked = new Set(result.questions.map((q) => q.generator));
  assert.ok(asked.has('whole.factors-multiples.factors') || result.nodes['whole.factors-multiples.factors']);
  assert.ok(!asked.has('whole.factors-multiples.primes'));
  assert.ok(!asked.has('whole.factors-multiples.lcm'));
  // ...and the owner's rule still holds: no division facts credited by fraction work.
  assert.equal(statusOf(diagnose({}).result, 'whole.mult-div.div-facts'), 'not-tested');
});

// ---------- the pre-algebra check (taken after the fractions check) ----------

function preAlgebra(traits) {
  const student = simulatedStudent({ graph: fractions.graph, generators: fractions.generators, ...traits });
  const prior = compactResult(runWithStudent(startDiagnostic({ ...fractions, seed: 'first' }), student));
  const targets = catchUpTargets({ ...fractions, prior });
  return runWithStudent(startDiagnostic({ ...fractions, config: { ...fractions.config, targets }, seed: 'pre', prior }), student);
}

test('pre-algebra check: knows everything -> one problem each for order of operations, powers, evaluating, equations, expressions, multi-step equations and inequalities, plus the negative-number parts', () => {
  const result = preAlgebra({});
  assert.deepEqual(result.rootGaps, []);
  assert.equal(result.skills['alg.evaluate'], 'known');
  assert.equal(result.questionCount, 10);
  assert.equal(result.skills['alg.multi-step'], 'known');
  assert.equal(result.skills['alg.inequalities'], 'known');
  assert.equal(result.skills['alg.expressions'], 'known');
  assert.equal(result.skills['alg.equations'], 'known');
  assert.equal(result.skills['alg.order-ops'], 'known');
  assert.equal(result.skills['alg.exponents'], 'known');
  assert.ok(result.questions.every((q) => q.generator.startsWith('alg.')), 'nothing from the fractions check asked again');
});

test('pre-algebra check: works left to right (2 + 3 × 4 = 20) -> gap on the order of operations, found and named', () => {
  const result = preAlgebra({ lacks: ['alg.order-ops.no-parens'], misconceptions: ['alg.ops-left-to-right'] });
  assert.deepEqual(result.rootGaps, ['alg.order-ops.no-parens']);
  assert.ok(result.misconceptions['alg.ops-left-to-right'] >= 1);
  // Parentheses and powers-in-expressions rest on it: "can't check yet", not asked.
  assert.ok(result.nodes['alg.order-ops.parens'].blockedBy || result.nodes['alg.order-ops.parens'].status === 'not-tested');
  assert.equal(statusOf(result, 'alg.exponents.evaluate'), 'known');
  assert.ok(result.questionCount <= 9, `took ${result.questionCount}`);
});

test('pre-algebra check: can\'t multiply integers -> the negative-number parts lead back to integer multiplying', () => {
  const result = preAlgebra({ lacks: ['int.mult-div.multiply'] });
  assert.ok(result.rootGaps.includes('int.mult-div.multiply'), JSON.stringify(result.rootGaps));
  assert.equal(statusOf(result, 'alg.order-ops.no-parens'), 'known');
});

// ---------- quick re-check after a foundation gap is fixed ----------

const { lessons } = loadClassSetup();

test('re-check: nothing fixed yet -> nothing to re-check', () => {
  const prior = compactResult(diagnose({ lacks: ['whole.mult-div.mult-facts'] }).result);
  assert.deepEqual(fixedGaps({ graph: fractions.graph, prior, summary: { sectionsPassed: [] }, lessons }), []);
});

test('re-check: once facts are fixed, everything that waited on them is reopened (chains too), foundations first', () => {
  const prior = compactResult(diagnose({ lacks: ['whole.mult-div.mult-facts'] }).result);
  assert.ok(prior.nodes['frac.multiply.by-fraction'].blockedBy, 'multiplying fractions waited on facts');
  assert.ok(prior.nodes['frac.divide.multiply-reciprocal'].blockedBy, 'dividing waited on multiplying');
  const fixed = fixedGaps({ graph: fractions.graph, prior, summary: { sectionsPassed: ['whole.mult-div.mult-facts'] }, lessons });
  assert.deepEqual(fixed, ['whole.mult-div.mult-facts']);
  const plan = recheckPlan({ graph: fractions.graph, generators: fractions.generators, prior, fixed });
  assert.ok(plan.targets.includes('frac.multiply') && plan.targets.includes('frac.divide'), plan.targets.join());
  assert.ok(plan.targets.indexOf('frac.multiply') < plan.targets.indexOf('frac.divide'), 'what dividing builds on comes first');
  assert.equal(plan.prior.nodes['whole.mult-div.mult-facts'].status, 'known');
  assert.equal(plan.prior.nodes['frac.divide.multiply-reciprocal'].blockedBy, undefined);
  // The student now knows their facts: the re-check finds that, without asking about facts again.
  const now = simulatedStudent({ graph: fractions.graph, generators: fractions.generators });
  const result = runWithStudent(startDiagnostic({ ...fractions, config: { ...fractions.config, targets: plan.targets }, seed: 're', prior: plan.prior }), now);
  assert.ok(!result.questions.some((q) => q.generator === 'whole.mult-div.mult-facts'));
  assert.equal(result.skills['frac.multiply'], 'known');
  assert.ok(result.questionCount <= 12, `took ${result.questionCount}`);
});

test('re-check: a gap counts as fixed by passing its section, mastering its skill, or the teacher\'s check', () => {
  const prior = { nodes: { 'whole.mult-div.mult-facts': { status: 'gap' }, 'frac.add-sub.combine': { status: 'gap' }, 'whole.add-sub.add-regroup': { status: 'gap' } } };
  const f = (summary) => fixedGaps({ graph: fractions.graph, prior, summary, lessons }).sort();
  assert.deepEqual(f({ mastered: ['frac.add-sub'] }), ['frac.add-sub.combine']);
  assert.deepEqual(f({ cleared: ['whole.add-sub.add-regroup'] }), ['whole.add-sub.add-regroup']);
  assert.deepEqual(f({ sectionsPassed: ['whole.mult-div.mult-facts'] }), ['whole.mult-div.mult-facts']);
});

test('pre-algebra check: does the operation instead of undoing it (x + 5 = 12 -> 17) -> gap on undoing adding, two steps can\'t be checked yet', () => {
  const result = preAlgebra({ lacks: ['alg.equations.add-sub'], misconceptions: ['alg.eq-add-same-op'] });
  assert.ok(result.rootGaps.includes('alg.equations.add-sub'), JSON.stringify(result.rootGaps));
  assert.equal(statusOf(result, 'alg.equations.mult-div'), 'known');
});

test('pre-algebra check: can\'t divide integers -> found under undoing multiplication', () => {
  const result = preAlgebra({ lacks: ['int.mult-div.divide'] });
  assert.ok(result.rootGaps.includes('int.mult-div.divide'), JSON.stringify(result.rootGaps));
});

test('pre-algebra check: 3(x + 4) = 3x + 4 -> gap on the distributive property; combining like terms still checked', () => {
  const result = preAlgebra({ lacks: ['alg.expressions.distribute'], misconceptions: ['alg.expr-first-only'] });
  assert.ok(result.rootGaps.includes('alg.expressions.distribute'), JSON.stringify(result.rootGaps));
  assert.equal(statusOf(result, 'alg.expressions.like-terms'), 'known');
});
