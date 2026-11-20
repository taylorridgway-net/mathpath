// The Apps Script entry point. tools/build.js bundles this (with the engine and
// curriculum) into dist/apps-script/Code.js. Kept thin on purpose: it serves
// the two pages and passes requests to server/core/server.js.
//
// Functions Google calls:
//   setup()                    run ONCE by hand from the Apps Script editor: makes the
//                              spreadsheet and adds you as a teacher
//   speedCheck()               run by hand: times the spreadsheet steps a save makes,
//                              on a scratch tab it deletes again (no real data touched)
//   doGet(e)                   serves the student page, or the dashboard with ?page=teacher
//   apiStudent(name, args)     student requests (sign in, save); students need no Google account
//   apiTeacher(name, args)     teacher requests; Google tells us who is signed in

import domainsIndex from '../../curriculum/graph/domains.json';
import wholeGraph from '../../curriculum/graph/whole.json';
import intGraph from '../../curriculum/graph/int.json';
import fracGraph from '../../curriculum/graph/frac.json';
import fracMisconceptions from '../../curriculum/misconceptions/frac.json';
import wholeMisconceptions from '../../curriculum/misconceptions/whole.json';
import fracDiagnostic from '../../curriculum/diagnostic/frac.json';
import addSubLesson from '../../curriculum/lessons/frac.add-sub.json';
import equivalentLesson from '../../curriculum/lessons/frac.equivalent.json';
import compareLesson from '../../curriculum/lessons/frac.compare.json';
import multiplyLesson from '../../curriculum/lessons/frac.multiply.json';
import meaningLesson from '../../curriculum/lessons/frac.meaning.json';
import wholeAddSubLesson from '../../curriculum/lessons/whole.add-sub.json';
import wholeMultDivLesson from '../../curriculum/lessons/whole.mult-div.json';
import wholeFactorsLesson from '../../curriculum/lessons/whole.factors-multiples.json';
import masteryRules from '../../curriculum/mastery.json';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators } from '../../engine/generators/index.js';
import { createServer } from '../core/server.js';
import { createSheetsStore, ensureTabs } from './store-sheets.js';

/* global SpreadsheetApp, LockService, PropertiesService, HtmlService, Session, Utilities, Logger */

const SHEET_ID_KEY = 'MATHPATH_SPREADSHEET_ID';
const STUDENT_CALLS = ['login', 'saveRecord', 'setNickname'];
const TEACHER_CALLS = ['teacherData', 'studentDetail', 'addClass', 'addStudents', 'resetCode', 'clearFoundation', 'resetSkill', 'verify'];

const setupData = {
  graph: buildGraphIndex(domainsIndex, { 'whole.json': wholeGraph, 'int.json': intGraph, 'frac.json': fracGraph }),
  generators,
  misconceptions: [...fracMisconceptions.misconceptions, ...wholeMisconceptions.misconceptions],
  diagnosticConfig: fracDiagnostic,
  lessons: [wholeAddSubLesson, wholeMultDivLesson, wholeFactorsLesson, meaningLesson, equivalentLesson, compareLesson, addSubLesson, multiplyLesson],
  rules: masteryRules.default,
};

// Random numbers for codes and ids, from Google's UUID generator (not guessable).
function random() {
  return parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) / 2 ** 48;
}

function openSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty(SHEET_ID_KEY);
  if (!id) throw new Error('Not set up yet: open the Apps Script editor and run setup() once.');
  return SpreadsheetApp.openById(id);
}

function server() {
  const store = createSheetsStore({ spreadsheet: openSpreadsheet(), lockService: LockService });
  return createServer({ store, setup: setupData, random });
}

export function setup() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheet;
  const existing = props.getProperty(SHEET_ID_KEY);
  if (existing) spreadsheet = SpreadsheetApp.openById(existing);
  else {
    spreadsheet = SpreadsheetApp.create('MathPath data (private)');
    props.setProperty(SHEET_ID_KEY, spreadsheet.getId());
  }
  ensureTabs(spreadsheet);
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  createSheetsStore({ spreadsheet, lockService: LockService }).addTeacher(me);
  const sheet1 = spreadsheet.getSheetByName('Sheet1');
  if (sheet1 && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(sheet1);
  Logger.log(`MathPath is set up. Data spreadsheet: ${spreadsheet.getUrl()}  Teacher: ${me}`);
  return spreadsheet.getUrl();
}

// How long the spreadsheet steps of one save take on Google, for the load test
// (npm run load-test -- --save-ms N). Uses a scratch tab, then deletes it.
export function speedCheck() {
  const ms = {};
  const time = (name, fn) => {
    const t = Date.now();
    const out = fn();
    ms[name] = Date.now() - t;
    return out;
  };
  const spreadsheet = time('open the spreadsheet', openSpreadsheet);
  const students = spreadsheet.getSheetByName('Students');
  time('read the Students tab', () => students.getRange(1, 1, Math.max(1, students.getLastRow()), students.getLastColumn()).getValues());
  const scratch = spreadsheet.insertSheet(`SpeedCheck ${Date.now()}`);
  try {
    time('read a header row', () => scratch.getLastRow());
    time('add a row', () => scratch.appendRow(['speed', 'check', JSON.stringify({ answers: new Array(30).fill({ num: 3, den: 4 }) })]));
    time('update a row', () => scratch.getRange(1, 1, 1, 3).setValues([['speed', 'check', 'again']]));
    time('take and release the lock', () => {
      const lock = LockService.getScriptLock();
      lock.waitLock(25000);
      lock.releaseLock();
    });
  } finally {
    spreadsheet.deleteSheet(scratch);
  }
  // A save: open + read Students + read Sections header + add a row + update the student row, inside the lock.
  const save = ms['open the spreadsheet'] + ms['read the Students tab'] + ms['read a header row'] + ms['add a row'] + ms['update a row'] + ms['take and release the lock'];
  const lines = Object.entries(ms).map(([k, v]) => `${k}: ${v} ms`);
  Logger.log(`${lines.join('\n')}\nOne save takes about ${save} ms. Tell Claude this number (for npm run load-test -- --save-ms ${save}).`);
  return { ...ms, save };
}

export function doGet(e) {
  const teacher = e && e.parameter && e.parameter.page === 'teacher';
  return HtmlService.createHtmlOutputFromFile(teacher ? 'teacher' : 'student')
    .setTitle(teacher ? 'MathPath Teacher' : 'MathPath')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

export function apiStudent(name, args) {
  if (!STUDENT_CALLS.includes(name)) return { error: 'bad-call', message: name };
  return guarded(() => server().student[name](...(args || [])));
}

export function apiTeacher(name, args) {
  if (!TEACHER_CALLS.includes(name)) return { error: 'bad-call', message: name };
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) return { error: 'not-a-teacher', message: 'Sign in to Google with your school account to open the dashboard.' };
  return guarded(() => server().teacher[name](email, ...(args || [])));
}

// Never let an error escape as a crash page; the browser keeps the work and retries.
function guarded(fn) {
  try {
    return fn();
  } catch (e) {
    const busy = /lock/i.test(String(e && e.message));
    return { error: busy ? 'busy' : 'server', message: String((e && e.message) || e) };
  }
}
