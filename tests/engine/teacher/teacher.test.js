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
  const r = { ...gapCombine, uncheckedCauses: ['frac.equivalent'] };
  assert.equal(status({ diagnosticResult: r, waitForTeacher: true }).waiting, true);
  assert.equal(status({ diagnosticResult: r, cleared: ['frac.equivalent'], waitForTeacher: true }).waiting, false);
  assert.equal(status({ diagnosticResult: r }).waiting, false, 'by default (owner decision) nobody waits');
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
