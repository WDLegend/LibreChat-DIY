export type LearningNode = {
  id: string;
  label: string;
  parentId?: string;
};

export type LearningEdge = {
  from: string;
  to: string;
};

export type LearningMapPayload = {
  title?: string;
  nodes: LearningNode[];
  edges?: LearningEdge[];
};

export type LearningMapState = {
  conversationId: string;
  map: LearningMapPayload;
  selectedNodeIds: string[];
  coverCount: Record<string, number>;
  masteredNodeIds: string[];
  currentNodeId?: string;
  pendingBranchFromId?: string;
  focusRootId?: string;
  awaitingBranchChoice?: boolean;
  pendingChildIds?: string[];
  lastManualNodeId?: string;
  lastSnapshot?: {
    selectedNodeIds: string[];
    coverCount: Record<string, number>;
    masteredNodeIds: string[];
    currentNodeId?: string;
    pendingBranchFromId?: string;
    focusRootId?: string;
    awaitingBranchChoice?: boolean;
    pendingChildIds?: string[];
  };
  updatedAt: string;
};
