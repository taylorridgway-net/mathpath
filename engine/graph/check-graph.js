// Checks the skill graph against the rules in docs/PLAN.md, section 2.
//
// Input: the parsed domains.json, plus an object mapping each domain file name
// to its parsed contents. (This file never reads from disk itself, so it runs
// the same way in Node, in the browser, and in Apps Script.)
//
// Output: a list of problems, each a plain-English string. An empty list means
// the graph is valid.

const SCHEMA_VERSION = 1;
const STRENGTHS = ['essential', 'supporting'];
const STATUSES = ['stub', 'draft', 'ready', 'retired'];
const ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

export function checkGraph(domainsIndex, domainFiles) {
  const problems = [];
  const nodes = new Map(); // id -> { id, kind: 'skill'|'subskill', skillId, status, prerequisites }

  // ---- 1. The domain list ----
  if (domainsIndex.schemaVersion !== SCHEMA_VERSION) {
    problems.push(`domains.json: schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (typeof domainsIndex.curriculumVersion !== 'string') {
    problems.push('domains.json: curriculumVersion is missing');
  }

  for (const entry of domainsIndex.domains || []) {
    const file = domainFiles[entry.file];
    if (!file) {
      problems.push(`domains.json lists "${entry.file}" but that file was not provided`);
      continue;
    }
    if (file.schemaVersion !== SCHEMA_VERSION) {
      problems.push(`${entry.file}: schemaVersion must be ${SCHEMA_VERSION}`);
    }
    if (!file.domain || file.domain.id !== entry.id) {
      problems.push(`${entry.file}: domain id should be "${entry.id}"`);
    }

    // ---- 2. Each skill and subskill: shape and naming ----
    for (const skill of file.skills || []) {
      const where = `${entry.file} > ${skill.id}`;
      checkId(skill.id, `${entry.id}.`, where, problems);
      if (!skill.name) problems.push(`${where}: missing name`);
      if (!STATUSES.includes(skill.status)) {
        problems.push(`${where}: status must be one of ${STATUSES.join(', ')}`);
      }
      if (!Array.isArray(skill.subskills)) {
        problems.push(`${where}: subskills must be a list (use [] if none)`);
      } else if (skill.subskills.length === 0 && skill.status !== 'stub' && skill.status !== 'retired') {
        problems.push(`${where}: a skill that is being built needs at least one subskill`);
      }
      addNode(nodes, problems, where, {
        id: skill.id, kind: 'skill', skillId: skill.id, status: skill.status,
        prerequisites: skill.prerequisites,
      });

      for (const sub of skill.subskills || []) {
        const subWhere = `${entry.file} > ${sub.id}`;
        checkId(sub.id, `${skill.id}.`, subWhere, problems);
        if (!sub.name) problems.push(`${subWhere}: missing name`);
        addNode(nodes, problems, subWhere, {
          id: sub.id, kind: 'subskill', skillId: skill.id, status: skill.status,
          prerequisites: sub.prerequisites,
        });
      }
    }
  }

  // ---- 3. Prerequisite links ----
  for (const node of nodes.values()) {
    if (!Array.isArray(node.prerequisites)) {
      problems.push(`${node.id}: prerequisites must be a list (use [] if none)`);
      continue;
    }
    for (const link of node.prerequisites) {
      const target = nodes.get(link.id);
      if (!target) {
        problems.push(`${node.id}: prerequisite "${link.id}" does not exist`);
        continue;
      }
      if (!STRENGTHS.includes(link.strength)) {
        problems.push(`${node.id} -> ${link.id}: strength must be "essential" or "supporting"`);
      }
      if (target.skillId === node.skillId && (target.kind === 'skill' || node.kind === 'skill')) {
        problems.push(`${node.id} -> ${link.id}: a skill can't need itself or its own subskills`);
      }
      // "check": when the diagnostic follows this link down, ask only these parts of the skill.
      if (link.check !== undefined) {
        if (target.kind !== 'skill') problems.push(`${node.id} -> ${link.id}: "check" only makes sense for a link to a whole skill`);
        else for (const c of link.check) if (nodes.get(c)?.skillId !== link.id || c === link.id) problems.push(`${node.id} -> ${link.id}: "check" lists ${c}, which isn't one of its parts`);
      }
      if (target.status === 'retired' && node.status !== 'retired') {
        problems.push(`${node.id} -> ${link.id}: depends on a retired skill`);
      }
    }
  }

  // ---- 4. No loops ----
  // Checked at skill level: "skill A needs something in skill B" is an arrow A -> B.
  // This also rules out loops between individual subskills in different skills.
  const skillEdges = new Map();
  for (const node of nodes.values()) {
    if (!skillEdges.has(node.skillId)) skillEdges.set(node.skillId, new Set());
    for (const link of node.prerequisites || []) {
      const target = nodes.get(link.id);
      if (target && target.skillId !== node.skillId) skillEdges.get(node.skillId).add(target.skillId);
    }
  }
  // Within one skill, subskills may need sibling subskills; check those for loops too.
  const subskillEdges = new Map();
  for (const node of nodes.values()) {
    if (node.kind !== 'subskill') continue;
    const siblings = (node.prerequisites || [])
      .map((l) => nodes.get(l.id))
      .filter((t) => t && t.kind === 'subskill' && t.skillId === node.skillId)
      .map((t) => t.id);
    subskillEdges.set(node.id, new Set(siblings));
  }
  for (const loop of findLoops(skillEdges)) problems.push(`loop between skills: ${loop.join(' -> ')}`);
  for (const loop of findLoops(subskillEdges)) problems.push(`loop between subskills: ${loop.join(' -> ')}`);

  return problems;
}

function checkId(id, requiredPrefix, where, problems) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    problems.push(`${where}: id must be lowercase letters, digits and dashes, separated by dots`);
  } else if (!id.startsWith(requiredPrefix)) {
    problems.push(`${where}: id must start with "${requiredPrefix}"`);
  }
}

function addNode(nodes, problems, where, node) {
  if (nodes.has(node.id)) {
    problems.push(`${where}: id "${node.id}" is used more than once`);
    return;
  }
  nodes.set(node.id, node);
}

// Depth-first search. Returns each loop found as a list of ids, e.g. [a, b, a].
function findLoops(edges) {
  const loops = [];
  const state = new Map(); // id -> 'visiting' | 'done'
  const path = [];

  function visit(id) {
    state.set(id, 'visiting');
    path.push(id);
    for (const next of edges.get(id) || []) {
      if (state.get(next) === 'visiting') {
        loops.push([...path.slice(path.indexOf(next)), next]);
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    path.pop();
    state.set(id, 'done');
  }

  for (const id of edges.keys()) if (!state.has(id)) visit(id);
  return loops;
}
