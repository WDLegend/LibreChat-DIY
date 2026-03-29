import type { LearningMapPayload, LearningMapState } from '~/types/learning';

export const LEARNING_CONTINUE_TOKEN = '__LEARNING_NEXT__';
export const LEARNING_CONTINUE_TOKEN_PREFIX = '__LEARNING_NEXT__:';
export const LEARNING_BRANCH_TOKEN_PREFIX = '__LEARNING_BRANCH__:';

const CONTINUE_PATTERNS = [
  /\bcontinue\b/i,
  /\bnext\b/i,
  /\bgo on\b/i,
  /\bgot it\b/i,
  /\bok\b/i,
  /\bokay\b/i,
  /\ball right\b/i,
  /\bmove on\b/i,
  /\bcarry on\b/i,
  /继续/,
  /下一步/,
  /下一节/,
  /下一点/,
  /继续讲/,
  /懂了/,
  /明白了/,
  /我明白了/,
  /我理解了/,
  /理解了/,
  /知道了/,
  /可以了/,
  /好的/,
  /好/,
  /行/,
  /ok/,
  /接着讲/,
  /往下/,
];

export function isContinueIntent(text: string): boolean {
  return CONTINUE_PATTERNS.some((pattern) => pattern.test(text));
}

export function parseLearningMapPayload(content: string): LearningMapPayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<LearningMapPayload>;
    const nodes = Array.isArray(parsed.nodes)
      ? parsed.nodes.reduce<LearningMapPayload['nodes']>((acc, node) => {
          const source = node as { id?: unknown; label?: unknown; title?: unknown; parentId?: unknown };
          const id = typeof source.id === 'string' ? source.id : null;
          const label =
            typeof source.label === 'string'
              ? source.label
              : typeof source.title === 'string'
                ? source.title
                : null;
          const parentId = typeof source.parentId === 'string' ? source.parentId : undefined;

          if (!id || !label) {
            return acc;
          }

          acc.push({ id, label, parentId });
          return acc;
        }, [])
      : [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const explicitEdges = Array.isArray(parsed.edges)
      ? parsed.edges.filter((edge): edge is { from: string; to: string } => {
          return (
            !!edge &&
            typeof edge.from === 'string' &&
            typeof edge.to === 'string' &&
            nodeIds.has(edge.from) &&
            nodeIds.has(edge.to)
          );
        })
      : [];

    const parentEdges = nodes
      .filter((node) => node.parentId != null && nodeIds.has(node.parentId))
      .map((node) => ({ from: node.parentId as string, to: node.id }));
    const edges = explicitEdges.length > 0 ? explicitEdges : parentEdges;

    if (nodes.length === 0) {
      return null;
    }

    return {
      title: typeof parsed.title === 'string' ? parsed.title : 'Learning Map',
      nodes,
      edges,
    };
  } catch {
    return null;
  }
}

export function getTopologicalOrder(map: LearningMapPayload): string[] {
  const inDegree = new Map<string, number>(map.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(map.nodes.map((node) => [node.id, []]));

  (map.edges ?? []).forEach((edge) => {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  });

  const queue = map.nodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id == null) {
      break;
    }
    ordered.push(id);
    (outgoing.get(id) ?? []).forEach((nextId) => {
      const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        queue.push(nextId);
      }
    });
  }

  if (ordered.length === map.nodes.length) {
    return ordered;
  }

  const seen = new Set(ordered);
  return [...ordered, ...map.nodes.map((node) => node.id).filter((id) => !seen.has(id))];
}

export function getParentMap(map: LearningMapPayload): Map<string, string[]> {
  const parentMap = new Map<string, string[]>(map.nodes.map((node) => [node.id, []]));

  (map.edges ?? []).forEach((edge) => {
    if (!parentMap.has(edge.to)) {
      parentMap.set(edge.to, []);
    }
    parentMap.set(edge.to, [...(parentMap.get(edge.to) ?? []), edge.from]);
  });

  map.nodes.forEach((node) => {
    if (node.parentId && parentMap.has(node.id)) {
      parentMap.set(node.id, [...(parentMap.get(node.id) ?? []), node.parentId]);
    }
  });

  return parentMap;
}

export function getPrimaryParentMap(map: LearningMapPayload): Map<string, string | undefined> {
  const parentMap = new Map<string, string | undefined>(map.nodes.map((node) => [node.id, undefined]));

  map.nodes.forEach((node) => {
    if (node.parentId && parentMap.has(node.id)) {
      parentMap.set(node.id, node.parentId);
    }
  });

  (map.edges ?? []).forEach((edge) => {
    if (!parentMap.has(edge.to)) {
      return;
    }
    if (parentMap.get(edge.to) == null) {
      parentMap.set(edge.to, edge.from);
    }
  });

  return parentMap;
}

export function getChildrenMap(map: LearningMapPayload): Map<string, string[]> {
  const childrenMap = new Map<string, Set<string>>(map.nodes.map((node) => [node.id, new Set()]));

  (map.edges ?? []).forEach((edge) => {
    if (!childrenMap.has(edge.from)) {
      childrenMap.set(edge.from, new Set());
    }
    childrenMap.get(edge.from)?.add(edge.to);
  });

  map.nodes.forEach((node) => {
    if (node.parentId && childrenMap.has(node.parentId)) {
      childrenMap.get(node.parentId)?.add(node.id);
    }
  });

  return new Map(Array.from(childrenMap.entries()).map(([key, value]) => [key, [...value]]));
}

export function getDescendants(map: LearningMapPayload, nodeId: string): string[] {
  const childrenMap = getChildrenMap(map);
  const result: string[] = [];
  const stack = [...(childrenMap.get(nodeId) ?? [])];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || visited.has(id)) {
      continue;
    }
    visited.add(id);
    result.push(id);
    (childrenMap.get(id) ?? []).forEach((childId) => stack.push(childId));
  }

  return result;
}

export function getAncestors(map: LearningMapPayload, nodeId: string): string[] {
  const parentMap = getParentMap(map);
  const result: string[] = [];
  const visited = new Set<string>();

  const walk = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const parents = parentMap.get(id) ?? [];
    parents.forEach((parentId) => {
      walk(parentId);
      result.push(parentId);
    });
  };

  walk(nodeId);
  return Array.from(new Set(result));
}

export function deriveCoverCountFromSelected(
  map: LearningMapPayload,
  selectedNodeIds: string[],
): Record<string, number> {
  const parentMap = getPrimaryParentMap(map);
  const nodeSet = new Set(map.nodes.map((node) => node.id));
  const coverCount: Record<string, number> = Object.fromEntries(
    map.nodes.map((node) => [node.id, 0]),
  ) as Record<string, number>;

  selectedNodeIds.forEach((nodeId) => {
    if (!nodeSet.has(nodeId)) {
      return;
    }
    let current: string | undefined = nodeId;
    let guard = 0;
    while (current != null && guard < map.nodes.length + 5) {
      coverCount[current] = (coverCount[current] ?? 0) + 1;
      current = parentMap.get(current);
      guard += 1;
    }
  });

  return coverCount;
}

export function deriveMasteredFromCoverCount(coverCount: Record<string, number>): string[] {
  return Object.entries(coverCount)
    .filter(([, count]) => count > 0)
    .map(([nodeId]) => nodeId);
}

export function getNextNodeFromChoice(
  map: LearningMapPayload,
  masteredNodeIds: string[],
  fromNodeId?: string,
): string | undefined {
  const branchOptionNodeIds = getBranchOptionNodeIds(map, masteredNodeIds);

  if (branchOptionNodeIds.length > 0) {
    return branchOptionNodeIds[0];
  }

  return getNextNodeId(map, masteredNodeIds);
}

export function getNextNodeId(map: LearningMapPayload, masteredNodeIds: string[]): string | undefined {
  const mastered = new Set(masteredNodeIds);
  const order = getTopologicalOrder(map);
  return order.find((id) => !mastered.has(id));
}

function orderedUniqueNodeIds(map: LearningMapPayload, nodeIds: Iterable<string>): string[] {
  const nodeIdSet = new Set(map.nodes.map((node) => node.id));
  const candidateSet = new Set<string>();

  for (const nodeId of nodeIds) {
    if (nodeIdSet.has(nodeId)) {
      candidateSet.add(nodeId);
    }
  }

  return getTopologicalOrder(map).filter((nodeId) => candidateSet.has(nodeId));
}

function hasSatisfiedPrerequisites(
  parentMap: Map<string, string[]>,
  mastered: Set<string>,
  nodeId: string,
): boolean {
  const parentIds = parentMap.get(nodeId) ?? [];
  return parentIds.every((parentId) => mastered.has(parentId));
}

export function resolveCurrentNode(
  map: LearningMapPayload,
  masteredNodeIds: string[],
  preferredCurrentNodeId?: string,
): {
  currentNodeId?: string;
  awaitingBranchChoice: boolean;
  pendingChildIds: string[];
} {
  const mastered = new Set(masteredNodeIds);
  const childrenMap = getChildrenMap(map);

  let currentNodeId = preferredCurrentNodeId;
  if (!currentNodeId || mastered.has(currentNodeId)) {
    currentNodeId = getNextNodeId(map, masteredNodeIds);
  }

  if (!currentNodeId) {
    return { currentNodeId: undefined, awaitingBranchChoice: false, pendingChildIds: [] };
  }

  const pendingChildIds = (childrenMap.get(currentNodeId) ?? []).filter((id) => !mastered.has(id));
  const awaitingBranchChoice = pendingChildIds.length > 1;

  return {
    currentNodeId,
    awaitingBranchChoice,
    pendingChildIds,
  };
}

export function getFrontierNodeIds(map: LearningMapPayload, masteredNodeIds: string[]): string[] {
  const mastered = new Set(masteredNodeIds);
  const parentMap = getParentMap(map);

  return getTopologicalOrder(map).filter((id) => {
    if (mastered.has(id)) {
      return false;
    }

    return hasSatisfiedPrerequisites(parentMap, mastered, id);
  });
}

export function getBranchOptionNodeIds(
  map: LearningMapPayload,
  masteredNodeIds: string[],
): string[] {
  const mastered = new Set(masteredNodeIds);
  const childrenMap = getChildrenMap(map);
  const parentMap = getParentMap(map);

  const options = map.nodes.flatMap((node) => {
    if (!mastered.has(node.id)) {
      return [];
    }

    return (childrenMap.get(node.id) ?? []).filter(
      (childId) => !mastered.has(childId) && hasSatisfiedPrerequisites(parentMap, mastered, childId),
    );
  });

  return orderedUniqueNodeIds(map, options);
}

export function advanceCurrentNode(
  map: LearningMapPayload,
  masteredNodeIds: string[],
  currentNodeId?: string,
): {
  nextNodeId?: string;
  awaitingBranchChoice: boolean;
  pendingChildIds: string[];
} {
  const branchOptionNodeIds = getBranchOptionNodeIds(map, masteredNodeIds);

  if (branchOptionNodeIds.length > 1) {
    return {
      nextNodeId: undefined,
      awaitingBranchChoice: true,
      pendingChildIds: branchOptionNodeIds,
    };
  }

  if (branchOptionNodeIds.length === 1) {
    return {
      nextNodeId: branchOptionNodeIds[0],
      awaitingBranchChoice: false,
      pendingChildIds: [],
    };
  }

  const frontier = getFrontierNodeIds(map, masteredNodeIds).filter((nodeId) => nodeId !== currentNodeId);
  return {
    nextNodeId: frontier[0] ?? getNextNodeId(map, masteredNodeIds),
    awaitingBranchChoice: false,
    pendingChildIds: [],
  };
}

export function advanceLearningState(state: LearningMapState): LearningMapState {
  const nextId = getNextNodeFromChoice(state.map, state.masteredNodeIds, state.currentNodeId);
  return {
    ...state,
    currentNodeId: nextId,
    updatedAt: new Date().toISOString(),
  };
}
