// Ratios and percents paper tests: every answer key re-computed from its calculation.
// "$" and "%" are stripped from the key before comparing; fraction keys must be in
// simplest form; "better" keys must name the cheaper option first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../curriculum/mastery.json', import.meta.url), 'utf8')).default.verification;
const skills = ['rat.ratios', 'rat.percent', 'rat.percent-change'];
const papers = skills.map((s) => JSON.parse(readFileSync(new URL(`../../curriculum/paper/${s}.json`, import.meta.url), 'utf8')));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const close = (a, b) => Math.abs(a - b) < 1e-9;
const ARITH = /^[\d.+\-*/() ]+$/;
// The key's first token without "$" or "%", e.g. "$43.20" -> "43.20", "25% increase" -> "25".
const lead = (answer) => answer.split(' ')[0].replace(/^\$/, '').replace(/%$/, '');
const isNumber = (s) => /^\d+(\.\d+)?$/.test(s);
const numKey = (key, want) => [isNumber(key) && close(Number(key), want), String(want)];
const fraction = (s) => s.split('/').map(Number);

// Returns [ok, what the calculation gives]; throws on an unknown calculation.
function check(math, answer) {
  const [kind, ...args] = math.split(' ');
  const key = lead(answer);
  if (kind === 'pct') { // "pct 35 of 80": 35% of 80
    assert.equal(args[1], 'of', math);
    return numKey(key, (Number(args[0]) * Number(args[2])) / 100);
  }
  if (kind === 'whatpct') { // "whatpct 18 24": 18 is what percent of 24 (key "75%")
    return [answer.split(' ')[0].endsWith('%') && numKey(key, (100 * Number(args[0])) / Number(args[1]))[0], `${(100 * args[0]) / args[1]}%`];
  }
  if (kind === 'pcttodec') return numKey(key, Number(args[0]) / 100);
  if (kind === 'dectopct' || kind === 'fractopct') {
    const [a, b = 1] = kind === 'fractopct' ? fraction(args[0]) : [Number(args[0])];
    const want = (100 * a) / b;
    return [answer.split(' ')[0].endsWith('%') && numKey(key, want)[0], `${want}%`];
  }
  if (kind === 'pcttofrac') { // key a/b = p/100 exactly, in simplest form, not a whole number
    const m = /^(\d+)\/(\d+)$/.exec(key);
    if (!m) return [false, 'a fraction a/b'];
    const [a, b] = [Number(m[1]), Number(m[2])];
    return [a * 100 === Number(args[0]) * b && gcd(a, b) === 1 && b !== 1, `${args[0]}/100 in simplest form`];
  }
  if (kind === 'up' || kind === 'down') { // "up 36 20": 36 increased by 20%
    const [old, p] = args.map(Number);
    return numKey(key, old * (1 + ((kind === 'up' ? 1 : -1) * p) / 100));
  }
  if (kind === 'change') { // "change 50 40": key "20% decrease"
    const [old, now] = args.map(Number);
    const want = (100 * Math.abs(now - old)) / old;
    const word = now > old ? 'increase' : 'decrease';
    const [first, second] = answer.split(' ');
    return [first.endsWith('%') && numKey(key, want)[0] && second === word, `${want}% ${word}`];
  }
  if (kind === 'better') { // "better 6-pack 6 4.50 10-pack 10 7.00": label count price, twice
    const [l1, n1, t1, l2, n2, t2] = args;
    const [u1, u2] = [Number(t1) / Number(n1), Number(t2) / Number(n2)];
    assert.ok(!close(u1, u2), `${math}: a tie`);
    const want = (u1 < u2 ? l1 : l2).replace(/_/g, ' ');
    // The key names the winner and shows both unit prices.
    const shows = [u1, u2].every((u) => answer.includes(`$${u.toFixed(2)}`));
    return [answer.startsWith(`${want} (`) && shows, `${want} ($${u1.toFixed(2)} vs $${u2.toFixed(2)})`];
  }
  if (!ARITH.test(math)) throw new Error(`unknown calculation: ${math}`);
  return numKey(key, Function(`"use strict"; return (${math});`)());
}

const numbers = (text) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

for (const paper of papers) {
  const items = paper.versions.flatMap((v) => v.items);

  test(`${paper.skill}: every answer key matches its calculation`, () => {
    for (const item of items) {
      const [ok, want] = check(item.math, item.answer);
      assert.ok(ok, `${item.id}: key "${item.answer}" but ${item.math} gives ${want}`);
    }
  });

  test(`${paper.skill}: no answer key is negative`, () => {
    for (const item of items) {
      assert.ok(!/^[-−]/.test(lead(item.answer)), `${item.id}: ${item.answer}`);
      if (ARITH.test(item.math)) assert.ok(Function(`"use strict"; return (${item.math});`)() >= 0, item.id);
    }
  });

  test(`${paper.skill}: the prompt shows every number the calculation uses`, () => {
    for (const item of items) {
      const shown = numbers(item.prompt);
      for (const n of numbers(item.math)) assert.ok(shown.includes(n), `${item.id}: ${n}`);
    }
  });

  test(`${paper.skill}: ${rules.outOf} items per version, 2+ word problems, an 'is this right?' item, no repeated prompts`, () => {
    for (const v of paper.versions) {
      assert.equal(v.items.length, rules.outOf, v.id);
      assert.ok(v.items.filter((i) => i.kind === 'word').length >= 2, `${v.id}: word problems`);
      assert.ok(v.items.some((i) => /Is (s?he|they) right\?/.test(i.prompt)), `${v.id}: 'is this right?' item`);
      assert.ok(v.items.every((i, n) => i.id === `${v.id}${n + 1}`), `${v.id}: item ids`);
      assert.ok(v.items.every((i) => ['word', 'computation'].includes(i.kind)), `${v.id}: item kinds`);
    }
    const prompts = items.map((i) => i.prompt);
    assert.equal(new Set(prompts).size, prompts.length, 'A and B repeat a prompt');
  });

  test(`${paper.skill}: money keys are to the cent at most`, () => {
    for (const item of items) {
      const money = item.answer.split(' ')[0];
      if (money.startsWith('$')) assert.match(money, /^\$\d+(\.\d\d)?$/, item.id);
    }
  });
}
