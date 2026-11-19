import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gcd, lcm, fraction, reduce, isSimplest, add, sub, mul, div, equals, compare, toMixed, fromMixed,
} from '../../../engine/math/fraction.js';

const f = (n, d) => fraction(n, d);
const same = (actual, n, d) => assert.deepEqual({ ...actual }, { n, d });

test('gcd and lcm', () => {
  assert.equal(gcd(12, 18), 6);
  assert.equal(gcd(7, 13), 1);
  assert.equal(gcd(0, 5), 5);
  assert.equal(gcd(-8, 12), 4);
  assert.equal(lcm(4, 6), 12);
  assert.equal(lcm(3, 5), 15);
  assert.equal(lcm(3, 6), 6);
});

test('the sign always lives on the numerator', () => {
  same(f(3, -4), -3, 4);
  same(f(-3, -4), 3, 4);
  same(f(0, -4), 0, 4);
  assert.ok(!Object.is(f(0, -4).n, -0));
});

test('fractions are not reduced automatically', () => {
  same(f(6, 8), 6, 8);
  same(reduce(f(6, 8)), 3, 4);
  same(reduce(f(-6, 8)), -3, 4);
  same(reduce(f(0, 8)), 0, 1);
});

test('bad fractions are rejected', () => {
  assert.throws(() => f(1, 0));
  assert.throws(() => f(1.5, 2));
  assert.throws(() => f(1, '2'));
  assert.throws(() => div(f(1, 2), f(0, 3)));
});

test('isSimplest', () => {
  assert.ok(isSimplest(f(3, 4)));
  assert.ok(!isSimplest(f(6, 8)));
  assert.ok(isSimplest(f(7, 4)));
  assert.ok(!isSimplest(f(0, 5)));
  assert.ok(isSimplest(f(0, 1)));
});

test('add and subtract (results come back reduced)', () => {
  same(add(f(1, 2), f(1, 3)), 5, 6);
  same(add(f(1, 4), f(1, 4)), 1, 2);
  same(add(f(3, 4), f(1, 4)), 1, 1);
  same(sub(f(3, 4), f(1, 6)), 7, 12);
  same(sub(f(1, 3), f(1, 2)), -1, 6);
  same(add(f(-1, 2), f(1, 2)), 0, 1);
});

test('multiply and divide', () => {
  same(mul(f(2, 3), f(3, 4)), 1, 2);
  same(mul(f(-2, 3), f(3, 5)), -2, 5);
  same(div(f(1, 2), f(1, 4)), 2, 1);
  same(div(f(3, 4), f(-3, 2)), -1, 2);
});

test('equals and compare', () => {
  assert.ok(equals(f(1, 2), f(2, 4)));
  assert.ok(equals(f(-1, 2), f(1, -2)));
  assert.ok(!equals(f(1, 2), f(1, 3)));
  assert.equal(compare(f(1, 2), f(1, 3)), 1);
  assert.equal(compare(f(1, 3), f(1, 2)), -1);
  assert.equal(compare(f(2, 4), f(1, 2)), 0);
});

test('mixed numbers', () => {
  assert.deepEqual(toMixed(f(7, 4)), { negative: false, whole: 1, n: 3, d: 4 });
  assert.deepEqual(toMixed(f(-9, 4)), { negative: true, whole: 2, n: 1, d: 4 });
  assert.deepEqual(toMixed(f(8, 4)), { negative: false, whole: 2, n: 0, d: 4 });
  assert.deepEqual(toMixed(f(3, 4)), { negative: false, whole: 0, n: 3, d: 4 });
  same(fromMixed(2, 1, 4), 9, 4);
  same(fromMixed(2, 1, 4, true), -9, 4);
});

test('arithmetic matches brute-force checking on many fractions', () => {
  // Compare against cross-multiplication done the long way.
  for (let a = -6; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      for (let c = -6; c <= 6; c++) {
        for (let d = 1; d <= 6; d++) {
          const x = f(a, b);
          const y = f(c, d);
          assert.ok(equals(add(x, y), f(a * d + c * b, b * d)));
          assert.ok(equals(sub(x, y), f(a * d - c * b, b * d)));
          assert.ok(equals(mul(x, y), f(a * c, b * d)));
          if (c !== 0) assert.ok(equals(div(x, y), f(a * d, b * c)));
          assert.ok(isSimplest(add(x, y)));
        }
      }
    }
  }
});
