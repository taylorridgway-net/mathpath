// A class's course on the server: the teacher sets it and opens skills as they're taught;
// students get what their class holds back at sign-in; catch-up checks are re-graded with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../server/core/server.js';
import { createMemoryStore } from '../../server/core/store-memory.js';
import { seedFor } from '../../engine/seeds.js';
import { startDiagnostic, catchUpTargets } from '../../engine/diagnostic/diagnostic.js';
import { simulatedStudent } from '../../tools/simulated-student.js';
import { createRng } from '../../engine/random.js';
import { loadClassSetup } from '../helpers/class-setup.js';

const setup = loadClassSetup();
const T1 = 'teacher1@school.org';
const T2 = 'teacher2@school.org';
const knowsAll = simulatedStudent({ graph: setup.graph, generators: setup.generators });

function fresh() {
  const store = createMemoryStore({ teachers: [T1, T2] });
  const server = createServer({ store, setup, now: () => '2026-11-21T10:00:00.000Z', random: createRng('courses').next });
  const cls = server.teacher.addClass(T1, 'Period 2').class;
  const [kid] = server.teacher.addStudents(T1, cls.id, ['Pretend Kid']).students;
  return { store, server, cls, kid };
}
function run(d) {
  const answers = [];
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) { const a = knowsAll.answer(q.problem); answers.push(a); d.submit(a); }
  return answers;
}
function diagnose(server, kid, attemptNo, targets = null, prior = null) {
  const seed = seedFor(kid.id, 'diagnostic', attemptNo);
  const config = targets ? { ...setup.diagnosticConfig, targets } : setup.diagnosticConfig;
  const answers = run(startDiagnostic({ ...setup, config, seed, prior }));
  return server.student.saveRecord(kid.code, { type: 'diagnostic', saveId: `d${attemptNo}`, attemptNo, seed, answers, times: [], startedAt: 'a', finishedAt: 'b', ...(prior ? { catchUp: true } : {}) });
}

test('set a course: students get what it holds back at sign-in; opening a skill lets it through; logged', () => {
  const { server, store, cls, kid } = fresh();
  assert.deepEqual(server.student.login(kid.code).summary.held, [], 'no course: nothing held back');
  assert.equal(server.teacher.setCourse(T1, cls.id, 'im1').ok, true);
  let held = server.student.login(kid.code).summary.held;
  assert.ok(held.includes('alg.systems') && held.includes('lin.slope') && held.includes('poly.factor'));
  assert.equal(server.teacher.openSkill(T1, cls.id, 'alg.systems', true).ok, true);
  held = server.student.login(kid.code).summary.held;
  assert.ok(!held.includes('alg.systems'));
  assert.equal(server.teacher.openSkill(T1, cls.id, 'alg.systems', false).ok, true);
  assert.ok(server.student.login(kid.code).summary.held.includes('alg.systems'), 'held back again');
  const log = store.data.records.log.map((r) => r.what);
  assert.ok(log.includes('Class course set to Integrated Math 1'));
  assert.ok(log.some((w) => /Systems of equations: opened/.test(w)));
  assert.equal(server.teacher.teacherData(T1).classes[0].course, 'im1');
});

test('only the class\'s own teachers can change it; unknown courses and skills are refused', () => {
  const { server, cls } = fresh();
  assert.equal(server.teacher.setCourse(T2, cls.id, 'im1').error, 'not-your-class');
  assert.equal(server.teacher.openSkill(T2, cls.id, 'alg.systems').error, 'not-your-class');
  assert.equal(server.teacher.setCourse(T1, cls.id, 'algebra-9').error, 'bad-course');
  assert.equal(server.teacher.openSkill(T1, cls.id, 'nope.skill').error, 'bad-skill');
  assert.equal(server.teacher.setCourse('stranger@x.org', cls.id, 'im1').error, 'not-a-teacher');
});

test('catch-up checks are re-graded with what the class holds back (the server works it out itself)', () => {
  const { server, cls, kid } = fresh();
  server.teacher.setCourse(T1, cls.id, 'im1');
  let res = diagnose(server, kid, 1);
  assert.equal(res.ok, true);
  let held = res.summary.held;
  // Walk the later checks, one at a time, the way the student's device does.
  const asked = [];
  for (let attempt = 2; attempt < 20; attempt++) {
    const prior = res.summary.diagnostic.result;
    const targets = catchUpTargets({ graph: setup.graph, generators: setup.generators, config: setup.diagnosticConfig, prior, held });
    if (!targets.length) break;
    asked.push(...targets);
    res = diagnose(server, kid, attempt, targets, prior);
    assert.equal(res.ok, true, `${targets}: ${res.message}`);
    held = res.summary.held;
  }
  assert.ok(asked.includes('alg.multi-step') && asked.includes('stat.prob'), 'everything else is still checked');
  assert.ok(!asked.includes('alg.systems') && !asked.some((id) => id.startsWith('lin.') || id.startsWith('poly.')), 'IM1: nothing it hasn\'t taught yet');
  // Opening systems makes it the next check.
  server.teacher.openSkill(T1, cls.id, 'alg.systems', true);
  const login = server.student.login(kid.code).summary;
  assert.deepEqual(catchUpTargets({ graph: setup.graph, generators: setup.generators, config: setup.diagnosticConfig, prior: login.diagnostic.result, held: login.held }), ['alg.systems']);
});
