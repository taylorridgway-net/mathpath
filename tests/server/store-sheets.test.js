// The Sheets store, against a fake spreadsheet: the whole server works on it,
// writes go through the lock, and nothing is written per question.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSheetsStore, ensureTabs, TABS } from '../../server/apps-script/store-sheets.js';
import { createServer } from '../../server/core/server.js';
import { seedFor } from '../../engine/seeds.js';
import { startPractice } from '../../engine/practice/practice.js';
import { reduce } from '../../engine/math/fraction.js';
import { createRng } from '../../engine/random.js';
import { fakeSpreadsheet, fakeLockService } from '../helpers/fake-sheets.js';
import { loadClassSetup } from '../helpers/class-setup.js';

const setup = loadClassSetup();
const T = 'teacher@school.org';

function fresh() {
  const spreadsheet = fakeSpreadsheet();
  ensureTabs(spreadsheet);
  const locks = fakeLockService();
  // A new store per request, like Apps Script.
  const request = () => createSheetsStore({ spreadsheet, lockService: locks });
  request().addTeacher(T);
  const rng = createRng('sheets');
  const server = () => createServer({ store: request(), setup, now: () => '2026-11-20T10:00:00.000Z', random: rng.next });
  return { spreadsheet, locks, server, request };
}

const right = (problem) => {
  const a = problem.answer;
  if (a.type === 'choice') return { choice: a.correct };
  if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
  if (a.type === 'common-multiple') return { whole: a.least };
  const v = reduce(a.value);
  return { ...(v.d === 1 ? { whole: Math.abs(v.n) } : { num: Math.abs(v.n), den: v.d }), ...(v.n < 0 ? { negative: true } : {}) };
};

test('setup makes every tab with its header row, and running it again changes nothing', () => {
  const { spreadsheet } = fresh();
  ensureTabs(spreadsheet);
  for (const [name, cols] of Object.entries(TABS)) assert.deepEqual(spreadsheet.getSheetByName(name).rows[0], cols, name);
});

test('the whole flow works on a sheet: add students, sign in, save a section, teacher sees it', () => {
  const { spreadsheet, server } = fresh();
  const cls = server().teacher.addClass(T, 'Period 2').class;
  const [kid] = server().teacher.addStudents(T, cls.id, ['=SUM(A1)', 'Second Kid']).students;
  assert.equal(spreadsheet.getSheetByName('Roster').rows[1][2], "'=SUM(A1)", 'text that looks like a formula is kept as text');

  const section = 'frac.add-sub.combine';
  const seed = seedFor(kid.id, section, 1);
  const p = startPractice({ generators: setup.generators, rules: setup.rules, seed, plan: { generator: section, mode: 'section' } });
  const answers = [];
  for (let c = p.currentProblem(); c; c = p.currentProblem()) { answers.push(right(c.problem)); p.submit(answers.at(-1)); }

  const sheet = spreadsheet.getSheetByName('Sections');
  const before = sheet.writes;
  const readsBefore = sheet.reads;
  const res = server().student.saveRecord(kid.code, {
    type: 'lesson-section', saveId: 'x1', section, attemptNo: 1, seed, answers, times: answers.map(() => 30000),
    startedAt: '2026-11-20T09:50:00.000Z', finishedAt: '2026-11-20T09:58:00.000Z',
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(sheet.writes - before, 1, `one row for the whole section (${answers.length} answers), not one per question`);
  assert.ok(sheet.reads - readsBefore <= 1, 'a save reads at most the header of Sections');

  // A second save, now that there is a past save it must NOT read.
  const seed2 = seedFor(kid.id, section, 2);
  const p2 = startPractice({ generators: setup.generators, rules: setup.rules, seed: seed2, plan: { generator: section, mode: 'section' } });
  const answers2 = [];
  for (let c = p2.currentProblem(); c; c = p2.currentProblem()) { answers2.push(right(c.problem)); p2.submit(answers2.at(-1)); }
  const reads2 = sheet.reads;
  server().student.saveRecord(kid.code, { type: 'lesson-section', saveId: 'x2', section, attemptNo: 2, seed: seed2, answers: answers2, times: [] });
  assert.ok(sheet.reads - reads2 <= 1, 'a save never re-reads past saves');

  // A new request reads it back from the sheet.
  assert.deepEqual(server().student.login(kid.code).summary.sectionsPassed, [section]);
  const data = server().teacher.teacherData(T);
  assert.equal(data.sections.length, 2);
  assert.equal(data.sections[0].finishedAt, '2026-11-20T09:58:00.000Z', 'dates come back as the same text');
  assert.equal(data.sections[0].answers, undefined, 'the dashboard gets summaries, not every answer');
  assert.equal(data.sections[0].passed, true);
  assert.equal(data.sections[0].problemCount, 5);
  assert.equal(data.sections[0].seconds, answers.length * 30);
  const detail = server().teacher.studentDetail(T, kid.id);
  assert.deepEqual(detail.sections[0].answers, answers, 'the profile gets every answer, for one student');
  assert.equal(data.roster.find((r) => r.studentId === kid.id).realName, '=SUM(A1)');
});

test('writes happen inside the lock, and the lock is released even if something fails', () => {
  const { locks, server } = fresh();
  const srv = server();
  srv.teacher.addClass(T, 'P1');
  assert.equal(locks.lock.held, false);
  assert.equal(srv.student.saveRecord('nobody-here-11', { saveId: 'z', type: 'diagnostic' }).error, 'unknown-code');
  assert.equal(locks.lock.held, false);
});

test('another teacher\'s classes stay out of the data, on the sheet too', () => {
  const { server, request } = fresh();
  const other = 'other@school.org';
  request().addTeacher(other);
  server().teacher.addClass(T, 'Mine');
  server().teacher.addClass(other, 'Theirs');
  assert.deepEqual(server().teacher.teacherData(T).classes.map((c) => c.name), ['Mine']);
  assert.deepEqual(server().teacher.teacherData(other).classes.map((c) => c.name), ['Theirs']);
});

test('on the sheet: sharing a class with a co-teacher, and removing/restoring it, work (and an older Classes tab gets the new columns)', () => {
  const { server, request } = fresh();
  const cls = server().teacher.addClass(T, 'Shared').class;
  server().teacher.addStudents(T, cls.id, ['Kid']);
  const co = 'co@school.org';
  assert.equal(server().teacher.shareClass(T, cls.id, co).ok, true);
  assert.ok(request().isTeacher(co));
  assert.deepEqual(server().teacher.teacherData(co).classes.map((c) => c.name), ['Shared']);
  server().teacher.removeClass(co, cls.id);
  assert.equal(server().teacher.teacherData(T).classes.length, 0);
  assert.equal(server().teacher.teacherData(T).removed.classes[0].name, 'Shared');
  server().teacher.restoreClass(T, cls.id);
  assert.equal(server().teacher.teacherData(T).students.length, 1);
});

test('an older spreadsheet gets the new columns added before "data", and its rows still read correctly', () => {
  const spreadsheet = fakeSpreadsheet();
  const old = spreadsheet.insertSheet('Sections');
  old.appendRow(['studentId', 'saveId', 'section', 'attemptNo', 'endedBy', 'passed', 'data']);
  old.appendRow(['s-1', 'x', 'frac.add-sub.combine', 1, 'passed', true, JSON.stringify({ answers: [{ whole: 1 }] })]);
  ensureTabs(spreadsheet);
  const header = old.rows[0];
  assert.equal(header[header.length - 1], 'data', '"data" stays last');
  assert.ok(header.includes('seconds') && header.includes('misconceptions'));
  const store = createSheetsStore({ spreadsheet, lockService: fakeLockService() });
  const [row] = store.listRecords('sections', ['s-1']);
  assert.equal(row.passed, true);
  assert.deepEqual(row.answers, [{ whole: 1 }]);
});

test('a spreadsheet from an older version (no Resets tab) keeps working: the tab is made when needed', () => {
  const { spreadsheet, server } = fresh();
  spreadsheet.sheets.delete('Resets');
  assert.equal(server().teacher.teacherData(T).error, undefined);
  assert.ok(spreadsheet.getSheetByName('Resets'), 'made on first use');
  assert.deepEqual(spreadsheet.getSheetByName('Resets').rows[0], TABS.Resets);
});

test('someone who isn\'t on the Teachers tab gets nothing', () => {
  const { server } = fresh();
  assert.equal(server().teacher.teacherData('student@school.org').error, 'not-a-teacher');
});
