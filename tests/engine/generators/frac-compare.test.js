// Compare fractions: the right button worked out here by cross-multiplying.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => `cmp-${i}`);
const catalog = new Set(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/frac.json', import.meta.url), 'utf8')).misconceptions.map((m) => m.id));
const val = (f) => (f.type === 'int' ? [f.value, 1] : [f.n, f.d]);
const rightSign = (e) => { const [a, b] = val(e.left); const [c, d] = val(e.right); return a * d < c * b ? '<' : a * d === c * b ? '=' : '>'; };

for (const id of ['frac.compare.like', 'frac.compare.benchmark', 'frac.compare.unlike']) {
  test(`${id}: the right button is worked out independently; every wrong-answer pattern is a different, wrong button`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const { options, correct } = p.answer;
      if (p.expression.type === 'compare') {
        assert.equal(options[correct], rightSign(p.expression), JSON.stringify(p.expression));
      } else {
        const { n, d: den } = p.expression; // closest benchmark
        const dist = [n / den, Math.abs(n / den - 0.5), 1 - n / den];
        assert.equal(correct, dist.indexOf(Math.min(...dist)));
      }
      assert.equal(checkAnswer(p, { choice: correct }).status, 'correct');
      for (const m of p.misconceptions) {
        assert.ok(catalog.has(m.id), m.id);
        assert.notEqual(m.choice, correct);
        assert.equal(checkAnswer(p, { choice: m.choice }).misconception, m.id);
      }
    }
  });
}

test('the classic mistakes are recognised: 3/8 > 3/5, and 3/4 = 5/6', () => {
  let sawDenominator = false;
  let sawGap = false;
  for (const seed of SEEDS) {
    const p1 = generateProblem('frac.compare.unlike', seed, 1);
    if (p1.misconceptions.some((m) => m.id === 'frac.cmp-bigger-denominator-bigger')) sawDenominator = true;
    const p3 = generateProblem('frac.compare.unlike', seed, 3);
    if (p3.misconceptions.some((m) => m.id === 'frac.cmp-gap-equal' && p3.answer.options[m.choice] === '=')) sawGap = true;
  }
  assert.ok(sawDenominator && sawGap);
});

test('"<" and ">" are both common answers (no guessing pattern)', () => {
  for (const d of DIFFICULTIES) {
    const answers = SEEDS.map((s) => { const p = generateProblem('frac.compare.unlike', s, d); return p.answer.options[p.answer.correct]; });
    const lt = answers.filter((a) => a === '<').length / answers.length;
    assert.ok(lt > 0.3 && lt < 0.7, `level ${d}: ${Math.round(lt * 100)}% "<"`);
  }
});

test('closest-benchmark questions never have a near-tie', () => {
  for (const seed of SEEDS) {
    const { n, d } = generateProblem('frac.compare.benchmark', seed, 3).expression;
    const dist = [n / d, Math.abs(n / d - 0.5), 1 - n / d].sort((a, b) => a - b);
    assert.ok(dist[1] - dist[0] >= 1 / 12);
  }
});
