// Worked solutions for "Understand fractions" end with the right answer (worked out here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';

test('every "understand fractions" solution reaches the right answer', () => {
  for (const d of DIFFICULTIES) for (let i = 0; i < 100; i++) {
    for (const id of ['frac.meaning.read-models', 'frac.meaning.number-line', 'frac.meaning.division', 'frac.meaning']) {
      const p = generateProblem(id, `sm-${i}`, d);
      const kind = p.part || p.generator;
      const e = p.expression;
      const text = solve(p).map((s) => s.say).join(' ');
      let want;
      if (kind.endsWith('read-models')) want = `So ${e.shaded}/${e.parts} is shaded.`;
      if (kind.endsWith('number-line')) want = `the dot is at ${e.point}/${e.perUnit}.`;
      if (kind.endsWith('division')) want = e.type === 'frac' ? `= ${e.n / e.d}.` : `= ${e.left.value}/${e.right.value}.`;
      assert.ok(text.includes(want), `${id} d${d}: "${text}" should contain "${want}"`);
    }
  }
});
