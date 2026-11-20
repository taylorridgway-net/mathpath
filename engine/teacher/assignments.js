// Teacher changes to a student's path (the platform proposes, the teacher decides):
//   assign  put a lesson (all its steps) or one step on the path, at the top,
//           marked "From your teacher". Works for any built lesson, on the path or not
//           (e.g. a skill the diagnostic never reaches, like converting mixed numbers).
//   skip    take a lesson or one step off the path ("they don't need this").
// Both can be undone (unassign, unskip). Everything is logged; nothing is deleted.
//
// Records: { action: 'assign' | 'unassign' | 'skip' | 'unskip', lesson, section (or null), at, by }.
// Assigning something takes it off the skipped list, and skipping it takes it off
// the assigned list: the latest decision wins.

export const PATH_ACTIONS = ['assign', 'unassign', 'skip', 'unskip'];
// For the change log: before -> after.
export const LOG_STATES = {
  assign: ['', 'on their path (from you)'], unassign: ['on their path (from you)', ''],
  skip: ['on their path', 'taken off'], unskip: ['taken off', 'on their path'],
};

const keyOf = (r) => `${r.lesson}|${r.section || ''}`;

// -> { assigned: [{ lesson, section, at, by }], skipped: [...] }, oldest first.
export function pathChanges(records = []) {
  const assigned = new Map();
  const skipped = new Map();
  for (const r of [...records].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const key = keyOf(r);
    const item = { lesson: r.lesson, section: r.section || null, at: r.at, by: r.by };
    if (r.action === 'assign') { skipped.delete(key); if (!assigned.has(key)) assigned.set(key, item); }
    if (r.action === 'unassign') assigned.delete(key);
    if (r.action === 'skip') { assigned.delete(key); if (!skipped.has(key)) skipped.set(key, item); }
    if (r.action === 'unskip') skipped.delete(key);
  }
  return { assigned: [...assigned.values()], skipped: [...skipped.values()] };
}

// The section ids an assigned or skipped item stands for: one step, or every step of
// the lesson (one-step sections in lesson order, then "Putting it together").
export function sectionsOf(item, lessons) {
  const lesson = lessons.find((l) => l.skill === item.lesson);
  if (!lesson) return [];
  if (item.section) return lesson.sections.some((s) => s.id === item.section) ? [item.section] : [];
  return [...lesson.sections.filter((s) => s.mode === 'section'), ...lesson.sections.filter((s) => s.mode === 'skill')].map((s) => s.id);
}
