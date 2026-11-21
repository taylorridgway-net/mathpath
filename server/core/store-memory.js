// A store kept in memory: for tests, and for the claude.ai preview (where it is
// saved to the browser). Same interface as server/apps-script/store-sheets.js.
//
// Interface:
//   withLock(fn)                       run fn with exclusive access (Sheets: LockService)
//   isTeacher(email)
//   getStudent(id), getStudentByCode(code), putStudent(student), listStudents(classIds)
//   listClasses(teacherEmail), putClass(cls)
//   listRoster(studentIds), putRoster(row)
//   appendRecord(kind, row), listRecords(kind, studentIds, { summary })
//     kinds: diagnostics, sections, verifications, clearances, resets, practice, memory, log

const KINDS = ['diagnostics', 'sections', 'verifications', 'clearances', 'resets', 'practice', 'memory', 'assignments', 'log'];
const DETAIL = ['answers', 'times', 'scaffolds', 'hintsShown', 'seed', 'gap', 'generator', 'mode'];
const stripDetail = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !DETAIL.includes(k)));

export function createMemoryStore(initial = {}) {
  const data = {
    teachers: [...(initial.teachers || [])],
    classes: [...(initial.classes || [])],
    students: [...(initial.students || [])],
    roster: [...(initial.roster || [])],
    records: Object.fromEntries(KINDS.map((k) => [k, [...(initial.records?.[k] || [])]])),
  };
  const copy = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);
  return {
    data,
    withLock: (fn) => fn(),
    isTeacher: (email) => data.teachers.includes(String(email).toLowerCase()),
    addTeacher: (email) => { if (!data.teachers.includes(email.toLowerCase())) data.teachers.push(email.toLowerCase()); },
    getStudent: (id) => copy(data.students.find((s) => s.id === id)),
    getStudentByCode: (code) => copy(data.students.find((s) => s.code === code)),
    putStudent(student) {
      const i = data.students.findIndex((s) => s.id === student.id);
      if (i >= 0) data.students[i] = copy(student);
      else data.students.push(copy(student));
    },
    listStudents: (classIds) => copy(data.students.filter((s) => classIds.includes(s.classId))),
    // A teacher's classes: the ones they made, and ones shared with them.
    listClasses: (email) => copy(data.classes.filter((c) => c.teacherEmail === email || (c.coTeachers || []).includes(String(email).toLowerCase()))),
    getClass: (id) => copy(data.classes.find((c) => c.id === id)),
    putClass(cls) {
      const i = data.classes.findIndex((c) => c.id === cls.id);
      if (i >= 0) data.classes[i] = copy(cls);
      else data.classes.push(copy(cls));
    },
    listRoster: (ids) => copy(data.roster.filter((r) => ids.includes(r.studentId))),
    putRoster(row) {
      const i = data.roster.findIndex((r) => r.studentId === row.studentId);
      if (i >= 0) data.roster[i] = copy(row);
      else data.roster.push(copy(row));
    },
    appendRecord(kind, row) {
      if (!KINDS.includes(kind)) throw new Error(`Unknown record kind ${kind}`);
      data.records[kind].push(copy(row));
    },
    // summary: leave out the bulky fields (answers, timing), like the Sheets store does.
    listRecords: (kind, ids, { summary = false } = {}) => copy(data.records[kind].filter((r) => ids.includes(r.studentId)))
      .map((r) => (summary && (kind === 'sections' || kind === 'practice' || kind === 'memory') ? stripDetail(r) : r)),
  };
}
