// Column addition and subtraction, laid out the way it's written on paper:
// carried 1s above the next column; when borrowing, the top digit crossed out
// with its new value above (borrowing across zeros changes them to 9s).
//
// columnLayout(op, top, bottom, done) -> what to draw after `done` columns
// (ones first) have been worked. Pure, so it's tested in Node and used by the
// lesson picture and the worked solutions alike.

const digitsOf = (n, width) => String(n).padStart(width, ' ').split('').reverse().map((c) => (c === ' ' ? null : Number(c)));

export function columnLayout(op, top, bottom, done = Infinity) {
  const width = Math.max(String(top).length, String(bottom).length, op === '+' ? String(top + bottom).length : 0);
  const t = digitsOf(top, width);
  const b = digitsOf(bottom, width);
  const cols = Array.from({ length: width }, (_, i) => ({ top: t[i], bottom: b[i], newTop: null, carry: null, result: null }));
  // How many columns there are to work: every digit column, plus one for a final carry.
  const work = op === '+' ? String(top + bottom).length : Math.max(String(top).length, String(bottom).length);
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
    for (let i = columns - 1; i > 0 && cols[i].result === 0 && i >= String(top - bottom).length; i--) cols[i].result = null;
  }
  return { op, width, columns: cols, current: columns > 0 && columns <= width ? columns - 1 : null };
}
