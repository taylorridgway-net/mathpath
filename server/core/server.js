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
import { replayDiagnostic, compactResult, catchUpTargets, resultFromVerdicts, fixedGaps, recheckPlan } from '../../engine/diagnostic/diagnostic.js';
import { replayPractice } from '../../engine/practice/practice.js';
import { verificationRecord } from '../../engine/teacher/verification.js';
import { sectionSummary } from '../../engine/teacher/section-summary.js';
import { practicePlan, practiceSetPlan, memoryCheckPlan } from '../../engine/lessons/plan.js';
import { memoryState, memoryHeld, memoryEvents } from '../../engine/lessons/memory.js';
import { pathChanges, PATH_ACTIONS, LOG_STATES } from '../../engine/teacher/assignments.js';

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
    return { diagnostic: null, diagnosticAttempts: 0, sectionAttempts: {}, sectionsPassed: [], mastered: [], cleared: [], memory: {}, saveIds: [] };
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
    let student = store.getStudentByCode(normalize(code));
    if (!student || student.retired) return fail('unknown-code', 'That code isn’t right. Check it with your teacher.');
    if (!student.summary.memory) {
      // Saved before memory checks: work out each mastered skill's schedule once, from its records.
      student = store.withLock(() => {
        const fresh = store.getStudentByCode(normalize(code));
        if (!fresh.summary.memory) {
          const sections = store.listRecords('sections', [fresh.id], { summary: true });
          fresh.summary.memory = Object.fromEntries((fresh.summary.mastered || []).map((skill) => [
            skill, memoryEvents(skill, { sections, resetAt: fresh.summary.resets?.[skill] || null }),
          ]));
          store.putStudent(fresh);
        }
        return fresh;
      });
    }
    if (student.summary.diagnostic && !student.summary.diagnostic.result) {
      // Saved before results were kept: fill it in once, from the verdicts recorded at the time.
      student = store.withLock(() => {
        const fresh = store.getStudentByCode(normalize(code));
        if (fresh.summary.diagnostic && !fresh.summary.diagnostic.result) {
          fresh.summary.diagnostic.result = slimResult(savedResultFromRecords(fresh));
          store.putStudent(fresh);
        }
        return fresh;
      });
    }
    return { student: { id: student.id, nickname: student.nickname || '' }, summary: publicSummary(student.summary) };
  }

  // The latest diagnostic's result as saved (older saves: rebuilt from their verdicts).
  function savedResultFromRecords(student) {
    const latest = latestDiagnostics(store.listRecords('diagnostics', [student.id]))[0];
    if (!latest) return null;
    return latest.result || resultFromVerdicts(latest);
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
          : record.type === 'practice-set' ? checkPracticeSet(student, record)
            : record.type === 'memory-check' ? checkMemoryCheck(student, record)
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
    // A catch-up check starts from the saved result; the server works out the new skills itself.
    let config = setup.diagnosticConfig;
    let prior = null;
    if (record.catchUp === true) {
      prior = summary.diagnostic?.result || (summary.diagnostic && savedResultFromRecords(student));
      if (!prior) return fail('no-diagnostic', 'There’s no earlier check to catch up from.');
      let targets;
      if (record.recheck === true) {
        // A quick re-check: the browser says which gaps are fixed; accept only ones this server can confirm.
        const confirmed = new Set(fixedGaps({ graph: setup.graph, prior, summary, lessons: setup.lessons }));
        const fixed = (record.fixed || []).filter((g) => confirmed.has(g));
        if (fixed.length !== (record.fixed || []).length) return fail('not-fixed', 'Some of those gaps aren’t fixed yet.');
        const plan = recheckPlan({ graph: setup.graph, generators: setup.generators, prior, fixed });
        ({ targets } = plan);
        prior = plan.prior;
      } else {
        targets = catchUpTargets({ graph: setup.graph, generators: setup.generators, config, prior });
      }
      if (!targets.length) return fail('nothing-to-catch-up', 'There’s nothing new to check.');
      config = { ...config, targets };
    }
    let result;
    try {
      result = replayDiagnostic({
        graph: setup.graph, generators: setup.generators, misconceptions: setup.misconceptions, config, seed, prior,
      }, record.answers || [], record.times || []).result();
    } catch (e) {
      return fail('regrade-failed', String(e.message || e));
    }
    if (!result.finished) return fail('not-finished', 'The diagnostic isn’t finished.');
    const saved = compactResult(result);
    summary.diagnosticAttempts = attemptNo;
    summary.diagnostic = {
      attemptNo, seed, answers: record.answers, times: record.times || [], finishedAt: record.finishedAt,
      ...(prior ? { catchUp: true } : {}), ...(record.recheck === true ? { recheck: true } : {}), result: slimResult(saved),
    };
    const verdicts = Object.fromEntries(Object.entries(result.nodes).map(([id, n]) => [id, n.status]));
    return {
      kind: 'diagnostics',
      result: { rootGaps: result.rootGaps },
      row: {
        studentId: student.id, saveId: record.saveId, attemptNo, seed, answers: record.answers, times: record.times || [],
        startedAt: record.startedAt, finishedAt: record.finishedAt, receivedAt: now(),
        curriculumVersion: setup.graph.curriculumVersion, questionCount: result.questionCount,
        verdicts, rootGaps: result.rootGaps, misconceptions: result.misconceptions,
        ...(prior ? { catchUp: true, targets: config.targets } : {}), ...(record.recheck === true ? { recheck: true, fixed: record.fixed } : {}), result: saved,
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
    // A refresher ("Putting it together" straight to the whole problems) only after a missed memory check.
    if (record.review === true && sec.mode === 'skill'
      && memoryState(summary.memory?.[sec.lesson] || [], setup.rules.retention, now()).status !== 'slipping') {
      return fail('not-slipping', 'A refresher is only for a skill that slipped in a memory check.');
    }
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
    if (result.provisionalMastery) {
      // Starts (or after a slip, restarts) the memory-check schedule.
      const events = summary.memory?.[sec.lesson] || [];
      summary.memory = { ...(summary.memory || {}), [sec.lesson]: [...events, { type: 'mastered', at: when(record.finishedAt) }] };
    }
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

  // Practice for a check (the student's choice). Re-graded like everything else,
  // but it never changes mastery or the path: it only counts as participation.
  function checkPracticeSet(student, record) {
    const summary = student.summary;
    const skillId = record.skill;
    if (!setup.lessons.some((l) => l.skill === skillId)) return fail('bad-record', `No practice for ${skillId}.`);
    const attempts = summary.practiceAttempts || {};
    const attemptNo = (attempts[skillId] || 0) + 1;
    if (record.attemptNo !== attemptNo) return fail('wrong-attempt', `Expected practice set ${attemptNo} for ${skillId}.`);
    const seed = seedFor(student.id, `practice:${skillId}`, attemptNo);
    if (record.seed !== seed) return fail('wrong-seed', 'Seed doesn’t match.');
    let result;
    try {
      result = replayPractice({ generators: setup.generators, rules: setup.rules, seed, plan: practiceSetPlan(skillId, setup.rules) }, record.answers || []).result();
    } catch (e) {
      return fail('regrade-failed', String(e.message || e));
    }
    if (!result.finished) return fail('not-finished', 'The practice set isn’t finished.');
    summary.practiceAttempts = { ...attempts, [skillId]: attemptNo };
    const short = sectionSummary(result, record.times || []);
    return {
      kind: 'practice',
      result: { firstTry: short.firstTry, problemCount: short.problemCount },
      row: {
        studentId: student.id, saveId: record.saveId, skillId, attemptNo, seed, answers: record.answers, times: record.times || [],
        hintsShown: record.hintsShown || [], startedAt: record.startedAt, finishedAt: record.finishedAt, receivedAt: now(),
        curriculumVersion: setup.graph.curriculumVersion, ...short,
      },
    };
  }

  // A memory check: a few whole problems on a skill mastered a while ago. The server
  // checks it's really due (its own clock, a little slack for device clocks), re-grades
  // it, and moves the skill's schedule on (held up) or marks it slipping (refresher next).
  function checkMemoryCheck(student, record) {
    const summary = student.summary;
    const skillId = record.skill;
    const rule = setup.rules.retention;
    if (!setup.lessons.some((l) => l.skill === skillId)) return fail('bad-record', `No memory check for ${skillId}.`);
    const events = summary.memory?.[skillId] || [];
    const slack = new Date(new Date(now()).getTime() + (rule.dueSlackDays || 0) * 24 * 3600 * 1000).toISOString();
    const state = memoryState(events, rule, slack);
    if (state.status !== 'due') return fail('not-due', `No memory check is due for ${skillId}.`);
    const attempts = summary.memoryAttempts || {};
    const attemptNo = (attempts[skillId] || 0) + 1;
    if (record.attemptNo !== attemptNo) return fail('wrong-attempt', `Expected memory check ${attemptNo} for ${skillId}.`);
    const seed = seedFor(student.id, `memory:${skillId}`, attemptNo);
    if (record.seed !== seed) return fail('wrong-seed', 'Seed doesn’t match.');
    let result;
    try {
      result = replayPractice({ generators: setup.generators, rules: setup.rules, seed, plan: memoryCheckPlan(skillId, setup.rules) }, record.answers || []).result();
    } catch (e) {
      return fail('regrade-failed', String(e.message || e));
    }
    if (!result.finished) return fail('not-finished', 'The memory check isn’t finished.');
    const held = memoryHeld(result, rule);
    const at = when(record.finishedAt);
    summary.memoryAttempts = { ...attempts, [skillId]: attemptNo };
    summary.memory = { ...(summary.memory || {}), [skillId]: [...events, { type: 'check', at, held }] };
    const short = sectionSummary(result, record.times || []);
    return {
      kind: 'memory',
      result: { held, firstTry: short.firstTry, problemCount: short.problemCount },
      row: {
        studentId: student.id, saveId: record.saveId, skillId, attemptNo, stage: state.stage + 1, held, seed,
        answers: record.answers, times: record.times || [], startedAt: record.startedAt, finishedAt: at, receivedAt: now(),
        curriculumVersion: setup.graph.curriculumVersion, ...short,
      },
    };
  }

  // A device's finish time, unless it's in the future or not a time (then the server's).
  function when(t) {
    const server = now();
    return typeof t === 'string' && !Number.isNaN(Date.parse(t)) && t <= server ? new Date(t).toISOString() : server;
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
      const all = store.listClasses(email);
      const classes = all.filter((c) => !c.archived);
      const everyone = store.listStudents(classes.map((c) => c.id));
      const students = everyone.filter((s) => !s.retired);
      const ids = students.map((s) => s.id);
      // Removed students and classes, so the teacher can bring them back.
      const gone = everyone.filter((s) => s.retired);
      const goneNames = new Map(store.listRoster(gone.map((s) => s.id)).map((r) => [r.studentId, r.realName]));
      const codeOf = new Map(students.map((s) => [s.id, s.code]));
      const withCode = (rows) => rows.map((r) => ({ ...r, code: codeOf.get(r.studentId) }));
      return {
        synthetic: false,
        teacher: email,
        classes,
        students: students.map((s) => ({ id: s.id, code: s.code, nickname: s.nickname || null, classId: s.classId, createdAt: s.createdAt })),
        roster: store.listRoster(ids).map((r) => ({ ...r, code: codeOf.get(r.studentId) })),
        // The latest result per student, without its question list (studentDetail() has that).
        diagnostics: withCode(latestDiagnostics(store.listRecords('diagnostics', ids))).map(dashboardDiagnostic),
        // Summaries only; studentDetail() has the answers for one student.
        sections: withCode(store.listRecords('sections', ids, { summary: true })).map((r) => ({ type: 'lesson-section', ...r })),
        verifications: withCode(store.listRecords('verifications', ids)),
        clearances: withCode(store.listRecords('clearances', ids)),
        resets: withCode(store.listRecords('resets', ids)),
        practice: withCode(store.listRecords('practice', ids, { summary: true })).map((r) => ({ type: 'practice-set', ...r })),
        memory: withCode(store.listRecords('memory', ids, { summary: true })).map((r) => ({ type: 'memory-check', ...r })),
        assignments: withCode(store.listRecords('assignments', ids)),
        log: withCode(store.listRecords('log', ids)),
        removed: {
          classes: all.filter((c) => c.archived).map(({ id, name }) => ({ id, name })),
          students: gone.map((s) => ({ id: s.id, code: s.code, classId: s.classId, realName: goneNames.get(s.id) || '' })),
        },
      };
    });
  }

  // One student's finished sections with every answer, for their profile page.
  function studentDetail(email, studentId) {
    return teacherOnly(email, () => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      const sections = store.listRecords('sections', [studentId]).map((r) => ({ type: 'lesson-section', ...r, code: student.code }));
      const memory = store.listRecords('memory', [studentId]).map((r) => ({ type: 'memory-check', ...r, code: student.code }));
      const latest = latestDiagnostics(store.listRecords('diagnostics', [studentId]))[0];
      const diagnostic = latest ? { ...latest, code: student.code, result: latest.result || resultFromVerdicts(latest) } : null;
      return { ok: true, sections, memory, diagnostic };
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

  // ---- removing and restoring (nothing is deleted: the work stays, and can come back) ----

  function setStudentRemoved(email, studentId, removed) {
    return teacherOnly(email, () => store.withLock(() => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      if (Boolean(student.retired) === removed) return { ok: true, already: true };
      store.putStudent({ ...student, retired: removed });
      log(email, studentId, removed ? 'Removed from the class (code stops working; work kept)' : 'Brought back to the class', removed ? 'active' : 'removed', removed ? 'removed' : 'active');
      return { ok: true };
    }));
  }

  function setClassRemoved(email, classId, removed) {
    return teacherOnly(email, () => store.withLock(() => {
      const cls = store.listClasses(email).find((c) => c.id === classId);
      if (!cls) return fail('not-your-class', 'That class isn’t yours.');
      store.putClass({ ...cls, archived: removed });
      for (const st of store.listStudents([classId])) log(email, st.id, removed ? `Class “${cls.name}” removed` : `Class “${cls.name}” brought back`, '', '');
      return { ok: true };
    }));
  }

  // A co-teacher sees and does everything the teacher can for this class (owner decision).
  function shareClass(email, classId, otherEmail) {
    return teacherOnly(email, () => store.withLock(() => {
      const cls = store.listClasses(email).find((c) => c.id === classId);
      if (!cls) return fail('not-your-class', 'That class isn’t yours.');
      const other = String(otherEmail || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(other)) return fail('bad-email', 'That doesn’t look like an email address.');
      if (other === String(cls.teacherEmail).toLowerCase() || (cls.coTeachers || []).includes(other)) return { ok: true, already: true };
      store.addTeacher(other);
      store.putClass({ ...cls, coTeachers: [...(cls.coTeachers || []), other] });
      for (const st of store.listStudents([classId])) log(email, st.id, `Class shared with ${other}`, '', other);
      return { ok: true };
    }));
  }

  function unshareClass(email, classId, otherEmail) {
    return teacherOnly(email, () => store.withLock(() => {
      const cls = store.listClasses(email).find((c) => c.id === classId);
      if (!cls) return fail('not-your-class', 'That class isn’t yours.');
      const other = String(otherEmail || '').trim().toLowerCase();
      if (!(cls.coTeachers || []).includes(other)) return { ok: true, already: true };
      store.putClass({ ...cls, coTeachers: cls.coTeachers.filter((e) => e !== other) });
      for (const st of store.listStudents([classId])) log(email, st.id, `Class no longer shared with ${other}`, other, '');
      return { ok: true };
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

  // The teacher sends a student back to redo a skill (e.g. after a paper test
  // says "not yet"): platform mastery is cleared and "Putting it together" for
  // that skill counts as not done, so the student does it again. Logged.
  function resetSkill(email, studentId, skillId) {
    return teacherOnly(email, () => store.withLock(() => {
      const student = ownStudent(email, studentId);
      if (!student) return fail('not-your-student', 'That student isn’t in your classes.');
      const lesson = setup.lessons.find((l) => l.skill === skillId);
      if (!lesson) return fail('bad-skill', `No lesson for ${skillId}.`);
      const at = now();
      const whole = lesson.sections.filter((s) => s.mode === 'skill').map((s) => s.id);
      const summary = {
        ...student.summary,
        mastered: student.summary.mastered.filter((m) => m !== skillId),
        sectionsPassed: student.summary.sectionsPassed.filter((s) => !whole.includes(s)),
        resets: { ...(student.summary.resets || {}), [skillId]: at },
        // Memory checks start again from the next platform mastery.
        memory: { ...(student.summary.memory || {}), [skillId]: [] },
      };
      store.appendRecord('resets', { studentId, skillId, by: email, at });
      store.putStudent({ ...student, summary });
      log(email, studentId, `Sent back to redo “${lesson.title}”`, student.summary.mastered.includes(skillId) ? 'platform mastery' : '', 'redo');
      return { ok: true, at };
    }));
  }

  // The teacher changes students' paths: assign a lesson (or one step) to the top of
  // the path, or skip one. For one student or a group at once. Logged per student;
  // the student's summary keeps the current list (what sign-in sends).
  function changePath(email, { studentIds, action, lesson, section = null }) {
    return teacherOnly(email, () => store.withLock(() => {
      if (!PATH_ACTIONS.includes(action)) return fail('bad-action', `Unknown action ${action}.`);
      const l = setup.lessons.find((x) => x.skill === lesson);
      if (!l || (section && !l.sections.some((s) => s.id === section))) return fail('bad-lesson', 'No such lesson or step.');
      const list = (studentIds || []).map((id) => ownStudent(email, id));
      if (!list.length || list.some((s) => !s)) return fail('not-your-student', 'That student isn’t in your classes.');
      const at = now();
      const what = section ? `“${l.sections.find((s) => s.id === section).title}” (${l.title})` : `“${l.title}”`;
      const words = { assign: 'Assigned', unassign: 'Took back the assignment of', skip: 'Took off the path:', unskip: 'Put back on the path:' }[action];
      for (const student of list) {
        const row = { studentId: student.id, action, lesson, section: section || '', by: email, at };
        store.appendRecord('assignments', row);
        const all = store.listRecords('assignments', [student.id]);
        const changes = pathChanges(all);
        store.putStudent({ ...student, summary: { ...student.summary, assigned: changes.assigned, skipped: changes.skipped } });
        log(email, student.id, `${words} ${what}`, ...LOG_STATES[action]);
      }
      return { ok: true, at };
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
    teacher: {
      teacherData, studentDetail, addClass, addStudents, resetCode, clearFoundation, resetSkill, verify,
      removeStudent: (email, id) => setStudentRemoved(email, id, true),
      restoreStudent: (email, id) => setStudentRemoved(email, id, false),
      removeClass: (email, id) => setClassRemoved(email, id, true),
      restoreClass: (email, id) => setClassRemoved(email, id, false),
      shareClass,
      unshareClass,
      changePath,
    },
  };
}

// Only the most recent diagnostic per student (a retake replaces the old one on the dashboard).
// What the dashboard overview needs from a diagnostic row (answers and the question list stay behind).
function dashboardDiagnostic(row) {
  const { answers, times, verdicts, result, ...rest } = row;
  return { type: 'diagnostic', ...rest, result: slimResult(result || resultFromVerdicts(row)) };
}

// The student's own copy (read at every sign-in) leaves out the question list.
function slimResult(result) {
  if (!result) return null;
  const { questions, ...rest } = result;
  return rest;
}

function latestDiagnostics(rows) {
  const latest = new Map();
  for (const r of rows) if (!latest.has(r.studentId) || latest.get(r.studentId).attemptNo < r.attemptNo) latest.set(r.studentId, r);
  return [...latest.values()];
}
