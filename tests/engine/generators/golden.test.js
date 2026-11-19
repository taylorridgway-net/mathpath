// Fails if any generator now produces different problems for the same seed
// than it did when golden.json was recorded. See tools/update-golden.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGolden } from '../../../tools/update-golden.js';

const saved = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const current = buildGolden();

test('every generator has saved reference problems', () => {
  assert.deepEqual(Object.keys(current).sort(), Object.keys(saved).sort(),
    'Generators were added or removed. If intended, run: npm run update-golden');
});

for (const id of Object.keys(current)) {
  test(`${id} still produces the same problems for the same seeds`, () => {
    if (!saved[id]) return;
    if (current[id].version === saved[id].version) {
      assert.deepEqual(current[id].problems, saved[id].problems,
        `${id} changed its output without a version bump. Saved student work would no longer re-check. ` +
        'Undo the change, or bump the generator version and run: npm run update-golden');
    } else {
      assert.fail(`${id} version changed (${saved[id].version} -> ${current[id].version}). ` +
        'If intended, run: npm run update-golden');
    }
  });
}
