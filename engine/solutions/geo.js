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
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}
