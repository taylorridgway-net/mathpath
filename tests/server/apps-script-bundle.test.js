// Runs the REAL Apps Script bundle (the Code.js that gets uploaded to Google)
// against pretend Google services, to catch packaging mistakes before deploy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { bundleServer, ENTRY_POINTS } from '../../tools/bundle-server.js';
import { fakeSpreadsheet, fakeLockService } from '../helpers/fake-sheets.js';

const OWNER = 'teacher@school.org';

async function googleWorld() {
  const props = new Map();
  const spreadsheet = fakeSpreadsheet();
  spreadsheet.insertSheet('Sheet1');
  let activeUser = OWNER;
  const served = [];
  const context = vm.createContext({
    SpreadsheetApp: { create: () => spreadsheet, openById: (id) => (id === 'fake-sheet-id' ? spreadsheet : null) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    LockService: fakeLockService(),
    Session: { getEffectiveUser: () => ({ getEmail: () => OWNER }), getActiveUser: () => ({ getEmail: () => activeUser }) },
    Utilities: { getUuid: () => randomUUID() },
    HtmlService: {
      createHtmlOutputFromFile(name) {
        const out = { name, setTitle(t) { out.title = t; return out; }, addMetaTag() { return out; } };
        served.push(out);
        return out;
      },
    },
    Logger: { log() {} },
  });
  vm.runInContext(await bundleServer(), context);
  return { context, spreadsheet, served, setUser: (u) => { activeUser = u; } };
}

test('the bundle defines exactly the functions Google calls', async () => {
  const { context } = await googleWorld();
  for (const f of ENTRY_POINTS) assert.equal(typeof context[f], 'function', f);
});

test('before setup: a clear message, not a crash', async () => {
  const { context } = await googleWorld();
  const res = context.apiStudent('login', ['maple-tiger-42']);
  assert.equal(res.error, 'server');
  assert.match(res.message, /run setup\(\)/);
});

test('setup, then a teacher adds a class and students, and a student signs in', async () => {
  const { context, spreadsheet, setUser } = await googleWorld();
  context.setup();
  assert.ok(spreadsheet.getSheetByName('Students'), 'tabs made');
  assert.equal(spreadsheet.getSheetByName('Sheet1'), null, 'the empty default tab is removed');
  assert.equal(JSON.stringify(spreadsheet.getSheetByName('Teachers').rows.slice(1)), JSON.stringify([[OWNER]]), 'the owner is a teacher');

  const cls = context.apiTeacher('addClass', ['Period 3']).class;
  const added = context.apiTeacher('addStudents', [cls.id, ['Pretend One', 'Pretend Two']]);
  assert.equal(added.students.length, 2);
  const login = context.apiStudent('login', [added.students[0].code]);
  assert.equal(login.student.id, added.students[0].id);

  setUser('student@school.org');
  assert.equal(context.apiTeacher('teacherData', []).error, 'not-a-teacher', 'a student can\'t open teacher data');
  setUser('');
  assert.equal(context.apiTeacher('teacherData', []).error, 'not-a-teacher');
});

test('only the allowed calls get through', async () => {
  const { context } = await googleWorld();
  context.setup();
  assert.equal(context.apiStudent('teacherData', []).error, 'bad-call');
  assert.equal(context.apiTeacher('constructor', []).error, 'bad-call');
});

test('doGet serves the student page, or the dashboard with ?page=teacher', async () => {
  const { context, served } = await googleWorld();
  context.doGet({ parameter: {} });
  context.doGet({ parameter: { page: 'teacher' } });
  assert.equal(served.map((s) => s.name).join(','), 'student,teacher');
});
