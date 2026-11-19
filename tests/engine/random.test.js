import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashSeed } from '../../engine/random.js';

const draw = (seed, count) => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

test('same seed gives the same sequence', () => {
  assert.deepEqual(draw('maple-tiger-42', 50), draw('maple-tiger-42', 50));
});

test('different seeds give different sequences', () => {
  assert.notDeepEqual(draw('a', 10), draw('b', 10));
});

test('the sequence never changes between versions (server re-checking depends on this)', () => {
  // These numbers were recorded once. If this test fails, every saved seed would
  // now produce different problems. Don't "fix" the numbers; fix the code.
  assert.equal(hashSeed('mathpath'), 1989287944);
  const rng = createRng(12345);
  assert.deepEqual([1, 2, 3, 4, 5].map(() => rng.int(1, 100)), [73, 70, 100, 63, 30]);
  assert.equal(createRng('maple-tiger-42').next(), 0.12024155841208994);
});

test('next() stays in [0, 1)', () => {
  for (const x of draw('range', 10000)) assert.ok(x >= 0 && x < 1);
});

test('int() covers every value in range and nothing outside it', () => {
  const rng = createRng('ints');
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const x = rng.int(3, 9);
    assert.ok(Number.isInteger(x) && x >= 3 && x <= 9);
    seen.add(x);
  }
  assert.equal(seen.size, 7);
});

test('int() is roughly even', () => {
  const rng = createRng('even');
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 40000; i++) counts[rng.int(0, 3)]++;
  for (const c of counts) assert.ok(c > 9000 && c < 11000, `count ${c} is suspiciously uneven`);
});

test('int() rejects bad ranges', () => {
  const rng = createRng(1);
  assert.throws(() => rng.int(5, 2));
  assert.throws(() => rng.int(1.5, 3));
});

test('pick() and chance()', () => {
  const rng = createRng('pick');
  assert.throws(() => rng.pick([]));
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(rng.pick(['a', 'b', 'c']));
  assert.equal(seen.size, 3);
  assert.equal(rng.chance(0), false);
  assert.equal(rng.chance(1), true);
});
