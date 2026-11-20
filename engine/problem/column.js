// Column addition and subtraction, laid out the way it's written on paper:
// carried 1s above the next column; when borrowing, the top digit crossed out
// with its new value above (borrowing across zeros changes them to 9s).
//
// columnLayout(op, top, bottom, done) -> what to draw after `done` columns
// (ones first) have been worked. Pure, so it's tested in Node and used by the
// lesson picture and the worked solutions alike.

// Decimals: top and bottom are whole numbers of 10^-places (3.5 and 1.25 with places 2
// are 350 and 125), so the points line up; a number always shows its ones digit (0.35).
// The zeros filled in to line the points up (3.50) are marked `padded`.
const lengthOf = (n, places) => Math.max(String(n).length, places + 1);
const digitsOf = (n, width, places = 0) => String(n).padStart(places + 1, '0').padStart(width, ' ').split('').reverse().map((c) => (c === ' ' ? null : Number(c)));

export function columnLayout(op, top, bottom, done = Infinity, { places = 0, topPlaces = places, bottomPlaces = places } = {}) {
  const width = Math.max(lengthOf(top, places), lengthOf(bottom, places), op === '+' ? lengthOf(top + bottom, places) : 0);
  const t = digitsOf(top, width, places);
  const b = digitsOf(bottom, width, places);
  const cols = Array.from({ length: width }, (_, i) => ({
    top: t[i], bottom: b[i], newTop: null, carry: null, result: null,
    ...(i < places - topPlaces ? { topPadded: true } : {}), ...(i < places - bottomPlaces ? { bottomPadded: true } : {}),
  }));
  // How many columns there are to work: every digit column, plus one for a final carry.
  const work = op === '+' ? lengthOf(top + bottom, places) : Math.max(lengthOf(top, places), lengthOf(bottom, places));
  const columns = Math.min(done, work);
  if (op === '+') {
    let carry = 0;
    for (let i = 0; i < columns; i++) {
      const sum = (t[i] ?? 0) + (b[i] ?? 0) + carry;
      cols[i].result = sum % 10;
      carry = sum >= 10 ? 1 : 0;
      if (carry && i + 1 < width) cols[i + 1].carry = 1;
    }
  } else {
    const cur = t.map((d) => d ?? 0);
    for (let i = 0; i < columns; i++) {
      if (cur[i] < (b[i] ?? 0)) {
        let j = i + 1;
        while (cur[j] === 0) j++;
        cur[j] -= 1;
        cols[j].newTop = cur[j];
        for (let k = j - 1; k > i; k--) { cur[k] = 9; cols[k].newTop = 9; }
        cur[i] += 10;
        cols[i].newTop = cur[i];
      }
      cols[i].result = cur[i] - (b[i] ?? 0);
    }
    // No leading zeros in the answer.
    for (let i = columns - 1; i > places && cols[i].result === 0 && i >= lengthOf(top - bottom, places); i--) cols[i].result = null;
  }
  return { op, width, places, columns: cols, current: columns > 0 && columns <= width ? columns - 1 : null };
}
