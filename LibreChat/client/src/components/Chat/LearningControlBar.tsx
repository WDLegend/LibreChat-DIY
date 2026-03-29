import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useSubmitMessage } from '~/hooks';
import store from '~/store';
import {
  LEARNING_BRANCH_TOKEN_PREFIX,
  LEARNING_CONTINUE_TOKEN,
  LEARNING_CONTINUE_TOKEN_PREFIX,
  getBranchOptionNodeIds,
  getChildrenMap,
} from '~/utils/learning';

export default function LearningControlBar() {
  const { conversationId } = useParams();
  const activeConversationId = conversationId ?? 'new';
  const learningMode = useRecoilValue(store.learningMode);
  const [learningMapState, setLearningMapState] = useRecoilState(store.learningMapState);
  const { submitMessage } = useSubmitMessage();

  const nodesById = useMemo(() => {
    if (!learningMapState?.map) {
      return new Map<string, { id: string; label: string; parentId?: string }>();
    }
    return new Map(learningMapState.map.nodes.map((node) => [node.id, node]));
  }, [learningMapState?.map]);

  const childrenMap = useMemo(() => {
    if (!learningMapState?.map) {
      return new Map<string, string[]>();
    }
    return getChildrenMap(learningMapState.map);
  }, [learningMapState?.map]);

  if (
    !learningMode ||
    !learningMapState?.map ||
    learningMapState.conversationId !== activeConversationId
  ) {
    return null;
  }

  const currentNodeId = learningMapState.currentNodeId;
  const masteredSet = new Set(learningMapState.masteredNodeIds);
  const currentChildren = learningMapState.awaitingBranchChoice
    ? learningMapState.pendingChildIds?.length
      ? learningMapState.pendingChildIds
      : getBranchOptionNodeIds(learningMapState.map, learningMapState.masteredNodeIds)
    : [];

  const handleContinue = () => {
    if (!currentNodeId) {
      submitMessage({ text: LEARNING_CONTINUE_TOKEN });
      return;
    }

    submitMessage({ text: `${LEARNING_CONTINUE_TOKEN_PREFIX}${currentNodeId}` });
  };

  const handleChoosePath = (nodeId: string) => {
    submitMessage({ text: `${LEARNING_BRANCH_TOKEN_PREFIX}${nodeId}` });
  };

  const handleUndo = () => {
    setLearningMapState((prev) => {
      if (!prev?.lastSnapshot) {
        return prev;
      }

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
        lastSnapshot: undefined,
        lastManualNodeId: undefined,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  return (
    <div className="sticky bottom-0 z-20 mt-2 rounded-xl border border-border-light bg-surface-chat/95 px-3 py-2 backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-text-secondary">
        <span className="truncate">
          {currentNodeId
            ? `Learning: ${nodesById.get(currentNodeId)?.label ?? currentNodeId}`
            : 'Learning complete'}
        </span>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!learningMapState.lastSnapshot}
          className="flex items-center gap-1 rounded border border-border-light px-2 py-1 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Undo
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {learningMapState.awaitingBranchChoice && (
          <span className="self-center text-xs text-text-secondary">Choose next branch:</span>
        )}
        {currentChildren.map((childId) => {
          const childLabel = nodesById.get(childId)?.label ?? childId;
          return (
            <button
              key={childId}
              type="button"
              onClick={() => handleChoosePath(childId)}
              className="rounded-md border border-border-light bg-surface-primary px-2 py-1 text-xs hover:bg-surface-hover"
            >
              Learn {childLabel}
            </button>
          );
        })}

        {currentNodeId && (
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-md bg-surface-active px-3 py-1 text-xs font-medium hover:bg-surface-hover"
          >
            I got it, continue
          </button>
        )}
      </div>
    </div>
  );
}
