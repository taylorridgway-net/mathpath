// Worked solutions for linear functions: every stated calculation is right, and the
// answer (a number, or y = mx + b) is in the last step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { solve } from '../../../engine/solutions/index.js';
import { toText } from '../../../engine/problem/text.js';
import { reduce } from '../../../engine/math/fraction.js';

const PARTS = Object.keys(generators).filter((id) => id.startsWith('lin.') && !generators[id].mixed);
const n = (v) => (v < 0 ? `−${-v}` : String(v));
const num = (t) => Number(t.replace(/[()]/g, '').replace('−', '-'));

test('every stated calculation is right; the answer is in the last step', () => {
  for (const id of PARTS) for (const d of DIFFICULTIES) for (let i = 0; i < 150; i++) {
    const p = generateProblem(id, `ls-${i}`, d);
    const steps = solve(p);
    const all = steps.map((s) => s.say).join(' / ');
    assert.doesNotMatch(all, /undefined|NaN|Infinity/, all);
    // Whole chains like "6 × (−2) + 6 = −6", with the usual order of operations.
    for (const m of all.matchAll(/(?<![\d)] [+−×÷] |[\d)])((?:\(?−?\d+\)? [+−×÷] )+\(?−?\d+\)?) = (−?\d+)(?![\d/])/g)) {
      const js = m[1].replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
      assert.equal(Function(`"use strict"; return (${js});`)(), num(m[2]), `${m[0]} in: ${all}`);
    }
    const a = p.answer;
    const last = steps.at(-1).say;
    if (a.type === 'choice') {
      assert.ok(last.includes(a.options[a.correct]), `${toText(p.expression)}: ${last}`);
    } else if (a.type === 'linear') {
      const m = a.coef; const b = a.constant;
      const eq = `y = ${m === 1 ? '' : m === -1 ? '−' : n(m)}x${b === 0 ? '' : b < 0 ? ` − ${-b}` : ` + ${b}`}`;
      assert.ok(last.includes(eq), `${toText(p.expression)}: ${last} (want ${eq})`);
    } else {
      const r = reduce(a.value);
      const shown = r.d === 1 ? n(r.n) : `${r.n < 0 ? '−' : ''}${Math.abs(r.n)}/${r.d}`;
      assert.ok(last.includes(shown), `${toText(p.expression)}: ${last} (want ${shown})`);
    }
  }
});
