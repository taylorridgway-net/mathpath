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
    // Whole chains (9 + 7 + 9 = 25), worked left to right; only + and − chains, or one operation.
    for (const m of all.matchAll(/(?<![\d.−^×+÷] ?)((?:\(?−?\d+\)? [×+÷−] )+\(?−?\d+\)?) = (−?\d+)(?![\d/]|\.\d)/g)) {
      const v = (t) => Number(t.replace(/[()]/g, '').replace('−', '-'));
      const tok = m[1].split(' ');
      if (tok.length > 3 && tok.some((t, i) => i % 2 && /[×÷]/.test(t))) continue;
      let acc = v(tok[0]);
      for (let i = 1; i < tok.length; i += 2) { const y = v(tok[i + 1]); acc = { '×': acc * y, '+': acc + y, '÷': acc / y, '−': acc - y }[tok[i]]; }
      assert.equal(acc, v(m[2]), `${m[0]} in ${all}`);
    }
    const a = p.answer;
    const ans = a.type === 'choice' ? a.options[a.correct] : `${a.value}${a.suffix ? ` ${a.suffix}` : ''}`;
    assert.ok(steps.at(-1).say.includes(ans), `${toText(p.expression)}: ${steps.at(-1).say} (want ${ans})`);
  }
});
