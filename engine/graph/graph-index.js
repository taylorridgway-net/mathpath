// Turns the curriculum graph files into something easy to ask questions of:
// "what are the essential prerequisites of X?", "what subskills does skill Y have?"
//
// Like check-graph.js, this takes already-parsed JSON and never reads files,
// so it runs the same in Node, the browser, and Apps Script.

export function buildGraphIndex(domainsIndex, domainFiles) {
  const nodes = new Map();

  for (const entry of domainsIndex.domains) {
    for (const skill of domainFiles[entry.file].skills) {
      nodes.set(skill.id, {
        id: skill.id,
        kind: 'skill',
        skillId: skill.id,
        domain: entry.id,
        name: skill.name,
        status: skill.status,
        prerequisites: skill.prerequisites || [],
        subskillIds: (skill.subskills || []).map((s) => s.id),
      });
      for (const sub of skill.subskills || []) {
        nodes.set(sub.id, {
          id: sub.id,
          kind: 'subskill',
          skillId: skill.id,
          domain: entry.id,
          name: sub.name,
          status: skill.status,
          prerequisites: sub.prerequisites || [],
        });
      }
    }
  }

  function get(id) {
    const node = nodes.get(id);
    if (!node) throw new Error(`Unknown skill or subskill "${id}"`);
    return node;
  }

  // Essential prerequisites that apply to this node. For a subskill, that's its
  // own links PLUS its parent skill's links (a skill's prerequisites apply to
  // all of its subskills).
  function essentialPrereqs(id) {
    const node = get(id);
    const links = [...node.prerequisites];
    if (node.kind === 'subskill') links.push(...get(node.skillId).prerequisites);
    return [...new Set(links.filter((l) => l.strength === 'essential').map((l) => l.id))];
  }

  return {
    curriculumVersion: domainsIndex.curriculumVersion,
    nodes,
    has: (id) => nodes.has(id),
    get,
    essentialPrereqs,
    subskillsOf: (skillId) => get(skillId).subskillIds || [],
  };
}
