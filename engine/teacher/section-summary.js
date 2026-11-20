// The short version of a finished section that the dashboard needs (so it never
// has to load every answer). Worked out once, when the section is saved.
//
// result: a practice session's result(). times: milliseconds per answer.

export function sectionSummary(result, times = []) {
  const misconceptions = new Set();
  for (const p of result.problems) for (const a of p.attempts) if (a.misconception) misconceptions.add(a.misconception);
  return {
    problemCount: result.problems.filter((p) => p.outcome).length,
    firstTry: result.problems.filter((p) => p.outcome === 'right-first').length,
    seconds: Math.round(times.reduce((n, t) => n + (t || 0), 0) / 1000),
    misconceptions: [...misconceptions],
  };
}
