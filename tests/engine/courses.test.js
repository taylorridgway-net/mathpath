// Course mapping (curriculum/courses.json): a class's course holds back the skills it hasn't
// taught yet: no check questions, no lessons on the path, "not taught" on the dashboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heldSkills, courseUnits, courseIndexOf, isHeld } from '../../engine/courses/courses.js';
import { catchUpTargets, compactResult, startDiagnostic } from '../../engine/diagnostic/diagnostic.js';
import { buildPath } from '../../engine/lessons/path.js';
import { studentStatus } from '../../engine/teacher/student-status.js';
import { simulatedStudent, runWithStudent } from '../../tools/simulated-student.js';
import { loadClassSetup } from '../helpers/class-setup.js';

const setup = loadClassSetup();
const courses = JSON.parse(readFileSync(new URL('../../curriculum/courses.json', import.meta.url), 'utf8'));
const LIN = ['lin.functions', 'lin.slope', 'lin.slope-intercept', 'lin.graphing', 'lin.forms', 'lin.parallel'];

test('the course file: real skills with lessons, each in one unit, never a fractions-check skill', () => {
  const all = courses.courses.flatMap((c) => c.units.flatMap((u) => u.skills));
  assert.equal(new Set(all).size, all.length, 'no skill in two units');
  for (const id of all) {
    assert.ok(setup.graph.has(id) && setup.graph.get(id).kind === 'skill', id);
    assert.ok(setup.lessons.some((l) => l.skill === id), `${id} has a lesson`);
    assert.ok(!setup.diagnosticConfig.targets.includes(id), `${id} is a foundation (fractions check)`);
  }
  assert.deepEqual(courses.courses.map((c) => c.id), ['im1', 'im2', 'im3']);
});

test('IM1 holds back linear functions, systems and factoring; IM2 only factoring; IM3 and no course: nothing', () => {
  const im1 = heldSkills({ courses, course: 'im1' });
  for (const id of [...LIN, 'alg.systems', 'poly.multiply', 'poly.factor']) assert.ok(im1.includes(id), id);
  assert.ok(!im1.includes('frac.add-sub') && !im1.includes('alg.equations') && !im1.includes('stat.center'), 'foundations are never held back');
  assert.deepEqual(heldSkills({ courses, course: 'im2' }).sort(), ['poly.factor', 'poly.multiply']);
  assert.deepEqual(heldSkills({ courses, course: 'im3' }), []);
  assert.deepEqual(heldSkills({ courses, course: '' }), []);
  // Opened by the teacher: no longer held back.
  assert.ok(!heldSkills({ courses, course: 'im1', opened: ['alg.systems'] }).includes('alg.systems'));
  assert.equal(courseIndexOf(courses, 'alg.systems'), 0);
  assert.equal(courseIndexOf(courses, 'frac.add-sub'), -1);
  assert.ok(isHeld(['alg.systems'], 'alg.systems.graph') && !isHeld(['alg.systems'], 'alg.systemsx'));
  const units = courseUnits({ courses, course: 'im1', opened: ['alg.systems'] });
  assert.equal(units.find((u) => u.skills.some((s) => s.id === 'alg.systems')).skills[0].open, true);
});

// A student who knows everything in the fractions check and every later check before Equations.
function priorThrough(checkId) {
  const student = simulatedStudent({ graph: setup.graph, generators: setup.generators });
  const prior = compactResult(runWithStudent(startDiagnostic({ ...setup, config: setup.diagnosticConfig, seed: 'c' }), student));
  for (const check of setup.diagnosticConfig.moreChecks) {
    if (check.id === checkId) break;
    for (const id of check.targets) prior.nodes[id] = { status: 'known' };
  }
  return prior;
}
const targets = (prior, held) => catchUpTargets({ graph: setup.graph, generators: setup.generators, config: setup.diagnosticConfig, prior, held });

test('checks: a held-back skill is never asked; a check that is all held back is skipped', () => {
  const prior = priorThrough('equations');
  assert.ok(targets(prior, []).includes('alg.systems'));
  const im1 = heldSkills({ courses, course: 'im1' });
  assert.deepEqual(targets(prior, im1), ['alg.equations', 'alg.multi-step', 'alg.inequalities', 'alg.inequality-graphs']);
  // Past statistics, IM1 has nothing left to check (linear functions and factoring are all held back).
  const late = priorThrough('linear');
  assert.deepEqual(targets(late, im1), []);
  assert.deepEqual(targets(late, heldSkills({ courses, course: 'im2' })).sort(), [...LIN].sort(), 'IM2: linear functions are expected (taught in IM1)');
});

test('path: a held-back skill\'s lessons stay off, even after a missed early check, unless the teacher assigns them', () => {
  const prior = priorThrough('equations');
  prior.nodes['alg.systems'] = { status: 'gap' };
  prior.nodes['alg.systems.substitute'] = { status: 'gap' };
  prior.skills = { ...prior.skills, 'alg.systems': 'gap' };
  const ids = (p) => p.filter((i) => i.kind === 'section').map((i) => i.lesson);
  const base = { result: prior, lessons: setup.lessons, graph: setup.graph };
  assert.ok(ids(buildPath(base)).includes('alg.systems'));
  assert.ok(!ids(buildPath({ ...base, held: ['alg.systems'] })).includes('alg.systems'));
  assert.ok(ids(buildPath({ ...base, held: ['alg.systems'], assigned: [{ lesson: 'alg.systems' }] })).includes('alg.systems'), 'the teacher can still assign it');
  // Dashboard: "not taught", not a gap.
  const status = studentStatus({ diagnosticResult: prior, graph: setup.graph, lessons: setup.lessons, held: ['alg.systems'] });
  assert.equal(status.skills['alg.systems'], 'not-taught');
  assert.equal(status.subskills['alg.systems.substitute'], 'not-taught');
  assert.equal(studentStatus({ diagnosticResult: prior, graph: setup.graph, lessons: setup.lessons }).skills['alg.systems'], 'gap');
});

// ---------- unit readiness ----------
import { unitReadiness, readinessOf } from '../../engine/courses/readiness.js';

test('each unit relies on real skills with lessons, all from earlier courses or foundations', () => {
  courses.courses.forEach((c, at) => {
    for (const u of c.units) {
      assert.ok(u.reliesOn.length >= 2, u.name);
      for (const id of u.reliesOn) {
        assert.ok(setup.graph.has(id) && setup.graph.get(id).kind === 'skill', `${u.name}: ${id}`);
        assert.ok(setup.lessons.some((l) => l.skill === id), `${id} has a lesson to assign`);
        assert.ok(courseIndexOf(courses, id) < at, `${u.name} relies on ${id}, which its own or a later course teaches`);
      }
    }
  });
});

test('readiness: ready only with every skill shown; gaps listed by skill; unchecked kept apart; held-back skills ignored', () => {
  const unit = { name: 'U', reliesOn: ['int.add-sub', 'alg.equations', 'lin.slope'] };
  const st = (code, skills, held = []) => ({ code, held, status: { skills } });
  const r = unitReadiness(unit, [
    st('a', { 'int.add-sub': 'known', 'alg.equations': 'verified', 'lin.slope': 'platform' }),
    st('b', { 'int.add-sub': 'gap', 'alg.equations': 'credited', 'lin.slope': 'known' }),
    st('c', { 'int.add-sub': 'known', 'alg.equations': 'not-tested', 'lin.slope': 'known' }),
    st('d', { 'int.add-sub': 'working', 'alg.equations': 'not-tested', 'lin.slope': 'gap' }),
    st('e', { 'int.add-sub': 'known', 'alg.equations': 'known', 'lin.slope': 'not-taught' }, ['lin.slope']),
  ]);
  assert.deepEqual(r.ready, ['a', 'e']);
  assert.deepEqual(r.notReady, ['b', 'd']);
  assert.deepEqual(r.needs, [{ skill: 'int.add-sub', codes: ['b', 'd'] }, { skill: 'lin.slope', codes: ['d'] }]);
  assert.deepEqual(r.unknown, [{ skill: 'alg.equations', codes: ['c', 'd'] }]);
  assert.equal(readinessOf('slipping'), 'needs');
  assert.equal(readinessOf('partly'), 'unknown');
});
