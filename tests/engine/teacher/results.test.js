// Results tab numbers, from hand-made records where every answer is known.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classResults, share } from '../../../engine/teacher/results.js';

const lessons = [
  { skill: 'frac.add-sub', sections: [{ id: 'fa.common', mode: 'section', forGap: 'frac.add-sub.common-denom' }, { id: 'fa.whole', mode: 'skill', forGap: 'frac.add-sub' }] },
  { skill: 'int.add-sub', sections: [{ id: 'ia.sub', mode: 'section', forGap: 'int.add-sub.subtract' }, { id: 'ia.whole', mode: 'skill', forGap: 'int.add-sub' }] },
];
const rec = (section, startedAt, finishedAt, extra = {}) => ({ section, startedAt, finishedAt, problemCount: 6, firstTry: 4, seconds: 300, passed: true, ...extra });

const ana = {
  code: 'ana',
  result: { skills: { 'frac.add-sub': 'gap', 'int.add-sub': 'known' }, nodes: { 'frac.add-sub.common-denom': { status: 'gap' } } },
  sections: [
    rec('fa.common', '2026-11-01T10:00:00Z', '2026-11-01T10:10:00Z', { problemCount: 3, firstTry: 3 }), // aced from the start
    rec('fa.whole', '2026-11-03T10:00:00Z', '2026-11-03T10:15:00Z', { provisionalMastery: true }),
  ],
  verifications: [
    { skillId: 'frac.add-sub', decision: 'not-yet', suggested: 'not-yet', at: '2026-11-02T00:00:00Z' }, // before platform mastery: not counted
    { skillId: 'frac.add-sub', decision: 'verified', suggested: 'verified', at: '2026-11-05T00:00:00Z' },
  ],
  memory: [{ skillId: 'frac.add-sub', held: true }],
  status: { skills: { 'frac.add-sub': 'verified', 'int.add-sub': 'known' }, platformAt: { 'frac.add-sub': '2026-11-03T10:15:00Z' }, memory: { 'frac.add-sub': { status: 'waiting' } } },
};
const ben = {
  code: 'ben',
  result: { skills: { 'frac.add-sub': 'gap', 'int.add-sub': 'gap' }, nodes: { 'frac.add-sub.common-denom': { status: 'gap' }, 'int.add-sub.subtract': { status: 'gap' } } },
  sections: [
    rec('fa.common', '2026-11-02T10:00:00Z', '2026-11-02T10:20:00Z', { problemCount: 8, firstTry: 5 }),
    rec('fa.whole', '2026-11-06T10:00:00Z', '2026-11-06T10:20:00Z', { provisionalMastery: true, problemCount: 7, seconds: 600 }),
    rec('ia.sub', '2026-11-07T10:00:00Z', '2026-11-07T10:20:00Z', { passed: false }),
  ],
  verifications: [
    { skillId: 'frac.add-sub', decision: 'not-yet', suggested: 'verified', at: '2026-11-08T00:00:00Z' }, // teacher overrode
    { skillId: 'int.add-sub', decision: 'verified', suggested: 'verified', at: '2026-11-01T00:00:00Z' }, // before any platform mastery: not counted
  ],
  memory: [{ skillId: 'frac.add-sub', held: false }],
  status: { skills: { 'frac.add-sub': 'slipping', 'int.add-sub': 'working' }, platformAt: { 'frac.add-sub': '2026-11-06T10:20:00Z' }, memory: { 'frac.add-sub': { status: 'slipping' } } },
};

test('results: gaps closed, paper tests, over-flagging, time to mastery and memory checks', () => {
  const r = classResults([ana, ben, { code: 'new', status: { skills: {} } }], { lessons });
  assert.equal(r.students, 3);
  assert.deepEqual(r.gaps, { found: 3, mastered: 2, verified: 1, students: 2 });
  assert.deepEqual(r.paper, { tests: 2, confirmed: 1, notYet: 1, agreed: 1 });
  assert.deepEqual(r.overFlagged, { started: 3, perfect: 1 });
  assert.deepEqual(r.memory, { taken: 2, held: 1, slipping: 1, kept: 0 });
  const fa = r.bySkill.find((x) => x.skill === 'frac.add-sub');
  assert.equal(fa.gapped, 2);
  assert.equal(fa.mastered, 2);
  assert.equal(fa.verified, 1);
  assert.equal(fa.reached, 2);
  // Ana: Nov 1 10:00 -> Nov 3 10:15 (2.01 days); Ben: Nov 2 10:00 -> Nov 6 10:20 (4.01 days).
  assert.ok(Math.abs(fa.medianDays - (2.0104 + 4.0139) / 2) < 0.01, String(fa.medianDays));
  assert.equal(fa.medianProblems, (3 + 6 + 8 + 7) / 2); // Ana 9, Ben 15
  assert.equal(fa.medianMinutes, (10 + 15) / 2); // Ana 600 s, Ben 900 s
  const ia = r.bySkill.find((x) => x.skill === 'int.add-sub');
  assert.deepEqual([ia.gapped, ia.mastered, ia.reached, ia.medianDays], [1, 0, 0, null]);
  assert.equal(share(18, 22), '18 of 22 (82%)');
  assert.equal(share(0, 0), '—');
});

test('results: quick reviews don\'t count as over-flagging, and nothing at all gives empty results', () => {
  const st = { ...ben, sections: [rec('fa.common', 'a', 'b', { review: true, problemCount: 3, firstTry: 3 })] };
  assert.deepEqual(classResults([st], { lessons }).overFlagged, { started: 0, perfect: 0 });
  const empty = classResults([], { lessons });
  assert.deepEqual(empty.gaps, { found: 0, mastered: 0, verified: 0, students: 0 });
  assert.deepEqual(empty.bySkill, []);
});
