// Unit readiness: before teaching a unit, which students have the skills it relies on
// (curriculum/courses.json "reliesOn"), who needs work on which skill, and who hasn't been
// checked on something yet. Pure logic; the dashboard's Units tab draws it.

// A skill's dashboard status (engine/teacher/student-status.js) for readiness.
const READY = new Set(['verified', 'platform', 'known', 'credited']);
const NEEDS = new Set(['gap', 'working', 'shaky', 'slipping', 'blocked']);
export function readinessOf(status) {
  if (READY.has(status)) return 'ready';
  if (NEEDS.has(status)) return 'needs';
  return 'unknown'; // not tested yet, partly asked, can't check
}

// students: [{ code, held, status }] (status: studentStatus() output; held: what the class holds back).
// Returns { ready: [codes], needs: [{ skill, codes }], unknown: [{ skill, codes }], notReady: [codes] }.
// A skill the student's class holds back (not taught yet) doesn't count either way.
export function unitReadiness(unit, students) {
  const needs = new Map(unit.reliesOn.map((s) => [s, []]));
  const unknown = new Map(unit.reliesOn.map((s) => [s, []]));
  const ready = [];
  const notReady = [];
  for (const st of students) {
    let ok = true;
    let checked = true;
    for (const skill of unit.reliesOn) {
      if ((st.held || []).includes(skill)) continue;
      const r = readinessOf(st.status.skills[skill]);
      if (r === 'needs') { needs.get(skill).push(st.code); ok = false; }
      if (r === 'unknown') { unknown.get(skill).push(st.code); checked = false; }
    }
    if (ok && checked) ready.push(st.code);
    else if (!ok) notReady.push(st.code);
  }
  const list = (m) => [...m].filter(([, codes]) => codes.length).map(([skill, codes]) => ({ skill, codes }));
  return { ready, notReady, needs: list(needs), unknown: list(unknown) };
}
