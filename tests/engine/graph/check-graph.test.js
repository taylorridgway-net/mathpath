// Proves the checker actually catches each kind of mistake.
// Each test starts from a tiny valid graph, breaks one thing, and expects a complaint.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGraph } from '../../../engine/graph/check-graph.js';

function validGraph() {
  const index = {
    schemaVersion: 1,
    curriculumVersion: '0.0.1',
    domains: [{ id: 'd', name: 'Demo', file: 'd.json' }],
  };
  const file = {
    schemaVersion: 1,
    domain: { id: 'd', name: 'Demo' },
    skills: [
      {
        id: 'd.base', name: 'Base', status: 'draft', prerequisites: [],
        subskills: [{ id: 'd.base.one', name: 'One', prerequisites: [] }],
      },
      {
        id: 'd.top', name: 'Top', status: 'draft',
        prerequisites: [{ id: 'd.base', strength: 'essential' }],
        subskills: [
          { id: 'd.top.one', name: 'One', prerequisites: [{ id: 'd.base.one', strength: 'supporting' }] },
          { id: 'd.top.two', name: 'Two', prerequisites: [{ id: 'd.top.one', strength: 'essential' }] },
        ],
      },
    ],
  };
  return { index, files: { 'd.json': file }, skills: file.skills };
}

function problemsFor(g) {
  return checkGraph(g.index, g.files);
}

function assertComplains(g, fragment) {
  const problems = problemsFor(g);
  assert.ok(
    problems.some((p) => p.includes(fragment)),
    `expected a problem mentioning "${fragment}", got: ${JSON.stringify(problems)}`,
  );
}

test('a valid graph has no problems', () => {
  assert.deepEqual(problemsFor(validGraph()), []);
});

test('missing prerequisite target', () => {
  const g = validGraph();
  g.skills[1].prerequisites.push({ id: 'd.nope', strength: 'essential' });
  assertComplains(g, 'does not exist');
});

test('bad strength', () => {
  const g = validGraph();
  g.skills[1].prerequisites[0].strength = 'kind of';
  assertComplains(g, 'strength must be');
});

test('missing strength', () => {
  const g = validGraph();
  delete g.skills[1].prerequisites[0].strength;
  assertComplains(g, 'strength must be');
});

test('duplicate id', () => {
  const g = validGraph();
  g.skills[1].subskills[1].id = 'd.top.one';
  assertComplains(g, 'used more than once');
});

test('subskill id must start with its skill id', () => {
  const g = validGraph();
  g.skills[1].subskills[0].id = 'd.base.two';
  assertComplains(g, 'must start with "d.top."');
});

test('skill id must start with its domain id', () => {
  const g = validGraph();
  g.skills[0].id = 'x.base';
  assertComplains(g, 'must start with "d."');
});

test('ids must be lowercase with dashes', () => {
  const g = validGraph();
  g.skills[0].subskills[0].id = 'd.base.Big_One';
  assertComplains(g, 'lowercase');
});

test('loop between skills', () => {
  const g = validGraph();
  g.skills[0].subskills[0].prerequisites.push({ id: 'd.top.two', strength: 'essential' });
  assertComplains(g, 'loop between skills');
});

test('loop between sibling subskills', () => {
  const g = validGraph();
  g.skills[1].subskills[0].prerequisites.push({ id: 'd.top.two', strength: 'essential' });
  assertComplains(g, 'loop between subskills');
});

test('a skill cannot need its own subskill', () => {
  const g = validGraph();
  g.skills[1].prerequisites.push({ id: 'd.top.one', strength: 'essential' });
  assertComplains(g, "can't need itself");
});

test('a skill being built needs at least one subskill', () => {
  const g = validGraph();
  g.skills[0].subskills = [];
  g.skills[1].subskills[0].prerequisites = [];
  assertComplains(g, 'at least one subskill');
});

test('a stub skill may have no subskills', () => {
  const g = validGraph();
  g.skills[0].status = 'stub';
  g.skills[0].subskills = [];
  g.skills[1].subskills[0].prerequisites = [];
  assert.deepEqual(problemsFor(g), []);
});

test('nothing active may depend on a retired skill', () => {
  const g = validGraph();
  g.skills[0].status = 'retired';
  assertComplains(g, 'retired');
});

test('bad status', () => {
  const g = validGraph();
  g.skills[0].status = 'finished';
  assertComplains(g, 'status must be');
});

test('domain file listed but missing', () => {
  const g = validGraph();
  g.index.domains.push({ id: 'e', name: 'E', file: 'e.json' });
  assertComplains(g, 'not provided');
});

test('wrong schema version', () => {
  const g = validGraph();
  g.files['d.json'].schemaVersion = 2;
  assertComplains(g, 'schemaVersion');
});
