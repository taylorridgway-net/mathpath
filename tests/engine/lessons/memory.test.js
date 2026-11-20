// Memory checks (retention): when they're due, and what a miss does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryState, memoryEvents, memoryHeld } from '../../../engine/lessons/memory.js';

const rule = { afterDays: [14, 28], difficulties: [2, 3, 3], holdAt: 2 };
const d = (day) => new Date(Date.UTC(2026, 8, 1) + day * 86400000).toISOString();

test('not mastered: no memory checks', () => {
  assert.equal(memoryState([], rule, d(0)).status, 'none');
  assert.equal(memoryState([{ type: 'check', at: d(1), held: true }], rule, d(30)).status, 'none');
});

test('first check is due 14 days after platform mastery', () => {
  const ev = [{ type: 'mastered', at: d(0) }];
  assert.deepEqual(memoryState(ev, rule, d(13)), { status: 'waiting', stage: 0, dueAt: d(14), lastAt: d(0) });
  assert.equal(memoryState(ev, rule, d(14)).status, 'due');
});

test('the second is due 28 days after the first was passed; then the skill is kept', () => {
  const ev = [{ type: 'mastered', at: d(0) }, { type: 'check', at: d(16), held: true }];
  assert.deepEqual(memoryState(ev, rule, d(20)), { status: 'waiting', stage: 1, dueAt: d(44), lastAt: d(16) });
  assert.equal(memoryState(ev, rule, d(44)).status, 'due');
  ev.push({ type: 'check', at: d(45), held: true });
  assert.equal(memoryState(ev, rule, d(400)).status, 'kept');
});

test('a missed check: slipping until a refresher gives platform mastery again, which restarts the schedule', () => {
  const ev = [{ type: 'mastered', at: d(0) }, { type: 'check', at: d(15), held: false }];
  assert.equal(memoryState(ev, rule, d(60)).status, 'slipping');
  ev.push({ type: 'mastered', at: d(17) });
  assert.deepEqual(memoryState(ev, rule, d(18)), { status: 'waiting', stage: 0, dueAt: d(31), lastAt: d(17) });
});

test('mastering again without a slip ("Practice again") doesn\'t move the schedule', () => {
  const ev = [{ type: 'mastered', at: d(0) }, { type: 'mastered', at: d(10) }];
  assert.equal(memoryState(ev, rule, d(14)).status, 'due');
});

test('event order doesn\'t matter (records arrive in any order)', () => {
  const ev = [{ type: 'check', at: d(15), held: false }, { type: 'mastered', at: d(0) }];
  assert.equal(memoryState(ev, rule, d(20)).status, 'slipping');
});

test('events from records skip anything before the teacher\'s reset', () => {
  const sections = [
    { lesson: 'frac.add-sub', provisionalMastery: true, finishedAt: d(0) },
    { lesson: 'frac.add-sub', provisionalMastery: false, finishedAt: d(2) },
    { lesson: 'frac.compare', provisionalMastery: true, finishedAt: d(3) },
    { lesson: 'frac.add-sub', provisionalMastery: true, finishedAt: d(30) },
  ];
  const checks = [{ skillId: 'frac.add-sub', held: true, finishedAt: d(15) }];
  assert.deepEqual(memoryEvents('frac.add-sub', { sections, checks }), [
    { type: 'mastered', at: d(0) }, { type: 'mastered', at: d(30) }, { type: 'check', at: d(15), held: true },
  ]);
  assert.deepEqual(memoryEvents('frac.add-sub', { sections, checks, resetAt: d(20) }), [{ type: 'mastered', at: d(30) }]);
});

test('held up at 2 of 3 right on the first try', () => {
  const r = (...o) => ({ problems: o.map((outcome) => ({ outcome })) });
  assert.equal(memoryHeld(r('right-first', 'missed', 'right-first'), rule), true);
  assert.equal(memoryHeld(r('right-first', 'missed', 'missed'), rule), false);
});
