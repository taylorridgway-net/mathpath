// Integer paper tests: every answer key re-computed here from its calculation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const papers = ['int.add-sub', 'int.mult-div'].map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

// "-8 - -13", "-4 × 3 × -5": numbers and operations, left to right (only one kind of operation per item).
function evaluate(math) {
  const t = math.split(' ');
  let v = Number(t[0]);
  for (let i = 1; i < t.length; i += 2) {
    const n = Number(t[i + 1]);
    v = { '+': v + n, '-': v - n, '×': v * n, '÷': v / n }[t[i]];
  }
  return v;
}

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);
  test(`${paper.skill}: every answer key matches its calculation`, () => {
    for (const item of items) {
      const want = String(evaluate(item.math));
      assert.ok(item.answer === want || item.answer.startsWith(`${want} `), `${item.id}: key "${item.answer}" but ${item.math} = ${want}`);
    }
  });
  test(`${paper.skill}: the prompt shows every number the calculation uses; ${rules.outOf} items, 2+ word problems`, () => {
    for (const item of items) {
      for (const n of item.math.match(/\d+/g)) assert.ok(item.prompt.match(/\d+/g)?.includes(n), `${item.id}: ${n}`);
      // A negative number in a computation item is written with a real minus sign.
      if (item.kind === 'computation') for (const n of item.math.split(' ').filter((x) => x.startsWith('-') && x.length > 1)) assert.ok(item.prompt.includes(`−${n.slice(1)}`), `${item.id}: ${n}`);
    }
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2);
    }
  });
}
