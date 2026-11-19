// Teacher-verified mastery from a paper test. The teacher marks each item right
// or wrong; the rule (curriculum/mastery.json "verification": 5 of 6, owner
// decision) suggests a decision, and the teacher makes the final call.
// Pure logic (tested in Node).

export function scorePaperTest(marks, rule) {
  if (marks.length !== rule.outOf) throw new Error(`Expected ${rule.outOf} marks, got ${marks.length}`);
  const score = marks.filter((m) => m === 1).length;
  return { score, outOf: rule.outOf, suggested: score >= rule.minScore ? 'verified' : 'not-yet' };
}

// One verification record. `decision` is the teacher's call (may differ from the suggestion).
export function verificationRecord({ code, skillId, assessmentId, version, marks, rule, decision, by, at, previous = [] }) {
  const { score, outOf, suggested } = scorePaperTest(marks, rule);
  return {
    code,
    skillId,
    assessmentId,
    version,
    marks,
    score,
    outOf,
    suggested,
    decision: decision ?? suggested,
    attempt: previous.filter((v) => v.code === code && v.skillId === skillId).length + 1,
    by,
    at,
  };
}
