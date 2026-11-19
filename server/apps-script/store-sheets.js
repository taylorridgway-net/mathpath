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
  Sections: ['studentId', 'saveId', 'section', 'attemptNo', 'endedBy', 'passed', 'provisionalMastery', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'data'],
  Verifications: ['studentId', 'skillId', 'version', 'score', 'outOf', 'suggested', 'decision', 'attempt', 'by', 'at', 'marks'],
  Clearances: ['studentId', 'gap', 'by', 'at'],
  Log: ['at', 'by', 'studentId', 'what', 'before', 'after'],
};
const JSON_COLUMNS = new Set(['summary', 'data', 'rootGaps', 'marks']);
const KIND_TAB = { diagnostics: 'Diagnostics', sections: 'Sections', verifications: 'Verifications', clearances: 'Clearances', log: 'Log' };

// Make the tabs (with header rows) if they don't exist yet. Safe to run again.
export function ensureTabs(spreadsheet) {
  for (const [name, columns] of Object.entries(TABS)) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(columns);
      sheet.setFrozenRows(1);
    }
  }
}

export function createSheetsStore({ spreadsheet, lockService }) {
  const cache = new Map(); // tab -> { sheet, rows: [object], index of first data row = 2 }

  function table(tab) {
    if (!cache.has(tab)) {
      const sheet = spreadsheet.getSheetByName(tab);
      if (!sheet) throw new Error(`The spreadsheet has no "${tab}" tab. Run setup() once.`);
      const values = sheet.getDataRange().getValues();
      const columns = TABS[tab];
      const rows = values.slice(1).filter((r) => r.some((v) => v !== '')).map((r) => fromRow(columns, r));
      cache.set(tab, { sheet, rows });
    }
    return cache.get(tab);
  }

  function append(tab, obj) {
    const t = table(tab);
    t.sheet.appendRow(toRow(TABS[tab], obj));
    t.rows.push(obj);
  }

  function upsert(tab, key, obj) {
    const t = table(tab);
    const i = t.rows.findIndex((r) => r[key] === obj[key]);
    if (i < 0) return append(tab, obj);
    const columns = TABS[tab];
    t.sheet.getRange(i + 2, 1, 1, columns.length).setValues([toRow(columns, obj)]);
    t.rows[i] = obj;
  }

  const copy = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  return {
    withLock(fn) {
      const lock = lockService.getScriptLock();
      lock.waitLock(20000); // throws if it can't get the lock in 20 s; the browser retries later
      try {
        cache.clear(); // someone may have written while we waited
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
    isTeacher: (email) => table('Teachers').rows.some((r) => String(r.email).toLowerCase() === String(email).toLowerCase()),
    addTeacher(email) {
      if (!this.isTeacher(email)) append('Teachers', { email: email.toLowerCase() });
    },
    getStudent: (id) => copy(table('Students').rows.find((s) => s.id === id)),
    getStudentByCode: (code) => copy(table('Students').rows.find((s) => s.code === code)),
    putStudent: (student) => upsert('Students', 'id', copy(student)),
    listStudents: (classIds) => copy(table('Students').rows.filter((s) => classIds.includes(s.classId))),
    listClasses: (email) => copy(table('Classes').rows.filter((c) => String(c.teacherEmail).toLowerCase() === String(email).toLowerCase())),
    putClass: (cls) => upsert('Classes', 'id', copy(cls)),
    listRoster: (ids) => copy(table('Roster').rows.filter((r) => ids.includes(r.studentId))),
    putRoster: (row) => upsert('Roster', 'studentId', copy(row)),
    appendRecord(kind, row) {
      const tab = KIND_TAB[kind];
      if (!tab) throw new Error(`Unknown record kind ${kind}`);
      append(tab, copy(row));
    },
    listRecords(kind, ids) {
      const set = new Set(ids);
      return copy(table(KIND_TAB[kind]).rows.filter((r) => set.has(r.studentId)));
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
  if (columns.includes('retired')) obj.retired = obj.retired === true || obj.retired === 'TRUE';
  return obj;
}

// Text starting with = + - @ would be read by Sheets as a formula. Keep it as text.
function safeText(s) {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}
