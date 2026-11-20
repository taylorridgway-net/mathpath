// Dashboard logic: mastery cells, teach-together groups, participation, paper-test scoring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studentStatus, countStatuses } from '../../../engine/teacher/student-status.js';
import { teachTogether } from '../../../engine/teacher/groups.js';
import { participation } from '../../../engine/teacher/participation.js';
import { scorePaperTest, verificationRecord } from '../../../engine/teacher/verification.js';
import { loadClassSetup } from '../../helpers/class-setup.js';

const setup = loadClassSetup();
const { graph, lessons, rules } = setup;
const SKILL = 'frac.add-sub';

// A pretend diagnostic result: only the fields the dashboard reads.
const diag = (nodes, skills, rootGaps = [], extra = {}) => ({
  nodes: Object.fromEntries(Object.entries(nodes).map(([id, status]) => [id, { status }])),
  skills, rootGaps, uncheckedCauses: [], misconceptions: {}, ...extra,
});
const gapCombine = diag({ [`${SKILL}.combine`]: 'gap', [`${SKILL}.common-denom`]: 'known' }, { [SKILL]: 'gap' }, [`${SKILL}.combine`]);
const record = (section, { passed = true, mastery = false, at = '2026-11-10T10:00:00Z', misconception } = {}) => ({
  lesson: SKILL, section, passed, provisionalMastery: mastery, finishedAt: at, times: [60000, 60000],
  problems: [{ attempts: [{ misconception }] }],
});
const status = (o) => studentStatus({ graph, lessons, ...o });

test('a gap with no practice yet is a gap; once started it is "working"', () => {
  assert.equal(status({ diagnosticResult: gapCombine }).skills[SKILL], 'gap');
  const s = status({ diagnosticResult: gapCombine, sections: [record(`${SKILL}.combine`)] });
  assert.equal(s.skills[SKILL], 'working');
  assert.equal(s.subskills[`${SKILL}.combine`], 'practised');
  assert.equal(s.next.section, `${SKILL}.whole`, 'next is Putting it together');
});

test('platform mastery and verified mastery are separate', () => {
  const sections = [record(`${SKILL}.combine`), record(`${SKILL}.whole`, { mastery: true })];
  assert.equal(status({ diagnosticResult: gapCombine, sections }).skills[SKILL], 'platform');
  const verified = { skillId: SKILL, decision: 'verified', at: '2026-11-12T10:00:00Z' };
  assert.equal(status({ diagnosticResult: gapCombine, sections, verifications: [verified] }).skills[SKILL], 'verified');
  const notYet = { skillId: SKILL, decision: 'not-yet', at: '2026-11-13T10:00:00Z' };
  assert.equal(status({ diagnosticResult: gapCombine, sections, verifications: [verified, notYet] }).skills[SKILL], 'platform',
    'the latest paper test counts; a "not yet" leaves platform mastery standing');
});

test('with waiting switched on, a student is marked waiting until the check is cleared', () => {
  // As if "understand fractions" had no lesson yet (it has one now).
  const without = lessons.filter((l) => l.skill !== 'frac.meaning');
  const r = { ...gapCombine, uncheckedCauses: ['frac.meaning'] };
  assert.equal(status({ diagnosticResult: r, waitForTeacher: true, lessons: without }).waiting, true);
  assert.equal(status({ diagnosticResult: r, cleared: ['frac.meaning'], waitForTeacher: true, lessons: without }).waiting, false);
  assert.equal(status({ diagnosticResult: r, lessons: without }).waiting, false, 'by default (owner decision) nobody waits');
});

test('no diagnostic yet: everything not tested', () => {
  const s = status({ diagnosticResult: null });
  assert.equal(s.diagnosed, false);
  assert.ok(Object.values(s.skills).every((x) => x === 'not-tested'));
});

test('countStatuses counts a heatmap column', () => {
  const c = countStatuses(['gap', 'gap', 'verified']);
  assert.equal(c.gap, 2);
  assert.equal(c.verified, 1);
  assert.equal(c.platform, 0);
});

test('teach together: same next section, and same recent wrong-answer pattern', () => {
  const now = '2026-11-19T12:00:00Z';
  const mk = (code, sections, misconceptions = {}) => ({
    code,
    status: status({ diagnosticResult: { ...gapCombine, misconceptions }, sections }),
    diagnostic: { finishedAt: '2026-11-15T10:00:00Z', result: { misconceptions } },
    sections,
  });
  const students = [
    mk('a', [], { 'frac.add-across': 1 }),
    mk('b', [], { 'frac.add-across': 2 }),
    mk('c', [record(`${SKILL}.combine`), record(`${SKILL}.whole`, { mastery: true })], { 'frac.add-across': 1 }),
  ];
  const g = teachTogether(students, { misconceptions: setup.misconceptions, now });
  assert.deepEqual(g.next.map((x) => [x.target, x.students]), [[`${SKILL}.combine`, ['a', 'b']]]);
  assert.deepEqual(g.misconceptions.map((x) => [x.target, x.students]), [['frac.add-across', ['a', 'b']]],
    'c has platform mastery, so the old pattern no longer counts');
  const old = teachTogether(students, { misconceptions: setup.misconceptions, now: '2026-12-30T00:00:00Z' });
  assert.equal(old.misconceptions.length, 0, 'patterns older than the window drop off');
});

test('participation: days active, sections, minutes in the last 7 days', () => {
  const now = '2026-11-19T12:00:00Z';
  const sections = [
    record('x', { at: '2026-11-18T10:00:00Z' }), record('y', { at: '2026-11-18T15:00:00Z' }),
    record('z', { at: '2026-11-16T10:00:00Z' }), record('old', { at: '2026-11-01T10:00:00Z' }),
  ];
  const p = participation({ sections }, { now, expectedSections: 3 });
  assert.deepEqual([p.daysActive, p.sectionsFinished, p.minutes, p.belowExpectation, p.inactive], [2, 3, 6, false, false]);
  assert.equal(participation({ sections: [] }, { now }).inactive, true);
  assert.equal(participation({ sections: [], hasWork: false }, { now }).belowExpectation, false, 'nothing to do: never flagged');
});

test('paper test: 5 of 6 suggests verified (owner rule); the teacher makes the call', () => {
  const rule = rules.verification;
  assert.deepEqual(scorePaperTest([1, 1, 1, 1, 1, 0], rule), { score: 5, outOf: 6, suggested: 'verified' });
  assert.equal(scorePaperTest([1, 1, 1, 1, 0, 0], rule).suggested, 'not-yet');
  assert.throws(() => scorePaperTest([1, 1, 1], rule));
  const first = verificationRecord({ code: 'k', skillId: SKILL, assessmentId: SKILL, version: 'A', marks: [1, 1, 1, 1, 0, 0], rule, decision: 'verified', by: 't', at: 'now' });
  assert.equal(first.suggested, 'not-yet');
  assert.equal(first.decision, 'verified', 'teacher override is kept, with the suggestion alongside');
  const second = verificationRecord({ code: 'k', skillId: SKILL, assessmentId: SKILL, version: 'B', marks: [1, 1, 1, 1, 1, 1], rule, by: 't', at: 'later', previous: [first] });
  assert.equal(second.attempt, 2);
});

test('after "send back to redo": the old mastery and the old paper test no longer count; a new attempt does', () => {
  const sections = [record(`${SKILL}.combine`), record(`${SKILL}.whole`, { mastery: true, at: '2026-11-10T10:00:00Z' })];
  const notYet = { skillId: SKILL, decision: 'not-yet', at: '2026-11-11T10:00:00Z' };
  const verified = { skillId: SKILL, decision: 'verified', at: '2026-11-11T09:00:00Z' };
  const resets = [{ skillId: SKILL, at: '2026-11-12T10:00:00Z' }];
  const after = status({ diagnosticResult: gapCombine, sections, verifications: [verified, notYet], resets });
  assert.equal(after.skills[SKILL], 'working');
  assert.equal(after.next.section, `${SKILL}.whole`, 'Putting it together is next again');
  const redone = [...sections, record(`${SKILL}.whole`, { mastery: true, at: '2026-11-14T10:00:00Z' })];
  assert.equal(status({ diagnosticResult: gapCombine, sections: redone, verifications: [notYet], resets }).skills[SKILL], 'platform');
});

test('practice sets count as activity (days, minutes) and on their own; not as sections', () => {
  const now = '2026-11-19T12:00:00Z';
  const practice = [{ finishedAt: '2026-11-17T10:00:00Z', seconds: 600 }];
  const p = participation({ sections: [], practice }, { now, expectedSections: 1 });
  assert.deepEqual([p.daysActive, p.practiceSets, p.sectionsFinished, p.minutes, p.inactive], [1, 1, 0, 10, false]);
});

test('memory checks: due after 14 days; a slip shows as "slipping" on platform mastery, never overrides "verified"', () => {
  const sections = [record(`${SKILL}.combine`), record(`${SKILL}.whole`, { mastery: true, at: '2026-10-01T10:00:00Z' })];
  const o = { diagnosticResult: gapCombine, sections, retention: rules.retention };
  assert.equal(status({ ...o, now: '2026-10-10T00:00:00Z' }).memory[SKILL].status, 'waiting');
  assert.equal(status({ ...o, now: '2026-10-16T00:00:00Z' }).memory[SKILL].status, 'due');
  const slip = [{ skillId: SKILL, held: false, finishedAt: '2026-10-16T10:00:00Z' }];
  const s = status({ ...o, memory: slip, now: '2026-10-20T00:00:00Z' });
  assert.equal(s.skills[SKILL], 'slipping');
  assert.equal(s.subskills[`${SKILL}.combine`], 'slipping');
  const verified = { skillId: SKILL, decision: 'verified', at: '2026-10-05T10:00:00Z' };
  const v = status({ ...o, memory: slip, verifications: [verified], now: '2026-10-20T00:00:00Z' });
  assert.equal(v.skills[SKILL], 'verified');
  assert.equal(v.memory[SKILL].status, 'slipping', 'the teacher still sees the slip');
  // The refresher's mastery restarts the schedule.
  const back = [...sections, record(`${SKILL}.whole`, { mastery: true, at: '2026-10-18T10:00:00Z' })];
  assert.equal(status({ ...o, sections: back, memory: slip, now: '2026-10-20T00:00:00Z' }).skills[SKILL], 'platform');
});

test('memory checks count as activity in participation', () => {
  const p = participation({ memory: [{ finishedAt: '2026-11-19T10:00:00Z', seconds: 120 }] }, { now: '2026-11-20T10:00:00Z' });
  assert.equal(p.memoryChecks, 1);
  assert.equal(p.minutes, 2);
});
