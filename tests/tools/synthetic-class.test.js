// The pretend class: deterministic, the requested size, and only made-up people.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticClass } from '../../tools/synthetic-class.js';
import { replayDiagnostic } from '../../engine/diagnostic/diagnostic.js';
import { replayPractice } from '../../engine/practice/practice.js';
import { loadClassSetup } from '../helpers/class-setup.js';
import { practicePlan, memoryCheckPlan } from '../../engine/lessons/plan.js';
import { memoryHeld } from '../../engine/lessons/memory.js';

const setup = loadClassSetup();
const now = '2026-11-19T20:00:00Z';
const make = (periods) => syntheticClass({ periods, now, setup });

test('same settings, same class', () => {
  assert.deepEqual(make([{ size: 20 }]), make([{ size: 20 }]));
});

test('any mix of 1-6 periods of 20-45 students', () => {
  const c = make([{ size: 20 }, { size: 45 }, { size: 33 }, { size: 20 }, { size: 45 }, { size: 21 }]);
  assert.equal(c.classes.length, 6);
  assert.equal(c.students.length, 184);
  assert.equal(new Set(c.students.map((s) => s.code)).size, 184, 'codes are unique');
  assert.ok(c.roster.every((r) => /^Sample Student \d+$/.test(r.realName)), 'only made-up names');
});

test('saved records replay through the real engine to the same results (as the server will check them)', () => {
  const c = make([{ size: 25 }]);
  for (const d of c.diagnostics) {
    const r = replayDiagnostic({ graph: setup.graph, generators: setup.generators, misconceptions: setup.misconceptions, config: setup.diagnosticConfig, seed: d.seed }, d.answers).result();
    assert.ok(r.finished, d.code);
  }
  for (const s of c.sections) {
    const sec = setup.lessons.flatMap((l) => l.sections).find((x) => x.id === s.section);
    const r = replayPractice({ generators: setup.generators, rules: setup.rules, seed: s.seed, plan: practicePlan(sec, { review: s.review }) }, s.answers).result();
    assert.equal(r.endedBy, s.endedBy, s.seed);
  }
  assert.ok(c.sections.length > 10 && c.verifications.length > 0, 'the class has some activity');
  for (const m of c.memory) {
    const r = replayPractice({ generators: setup.generators, rules: setup.rules, seed: m.seed, plan: memoryCheckPlan(m.skillId, setup.rules) }, m.answers).result();
    assert.equal(memoryHeld(r, setup.rules.retention), m.held, m.seed);
  }
});

test('some memory checks: most hold up, some slip (and some of those get a refresher)', () => {
  const c = make([{ size: 45 }, { size: 45 }]);
  const held = c.memory.filter((m) => m.held).length;
  assert.ok(c.memory.length >= 5, `memory checks: ${c.memory.length}`);
  assert.ok(held > 0 && held < c.memory.length, `held ${held} of ${c.memory.length}`);
  assert.ok(c.sections.some((s) => s.review && s.mode === 'skill'), 'a refresher');
});
