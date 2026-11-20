// Saving in this browser, per signed-in student (a shared device keeps each
// student's work apart, and nothing is lost by signing out).
//
//   in progress  one entry per section: the seed and answers so far. A practice
//                session is fully determined by (seed, answers), so that's all it
//                takes to put the student back where they were.
//   finished     one record per finished attempt (diagnostic or section): seed,
//                every answer, timing, attempts, curriculum version.
//   outbox       finished records not yet accepted by the server. Sent in order;
//                kept until the server says it has them, and retried on the next
//                load after a dropped connection or a sleeping Chromebook.

import { loadLocal, saveLocal } from './local.js';

let prefix = 'mathpath.anon.';
const key = (name) => `${prefix}${name}.v1`;

export function setStudent(studentId) {
  prefix = `mathpath.${studentId}.`;
}

// Anything else a page wants to keep for this student (e.g. the diagnostic in progress).
export const loadMine = (name) => loadLocal(key(name));
export const saveMine = (name, value) => saveLocal(key(name), value);

export function loadProgress(sectionId) {
  return (loadLocal(key('section-progress')) || {})[sectionId] || null;
}

export function saveProgress(sectionId, run) {
  const all = loadLocal(key('section-progress')) || {};
  all[sectionId] = run;
  saveLocal(key('section-progress'), all);
}

export function clearProgress(sectionId) {
  const all = loadLocal(key('section-progress')) || {};
  delete all[sectionId];
  saveLocal(key('section-progress'), all);
}

export function finishedRecords(sectionId) {
  const all = loadLocal(key('section-records')) || [];
  return sectionId ? all.filter((r) => r.section === sectionId) : all;
}

// Keep a finished record and queue it for the server.
export function saveFinished(record) {
  if (record.type !== 'diagnostic') saveLocal(key('section-records'), [...finishedRecords(), record]);
  saveLocal(key('outbox'), [...outbox(), record]);
}

export function outbox() {
  return loadLocal(key('outbox')) || [];
}

export function removeFromOutbox(saveId) {
  saveLocal(key('outbox'), outbox().filter((r) => r.saveId !== saveId));
}

// The server refused a record (e.g. the app changed under it). Keep it for the record, out of the queue.
export function setAside(record, reason) {
  saveLocal(key('rejected'), [...(loadLocal(key('rejected')) || []), { record, reason }]);
  removeFromOutbox(record.saveId);
}

export function clearAllSections() {
  for (const name of ['section-progress', 'section-records', 'outbox', 'rejected', 'diagnostic']) saveLocal(key(name), null);
}

export const outboxCount = () => outbox().length;
