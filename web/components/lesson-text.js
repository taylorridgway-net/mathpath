// Lesson text with math in it.
//
// Pictures too (paper tests): {bar 3/5} a bar with 3 of 5 parts shaded,
// {dots 4/9} 4 of 9 dots shaded, {line 2 4 7} a number line from 0 to 2 cut
// into fourths with a dot at the 7th mark.
//
// Lesson files mark math with braces: {3/4} is a stacked fraction, {1 3/4} a
// mixed number, {?/12} a fraction with a blank. Worked-solution sentences are
// generated as plain text ("So 1/4 = 3/12"), so for those, bare a/b fractions
// can be turned into stacked fractions too (autoFractions).
//
// parseLessonText is pure (tested in Node); renderLessonText draws it.

import { renderMath } from './render-math.js';

const BRACED = /\{([^}]*)\}/g;
const BARE = /(?<![\w/])(\d+)\/(\d+)(?![\w/])/g;

// "Add {1/2} and 3" -> [ 'Add ', { type: 'frac', n: 1, d: 2 }, ' and 3' ]
export function parseLessonText(text, { autoFractions = false } = {}) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(BRACED)) {
    pushText(out, text.slice(last, m.index), autoFractions);
    out.push(parseMath(m[1]));
    last = m.index + m[0].length;
  }
  pushText(out, text.slice(last), autoFractions);
  return out;
}

function pushText(out, rawText, autoFractions) {
  if (!rawText) return;
  // Keep "4 × 3 = 12" on one line: no line breaks around × and =.
  const text = rawText.replace(/ ([×=+−]) /g, '\u00a0$1\u00a0');
  if (!autoFractions) {
    out.push(text);
    return;
  }
  let last = 0;
  for (const m of text.matchAll(BARE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ type: 'frac', n: Number(m[1]), d: Number(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
}

function parseMath(inner) {
  const part = (s) => (s === '?' ? { type: 'blank' } : Number(s));
  const pic = /^(bar|dots) (\d+)\/(\d+)$/.exec(inner);
  if (pic) return { type: 'model', shape: pic[1] === 'bar' ? 'bar' : 'set', shaded: Number(pic[2]), parts: Number(pic[3]) };
  const line = /^line (\d+) (\d+) (\d+)$/.exec(inner);
  if (line) return { type: 'numberline', max: Number(line[1]), perUnit: Number(line[2]), point: Number(line[3]) };
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(inner);
  if (mixed) return { type: 'mixed', whole: Number(mixed[1]), n: Number(mixed[2]), d: Number(mixed[3]) };
  const f = /^(\d+|\?)\/(\d+|\?)$/.exec(inner);
  if (f) return { type: 'frac', n: part(f[1]), d: part(f[2]) };
  throw new Error(`Bad math markup {${inner}}`);
}

// Draw into a new element (default <p>).
export function renderLessonText(text, { tag = 'p', className = '', autoFractions = false } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const piece of parseLessonText(text, { autoFractions })) {
    el.append(typeof piece === 'string' ? piece : renderMath(piece, { inline: true }));
  }
  return el;
}
