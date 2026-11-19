// Checks the REAL curriculum files in curriculum/graph/ against the graph rules.
// If someone edits a skill file and breaks a rule, this test fails and says why.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkGraph } from '../../engine/graph/check-graph.js';

const graphDir = new URL('../../curriculum/graph/', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, graphDir), 'utf8'));

test('the curriculum skill graph follows all the rules', () => {
  const index = readJson('domains.json');
  const files = {};
  for (const d of index.domains) files[d.file] = readJson(d.file);

  const problems = checkGraph(index, files);
  assert.deepEqual(problems, [], `Skill graph problems:\n  ${problems.join('\n  ')}`);
});
