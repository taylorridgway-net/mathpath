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
  Classes: ['id', 'name', 'teacherEmail', 'createdAt', 'coTeachers', 'archived', 'course', 'opened'],
  Students: ['id', 'code', 'nickname', 'classId', 'createdAt', 'retired', 'summary'],
  Roster: ['studentId', 'classId', 'realName'],
  Diagnostics: ['studentId', 'saveId', 'attemptNo', 'seed', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'questionCount', 'rootGaps', 'data'],
  // Summary columns first (what the dashboard reads); the bulky answers stay in "data".
  Sections: ['studentId', 'saveId', 'lesson', 'section', 'attemptNo', 'review', 'endedBy', 'passed', 'provisionalMastery',
    'problemCount', 'firstTry', 'seconds', 'misconceptions', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'data'],
  Verifications: ['studentId', 'skillId', 'version', 'score', 'outOf', 'suggested', 'decision', 'attempt', 'by', 'at', 'marks'],
  Clearances: ['studentId', 'gap', 'by', 'at'],
  Resets: ['studentId', 'skillId', 'by', 'at'],
  Practice: ['studentId', 'saveId', 'skillId', 'attemptNo', 'problemCount', 'firstTry', 'seconds', 'misconceptions', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'data'],
  // Memory checks (retention): did a mastered skill stick?
  Memory: ['studentId', 'saveId', 'skillId', 'attemptNo', 'stage', 'held', 'problemCount', 'firstTry', 'seconds', 'misconceptions', 'startedAt', 'finishedAt', 'receivedAt', 'curriculumVersion', 'data'],
  // The teacher's changes to paths (assign / skip a lesson or step).
  Assignments: ['studentId', 'action', 'lesson', 'section', 'by', 'at'],
  Log: ['at', 'by', 'studentId', 'what', 'before', 'after'],
};
const JSON_COLUMNS = new Set(['summary', 'data', 'rootGaps', 'marks', 'misconceptions', 'coTeachers', 'opened']);
const BOOLEAN_COLUMNS = new Set(['retired', 'review', 'passed', 'provisionalMastery', 'archived', 'held']);
const KIND_TAB = { diagnostics: 'Diagnostics', sections: 'Sections', verifications: 'Verifications', clearances: 'Clearances', resets: 'Resets', practice: 'Practice', memory: 'Memory', assignments: 'Assignments', log: 'Log' };

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

// memo (optional): Google's script cache (CacheService.getScriptCache()), shared between
// requests. It remembers each tab's header row and each student's row number, so a
// save reads ONE student row instead of the whole Students tab, and no header rows
// (measured on Google: about 1 s for the Students tab and 0.6 s per header). Rows never
// move (students are only added or updated), and every remembered row is checked
// against the code it should hold; anything that doesn't match falls back to a full read.
// (Don't insert or reorder columns in the Sheet by hand; MathPath adds columns itself.)
const MEMO_SECONDS = 6 * 60 * 60;

export function createSheetsStore({ spreadsheet, lockService, memo = null }) {
  const headers = new Map(); // tab -> { sheet, header }
  const cache = new Map(); // `${tab}|full` or `${tab}|summary` -> rows
  const rowNumbers = new Map(); // `${tab}|full` -> sheet row number of each row in cache
  const studentRow = new Map(); // student id -> sheet row (rows never move, so this outlives the lock)

  function tab(name) {
    if (!headers.has(name)) {
      // A tab added in a newer version of MathPath is made the first time it's needed.
      const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
      let header = null;
      const saved = memo && memo.get(`hdr:${name}`);
      if (saved) {
        const h = JSON.parse(saved);
        if (TABS[name].every((c) => h.includes(c))) header = h; // a newer version may need new columns
      }
      if (!header) {
        header = headerOf(sheet, name);
        if (memo) memo.put(`hdr:${name}`, JSON.stringify(header), MEMO_SECONDS);
      }
      headers.set(name, { sheet, header });
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
      // Keep each row's sheet row number (blank rows are skipped, so it isn't just the index).
      const kept = values.map((r, i) => [r, i + 2]).filter(([r]) => r.some((v) => v !== ''));
      cache.set(key, kept.map(([r]) => fromRow(header.slice(0, width), r)));
      rowNumbers.set(key, kept.map(([, n]) => n));
      if (name === 'Students' && !summary) {
        cache.get(key).forEach((st, i) => studentRow.set(st.id, kept[i][1]));
        if (memo && kept.length) memo.putAll(Object.fromEntries(cache.get(key).map((st, i) => [`row:${st.code}`, String(kept[i][1])])), MEMO_SECONDS);
      }
    }
    return cache.get(key);
  }

  // One student by code: the remembered row only, if it still holds that code.
  function studentByCode(code) {
    if (memo && !cache.has('Students|full')) {
      const remembered = Number(memo.get(`row:${code}`));
      if (remembered >= 2) {
        const { sheet, header } = tab('Students');
        const [values] = sheet.getRange(remembered, 1, 1, header.length).getValues();
        const st = values && values.some((v) => v !== '') ? fromRow(header, values) : null;
        if (st && st.code === code) {
          studentRow.set(st.id, remembered);
          return st;
        }
      }
    }
    return rows('Students').find((st) => st.code === code);
  }

  // Add a row without reading the tab (a save never re-reads past saves).
  function append(name, obj) {
    const { sheet, header } = tab(name);
    sheet.appendRow(toRow(header, obj));
    for (const key of [`${name}|full`, `${name}|summary`]) if (cache.has(key)) cache.get(key).push(obj);
  }

  function upsert(name, key, obj) {
    // A student whose row we know (read this request): write it straight back.
    if (name === 'Students' && studentRow.has(obj.id) && !cache.has('Students|full')) {
      const { sheet, header } = tab(name);
      const row = studentRow.get(obj.id);
      sheet.getRange(row, 1, 1, header.length).setValues([toRow(header, obj)]);
      if (memo) memo.put(`row:${obj.code}`, String(row), MEMO_SECONDS);
      return;
    }
    const all = rows(name);
    const i = all.findIndex((r) => r[key] === obj[key]);
    if (i < 0) return append(name, obj);
    const { sheet, header } = tab(name);
    const row = rowNumbers.get(`${name}|full`)[i];
    sheet.getRange(row, 1, 1, header.length).setValues([toRow(header, obj)]);
    all[i] = obj;
    if (name === 'Students' && memo) memo.put(`row:${obj.code}`, String(row), MEMO_SECONDS);
  }

  const copy = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  return {
    withLock(fn) {
      const lock = lockService.getScriptLock();
      lock.waitLock(25000); // throws if it can't get the lock in 25 s; the browser retries
      try {
        cache.clear(); // someone may have written while we waited
        rowNumbers.clear();
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
    getStudentByCode: (code) => copy(studentByCode(code)),
    putStudent: (student) => upsert('Students', 'id', copy(student)),
    listStudents: (classIds) => copy(rows('Students').filter((s) => classIds.includes(s.classId))),
    // A teacher's classes: the ones they made, and ones shared with them.
    listClasses: (email) => {
      const me = String(email).toLowerCase();
      return copy(rows('Classes').filter((c) => String(c.teacherEmail).toLowerCase() === me || (c.coTeachers || []).includes(me)));
    },
    getClass: (id) => copy(rows('Classes').find((c) => c.id === id)),
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
