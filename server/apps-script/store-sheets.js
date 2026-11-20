// The store, on a Google Sheet. The ONLY file that reads or writes the Sheet.
// Same interface as server/core/store-memory.js, so it can be swapped for
// Firebase/Supabase later without touching anything else.
//
// One tab per kind of data, with a header row. Columns a teacher might want to
// look at are their own columns; everything else about a record goes in a
// "data" column as JSON (one row per finished section, never per question).
//
// Every write happens inside withLock (LockService), so two students saving at
// the same moment can't overwrite each other. Each tab is read at most once per
// request (and again after taking the lock, in case someone else just wrote).
//
// spreadsheet: a SpreadsheetApp Spreadsheet. lockService: Apps Script's LockService.
// (Both are passed in, so tests can use fakes.)

export const TABS = {
  Teachers: ['email'],
  Classes: ['id', 'name', 'teacherEmail', 'createdAt'],
  Students: ['id', 'code', 'nickname', 'classId', 'createdAt', 'retired', 'summary'],
  Roster: ['studentId', 'classId', 'realName'],
  Diagnostics: ['studentId', 'saveId', 'attemptNo', 'seed', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'questionCount', 'rootGaps', 'data'],
  // Summary columns first (what the dashboard reads); the bulky answers stay in "data".
  Sections: ['studentId', 'saveId', 'lesson', 'section', 'attemptNo', 'review', 'endedBy', 'passed', 'provisionalMastery',
    'problemCount', 'firstTry', 'seconds', 'misconceptions', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'data'],
  Verifications: ['studentId', 'skillId', 'version', 'score', 'outOf', 'suggested', 'decision', 'attempt', 'by', 'at', 'marks'],
  Clearances: ['studentId', 'gap', 'by', 'at'],
  Resets: ['studentId', 'skillId', 'by', 'at'],
  Log: ['at', 'by', 'studentId', 'what', 'before', 'after'],
};
const JSON_COLUMNS = new Set(['summary', 'data', 'rootGaps', 'marks', 'misconceptions']);
const BOOLEAN_COLUMNS = new Set(['retired', 'review', 'passed', 'provisionalMastery']);
const KIND_TAB = { diagnostics: 'Diagnostics', sections: 'Sections', verifications: 'Verifications', clearances: 'Clearances', resets: 'Resets', log: 'Log' };

// Make the tabs (with header rows) if they don't exist yet, and add any columns
// a newer version of MathPath needs. Safe to run again; never removes anything.
export function ensureTabs(spreadsheet) {
  for (const name of Object.keys(TABS)) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    headerOf(sheet, name);
  }
}

// The tab's header row, after adding any missing columns. New columns go just
// before "data", so "data" stays last and the dashboard can skip it.
function headerOf(sheet, tab) {
  const wanted = TABS[tab];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(wanted);
    sheet.setFrozenRows(1);
    return [...wanted];
  }
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  for (const col of wanted) {
    if (header.includes(col)) continue;
    const dataAt = header.indexOf('data');
    if (dataAt >= 0) {
      sheet.insertColumnBefore(dataAt + 1);
      sheet.getRange(1, dataAt + 1, 1, 1).setValues([[col]]);
      header.splice(dataAt, 0, col);
    } else {
      sheet.getRange(1, header.length + 1, 1, 1).setValues([[col]]);
      header.push(col);
    }
  }
  return header;
}

export function createSheetsStore({ spreadsheet, lockService }) {
  const headers = new Map(); // tab -> { sheet, header }
  const cache = new Map(); // `${tab}|full` or `${tab}|summary` -> rows

  function tab(name) {
    if (!headers.has(name)) {
      // A tab added in a newer version of MathPath is made the first time it's needed.
      const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
      headers.set(name, { sheet, header: headerOf(sheet, name) });
    }
    return headers.get(name);
  }

  // All rows of a tab. summary: leave out the "data" column (it's last), so the
  // dashboard doesn't pull every answer ever given.
  function rows(name, { summary = false } = {}) {
    const key = `${name}|${summary ? 'summary' : 'full'}`;
    if (!cache.has(key)) {
      const { sheet, header } = tab(name);
      const lastRow = sheet.getLastRow();
      const width = summary && header[header.length - 1] === 'data' ? header.length - 1 : header.length;
      const values = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, width).getValues();
      cache.set(key, values.filter((r) => r.some((v) => v !== '')).map((r) => fromRow(header.slice(0, width), r)));
    }
    return cache.get(key);
  }

  // Add a row without reading the tab (a save never re-reads past saves).
  function append(name, obj) {
    const { sheet, header } = tab(name);
    sheet.appendRow(toRow(header, obj));
    for (const key of [`${name}|full`, `${name}|summary`]) if (cache.has(key)) cache.get(key).push(obj);
  }

  function upsert(name, key, obj) {
    const all = rows(name);
    const i = all.findIndex((r) => r[key] === obj[key]);
    if (i < 0) return append(name, obj);
    const { sheet, header } = tab(name);
    sheet.getRange(i + 2, 1, 1, header.length).setValues([toRow(header, obj)]);
    all[i] = obj;
  }

  const copy = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  return {
    withLock(fn) {
      const lock = lockService.getScriptLock();
      lock.waitLock(25000); // throws if it can't get the lock in 25 s; the browser retries
      try {
        cache.clear(); // someone may have written while we waited
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
    isTeacher: (email) => rows('Teachers').some((r) => String(r.email).toLowerCase() === String(email).toLowerCase()),
    addTeacher(email) {
      if (!this.isTeacher(email)) append('Teachers', { email: email.toLowerCase() });
    },
    getStudent: (id) => copy(rows('Students').find((s) => s.id === id)),
    getStudentByCode: (code) => copy(rows('Students').find((s) => s.code === code)),
    putStudent: (student) => upsert('Students', 'id', copy(student)),
    listStudents: (classIds) => copy(rows('Students').filter((s) => classIds.includes(s.classId))),
    listClasses: (email) => copy(rows('Classes').filter((c) => String(c.teacherEmail).toLowerCase() === String(email).toLowerCase())),
    putClass: (cls) => upsert('Classes', 'id', copy(cls)),
    listRoster: (ids) => copy(rows('Roster').filter((r) => ids.includes(r.studentId))),
    putRoster: (row) => upsert('Roster', 'studentId', copy(row)),
    appendRecord(kind, row) {
      const name = KIND_TAB[kind];
      if (!name) throw new Error(`Unknown record kind ${kind}`);
      append(name, copy(row));
    },
    // summary: true leaves out each record's "data" (answers, timing): for the dashboard.
    listRecords(kind, ids, { summary = false } = {}) {
      const set = new Set(ids);
      return copy(rows(KIND_TAB[kind], { summary }).filter((r) => set.has(r.studentId)));
    },
  };
}

// ---------- turning objects into sheet rows and back ----------

// Fields that aren't their own column go into "data" (if the tab has one).
function toRow(columns, obj) {
  const extra = {};
  if (columns.includes('data')) for (const [k, v] of Object.entries(obj)) if (!columns.includes(k)) extra[k] = v;
  return columns.map((c) => {
    const v = c === 'data' ? extra : obj[c];
    if (v === undefined || v === null) return '';
    if (JSON_COLUMNS.has(c)) return JSON.stringify(v);
    if (typeof v === 'string') return safeText(v);
    return v;
  });
}

function fromRow(columns, values) {
  const obj = {};
  columns.forEach((c, i) => {
    let v = values[i];
    if (v instanceof Date) v = v.toISOString(); // Sheets may turn ISO text into dates
    if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
    if (JSON_COLUMNS.has(c)) {
      const parsed = v === '' ? (c === 'data' ? {} : null) : JSON.parse(v);
      if (c === 'data') Object.assign(obj, parsed);
      else obj[c] = parsed;
    } else {
      obj[c] = v === '' ? null : v;
    }
  });
  for (const c of columns) if (BOOLEAN_COLUMNS.has(c)) obj[c] = obj[c] === true || obj[c] === 'TRUE';
  return obj;
}

// Text starting with = + - @ would be read by Sheets as a formula. Keep it as text.
function safeText(s) {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}
