// Worked solutions for measurement and geometry, from the problem's own labels and words.
// A solution is a list of steps { say, show? }.

import { toText } from '../problem/text.js';

const label = (t, name) => { const m = new RegExp(`${name} (\\d+)`).exec(t); return m ? Number(m[1]) : null; };

export function solveGeo(problem) {
  const kind = problem.part || problem.generator;
  const t = toText(problem.expression);
  const a = problem.answer;
  const unit = a.suffix ? ` ${a.suffix}` : '';
  const ans = a.type === 'choice' ? a.options[a.correct] : `${a.value}${unit}`;
  let m;
  switch (kind) {
    case 'geo.units.convert': {
      m = /^([\d.]+) (\w+) = \? (\w+)$/.exec(t);
      const bigger = Number(a.value) > Number(m[1]);
      return [
        { say: `${bigger ? `${m[3]} are smaller than ${m[2]}, so there will be more of them: multiply` : `${m[3]} are bigger than ${m[2]}, so there will be fewer of them: divide`} by how many ${bigger ? m[3] : m[2]} make one ${bigger ? m[2].replace(/s$/, '') : m[3].replace(/s$/, '')}.` },
        { say: `So ${m[1]} ${m[2]} = ${ans}.` },
      ];
    }
    case 'geo.units.two-step': {
      m = /^([\d.]+) (\w+) = \? (\w+)$/.exec(t);
      return [
        { say: `There's a unit in between, so convert in two steps (or multiply the two conversion numbers together, never add them).` },
        { say: `${m[1]} ${m[2]} = ${ans}.` },
      ];
    }
    case 'geo.area.perimeter': {
      if (t.startsWith('[a rectangle')) { const [w, h] = [label(t, 'width'), label(t, 'height')]; return [{ say: `Perimeter is the distance all the way around: four sides, two of each length.` }, { say: `${w} + ${h} + ${w} + ${h} = ${2 * (w + h)}. So the perimeter is ${ans}.` }]; }
      if (t.startsWith('[an L-shape')) {
        const [w, h, top, right] = ['width', 'height', 'top', 'right side'].map((n) => label(t, n));
        return [
          { say: `An L-shape has six sides. The two unlabelled ones are ${w} − ${top} = ${w - top} (across) and ${h} − ${right} = ${h - right} (up and down).` },
          { say: `Add all six: ${w} + ${h} + ${top} + ${h - right} + ${w - top} + ${right} = ${2 * (w + h)}. So the perimeter is ${ans}.` },
        ];
      }
      if ((m = /square has sides of (\d+)/.exec(t))) return [{ say: `A square has four equal sides: 4 × ${m[1]} = ${4 * m[1]}.` }, { say: `So the perimeter is ${ans}.` }];
      m = /sides (\d+) \w+, (\d+) \w+ and (\d+)/.exec(t);
      return [{ say: `Add the three sides: ${m[1]} + ${m[2]} + ${m[3]} = ${+m[1] + +m[2] + +m[3]}.` }, { say: `So the perimeter is ${ans}.` }];
    }
    case 'geo.area.rectangle': {
      if (t.startsWith('[a rectangle')) { const [w, h] = [label(t, 'width'), label(t, 'height')]; return [{ say: `Area counts the squares inside: length × width. ${w} × ${h} = ${w * h}.` }, { say: `So the area is ${ans}.` }]; }
      if (t.startsWith('[a parallelogram')) { const [b, h] = [label(t, 'base'), label(t, 'height')]; return [{ say: `A parallelogram's area is base × height, where the height is straight up (the dashed line), not the slanted side. Slide the triangle from one end to the other and it's a rectangle.` }, { say: `${b} × ${h} = ${b * h}. So the area is ${ans}.` }]; }
      m = /area of (\d+) \S+ and a width of (\d+)/.exec(t);
      return [{ say: `Area = width × length, so length = area ÷ width: ${m[1]} ÷ ${m[2]} = ${m[1] / m[2]}.` }, { say: `So the other side is ${ans}.` }];
    }
    case 'geo.area.triangle': {
      if (t.startsWith('[a trapezoid')) {
        const [top, bottom, h] = [label(t, 'top'), label(t, 'bottom'), label(t, 'height')];
        return [{ say: `A trapezoid's area is the average of the two bases times the height: (${top} + ${bottom}) ÷ 2 × ${h}.` }, { say: `${top} + ${bottom} = ${top + bottom}, half of that is ${(top + bottom) / 2}, times ${h} is ${a.value}. So the area is ${ans}.` }];
      }
      const [b, h] = [label(t, 'base'), label(t, 'height')];
      return [{ say: `A triangle is half of a rectangle: area = ½ × base × height.` }, { say: `${b} × ${h} = ${b * h}, and half of that is ${a.value}. So the area is ${ans}.` }];
    }
    case 'geo.area.composite': {
      const [w, h, top, right] = ['width', 'height', 'top', 'right side'].map((n) => label(t, n));
      return [
        { say: `Think of the whole ${w} by ${h} rectangle, then take away the missing corner. The corner is ${w - top} across and ${h - right} up and down.` },
        { say: `${w} × ${h} = ${w * h}. The corner: ${w - top} × ${h - right} = ${(w - top) * (h - right)}. ${w * h} − ${(w - top) * (h - right)} = ${a.value}. So the area is ${ans}.` },
      ];
    }
    case 'geo.circles.circumference': {
      const d = label(t, 'diameter') ?? Number((/(\d+) \w+ across/.exec(t) || [])[1]);
      const r = label(t, 'radius') ?? Number((/radius of (\d+)/.exec(t) || [])[1]);
      return d ? [{ say: `Circumference (the distance around) = π × diameter.` }, { say: `π × ${d} = ${d}π. So the circumference is ${ans}.` }]
        : [{ say: `Circumference = 2 × π × radius (the diameter is twice the radius).` }, { say: `2 × ${r} = ${2 * r}, so it's ${2 * r}π. So the circumference is ${ans}.` }];
    }
    case 'geo.circles.area': {
      if ((m = /half circle has a radius of (\d+)/.exec(t))) return [{ say: `A whole circle's area is π × radius²: π × ${m[1]}² = ${m[1] * m[1]}π.` }, { say: `Half of it: ${m[1] * m[1]} ÷ 2 = ${a.value}. So the area is ${ans}.` }];
      const d = label(t, 'diameter');
      const r = label(t, 'radius') ?? d / 2;
      return [
        ...(d ? [{ say: `The formula needs the radius: half the diameter, ${d} ÷ 2 = ${r}.` }] : []),
        { say: `Area = π × radius² (radius times itself, not times 2): ${r} × ${r} = ${r * r}, so it's ${r * r}π.` },
        { say: `So the area is ${ans}.` },
      ];
    }
    case 'geo.volume.prism': {
      if ((m = /volume of (\d+) \S+ Its base is (\d+) \w+ by (\d+)/.exec(t))) return [{ say: `Volume = length × width × height, so height = volume ÷ (length × width). ${m[2]} × ${m[3]} = ${m[2] * m[3]}.` }, { say: `${m[1]} ÷ ${m[2] * m[3]} = ${a.value}. So it's ${ans} tall.` }];
      const dims = (m = /(\d+) \w+ long, (\d+) \w+ wide and (\d+)/.exec(t)) ? [m[1], m[2], m[3]].map(Number) : [label(t, 'length'), label(t, 'width'), label(t, 'height')];
      return [{ say: `Volume counts the cubes that fit inside: length × width × height.` }, { say: `${dims[0]} × ${dims[1]} = ${dims[0] * dims[1]}, times ${dims[2]} is ${a.value}. So the volume is ${ans}.` }];
    }
    case 'geo.volume.cylinder': {
      const d = label(t, 'diameter');
      const r = label(t, 'radius') ?? d / 2;
      const h = label(t, 'height');
      const cone = t.startsWith('[a cone');
      return [
        ...(d ? [{ say: `The radius is half the diameter: ${d} ÷ 2 = ${r}.` }] : []),
        { say: `${cone ? 'A cone holds one third of the cylinder around it: ⅓ × π × radius² × height.' : 'A cylinder is a circle stacked up: area of the circle × height = π × radius² × height.'}` },
        { say: `${r} × ${r} = ${r * r}, times ${h} is ${r * r * h}${cone ? `, and a third of that is ${a.value}` : ''}. So the volume is ${ans}.` },
      ];
    }
    case 'geo.angles.pairs': {
      let kindName; let a;
      if ((m = /are (\w+)\. One of them is (\d+)°/.exec(t))) [kindName, a] = [m[1], +m[2]];
      else { a = label(t, 'angle a'); kindName = t.includes('right angle') ? 'complementary' : t.includes('straight') ? 'supplementary' : 'vertical'; }
      if (kindName === 'vertical') return [{ say: `Vertical angles sit opposite each other where two lines cross. They are equal.` }, { say: `So the angle is ${ans}.` }];
      const total = kindName === 'complementary' ? 90 : 180;
      return [
        { say: `${kindName === 'complementary' ? 'The two angles make a right angle: they add to 90°' : 'The two angles make a straight line: they add to 180°'}.` },
        { say: `${total} − ${a} = ${total - a}. So the angle is ${ans}.` },
      ];
    }
    case 'geo.angles.triangle': {
      if ((m = /third angle is (\d+)°/.exec(t))) return [{ say: `The three angles of a triangle add to 180°. Take away the third angle: 180 − ${m[1]} = ${180 - m[1]}.` }, { say: `The two equal angles share that: ${180 - m[1]} ÷ 2 = ${a.value}. So each one is ${ans}.` }];
      const [x, y] = [label(t, 'angle a'), label(t, 'angle b')];
      return [{ say: `The three angles of a triangle add to 180°. The two you know: ${x} + ${y} = ${x + y}.` }, { say: `180 − ${x + y} = ${180 - x - y}. So x is ${ans}.` }];
    }
    case 'geo.angles.parallel': {
      m = /angle (\d) (\d+)°/.exec(t);
      const ask = Number(/angle (\d) x/.exec(t)[1]);
      const group = (k) => ([2, 3, 6, 7].includes(k) ? 'B' : 'A');
      const same = group(+m[1]) === group(ask);
      return [
        { say: `With parallel lines, the transversal makes just two sizes of angle: all the small ones are equal and all the big ones are equal, and a small one and a big one add to 180°.` },
        same ? { say: `Angle ${m[1]} and angle ${ask} are the same size. So x is ${ans}.` } : { say: `One is small and one is big, so they add to 180°: 180 − ${m[2]} = ${180 - m[2]}. So x is ${ans}.` },
      ];
    }
    case 'geo.pythag.hypotenuse': {
      const [p, q] = (m = /goes (\d+) \w+ east and then (\d+)/.exec(t)) ? [+m[1], +m[2]] : [...t.matchAll(/leg (\d+)/g)].map((v) => +v[1]);
      return [
        { say: `In a right triangle, a² + b² = c², where c is the longest side (across from the right angle).` },
        { say: `${p}² + ${q}² = ${p * p} + ${q * q} = ${p * p + q * q}.` },
        { say: `c is the square root: √${p * p + q * q} = ${a.value}. So the answer is ${ans}.` },
      ];
    }
    case 'geo.pythag.leg': {
      const [p, c] = (m = /A (\d+) \w+ ladder .* foot is (\d+)/.exec(t)) ? [+m[2], +m[1]] : [label(t, 'leg'), label(t, 'hypotenuse')];
      return [
        { say: `a² + b² = c², and this time you know c (the longest side). So b² = c² − a².` },
        { say: `${c}² − ${p}² = ${c * c} − ${p * p} = ${c * c - p * p}.` },
        { say: `b is the square root: √${c * c - p * p} = ${a.value}. So the answer is ${ans}.` },
      ];
    }
    case 'geo.pythag.converse': {
      const [x, y, z] = /sides are (\d+), (\d+), (\d+)/.exec(t).slice(1).map(Number).sort((u, v) => u - v);
      return [
        { say: `Test a² + b² = c² with the longest side as c: ${z}.` },
        { say: `${x}² + ${y}² = ${x * x} + ${y * y} = ${x * x + y * y}, and ${z}² = ${z * z}. ${x * x + y * y === z * z ? 'They match' : "They don't match"}. So the answer is ${ans}.` },
      ];
    }
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}
