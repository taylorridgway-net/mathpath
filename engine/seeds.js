// Problem seeds. A seed comes from the student's permanent id (given out by the
// server when the teacher adds the student) and the attempt number the server
// has on record, so the browser can't pick or reroll its problems: the server
// rejects any save whose seed or attempt number doesn't match.
//
//   kind: 'diagnostic' or a lesson section id

export function seedFor(studentId, kind, attemptNo) {
  if (!studentId || !kind || !Number.isInteger(attemptNo) || attemptNo < 1) {
    throw new Error(`seedFor: bad arguments (${studentId}, ${kind}, ${attemptNo})`);
  }
  return `${studentId}|${kind}|${attemptNo}`;
}
