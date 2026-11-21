// Course mapping (curriculum/courses.json): which skills a class's course hasn't taught yet.
// Pure logic, shared by the browser, the server and the dashboard.
//
// A skill is "held back" for a class when it is first taught in the class's own course
// (this year) or a later one, and the teacher hasn't opened it for the class yet. Held-back
// skills get no check questions, no lessons on the path (unless the teacher assigns one),
// and show as "not taught yet" on the dashboard instead of as gaps. Foundations are never
// held back: a class with no course set holds nothing back.

// The course a skill is first taught in (its index), or -1 if it's a foundation.
export function courseIndexOf(courses, skillId) {
  return courses.courses.findIndex((c) => c.units.some((u) => u.skills.includes(skillId)));
}

export function heldSkills({ courses, course, opened = [] }) {
  const at = courses.courses.findIndex((c) => c.id === course);
  if (at < 0) return [];
  return courses.courses.slice(at).flatMap((c) => c.units.flatMap((u) => u.skills)).filter((s) => !opened.includes(s));
}

// Is a skill or subskill held back? (A subskill goes with its skill.)
export function isHeld(held, id) {
  return held.some((s) => id === s || id.startsWith(`${s}.`));
}

// For the dashboard: this course's units, each skill marked open or not taught yet.
export function courseUnits({ courses, course, opened = [] }) {
  const c = courses.courses.find((x) => x.id === course);
  if (!c) return [];
  return c.units.map((u) => ({ name: u.name, skills: u.skills.map((id) => ({ id, open: opened.includes(id) })) }));
}
