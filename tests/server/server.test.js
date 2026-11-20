// The server's work, against an in-memory store: sign-in, server-side
// re-grading, no rerolls, no duplicate saves, teachers see only their classes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../server/core/server.js';
import { createMemoryStore } from '../../server/core/store-memory.js';
import { seedFor } from '../../engine/seeds.js';
import { startDiagnostic, catchUpTargets } from '../../engine/diagnostic/diagnostic.js';
import { startPractice } from '../../engine/practice/practice.js';
import { reduce } from '../../engine/math/fraction.js';
import { createRng } from '../../engine/random.js';
import { loadClassSetup } from '../helpers/class-setup.js';

const setup = loadClassSetup();
const T1 = 'teacher1@school.org';
const T2 = 'teacher2@school.org';

function fresh() {
  const store = createMemoryStore({ teachers: [T1, T2] });
  const rng = createRng('server-test');
  const server = createServer({ store, setup, now: () => '2026-11-20T10:00:00.000Z', random: rng.next });
  const cls = server.teacher.addClass(T1, 'Period 1').class;
  const [kid] = server.teacher.addStudents(T1, cls.id, ['Pretend Kid']).students;
  return { store, server, cls, kid };
}

const right = (problem) => {
  const a = problem.answer;
  if (a.type === 'choice') return { choice: a.correct };
  if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
  if (a.type === 'common-multiple') return { whole: a.least };
  const v = reduce(a.value);
  return { ...(v.d === 1 ? { whole: Math.abs(v.n) } : { num: Math.abs(v.n), den: v.d }), ...(v.n < 0 ? { negative: true } : {}) };
};

// A finished diagnostic record, answered by a student who gets everything right.
function diagnosticRecord(studentId, attemptNo = 1, answerFor = right) {
  const seed = seedFor(studentId, 'diagnostic', attemptNo);
  const d = startDiagnostic({ graph: setup.graph, generators: setup.generators, misconceptions: setup.misconceptions, config: setup.diagnosticConfig, seed });
  const answers = [];
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) {
    const a = answerFor(q.problem);
    answers.push(a);
    d.submit(a);
  }
  return { type: 'diagnostic', saveId: `diag-${studentId}-${attemptNo}`, attemptNo, seed, answers, times: answers.map(() => 20000), startedAt: 'a', finishedAt: 'b' };
}

function sectionRecord(studentId, section, attemptNo = 1, answerFor = right) {
  const sec = setup.lessons.flatMap((l) => l.sections).find((s) => s.id === section);
  const seed = seedFor(studentId, section, attemptNo);
  const p = startPractice({ generators: setup.generators, rules: setup.rules, seed, plan: { generator: sec.generator, mode: sec.mode } });
  const answers = [];
  for (let c = p.currentProblem(); c; c = p.currentProblem()) {
    const a = answerFor(c.problem);
    answers.push(a);
    p.submit(a);
  }
  return { type: 'lesson-section', saveId: `${section}-${attemptNo}`, section, attemptNo, seed, answers, times: [], startedAt: 'a', finishedAt: 'b' };
}

test('sign in with the code (any capitals or spaces); a wrong code is refused', () => {
  const { server, kid } = fresh();
  const ok = server.student.login(`  ${kid.code.toUpperCase()} `);
  assert.equal(ok.student.id, kid.id);
  assert.equal(ok.summary.diagnostic, null);
  assert.equal(server.student.login('nope-nope-11').error, 'unknown-code');
});

test('a diagnostic save is re-graded by the server and recorded with per-subskill verdicts', () => {
  const { server, store, kid } = fresh();
  const res = server.student.saveRecord(kid.code, diagnosticRecord(kid.id));
  assert.equal(res.ok, true);
  assert.equal(res.summary.diagnosticAttempts, 1);
  const [row] = store.data.records.diagnostics;
  assert.equal(row.verdicts['frac.add-sub.combine'], 'known');
  assert.equal(row.curriculumVersion, setup.graph.curriculumVersion);
});

test('the same save sent twice (a retry after a dropped connection) is stored once', () => {
  const { server, store, kid } = fresh();
  const rec = diagnosticRecord(kid.id);
  server.student.saveRecord(kid.code, rec);
  const again = server.student.saveRecord(kid.code, rec);
  assert.equal(again.duplicate, true);
  assert.equal(store.data.records.diagnostics.length, 1);
});

test('no rerolls: a seed the server didn\'t issue, or a skipped attempt number, is refused', () => {
  const { server, kid } = fresh();
  const forged = { ...diagnosticRecord(kid.id), seed: 'my-easy-seed' };
  assert.equal(server.student.saveRecord(kid.code, forged).error, 'wrong-seed');
  const skipped = sectionRecord(kid.id, 'frac.add-sub.combine', 2);
  assert.equal(server.student.saveRecord(kid.code, skipped).error, 'wrong-attempt');
});

test('the server\'s grading wins: a section claiming "passed" with wrong answers is stored as not passed', () => {
  const { server, store, kid } = fresh();
  const wrongAll = sectionRecord(kid.id, 'frac.add-sub.combine', 1, () => ({}));
  const res = server.student.saveRecord(kid.code, { ...wrongAll, passed: true, endedBy: 'passed' });
  assert.equal(res.ok, true);
  assert.equal(res.result.passed, false);
  assert.equal(store.data.records.sections[0].passed, false);
  assert.deepEqual(res.summary.sectionsPassed, []);
});

test('passing sections and mastering the skill update the student\'s summary (what sign-in returns)', () => {
  const { server, kid } = fresh();
  server.student.saveRecord(kid.code, sectionRecord(kid.id, 'frac.add-sub.combine'));
  server.student.saveRecord(kid.code, sectionRecord(kid.id, 'frac.add-sub.whole'));
  const s = server.student.login(kid.code).summary;
  assert.deepEqual(s.sectionsPassed, ['frac.add-sub.combine', 'frac.add-sub.whole']);
  assert.deepEqual(s.mastered, ['frac.add-sub']);
  assert.equal(s.sectionAttempts['frac.add-sub.combine'], 1);
});

test('an unfinished section or a made-up answer list is refused', () => {
  const { server, kid } = fresh();
  const rec = sectionRecord(kid.id, 'frac.add-sub.combine');
  assert.equal(server.student.saveRecord(kid.code, { ...rec, answers: rec.answers.slice(0, 2) }).error, 'not-finished');
});

test('teachers see only their own classes, and can\'t act on other teachers\' students', () => {
  const { server, kid } = fresh();
  const other = server.teacher.addClass(T2, 'Period 4').class;
  server.teacher.addStudents(T2, other.id, ['Someone Else']);
  const mine = server.teacher.teacherData(T1);
  assert.equal(mine.students.length, 1);
  assert.equal(mine.roster[0].realName, 'Pretend Kid');
  assert.equal(server.teacher.teacherData(T2).students.length, 1);
  assert.equal(server.teacher.resetCode(T2, kid.id).error, 'not-your-student');
  assert.equal(server.teacher.addStudents(T2, mine.classes[0].id, ['x']).error, 'not-your-class');
  assert.equal(server.teacher.teacherData('student@school.org').error, 'not-a-teacher');
});

test('code reset: the old code stops working, the work stays with the student', () => {
  const { server, kid } = fresh();
  server.student.saveRecord(kid.code, diagnosticRecord(kid.id));
  const { code } = server.teacher.resetCode(T1, kid.id);
  assert.equal(server.student.login(kid.code).error, 'unknown-code');
  assert.equal(server.student.login(code).summary.diagnosticAttempts, 1);
  const data = server.teacher.teacherData(T1);
  assert.equal(data.diagnostics[0].code, code, 'records are labelled with the current code');
  assert.ok(data.log.some((l) => l.what === 'Code reset' && l.by === T1), 'logged with who did it');
});

test('teacher clears a foundation check: the student\'s summary shows it; logged', () => {
  const { server, kid } = fresh();
  assert.equal(server.teacher.clearFoundation(T1, kid.id, 'whole.mult-div.mult-facts').ok, true);
  assert.deepEqual(server.student.login(kid.code).summary.cleared, ['whole.mult-div.mult-facts']);
  assert.equal(server.teacher.teacherData(T1).clearances.length, 1);
});

test('paper test: the server scores the marks (5 of 6 rule) and keeps the teacher\'s decision', () => {
  const { server, kid } = fresh();
  const res = server.teacher.verify(T1, { studentId: kid.id, skillId: 'frac.add-sub', version: 'A', marks: [1, 1, 1, 1, 0, 0], decision: 'verified' });
  assert.equal(res.verification.score, 4);
  assert.equal(res.verification.suggested, 'not-yet');
  assert.equal(res.verification.decision, 'verified');
  assert.equal(server.teacher.verify(T1, { studentId: kid.id, skillId: 'frac.add-sub', version: 'A', marks: [1, 1], decision: 'verified' }).error, 'bad-marks');
});

test('nickname: kept short, no email-looking characters', () => {
  const { server, kid } = fresh();
  assert.equal(server.student.setNickname(kid.code, 'Ace <script>@gmail.com').nickname, 'Ace scriptgmail.com');
  assert.equal(server.student.setNickname(kid.code, 'A really long nickname here ok').nickname.length, 20);
});

test('a quick review is re-graded as a review: a slip ends it, not passed; the next attempt is the full section', () => {
  const { server, kid } = fresh();
  const section = 'frac.add-sub.combine';
  const seed = seedFor(kid.id, section, 1);
  const p = startPractice({ generators: setup.generators, rules: setup.rules, seed, plan: { generator: section, mode: 'section', review: true } });
  const answers = [];
  for (let c = p.currentProblem(), i = 0; c; c = p.currentProblem(), i++) {
    const a = i === 0 ? {} : right(c.problem);
    answers.push(a);
    p.submit(a);
  }
  const res = server.student.saveRecord(kid.code, { type: 'lesson-section', saveId: 'rv1', section, attemptNo: 1, seed, answers, review: true });
  assert.equal(res.result.endedBy, 'review-missed');
  assert.equal(res.summary.sectionAttempts[section], 1);
  const full = sectionRecord(kid.id, section, 2);
  assert.equal(server.student.saveRecord(kid.code, full).result.passed, true);
});

test('send back to redo: platform mastery cleared, "Putting it together" not done, logged; other teachers can\'t', () => {
  const { server, kid } = fresh();
  server.student.saveRecord(kid.code, sectionRecord(kid.id, 'frac.add-sub.combine'));
  server.student.saveRecord(kid.code, sectionRecord(kid.id, 'frac.add-sub.whole'));
  assert.deepEqual(server.student.login(kid.code).summary.mastered, ['frac.add-sub']);
  assert.equal(server.teacher.resetSkill(T2, kid.id, 'frac.add-sub').error, 'not-your-student');
  const res = server.teacher.resetSkill(T1, kid.id, 'frac.add-sub');
  assert.equal(res.ok, true);
  const s = server.student.login(kid.code).summary;
  assert.deepEqual(s.mastered, []);
  assert.deepEqual(s.sectionsPassed, ['frac.add-sub.combine'], 'the one-step section stays done');
  assert.ok(s.resets['frac.add-sub']);
  const data = server.teacher.teacherData(T1);
  assert.equal(data.resets.length, 1);
  assert.ok(data.log.some((l) => /Sent back to redo/.test(l.what) && l.by === T1));
  // Redoing it: the next attempt is accepted and gives mastery again.
  server.student.saveRecord(kid.code, sectionRecord(kid.id, 'frac.add-sub.whole', 2));
  assert.deepEqual(server.student.login(kid.code).summary.mastered, ['frac.add-sub']);
});

test('practice for a check: re-graded, stored once, counted per skill; never changes mastery', () => {
  const { server, store, kid } = fresh();
  const skill = 'frac.add-sub';
  const seed = seedFor(kid.id, `practice:${skill}`, 1);
  const p = startPractice({ generators: setup.generators, rules: setup.rules, seed, plan: { generator: skill, mode: 'practice', difficulties: setup.rules.practice.difficulties } });
  const answers = [];
  for (let c = p.currentProblem(); c; c = p.currentProblem()) { answers.push(right(c.problem)); p.submit(answers.at(-1)); }
  const rec = { type: 'practice-set', saveId: 'pr1', skill, attemptNo: 1, seed, answers, times: answers.map(() => 30000) };
  const res = server.student.saveRecord(kid.code, rec);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.result.firstTry, 6);
  assert.deepEqual(res.summary.mastered, [], 'practice never gives mastery');
  assert.equal(res.summary.practiceAttempts[skill], 1);
  assert.equal(server.student.saveRecord(kid.code, rec).duplicate, true);
  assert.equal(store.data.records.practice.length, 1);
  assert.equal(server.student.saveRecord(kid.code, { ...rec, saveId: 'pr2', seed: 'easy' }).error, 'wrong-attempt');
  const data = server.teacher.teacherData(T1);
  assert.equal(data.practice.length, 1);
  assert.equal(data.practice[0].answers, undefined, 'the dashboard gets the summary only');
});

// ---------- saved results and the catch-up check ----------

// The diagnostic as it was before compare/multiply/divide had questions.
const oldSetup = { ...setup, diagnosticConfig: { ...setup.diagnosticConfig, targets: ['frac.add-sub'] } };

function answerAll(d, answerFor = right) {
  const answers = [];
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) {
    const a = answerFor(q.problem);
    answers.push(a);
    d.submit(a);
  }
  return answers;
}

// A student who took the old diagnostic, then the app gained skills (same store, newer server).
function tookOldDiagnostic() {
  const store = createMemoryStore({ teachers: [T1] });
  const old = createServer({ store, setup: oldSetup, now: () => '2026-11-19T10:00:00.000Z', random: createRng('old').next });
  const cls = old.teacher.addClass(T1, 'Period 1').class;
  const [kid] = old.teacher.addStudents(T1, cls.id, ['Pretend Kid']).students;
  const seed = seedFor(kid.id, 'diagnostic', 1);
  const answers = answerAll(startDiagnostic({ ...oldSetup, config: oldSetup.diagnosticConfig, seed }));
  assert.equal(old.student.saveRecord(kid.code, { type: 'diagnostic', saveId: 'd1', attemptNo: 1, seed, answers, times: [], startedAt: 'a', finishedAt: 'b' }).ok, true);
  const server = createServer({ store, setup, now: () => '2026-11-20T10:00:00.000Z', random: createRng('new').next });
  return { store, server, kid };
}

test('a diagnostic save keeps its whole result; the student\'s copy leaves out the question list', () => {
  const { server, store, kid } = fresh();
  const res = server.student.saveRecord(kid.code, diagnosticRecord(kid.id));
  assert.equal(res.summary.diagnostic.result.nodes['frac.add-sub.combine'].status, 'known');
  assert.equal(res.summary.diagnostic.result.questions, undefined);
  assert.equal(store.data.records.diagnostics[0].result.questions.length, store.data.records.diagnostics[0].questionCount);
});

test('older saves (verdicts only) get their result filled in at sign-in, once', () => {
  const { server, store, kid } = tookOldDiagnostic();
  // Make it look like it was saved before results were kept.
  delete store.data.records.diagnostics[0].result;
  const st = store.getStudentByCode(kid.code);
  delete st.summary.diagnostic.result;
  store.putStudent(st);
  const res = server.student.login(kid.code);
  assert.equal(res.summary.diagnostic.result.nodes['frac.add-sub.combine'].status, 'known');
  assert.ok(store.getStudentByCode(kid.code).summary.diagnostic.result, 'saved, so it isn\'t rebuilt every time');
});

test('catch-up check: only the new skills; re-graded from the saved result; the result covers both', () => {
  const { server, store, kid } = tookOldDiagnostic();
  const { summary } = server.student.login(kid.code);
  const prior = summary.diagnostic.result;
  const targets = catchUpTargets({ graph: setup.graph, generators: setup.generators, config: setup.diagnosticConfig, prior });
  assert.deepEqual(targets, ['frac.multiply', 'frac.divide', 'frac.signed', 'frac.compare']);
  const seed = seedFor(kid.id, 'diagnostic', 2);
  const d = startDiagnostic({ ...setup, config: { ...setup.diagnosticConfig, targets }, seed, prior });
  const answers = answerAll(d);
  assert.ok(answers.length <= 6);
  const res = server.student.saveRecord(kid.code, { type: 'diagnostic', catchUp: true, saveId: 'd2', attemptNo: 2, seed, answers, times: [], startedAt: 'a', finishedAt: 'b' });
  assert.equal(res.ok, true, res.message);
  const after = res.summary.diagnostic.result;
  assert.equal(after.nodes['frac.add-sub.combine'].status, 'known', 'the first check still counts');
  assert.equal(after.skills['frac.multiply'], 'known');
  assert.equal(res.summary.diagnostic.catchUp, true);
  assert.deepEqual(store.data.records.diagnostics.at(-1).targets, targets);
  // Nothing new any more: another catch-up is refused.
  const seed3 = seedFor(kid.id, 'diagnostic', 3);
  const again = server.student.saveRecord(kid.code, { type: 'diagnostic', catchUp: true, saveId: 'd3', attemptNo: 3, seed: seed3, answers: [], times: [] });
  assert.equal(again.error, 'nothing-to-catch-up');
});

test('catch-up answers re-graded as a full diagnostic (or the other way round) are refused', () => {
  const { server, kid } = tookOldDiagnostic();
  const prior = server.student.login(kid.code).summary.diagnostic.result;
  const targets = catchUpTargets({ graph: setup.graph, generators: setup.generators, config: setup.diagnosticConfig, prior });
  const seed = seedFor(kid.id, 'diagnostic', 2);
  const answers = answerAll(startDiagnostic({ ...setup, config: { ...setup.diagnosticConfig, targets }, seed, prior }));
  const res = server.student.saveRecord(kid.code, { type: 'diagnostic', saveId: 'd2', attemptNo: 2, seed, answers, times: [] });
  assert.ok(res.error, 'without catchUp: true the same answers don\'t make a finished full diagnostic');
});

test('dashboard overview: diagnostics without answers or the question list; the student\'s details have them', () => {
  const { server, kid } = fresh();
  server.student.saveRecord(kid.code, diagnosticRecord(kid.id));
  const [d] = server.teacher.teacherData(T1).diagnostics;
  assert.equal(d.answers, undefined);
  assert.equal(d.result.questions, undefined);
  assert.equal(d.result.nodes['frac.add-sub.combine'].status, 'known');
  const detail = server.teacher.studentDetail(T1, kid.id);
  assert.equal(detail.diagnostic.result.questions.length, detail.diagnostic.questionCount);
  assert.equal(detail.diagnostic.answers.length, detail.diagnostic.questionCount);
});
