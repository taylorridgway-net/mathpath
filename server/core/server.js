// The server's work, as plain JavaScript (no Apps Script here, so it's tested
// in Node and could move to Firebase/Supabase later). Apps Script only passes
// requests in and provides a `store` (server/apps-script/store-sheets.js).
//
// Students sign in with their code. Teachers are identified by their Google
// email (Apps Script provides it) and see only their own classes.
//
// Saves: one per finished diagnostic or lesson section, never per question.
// The server re-creates every problem from the seed, re-grades every answer
// with the same engine the browser uses, and stores ITS result, not the
// browser's. Each save carries a saveId, so a retried upload is never stored twice.
//
// Every function returns a plain object; failures are { error: 'kind', message }.

import { seedFor } from '../../engine/seeds.js';
import { replayDiagnostic } from '../../engine/diagnostic/diagnostic.js';
import { replayPractice } from '../../engine/practice/practice.js';
import { verificationRecord } from '../../engine/teacher/verification.js';
import { sectionSummary } from '../../engine/teacher/section-summary.js';
import { practicePlan } from '../../engine/lessons/plan.js';

const MAX_SAVE_IDS = 200; // recent saveIds kept per student to spot repeats
const WORDS_A = ['maple', 'river', 'cedar', 'stone', 'amber', 'cloud', 'birch', 'coral', 'frost', 'ember', 'meadow', 'harbor', 'canyon', 'willow', 'summit', 'pebble', 'acorn', 'delta', 'orbit', 'prism', 'quartz', 'tundra', 'lagoon', 'aspen'];
const WORDS_B = ['tiger', 'otter', 'falcon', 'heron', 'fox', 'bison', 'lynx', 'raven', 'panda', 'gecko', 'moose', 'koala', 'eagle', 'shark', 'llama', 'wolf', 'owl', 'yak', 'newt', 'crane', 'seal', 'wren', 'hare', 'orca'];

// setup: { graph, generators, misconceptions, diagnosticConfig, lessons, rules }
// now(): ISO time. random(): a number in [0, 1) (crypto-strength in production).
export function createServer({ store, setup, now = () => new Date().toISOString(), random }) {
  const fail = (error, message) => ({ error, message });
  const sectionById = new Map(setup.lessons.flatMap((l) => l.sections.map((s) => [s.id, { ...s, lesson: l.skill }])));
  const normalize = (code) => String(code || '').trim().toLowerCase().replace(/\s+/g, '-');

  function newSummary() {
    return { diagnostic: null, diagnosticAttempts: 0, sectionAttempts: {}, sectionsPassed: [], mastered: [], cleared: [], saveIds: [] };
  }
  const publicSummary = (summary) => {
    const { saveIds, ...rest } = summary;
    return rest;
  };

  function newCode() {
    for (let tries = 0; tries < 1000; tries++) {
      const pick = (list) => list[Math.floor(random() * list.length)];
      const code = `${pick(WORDS_A)}-${pick(WORDS_B)}-${10 + Math.floor(random() * 90)}`;
      if (!store.getStudentByCode(code)) return code;
    }
    throw new Error('Could not make a unique code');
  }
  function newId(prefix) {
    let s = prefix;
    for (let i = 0; i < 12; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(random() * 32)];
    return s;
  }

  // ---------------- students ----------------

  function login(code) {
    const student = store.getStudentByCode(normalize(code));
    if (!student || student.retired) return fail('unknown-code', 'That code isn’t right. Check it with your teacher.');
    return { student: { id: student.id, nickname: student.nickname || '' }, summary: publicSummary(student.summary) };
  }

  function setNickname(code, nickname) {
    return store.withLock(() => {
      const student = store.getStudentByCode(normalize(code));
      if (!student) return fail('unknown-code', 'Sign in again.');
      // Display name only. Short, and no email-looking text (no personal details stored).
      const clean = String(nickname || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 20);
      store.putStudent({ ...student, nickname: clean });
      return { ok: true, nickname: clean };
    });
  }

  function saveRecord(code, record) {
    return store.withLock(() => {
      const student = store.getStudentByCode(normalize(code));
      if (!student || student.retired) return fail('unknown-code', 'Sign in again.');
      if (!record || typeof record.saveId !== 'string') return fail('bad-record', 'Missing saveId.');
      const summary = student.summary;
      if (summary.saveIds.includes(record.saveId)) return { ok: true, duplicate: true, summary: publicSummary(summary) };

      const checked = record.type === 'diagnostic' ? checkDiagnostic(student, record)
        : record.type === 'lesson-section' ? checkSection(student, record)
          : fail('bad-record', `Unknown record type ${record.type}`);
      if (checked.error) return checked;

      summary.saveIds = [...summary.saveIds, record.saveId].slice(-MAX_SAVE_IDS);
      store.appendRecord(checked.kind, checked.row);
      store.putStudent({ ...student, summary });
      return { ok: true, result: checked.result, summary: publicSummary(summary) };
    });
  }

  function checkDiagnostic(student, record) {
    const summary = student.summary;
    const attemptNo = summary.diagnosticAttempts + 1;
    if (record.attemptNo !== attemptNo) return fail('wrong-attempt', `Expected diagnostic attempt ${attemptNo}.`);
    const seed = seedFor(student.id, 'diagnostic', attemptNo);
    if (record.seed !== seed) return fail('wrong-seed', 'Seed doesn’t match.');
    let result;
    try {
      result = replayDiagnostic({
        graph: setup.graph, generators: setup.generators, misconceptions: setup.misconceptions, config: setup.diagnosticConfig, seed,
      }, record.answers || [], record.times || []).result();
    } catch (e) {
      return fail('regrade-failed', String(e.message || e));
    }
    if (!result.finished) return fail('not-finished', 'The diagnostic isn’t finished.');
    summary.diagnosticAttempts = attemptNo;
    summary.diagnostic = { attemptNo, seed, answers: record.answers, times: record.times || [], finishedAt: record.finishedAt };
    const verdicts = Object.fromEntries(Object.entries(result.nodes).map(([id, n]) => [id, n.status]));
    return {
      kind: 'diagnostics',
      result: { rootGaps: result.rootGaps },
      row: {
        studentId: student.id, saveId: record.saveId, attemptNo, seed, answers: record.answers, times: record.times || [],
        startedAt: record.startedAt, finishedAt: record.finishedAt, receivedAt: now(),
        curriculumVersion: setup.graph.curriculumVersion, questionCount: result.questionCount,
        verdicts, rootGaps: result.rootGaps, misconceptions: result.misconceptions,
      },
    };
  }

  function checkSection(student, record) {
    const summary = student.summary;
    const sec = sectionById.get(record.section);
    if (!sec) return fail('bad-record', `Unknown section ${record.section}.`);
    const attemptNo = (summary.sectionAttempts[sec.id] || 0) + 1;
    if (record.attemptNo !== attemptNo) return fail('wrong-attempt', `Expected attempt ${attemptNo} of ${sec.id}.`);
    const seed = seedFor(student.id, sec.id, attemptNo);
    if (record.seed !== seed) return fail('wrong-seed', 'Seed doesn’t match.');
    let result;
    try {
      result = replayPractice({ generators: setup.generators, rules: setup.rules, seed, plan: practicePlan(sec, { review: record.review === true }) }, record.answers || []).result();
    } catch (e) {
      return fail('regrade-failed', String(e.message || e));
    }
    if (!result.finished) return fail('not-finished', 'The section isn’t finished.');
    summary.sectionAttempts = { ...summary.sectionAttempts, [sec.id]: attemptNo };
    if (result.passed && !summary.sectionsPassed.includes(sec.id)) summary.sectionsPassed = [...summary.sectionsPassed, sec.id];
    if (result.provisionalMastery && !summary.mastered.includes(sec.lesson)) summary.mastered = [...summary.mastered, sec.lesson];
    return {
      kind: 'sections',
      result: { endedBy: result.endedBy, passed: result.passed, provisionalMastery: result.provisionalMastery },
      row: {
        studentId: student.id, saveId: record.saveId, lesson: sec.lesson, section: sec.id, gap: sec.forGap, generator: sec.generator,
        mode: sec.mode, review: record.review === true, seed, attemptNo, answers: record.answers, times: record.times || [], scaffolds: record.scaffolds || {},
        hintsShown: record.hintsShown || [], startedAt: record.startedAt, finishedAt: record.finishedAt, receivedAt: now(),
        curriculumVersion: setup.graph.curriculumVersion,
        // The server's own grading. Each problem isn't stored: it can always be
        // re-created from the seed and answers (the dashboard does that on demand).
        endedBy: result.endedBy, passed: result.passed, provisionalMastery: result.provisionalMastery,
        ...sectionSummary(result, record.times || []),
      },
    };
  }

  // ---------------- teachers ----------------

  function teacherOnly(email, fn) {
    if (!email || !store.isTeacher(email)) return fail('not-a-teacher', 'This Google account isn’t set up as a MathPath teacher.');
    return fn();
  }
  function ownStudent(email, studentId) {
    const student = store.getStudent(studentId);
    if (!student) return null;
    const mine = store.listClasses(email).some((c) => c.id === student.classId);
    return mine ? student : null;
  }
  function log(email, studentId, what, before, after) {
    store.appendRecord('log', { at: now(), by: email, studentId, what, before: String(before ?? ''), after: String(after ?? '') });
  }

  // Everything the dashboard needs, for this teacher's classes only. Records are
  // labelled with each student's current code (codes can be reset; ids can't).
  function teacherData(email) {
    return teacherOnly(email, () => {
      const classes = store.listClasses(email);
      const students = store.listStudents(classes.map((c) => c.id)).filter((s) => !s.retired);
      const ids = students.map((s) => s.id);
      const codeOf = new Map(students.map((s) => [s.id, s.code]));
      const withCode = (rows) => rows.map((r) => ({ ...r, code: codeOf.get(r.studentId) }));
      return {
        synthetic: false,
        teacher: email,
        classes,
        students: students.map((s) => ({ id: s.id, code: s.code, nickname: s.nickname || null, classId: s.classId, createdAt: s.createdAt })),
        roster: store.listRoster(ids).map((r) => ({ ...r, code: codeOf.get(r.studentId) })),
        diagnostics: withCode(latestDiagnostics(store.listRecords('diagnostics', ids))).map((d) => ({ type: 'diagnostic', ...d })),
        // Summaries only; studentDetail() has the answers for one student.
        sections: withCode(store.listRecords('sections', ids, { summary: true })).map((r) => ({ type: 'lesson-section', ...r })),
        verifications: withCode(store.listRecords('verifications', ids)),
        clearances: withCode(store.listRecords('clearances', ids)),
        log: withCode(store.listRecords('log', ids)),
      };
    });
  }

  // One student's finished sections with every answer, for their profile page.
  function studentDetail(email, studentId) {
    return teacherOnly(email, () => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      const sections = store.listRecords('sections', [studentId]).map((r) => ({ type: 'lesson-section', ...r, code: student.code }));
      return { ok: true, sections };
    });
  }

  function addClass(email, name) {
    return teacherOnly(email, () => store.withLock(() => {
      const cls = { id: newId('c-'), name: String(name || '').trim().slice(0, 40) || 'New class', teacherEmail: email, createdAt: now() };
      store.putClass(cls);
      return { ok: true, class: cls };
    }));
  }

  // names: real names for the private roster (may be blank). Returns the new codes.
  function addStudents(email, classId, names) {
    return teacherOnly(email, () => store.withLock(() => {
      if (!store.listClasses(email).some((c) => c.id === classId)) return fail('not-your-class', 'That class isn’t yours.');
      const list = (names || []).map((n) => String(n || '').trim().slice(0, 60)).slice(0, 60);
      const created = list.map((realName) => {
        const student = { id: newId('s-'), code: newCode(), nickname: '', classId, createdAt: now(), retired: false, summary: newSummary() };
        store.putStudent(student);
        store.putRoster({ studentId: student.id, classId, realName });
        log(email, student.id, 'Student added', '', student.code);
        return { id: student.id, code: student.code, realName };
      });
      return { ok: true, students: created };
    }));
  }

  function resetCode(email, studentId) {
    return teacherOnly(email, () => store.withLock(() => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      const code = newCode();
      store.putStudent({ ...student, code });
      log(email, studentId, 'Code reset', student.code, code);
      return { ok: true, code };
    }));
  }

  function clearFoundation(email, studentId, gap) {
    return teacherOnly(email, () => store.withLock(() => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      if (!setup.graph.has(gap)) return fail('bad-skill', `Unknown skill ${gap}.`);
      if (student.summary.cleared.includes(gap)) return { ok: true, already: true };
      store.appendRecord('clearances', { studentId, gap, by: email, at: now() });
      store.putStudent({ ...student, summary: { ...student.summary, cleared: [...student.summary.cleared, gap] } });
      log(email, studentId, `Marked “${setup.graph.get(gap).name}” as checked`, 'waiting', 'checked');
      return { ok: true };
    }));
  }

  // A paper-test result. The server scores the marks itself (5 of 6 rule) and
  // keeps the teacher's decision alongside the suggestion.
  function verify(email, { studentId, skillId, version, marks, decision }) {
    return teacherOnly(email, () => store.withLock(() => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      if (!['verified', 'not-yet'].includes(decision)) return fail('bad-decision', 'Decision must be verified or not-yet.');
      let rec;
      try {
        rec = verificationRecord({
          code: student.code, skillId, assessmentId: skillId, version, marks, rule: setup.rules.verification, decision, by: email, at: now(),
          previous: store.listRecords('verifications', [studentId]).map((v) => ({ ...v, code: student.code })),
        });
      } catch (e) {
        return fail('bad-marks', String(e.message || e));
      }
      const { code, ...row } = rec;
      store.appendRecord('verifications', { studentId, ...row });
      log(email, studentId, `Paper test ${skillId} (version ${version}): ${rec.score}/${rec.outOf}`, '', decision === 'verified' ? 'Verified' : 'Not yet');
      return { ok: true, verification: { studentId, ...row } };
    }));
  }

  return {
    student: { login, saveRecord, setNickname },
    teacher: { teacherData, studentDetail, addClass, addStudents, resetCode, clearFoundation, verify },
  };
}

// Only the most recent diagnostic per student (a retake replaces the old one on the dashboard).
function latestDiagnostics(rows) {
  const latest = new Map();
  for (const r of rows) if (!latest.has(r.studentId) || latest.get(r.studentId).attemptNo < r.attemptNo) latest.set(r.studentId, r);
  return [...latest.values()];
}
