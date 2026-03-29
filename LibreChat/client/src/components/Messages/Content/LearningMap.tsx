import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import LearningTreeGraph from '~/components/Messages/Content/LearningTreeGraph';
import { useLearningStateQuery, useUpdateLearningStateMutation } from '~/data-provider/Notes';
import store from '~/store';
import {
  deriveCoverCountFromSelected,
  deriveMasteredFromCoverCount,
  getDescendants,
  getNextNodeId,
  parseLearningMapPayload,
  resolveCurrentNode,
} from '~/utils/learning';

function emptyCoverCount(nodeIds: string[]): Record<string, number> {
  return Object.fromEntries(nodeIds.map((id) => [id, 0])) as Record<string, number>;
}

function readServerLearningState({
  raw,
  conversationId,
  map,
}: {
  raw: Record<string, unknown> | null;
  conversationId: string;
  map: NonNullable<ReturnType<typeof parseLearningMapPayload>>;
}) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const rawConversationId = typeof raw.conversationId === 'string' ? raw.conversationId : null;
  if (!rawConversationId || rawConversationId !== conversationId) {
    return null;
  }

  const selectedNodeIdsRaw = Array.isArray(raw.selectedNodeIds) ? raw.selectedNodeIds : [];
  const nodeSet = new Set(map.nodes.map((node) => node.id));
  const selectedNodeIds = selectedNodeIdsRaw.filter(
    (id): id is string => typeof id === 'string' && nodeSet.has(id),
  );
  const coverCount = deriveCoverCountFromSelected(map, selectedNodeIds);
  const masteredNodeIds = deriveMasteredFromCoverCount(coverCount);
  const currentNodeIdRaw = typeof raw.currentNodeId === 'string' ? raw.currentNodeId : undefined;
  const currentNodeId =
    currentNodeIdRaw && nodeSet.has(currentNodeIdRaw)
      ? currentNodeIdRaw
      : getNextNodeId(map, masteredNodeIds);

  return {
    conversationId,
    map,
    selectedNodeIds,
    coverCount,
    masteredNodeIds,
    currentNodeId,
    pendingBranchFromId: undefined,
    focusRootId: undefined,
    awaitingBranchChoice: false,
    pendingChildIds: [],
    lastManualNodeId: undefined,
    lastSnapshot: undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export default function LearningMap({ children }: { children: string }) {
  const { conversationId } = useParams();
  const activeConversationId = conversationId ?? 'new';
  const [learningMapState, setLearningMapState] = useRecoilState(store.learningMapState);
  const learningStateQuery = useLearningStateQuery(activeConversationId);
  const updateLearningStateMutation = useUpdateLearningStateMutation();
  const mutateLearningState = updateLearningStateMutation.mutate;
  const map = useMemo(() => parseLearningMapPayload(children), [children]);

  useEffect(() => {
    if (!map) {
      return;
    }

    setLearningMapState((prev) => {
      const init = {
        conversationId: activeConversationId,
        map,
        selectedNodeIds: [],
        coverCount: emptyCoverCount(map.nodes.map((node) => node.id)),
        masteredNodeIds: [] as string[],
        currentNodeId: getNextNodeId(map, []),
        pendingBranchFromId: undefined,
        focusRootId: undefined,
        awaitingBranchChoice: false,
        pendingChildIds: [],
        lastManualNodeId: undefined,
        lastSnapshot: undefined,
        updatedAt: new Date().toISOString(),
      };

      if (!prev || prev.conversationId !== activeConversationId) {
        return init;
      }

      const mapKey = JSON.stringify(map);
      const prevMapKey = JSON.stringify(prev.map);
      if (mapKey === prevMapKey) {
        return prev;
      }

      const nodeSet = new Set(map.nodes.map((node) => node.id));
      const selectedNodeIds = prev.selectedNodeIds.filter((id) => nodeSet.has(id));
      const coverCount = deriveCoverCountFromSelected(map, selectedNodeIds);
      const masteredNodeIds = deriveMasteredFromCoverCount(coverCount);
      const resolved = resolveCurrentNode(map, masteredNodeIds, prev.currentNodeId);

      return {
        conversationId: activeConversationId,
        map,
        selectedNodeIds,
        coverCount,
        masteredNodeIds,
        currentNodeId: resolved.currentNodeId,
        pendingBranchFromId: prev.pendingBranchFromId,
        focusRootId: prev.focusRootId,
        awaitingBranchChoice: resolved.awaitingBranchChoice,
        pendingChildIds: resolved.pendingChildIds,
        lastManualNodeId: prev.lastManualNodeId,
        lastSnapshot: prev.lastSnapshot,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [activeConversationId, map, setLearningMapState]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const serverState = readServerLearningState({
      raw: learningStateQuery.data?.learningState ?? null,
      conversationId: activeConversationId,
      map,
    });
    if (!serverState) {
      return;
    }

    setLearningMapState((prev) => {
      if (!prev || prev.conversationId !== activeConversationId) {
        return serverState;
      }
      const prevUpdatedAt = prev.updatedAt ?? '';
      const serverUpdatedAt = serverState.updatedAt ?? '';
      return serverUpdatedAt > prevUpdatedAt ? serverState : prev;
    });
  }, [activeConversationId, learningStateQuery.data?.learningState, map, setLearningMapState]);

  useEffect(() => {
    if (!learningMapState || learningMapState.conversationId !== activeConversationId) {
      return;
    }
    if (activeConversationId === 'new') {
      return;
    }

    const timer = window.setTimeout(() => {
      mutateLearningState({
        conversationId: activeConversationId,
        learningState: {
          conversationId: learningMapState.conversationId,
          selectedNodeIds: learningMapState.selectedNodeIds,
          currentNodeId: learningMapState.currentNodeId,
          updatedAt: learningMapState.updatedAt,
        },
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeConversationId,
    learningMapState?.conversationId,
    learningMapState?.selectedNodeIds,
    learningMapState?.currentNodeId,
    learningMapState?.updatedAt,
    mutateLearningState,
  ]);

  if (!map) {
    return (
      <div className="my-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        Invalid knowledge tree payload. Expected nodes with id + label (or title).
      </div>
    );
  }

  if (learningMapState != null && learningMapState.conversationId !== activeConversationId) {
    return null;
  }

  const onNodeClick = (nodeId: string) => {
    setLearningMapState((prev) => {
      if (!prev || prev.conversationId !== activeConversationId) {
        return prev;
      }

      if (prev.lastManualNodeId === nodeId && prev.lastSnapshot) {
        return {
          ...prev,
          selectedNodeIds: prev.lastSnapshot.selectedNodeIds,
          coverCount: prev.lastSnapshot.coverCount,
          masteredNodeIds: prev.lastSnapshot.masteredNodeIds,
          currentNodeId: prev.lastSnapshot.currentNodeId,
          pendingBranchFromId: prev.lastSnapshot.pendingBranchFromId,
          focusRootId: prev.lastSnapshot.focusRootId,
          awaitingBranchChoice: prev.lastSnapshot.awaitingBranchChoice,
          pendingChildIds: prev.lastSnapshot.pendingChildIds,
          lastManualNodeId: undefined,
          lastSnapshot: undefined,
          updatedAt: new Date().toISOString(),
        };
      }

      const snapshot = {
        selectedNodeIds: prev.selectedNodeIds,
        coverCount: prev.coverCount,
        masteredNodeIds: prev.masteredNodeIds,
        currentNodeId: prev.currentNodeId,
        pendingBranchFromId: prev.pendingBranchFromId,
        awaitingBranchChoice: prev.awaitingBranchChoice,
        pendingChildIds: prev.pendingChildIds,
      };

      const selectedSet = new Set(prev.selectedNodeIds);
      const masteredSet = new Set(prev.masteredNodeIds);
      const isExplicitlySelected = selectedSet.has(nodeId);
      const isImplicitlyMastered = masteredSet.has(nodeId) && !isExplicitlySelected;

      if (isExplicitlySelected) {
        selectedSet.delete(nodeId);
      } else if (isImplicitlyMastered) {
        const descendants = getDescendants(prev.map, nodeId);
        selectedSet.delete(nodeId);
        descendants.forEach((id) => selectedSet.delete(id));
      } else {
        selectedSet.add(nodeId);
      }

      const selectedNodeIds = [...selectedSet];
      const coverCount = deriveCoverCountFromSelected(prev.map, selectedNodeIds);
      const masteredNodeIds = deriveMasteredFromCoverCount(coverCount);
      const isDeselected = !selectedSet.has(nodeId);
      const preferredCurrentNodeId = isDeselected ? nodeId : prev.currentNodeId;
      const resolved = resolveCurrentNode(prev.map, masteredNodeIds, preferredCurrentNodeId);

        return {
          ...prev,
          selectedNodeIds,
          coverCount,
          masteredNodeIds,
          currentNodeId: resolved.currentNodeId,
          pendingBranchFromId: nodeId,
          focusRootId: prev.focusRootId,
          awaitingBranchChoice: resolved.awaitingBranchChoice,
          pendingChildIds: resolved.pendingChildIds,
          lastManualNodeId: nodeId,
          lastSnapshot: snapshot,
          updatedAt: new Date().toISOString(),
      };
    });
  };

  return (
    <div className="my-3 rounded-lg border border-border-light bg-surface-primary p-3">
      <div className="mb-2 text-sm font-semibold text-text-primary">{map.title ?? 'Knowledge Tree'}</div>
      <p className="mb-3 text-xs text-text-secondary">
        Click any node to mark prerequisites. Click the same node again to undo that action.
      </p>
      <LearningTreeGraph
        map={map}
        masteredNodeIds={learningMapState?.masteredNodeIds ?? []}
        currentNodeId={learningMapState?.currentNodeId}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
