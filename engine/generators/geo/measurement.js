// Generators for measurement (area geo, grades 4-8): unit conversions, area and perimeter,
// circles (answers in terms of π: the student types the number in front, "π" is shown after
// the box), and volume. Shapes are pictures with labelled sides (a "shape" node).
// Answers are numbers (decimal answers where needed) with the unit shown after the box.
// See engine/generators/frac/add-sub.js for what a generator returns.

import { fraction, mul, div, equals } from '../../math/fraction.js';
import { decimalText, terminates } from '../../math/decimal.js';

const F = (n, d = 1) => fraction(n, d);
const words = (text) => ({ type: 'words', text });
const shape = (kind, labels) => ({ type: 'shape', kind, labels });
const text = (f) => decimalText(f);

// A numeric answer (whole or decimal) with a unit after the box; wrong values kept if they
// end, differ from the answer and from each other.
function numberProblem(instruction, expression, value, suffix, mistakes) {
  const out = [];
  for (const m of mistakes) {
    if (!m || !m.value || m.value.n <= 0 || !terminates(m.value)) continue;
    if (equals(m.value, value) || out.some((o) => equals(o.f, m.value))) continue;
    out.push({ id: m.id, value: text(m.value), f: m.value });
  }
  return { instruction, expression, answer: { type: 'decimal', value: text(value), suffix }, misconceptions: out.map(({ id, value: v }) => ({ id, value: v })) };
}

// ======================= Unit conversions =======================

// [big unit, small unit, how many small in one big, metric?]
const UNITS = [
  ['feet', 'inches', 12, false], ['yards', 'feet', 3, false], ['hours', 'minutes', 60, false], ['minutes', 'seconds', 60, false],
  ['pounds', 'ounces', 16, false], ['gallons', 'quarts', 4, false], ['meters', 'centimeters', 100, true], ['kilometers', 'meters', 1000, true],
  ['kilograms', 'grams', 1000, true], ['liters', 'milliliters', 1000, true],
];

// ---------- one step ----------
//   1: big to small (5 feet = 60 inches);  2: small to big (180 minutes = 3 hours);  3: decimals either way (2.5 ft = 30 in; 750 g = 0.75 kg)
const convert = {
  version: 1,
  generate(rng, difficulty) {
    const [big, small, k] = rng.pick(UNITS);
    let amount; let fromBig;
    if (difficulty === 1) { fromBig = true; amount = F(rng.int(2, 9)); } else if (difficulty === 2) { fromBig = false; amount = F(k * rng.int(2, 9)); } else {
      fromBig = rng.chance(0.5);
      amount = fromBig ? F(rng.int(3, 19), 2) : F(k * rng.int(1, 9), rng.pick([2, 4]));
      if (!terminates(amount) || !terminates(div(amount, F(k))) || !terminates(mul(amount, F(k)))) return convert.generate(rng, difficulty);
    }
    const value = fromBig ? mul(amount, F(k)) : div(amount, F(k));
    const [from, to] = fromBig ? [big, small] : [small, big];
    const wrongK = k === 12 || k === 16 || k === 60 || k === 3 || k === 4 ? 10 : k === 100 ? 10 : 100; // a wrong conversion number
    return numberProblem('Convert.', words(`${text(amount)} ${from} = ? ${to}`), value, to, [
      { id: 'geo.units-wrong-way', value: fromBig ? div(amount, F(k)) : mul(amount, F(k)) }, // divided when it should multiply
      { id: 'geo.units-wrong-factor', value: fromBig ? mul(amount, F(wrongK)) : div(amount, F(wrongK)) }, // 1 ft = 10 in
    ]);
  },
};

// ---------- two steps ----------
//   1: yards to inches (×3 ×12), hours to seconds;  2: the other way (7200 s = ? h);  3: kilometers to centimeters, gallons to cups
const TWO = [
  ['yards', 'feet', 'inches', 3, 12], ['hours', 'minutes', 'seconds', 60, 60], ['kilometers', 'meters', 'centimeters', 1000, 100],
  ['gallons', 'quarts', 'cups', 4, 4], ['days', 'hours', 'minutes', 24, 60],
];
const twoStep = {
  version: 1,
  alsoUses: ['geo.units.convert'],
  generate(rng, difficulty) {
    const [big, mid, small, k1, k2] = difficulty === 3 ? rng.pick(TWO.slice(2)) : rng.pick(TWO.slice(0, 2));
    const n = rng.int(2, 5);
    const down = difficulty !== 2;
    const amount = down ? F(n) : F(n * k1 * k2);
    const value = down ? F(n * k1 * k2) : F(n);
    return numberProblem('Convert.', words(`${text(amount)} ${down ? big : small} = ? ${down ? small : big}`), value, down ? small : big, [
      { id: 'geo.units-one-step', value: down ? F(n * k1) : F(n * k2) }, // stopped after one step
      { id: 'geo.units-one-step', value: down ? F(n * k2) : F(n * k1) },
      { id: 'geo.units-added', value: down ? F(n * (k1 + k2)) : null }, // ×(3 + 12) instead of ×3 ×12
    ]);
  },
};

// ======================= Area and perimeter =======================

const unitOf = (rng) => rng.pick(['cm', 'm', 'in', 'ft']);

// ---------- perimeter ----------
//   1: a rectangle;  2: a triangle with three sides, or a square from one side;  3: an L-shape (find the two missing sides)
const perimeter = {
  version: 1,
  generate(rng, difficulty) {
    const u = unitOf(rng);
    if (difficulty === 3) {
      const [w, h] = [rng.int(8, 14), rng.int(7, 12)];
      const [top, right] = [rng.int(3, w - 3), rng.int(3, h - 3)];
      return numberProblem('Find the perimeter.', shape('lshape', { w: `${w} ${u}`, h: `${h} ${u}`, top: `${top} ${u}`, right: `${right} ${u}` }), F(2 * (w + h)), u, [
        { id: 'geo.perimeter-missing-sides', value: F(w + h + top + right) }, // added only the labelled sides
        { id: 'geo.area-perimeter-swap', value: F(w * h - (w - top) * (h - right)) },
      ]);
    }
    if (difficulty === 2 && rng.chance(0.5)) {
      const s = [rng.int(3, 12), rng.int(3, 12)];
      const c = rng.int(Math.abs(s[0] - s[1]) + 1, s[0] + s[1] - 1);
      return numberProblem('Find the perimeter.', words(`A triangle has sides ${s[0]} ${u}, ${s[1]} ${u} and ${c} ${u}. What is its perimeter?`), F(s[0] + s[1] + c), u, []);
    }
    const [w, h] = difficulty === 2 ? [rng.int(3, 15), null] : [rng.int(4, 15), rng.int(2, 12)];
    if (h === null) {
      return numberProblem('Find the perimeter.', words(`A square has sides of ${w} ${u}. What is its perimeter?`), F(4 * w), u, [
        { id: 'geo.area-perimeter-swap', value: F(w * w) },
        { id: 'geo.perimeter-two-sides', value: F(2 * w) },
      ]);
    }
    return numberProblem('Find the perimeter.', shape('rect', { w: `${w} ${u}`, h: `${h} ${u}` }), F(2 * (w + h)), u, [
      { id: 'geo.area-perimeter-swap', value: F(w * h) },
      { id: 'geo.perimeter-two-sides', value: F(w + h) }, // added just the two labelled sides
    ]);
  },
};

// ---------- rectangles and parallelograms ----------
//   1: a rectangle;  2: a parallelogram (base × height, not the slanted side);  3: a missing side from the area
const rectangle = {
  version: 1,
  generate(rng, difficulty) {
    const u = unitOf(rng);
    const [b, h] = [rng.int(3, 15), rng.int(2, 12)];
    if (difficulty === 2) {
      const side = h + rng.int(1, 4);
      return numberProblem('Find the area.', shape('parallelogram', { base: `${b} ${u}`, height: `${h} ${u}`, side: `${side} ${u}` }), F(b * h), `${u}²`, [
        { id: 'geo.parallelogram-side', value: F(b * side) }, // used the slanted side
        { id: 'geo.triangle-no-half', value: F(b * h, 2) },
      ]);
    }
    if (difficulty === 3) {
      return numberProblem('Find the missing side.', words(`A rectangle has an area of ${b * h} ${u}² and a width of ${b} ${u}. How long is the other side?`), F(h), u, [
        { id: 'geo.area-perimeter-swap', value: F(b * h - 2 * b, 2) }, // treated the area as a perimeter
        { id: 'geo.missing-subtracted', value: F(b * h - b) },
      ]);
    }
    return numberProblem('Find the area.', shape('rect', { w: `${b} ${u}`, h: `${h} ${u}` }), F(b * h), `${u}²`, [
      { id: 'geo.area-perimeter-swap', value: F(2 * (b + h)) },
      { id: 'geo.perimeter-two-sides', value: F(b + h) },
    ]);
  },
};

// ---------- triangles and trapezoids ----------
//   1: a triangle with an even product (½ × 8 × 5);  2: any triangle (decimal answers like 17.5);  3: a trapezoid
const triangle = {
  version: 1,
  alsoUses: ['geo.area.rectangle'],
  generate(rng, difficulty) {
    const u = unitOf(rng);
    if (difficulty === 3) {
      const [t, bo, h] = [rng.int(3, 9), rng.int(10, 16), rng.int(2, 10)];
      return numberProblem('Find the area.', shape('trapezoid', { top: `${t} ${u}`, bottom: `${bo} ${u}`, height: `${h} ${u}` }), mul(F(t + bo, 2), F(h)), `${u}²`, [
        { id: 'geo.triangle-no-half', value: F((t + bo) * h) }, // forgot the ½
        { id: 'geo.trapezoid-one-base', value: F(bo * h) },
      ]);
    }
    let b; let h;
    do { [b, h] = [rng.int(3, 16), rng.int(2, 12)]; } while (difficulty === 1 && (b * h) % 2);
    return numberProblem('Find the area.', shape('triangle', { base: `${b} ${u}`, height: `${h} ${u}` }), F(b * h, 2), `${u}²`, [
      { id: 'geo.triangle-no-half', value: F(b * h) },
      { id: 'geo.area-perimeter-swap', value: F(b + h) },
    ]);
  },
};

// ---------- composite (L-shapes) ----------
//   1-3: an L-shape; split it into two rectangles (or take the cut corner away)
const composite = {
  version: 1,
  alsoUses: ['geo.area.rectangle'],
  generate(rng, difficulty) {
    const u = unitOf(rng);
    const [w, h] = difficulty === 1 ? [rng.int(6, 10), rng.int(5, 9)] : [rng.int(8, 15), rng.int(7, 12)];
    const [top, right] = [rng.int(2, w - 3), rng.int(2, h - 3)];
    const area = w * h - (w - top) * (h - right);
    return numberProblem('Find the area.', shape('lshape', { w: `${w} ${u}`, h: `${h} ${u}`, top: `${top} ${u}`, right: `${right} ${u}` }), F(area), `${u}²`, [
      { id: 'geo.composite-whole-rectangle', value: F(w * h) }, // the whole rectangle, cut corner and all
      { id: 'geo.composite-labelled', value: F(top * h + w * right) }, // overlapped the two pieces
      { id: 'geo.area-perimeter-swap', value: F(2 * (w + h)) },
    ]);
  },
};

// ======================= Circles =======================

// ---------- circumference (in terms of π) ----------
//   1: from the diameter (C = πd);  2: from the radius (C = 2πr);  3: either, as a word problem (a wheel, a pizza)
const circumference = {
  version: 1,
  generate(rng, difficulty) {
    const u = unitOf(rng);
    const r = rng.int(2, 12);
    const useD = difficulty === 1 || (difficulty === 3 && rng.chance(0.5));
    const value = F(2 * r);
    const expression = difficulty === 3
      ? words(useD ? `A bike wheel is ${2 * r} ${u} across. How far around is it? Answer in terms of π.` : `A round table has a radius of ${r} ${u}. How far is it around the edge? Answer in terms of π.`)
      : shape('circle', useD ? { d: `${2 * r} ${u}` } : { r: `${r} ${u}` });
    return numberProblem(difficulty === 3 ? 'Find the circumference.' : 'Find the circumference. Answer in terms of π.', expression, value, `π ${u}`, [
      { id: 'geo.circle-diameter-radius', value: useD ? F(4 * r) : F(r) }, // used d as r, or r as d
      { id: 'geo.circle-area-circumference', value: F(r * r) }, // used πr²
    ]);
  },
};

// ---------- area (in terms of π) ----------
//   1: from the radius;  2: from the diameter;  3: a half circle, or a word problem
const circleArea = {
  version: 1,
  alsoUses: ['geo.circles.circumference'],
  generate(rng, difficulty) {
    const u = unitOf(rng);
    const r = difficulty === 3 ? rng.int(1, 6) * 2 : rng.int(2, 10);
    if (difficulty === 3 && rng.chance(0.5)) {
      return numberProblem('Find the area of the half circle. Answer in terms of π.', words(`A half circle has a radius of ${r} ${u}.`), F(r * r, 2), `π ${u}²`, [
        { id: 'geo.half-forgot', value: F(r * r) },
        { id: 'geo.circle-area-circumference', value: F(r) },
      ]);
    }
    const useD = difficulty === 2 || difficulty === 3;
    return numberProblem('Find the area. Answer in terms of π.', shape('circle', useD ? { d: `${2 * r} ${u}` } : { r: `${r} ${u}` }), F(r * r), `π ${u}²`, [
      { id: 'geo.circle-diameter-radius', value: useD ? F(4 * r * r) : null }, // squared the diameter
      { id: 'geo.circle-area-circumference', value: F(2 * r) }, // used 2πr
    ]);
  },
};

// ======================= Volume =======================

// ---------- rectangular prisms ----------
//   1: l × w × h;  2: a word problem (a box, a fish tank);  3: a missing side from the volume
const prism = {
  version: 1,
  alsoUses: ['geo.area.rectangle'],
  generate(rng, difficulty) {
    const u = unitOf(rng);
    const [l, w, h] = [rng.int(2, 10), rng.int(2, 8), rng.int(2, 9)];
    if (difficulty === 3) {
      return numberProblem('Find the missing side.', words(`A box has a volume of ${l * w * h} ${u}³. Its base is ${l} ${u} by ${w} ${u}. How tall is it?`), F(h), u, [
        { id: 'geo.volume-added', value: F(l * w * h - l - w) },
      ]);
    }
    const expression = difficulty === 2 ? words(`A fish tank is ${l} ${u} long, ${w} ${u} wide and ${h} ${u} tall. How much water does it hold?`) : shape('prism', { l: `${l} ${u}`, w: `${w} ${u}`, h: `${h} ${u}` });
    return numberProblem('Find the volume.', expression, F(l * w * h), `${u}³`, [
      { id: 'geo.volume-added', value: F(l + w + h) },
      { id: 'geo.volume-surface', value: F(2 * (l * w + l * h + w * h)) }, // surface area
    ]);
  },
};

// ---------- cylinders and cones (in terms of π) ----------
//   1: a cylinder from the radius (πr²h);  2: from the diameter;  3: a cone (⅓πr²h)
const cylinder = {
  version: 1,
  alsoUses: ['geo.circles.area', 'geo.volume.prism'],
  generate(rng, difficulty) {
    const u = unitOf(rng);
    if (difficulty === 3) {
      let r; let h;
      do { [r, h] = [rng.int(2, 6), rng.int(2, 12)]; } while ((r * r * h) % 3);
      return numberProblem('Find the volume. Answer in terms of π.', shape('cone', { r: `${r} ${u}`, h: `${h} ${u}` }), F((r * r * h) / 3), `π ${u}³`, [
        { id: 'geo.cone-no-third', value: F(r * r * h) },
        { id: 'geo.volume-added', value: F(r * h) },
      ]);
    }
    const [r, h] = [rng.int(2, 7), rng.int(2, 10)];
    const useD = difficulty === 2;
    return numberProblem('Find the volume. Answer in terms of π.', shape('cylinder', useD ? { d: `${2 * r} ${u}`, h: `${h} ${u}` } : { r: `${r} ${u}`, h: `${h} ${u}` }), F(r * r * h), `π ${u}³`, [
      { id: 'geo.circle-diameter-radius', value: useD ? F(4 * r * r * h) : null },
      { id: 'geo.volume-added', value: F(r * h) }, // πrh: forgot to square
      { id: 'geo.circle-area-circumference', value: F(2 * r * h) },
    ]);
  },
};

const parts = {
  'geo.units.convert': convert,
  'geo.units.two-step': twoStep,
  'geo.area.perimeter': perimeter,
  'geo.area.rectangle': rectangle,
  'geo.area.triangle': triangle,
  'geo.area.composite': composite,
  'geo.circles.circumference': circumference,
  'geo.circles.area': circleArea,
  'geo.volume.prism': prism,
  'geo.volume.cylinder': cylinder,
};

const mixedOf = ({ covers, screener, parts: own }) => ({
  version: 1,
  mixed: true,
  ...(screener ? { screener } : {}),
  covers,
  ...(own ? { parts: own } : {}),
  generate(rng, difficulty) {
    const part = rng.pick(own || covers);
    return { ...parts[part].generate(rng, difficulty), part };
  },
});

export const measurementGenerators = {
  // A two-step conversion needs one-step conversions: it stands for both.
  'geo.units': mixedOf({ screener: 'geo.units.two-step', covers: ['geo.units.convert', 'geo.units.two-step'] }),
  // An L-shape's area needs rectangles; perimeter and triangles are asked on their own.
  'geo.area': mixedOf({ screener: 'geo.area.composite', covers: ['geo.area.rectangle', 'geo.area.composite'], parts: ['geo.area.perimeter', 'geo.area.rectangle', 'geo.area.triangle', 'geo.area.composite'] }),
  // Circumference and area are different formulas (and a classic mix-up): both asked.
  'geo.circles': mixedOf({ covers: ['geo.circles.circumference', 'geo.circles.area'] }),
  // A cylinder's volume needs base × height: it stands for prisms too.
  'geo.volume': mixedOf({ screener: 'geo.volume.cylinder', covers: ['geo.volume.prism', 'geo.volume.cylinder'] }),
  ...parts,
};
