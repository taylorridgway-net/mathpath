// The practice plan for a lesson section: exactly what the practice session
// needs to know. Built in ONE place, because the student's browser, the server
// (re-grading a save) and the dashboard (re-creating problems) must all build
// the same session, or the server would grade a different session than the one
// the student did.

export function practicePlan(section, { review = false } = {}) {
  return {
    generator: section.generator,
    mode: section.mode,
    review: Boolean(review),
    ...(section.check ? { check: section.check } : {}),
  };
}
