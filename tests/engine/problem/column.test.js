// Column addition and subtraction: the finished layout reads the right answer,
// carries and borrows land where they're written on paper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnLayout } from '../../../engine/problem/column.js';
import { createRng } from '../../../engine/random.js';

const read = (layout) => Number(layout.columns.map((c) => c.result).filter((d) => d !== null).reverse().join(''));

test('47 + 38: 7 + 8 = 15, write 5, carry 1 over the tens; answer 85', () => {
  const one = columnLayout('+', 47, 38, 1);
  assert.equal(one.columns[0].result, 5);
  assert.equal(one.columns[1].carry, 1);
  assert.equal(one.columns[1].result, null, 'the tens are not done yet');
  assert.equal(read(columnLayout('+', 47, 38)), 85);
});

test('503 − 278: borrowing across the zero turns it into 9; answer 225', () => {
  const one = columnLayout('-', 503, 278, 1);
  assert.equal(one.columns[0].newTop, 13);
  assert.equal(one.columns[1].newTop, 9);
  assert.equal(one.columns[2].newTop, 4);
  assert.equal(one.columns[0].result, 5);
  assert.equal(read(columnLayout('-', 503, 278)), 225);
});

test('any 2- or 3-digit sum or difference reads back right, and the carry out of the top makes a new digit', () => {
  const rng = createRng('col');
  for (let i = 0; i < 2000; i++) {
    const a = rng.int(10, 999);
    const b = rng.int(10, 999);
    assert.equal(read(columnLayout('+', a, b)), a + b, `${a} + ${b}`);
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    assert.equal(read(columnLayout('-', hi, lo)), hi - lo, `${hi} − ${lo}`);
  }
  assert.equal(read(columnLayout('+', 95, 87)), 182);
});
