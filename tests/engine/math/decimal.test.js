// Exact decimals: never floating point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecimal, decimalText, fromScaled, toScaled, terminates, sameDecimal, placesOf } from '../../../engine/math/decimal.js';
import { fraction } from '../../../engine/math/fraction.js';

test('reading decimals as exact fractions', () => {
  assert.deepEqual(parseDecimal('3.25'), fraction(325, 100));
  assert.deepEqual(parseDecimal('.5'), fraction(5, 10));
  assert.deepEqual(parseDecimal('5.'), fraction(5, 1));
  assert.deepEqual(parseDecimal('-0.04'), fraction(-4, 100));
  assert.deepEqual(parseDecimal('007'), fraction(7, 1));
  for (const bad of ['', '.', '-', '1.2.3', 'abc', '1,5', null]) assert.equal(parseDecimal(bad), null, String(bad));
});

test('writing exact fractions as decimals', () => {
  assert.equal(decimalText(fraction(3, 4)), '0.75');
  assert.equal(decimalText(fraction(3, 8)), '0.375');
  assert.equal(decimalText(fraction(-2, 5)), '-0.4');
  assert.equal(decimalText(fraction(12, 4)), '3');
  assert.throws(() => decimalText(fraction(1, 3)));
  assert.equal(terminates(fraction(7, 20)), true);
  assert.equal(terminates(fraction(1, 6)), false);
});

test('column helpers', () => {
  assert.equal(fromScaled(5, 2), '0.05');
  assert.equal(fromScaled(350, 2), '3.5');
  assert.equal(fromScaled(350, 2, { keepZeros: true }), '3.50');
  assert.equal(fromScaled(-125, 2), '-1.25');
  assert.equal(toScaled('3.5', 2), 350);
  assert.equal(placesOf('2.50'), 2);
  assert.equal(placesOf('7'), 0);
});

test('0.1 + 0.2 is 0.3 here', () => {
  assert.equal(sameDecimal(fromScaled(toScaled('0.1', 1) + toScaled('0.2', 1), 1), '0.3'), true);
  assert.equal(sameDecimal('0.50', '.5'), true);
  assert.equal(sameDecimal('0.5', '0.05'), false);
});
