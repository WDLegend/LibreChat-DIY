import type { LearningMapPayload } from '~/types/learning';
import {
  advanceCurrentNode,
  deriveCoverCountFromSelected,
  deriveMasteredFromCoverCount,
  getBranchOptionNodeIds,
} from './learning';

const branchingMap: LearningMapPayload = {
  title: 'Branching Map',
  nodes: [
    { id: 'root', label: 'Root' },
    { id: 'a', label: 'A', parentId: 'root' },
    { id: 'b', label: 'B', parentId: 'root' },
    { id: 'shared', label: 'Shared' },
  ],
  edges: [
    { from: 'root', to: 'a' },
    { from: 'root', to: 'b' },
    { from: 'a', to: 'shared' },
    { from: 'b', to: 'shared' },
  ],
};

function masteredFromSelected(map: LearningMapPayload, selectedNodeIds: string[]) {
  const coverCount = deriveCoverCountFromSelected(map, selectedNodeIds);
  return deriveMasteredFromCoverCount(coverCount);
}

describe('advanceCurrentNode', () => {
  it('waits for branch selection when current node has multiple eligible children', () => {
    const masteredNodeIds = masteredFromSelected(branchingMap, ['root']);

    expect(advanceCurrentNode(branchingMap, masteredNodeIds, 'root')).toEqual({
      nextNodeId: undefined,
      awaitingBranchChoice: true,
      pendingChildIds: ['a', 'b'],
    });
  });

  it('stays aligned with the current branch before falling back to the frontier', () => {
    const masteredNodeIds = masteredFromSelected(branchingMap, ['root', 'a']);

    expect(advanceCurrentNode(branchingMap, masteredNodeIds, 'a')).toEqual({
      nextNodeId: 'b',
      awaitingBranchChoice: false,
      pendingChildIds: [],
    });
  });
});

describe('getBranchOptionNodeIds', () => {
  it('returns unique branch candidates with all prerequisites satisfied', () => {
    const masteredNodeIds = masteredFromSelected(branchingMap, ['root', 'a']);

    expect(getBranchOptionNodeIds(branchingMap, masteredNodeIds)).toEqual(['b']);
  });

  it('filters branch candidates by the current focus node', () => {
    const masteredNodeIds = masteredFromSelected(branchingMap, ['root']);

    expect(getBranchOptionNodeIds(branchingMap, masteredNodeIds)).toEqual(['a', 'b']);
  });
});
