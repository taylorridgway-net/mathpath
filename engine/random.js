// Seeded random numbers.
//
// Same seed in -> same sequence of numbers out, on every device and on the
// server. That is what lets the server re-create a student's exact problems
// from the seed and check the answers itself.
//
// Never use Math.random() anywhere in the engine.

// Turn any seed (number or text) into a 32-bit whole number. (FNV-1a hash.)
export function hashSeed(seed) {
  const text = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Create a random-number source from a seed. (Mulberry32 algorithm: small,
// fast, and plenty random for choosing problem numbers.)
export function createRng(seed) {
  let state = hashSeed(seed);

  // A number from 0 (included) up to 1 (not included).
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // A whole number from min to max, both included.
  function int(min, max) {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new Error(`rng.int: bad range ${min}..${max}`);
    }
    return min + Math.floor(next() * (max - min + 1));
  }

  // One item from a list.
  function pick(list) {
    if (!list.length) throw new Error('rng.pick: empty list');
    return list[int(0, list.length - 1)];
  }

  // true with probability p.
  function chance(p) {
    return next() < p;
  }

  return { next, int, pick, chance };
}
