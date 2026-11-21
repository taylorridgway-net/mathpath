// Worked solutions for measurement and geometry: no gaps, simple
// arithmetic right, and the answer in the last step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('geo.') && id.split('.').length === 3);
const n = (v) => (v < 0 ? `−${-v}` : String(v));

test('geometry solutions: arithmetic right, answer last', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    const p = generateProblem(id, `sg-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN/, all);
    for (const m of all.matchAll(/(?<![\d.−^])(\(?−?\d+\)?) ([×+÷−]) (\(?−?\d+\)?) = (−?\d+)(?![\d/.])/g)) {
      const v = (t) => Number(t.replace(/[()]/g, '').replace('−', '-'));
      const [x, y] = [v(m[1]), v(m[3])];
      assert.equal({ '×': x * y, '+': x + y, '÷': x / y, '−': x - y }[m[2]], v(m[4]), `${m[0]} in ${all}`);
    }
    const a = p.answer;
    const ans = a.type === 'choice' ? a.options[a.correct] : `${a.value}${a.suffix ? ` ${a.suffix}` : ''}`;
    assert.ok(steps.at(-1).say.includes(ans), `${toText(p.expression)}: ${steps.at(-1).say} (want ${ans})`);
  }
});
