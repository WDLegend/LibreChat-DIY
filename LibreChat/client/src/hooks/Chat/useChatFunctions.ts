import { v4 } from 'uuid';
import { cloneDeep } from 'lodash';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSetRecoilState, useResetRecoilState, useRecoilValue } from 'recoil';
import {
  Constants,
  QueryKeys,
  ContentTypes,
  EModelEndpoint,
  getEndpointField,
  isAgentsEndpoint,
  parseCompactConvo,
  replaceSpecialVars,
  isAssistantsEndpoint,
  getDefaultParamsEndpoint,
} from 'librechat-data-provider';
import type {
  TMessage,
  TSubmission,
  TConversation,
  TStartupConfig,
  TEndpointOption,
  TEndpointsConfig,
  EndpointSchemaKey,
} from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import type { TAskFunction, ExtendedFile } from '~/common';
import useSetFilesToDelete from '~/hooks/Files/useSetFilesToDelete';
import useGetSender from '~/hooks/Conversations/useGetSender';
import { mergeRootPrompt } from '~/utils/rootPrompt';
import {
  advanceCurrentNode,
  deriveCoverCountFromSelected,
  deriveMasteredFromCoverCount,
  LEARNING_BRANCH_TOKEN_PREFIX,
  LEARNING_CONTINUE_TOKEN,
  LEARNING_CONTINUE_TOKEN_PREFIX,
} from '~/utils/learning';
import { logger, createDualMessageContent } from '~/utils';
import store, { useGetEphemeralAgent } from '~/store';
import useUserKey from '~/hooks/Input/useUserKey';
import { useAuthContext } from '~/hooks';

const LEARNING_MODE_BASE_PROMPT =
  'Learning mode is enabled. For a new learning request, first produce exactly one fenced ```learning-tree block for a prerequisite knowledge tree. Use this schema: {"title": string, "nodes": [{"id": string, "label": string, "parentId"?: string}], "edges"?: [{"from": string, "to": string}]}. Prefer label (not title) in nodes. The tree must represent prerequisite order from basics to advanced. After the tree exists, you must teach ONLY the current node selected by the UI state. Do not jump to sibling branches unless explicitly selected. When the user clicks continue, advance to the next node chosen by the state machine and teach that new node only. Each step must include only: goal, explanation, and one short example.';

const logChatRequest = (request: Record<string, unknown>) => {
  logger.log('=====================================\nAsk function called with:');
  logger.dir(request);
  logger.log('=====================================');
};

export default function useChatFunctions({
  index = 0,
  files,
  setFiles,
  getMessages,
  setMessages,
  isSubmitting,
  latestMessage,
  setSubmission,
  setLatestMessage,
  conversation: immutableConversation,
}: {
  index?: number;
  isSubmitting: boolean;
  paramId?: string | undefined;
  conversation: TConversation | null;
  latestMessage: TMessage | null;
  getMessages: () => TMessage[] | undefined;
  setMessages: (messages: TMessage[]) => void;
  files?: Map<string, ExtendedFile>;
  setFiles?: SetterOrUpdater<Map<string, ExtendedFile>>;
  setSubmission: SetterOrUpdater<TSubmission | null>;
  setLatestMessage?: SetterOrUpdater<TMessage | null>;
}) {
  const navigate = useNavigate();
  const getSender = useGetSender();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const setFilesToDelete = useSetFilesToDelete();
  const getEphemeralAgent = useGetEphemeralAgent();
  const isTemporary = useRecoilValue(store.isTemporary);
  const { getExpiry } = useUserKey(immutableConversation?.endpoint ?? '');
  const setIsSubmitting = useSetRecoilState(store.isSubmittingFamily(index));
  const setLearningMapState = useSetRecoilState(store.learningMapState);
  const setShowStopButton = useSetRecoilState(store.showStopButtonByIndex(index));
  const resetLatestMultiMessage = useResetRecoilState(store.latestMessageFamily(index + 1));
  const learningMode = useRecoilValue(store.learningMode);
  const learningMapState = useRecoilValue(store.learningMapState);

  const ask: TAskFunction = (
    {
      text,
      overrideConvoId,
      overrideUserMessageId,
      parentMessageId = null,
      conversationId = null,
      messageId = null,
    },
    {
      editedContent = null,
      editedMessageId = null,
      isRegenerate = false,
      isContinued = false,
      isEdited = false,
      overrideMessages,
      overrideFiles,
      addedConvo,
    } = {},
  ) => {
    setShowStopButton(false);
    resetLatestMultiMessage();

    text = text.trim();

    const continueNodeId = text.startsWith(LEARNING_CONTINUE_TOKEN_PREFIX)
      ? text.slice(LEARNING_CONTINUE_TOKEN_PREFIX.length)
      : null;
    const continueByButton = text === LEARNING_CONTINUE_TOKEN || !!continueNodeId;
    const branchTokenMatch = text.startsWith(LEARNING_BRANCH_TOKEN_PREFIX)
      ? text.slice(LEARNING_BRANCH_TOKEN_PREFIX.length)
      : null;

    if (continueByButton) {
      text = '我理解了，请继续讲解下一个节点。';
    } else if (branchTokenMatch) {
      text = `我想先学习节点 ${branchTokenMatch} 的分支，请继续讲解。`;
    }

    if (!!isSubmitting || text === '') {
      return;
    }

    const conversation = cloneDeep(immutableConversation);

    const endpoint = conversation?.endpoint;
    if (endpoint === null) {
      console.error('No endpoint available');
      return;
    }

    conversationId = conversationId ?? conversation?.conversationId ?? null;
    if (conversationId == 'search') {
      console.error('cannot send any message under search view!');
      return;
    }

    if (isContinued && !latestMessage) {
      console.error('cannot continue AI message without latestMessage!');
      return;
    }

    const activeConversationId = (conversationId ?? Constants.NEW_CONVO) as string;

    let nextNodeFromContinue: string | undefined;
    let effectiveLearningState = learningMapState;

    if (
      learningMode &&
      learningMapState?.map != null &&
      learningMapState.conversationId === activeConversationId &&
      continueByButton
    ) {
      const prev = learningMapState;
      if (!prev?.currentNodeId) {
        return;
      }

      if (continueNodeId && continueNodeId !== prev.currentNodeId) {
        return;
      }

      const selectedSet = new Set(prev.selectedNodeIds);
      selectedSet.add(prev.currentNodeId);
      const selectedNodeIds = [...selectedSet];
      const coverCount = deriveCoverCountFromSelected(prev.map, selectedNodeIds);
      const masteredNodeIds = deriveMasteredFromCoverCount(coverCount);
      const advanced = advanceCurrentNode(prev.map, masteredNodeIds, prev.currentNodeId);

      const nextState = {
        ...prev,
        selectedNodeIds,
        coverCount,
        masteredNodeIds,
        currentNodeId: advanced.nextNodeId,
        pendingBranchFromId: advanced.awaitingBranchChoice ? prev.currentNodeId : undefined,
        focusRootId: prev.currentNodeId,
        awaitingBranchChoice: advanced.awaitingBranchChoice,
        pendingChildIds: advanced.pendingChildIds,
        lastManualNodeId: undefined,
        lastSnapshot: undefined,
        updatedAt: new Date().toISOString(),
      };

      setLearningMapState(nextState);
      effectiveLearningState = nextState;
      nextNodeFromContinue = nextState.currentNodeId;

      if (!nextNodeFromContinue) {
        if (nextState.awaitingBranchChoice) {
          return;
        }

        text = '我理解了。';
        return;
      }

      if (nextNodeFromContinue) {
        text = `我理解了，请继续讲解节点（id: ${nextNodeFromContinue}）。`;
      }
    }

    if (
      learningMode &&
      effectiveLearningState?.map != null &&
      effectiveLearningState.conversationId === activeConversationId &&
      branchTokenMatch
    ) {
      const prev = effectiveLearningState;
      const nodeExists = prev.map.nodes.some((node) => node.id === branchTokenMatch);
      if (!nodeExists) {
        return;
      }

      const nextState = {
        ...prev,
        pendingBranchFromId: branchTokenMatch,
        currentNodeId: branchTokenMatch,
        focusRootId: prev.pendingBranchFromId ?? prev.focusRootId ?? prev.currentNodeId,
        awaitingBranchChoice: false,
        pendingChildIds: [],
        lastManualNodeId: undefined,
        lastSnapshot: undefined,
        updatedAt: new Date().toISOString(),
      };
      setLearningMapState(nextState);
      effectiveLearningState = nextState;
      text = `我想先学习节点（id: ${branchTokenMatch}），请讲解这个节点。`;
    }

    const ephemeralAgent = getEphemeralAgent(conversationId ?? Constants.NEW_CONVO);
    const isEditOrContinue = isEdited || isContinued;

    let currentMessages: TMessage[] | null = overrideMessages ?? getMessages() ?? [];

    const mergedPromptPrefix = mergeRootPrompt(conversation?.promptPrefix);
    let finalPromptPrefix = mergedPromptPrefix;

    if (learningMode) {
      let learningContextPrompt = LEARNING_MODE_BASE_PROMPT;
      if (effectiveLearningState?.map != null && effectiveLearningState.conversationId === activeConversationId) {
        const nodesById = new Map(effectiveLearningState.map.nodes.map((node) => [node.id, node.label]));
        const masteredLabels = effectiveLearningState.masteredNodeIds
          .map((id) => nodesById.get(id))
          .filter((label): label is string => typeof label === 'string');
        const currentLabel = effectiveLearningState.currentNodeId
          ? nodesById.get(effectiveLearningState.currentNodeId)
          : undefined;

        learningContextPrompt += ` Current map title: "${effectiveLearningState.map.title ?? 'Learning Map'}".`;
        learningContextPrompt += masteredLabels.length
          ? ` Mastered: ${masteredLabels.join(', ')}.`
          : ' Mastered: none.';
        learningContextPrompt += currentLabel
          ? ` Current node to teach next: ${currentLabel} (id: ${effectiveLearningState.currentNodeId}). Teach only this node.`
          : ' Current node to teach next: first unmastered node in topological order.';

        if (effectiveLearningState.awaitingBranchChoice && (effectiveLearningState.pendingChildIds?.length ?? 0) > 1) {
          learningContextPrompt += ` Branch choice required. Candidate child node ids: ${effectiveLearningState.pendingChildIds?.join(', ')}.`;
        }

        if (nextNodeFromContinue) {
          learningContextPrompt += ` Continue was clicked. New current node is id ${nextNodeFromContinue}. Teach this node only.`;
        } else if (continueNodeId) {
          learningContextPrompt += ` User clicked continue on node id ${continueNodeId}. If state transition is unavailable, teach only this node id.`;
        }
      }

      finalPromptPrefix = `${mergedPromptPrefix}\n\n${learningContextPrompt}`;
    }

    if (finalPromptPrefix && conversation) {
      conversation.promptPrefix = replaceSpecialVars({
        text: finalPromptPrefix,
        user,
      });
    }

    // construct the query message
    // this is not a real messageId, it is used as placeholder before real messageId returned
    const intermediateId = overrideUserMessageId ?? v4();
    parentMessageId = parentMessageId ?? latestMessage?.messageId ?? Constants.NO_PARENT;

    logChatRequest({
      index,
      conversation,
      latestMessage,
      conversationId,
      intermediateId,
      parentMessageId,
      currentMessages,
    });

    if (conversationId == Constants.NEW_CONVO) {
      parentMessageId = Constants.NO_PARENT;
      currentMessages = [];
      conversationId = null;
      navigate('/c/new', { state: { focusChat: true } });
    }

    const targetParentMessageId = isRegenerate ? messageId : latestMessage?.parentMessageId;
    /**
     * If the user regenerated or resubmitted the message, the current parent is technically
     * the latest user message, which is passed into `ask`; otherwise, we can rely on the
     * latestMessage to find the parent.
     */
    const targetParentMessage = currentMessages.find(
      (msg) => msg.messageId === targetParentMessageId,
    );

    let thread_id = targetParentMessage?.thread_id ?? latestMessage?.thread_id;
    if (thread_id == null) {
      thread_id = currentMessages.find((message) => message.thread_id)?.thread_id;
    }

    const endpointsConfig = queryClient.getQueryData<TEndpointsConfig>([QueryKeys.endpoints]);
    const startupConfig = queryClient.getQueryData<TStartupConfig>([QueryKeys.startupConfig]);
    const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');
    const iconURL = conversation?.iconURL;
    const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

    /** This becomes part of the `endpointOption` */
    const convo = parseCompactConvo({
      endpoint: endpoint as EndpointSchemaKey,
      endpointType: endpointType as EndpointSchemaKey,
      conversation: conversation ?? {},
      defaultParamsEndpoint,
    });

    const { modelDisplayLabel } = endpointsConfig?.[endpoint ?? ''] ?? {};
    const endpointOption = Object.assign(
      {
        endpoint,
        endpointType,
        overrideConvoId,
        overrideUserMessageId,
      },
      convo,
    ) as TEndpointOption;
    if (endpoint !== EModelEndpoint.agents) {
      endpointOption.key = getExpiry();
      endpointOption.thread_id = thread_id;
      endpointOption.modelDisplayLabel = modelDisplayLabel;
    } else {
      endpointOption.key = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    const responseSender = getSender({ model: conversation?.model, ...endpointOption });

    const currentMsg: TMessage = {
      text,
      sender: 'User',
      clientTimestamp: new Date().toLocaleString('sv').replace(' ', 'T'),
      isCreatedByUser: true,
      parentMessageId,
      conversationId,
      messageId: isContinued && messageId != null && messageId ? messageId : intermediateId,
      thread_id,
      error: false,
    };

    const submissionFiles = overrideFiles ?? targetParentMessage?.files;
    const reuseFiles =
      (isRegenerate || (overrideFiles != null && overrideFiles.length)) &&
      submissionFiles &&
      submissionFiles.length > 0;

    if (setFiles && reuseFiles === true) {
      currentMsg.files = [...submissionFiles];
      setFiles(new Map());
      setFilesToDelete({});
    } else if (setFiles && files && files.size > 0) {
      currentMsg.files = Array.from(files.values()).map((file) => ({
        file_id: file.file_id,
        filepath: file.filepath,
        type: file.type ?? '', // Ensure type is not undefined
        height: file.height,
        width: file.width,
      }));
      setFiles(new Map());
      setFilesToDelete({});
    }

    const responseMessageId =
      editedMessageId ??
      (latestMessage?.messageId && isRegenerate
        ? latestMessage.messageId.replace(/_+$/, '') + '_'
        : null) ??
      null;
    const initialResponseId =
      responseMessageId ?? `${isRegenerate ? messageId : intermediateId}`.replace(/_+$/, '') + '_';

    const initialResponse: TMessage = {
      sender: responseSender,
      text: '',
      endpoint: endpoint ?? '',
      parentMessageId: isRegenerate ? messageId : intermediateId,
      messageId: initialResponseId,
      thread_id,
      conversationId,
      unfinished: false,
      isCreatedByUser: false,
      model: convo?.model,
      error: false,
      iconURL,
    };

    if (isAssistantsEndpoint(endpoint)) {
      initialResponse.model = conversation?.assistant_id ?? '';
      initialResponse.text = '';
      initialResponse.content = [
        {
          type: ContentTypes.TEXT,
          [ContentTypes.TEXT]: {
            value: '',
          },
        },
      ];
    } else if (endpoint != null) {
      initialResponse.model = isAgentsEndpoint(endpoint)
        ? (conversation?.agent_id ?? '')
        : (conversation?.model ?? '');
      initialResponse.text = '';

      if (editedContent && latestMessage?.content) {
        initialResponse.content = cloneDeep(latestMessage.content);
        const { index, type, ...part } = editedContent;
        if (initialResponse.content && index >= 0 && index < initialResponse.content.length) {
          const contentPart = initialResponse.content[index];
          if (type === ContentTypes.THINK && contentPart.type === ContentTypes.THINK) {
            contentPart[ContentTypes.THINK] = part[ContentTypes.THINK];
          } else if (type === ContentTypes.TEXT && contentPart.type === ContentTypes.TEXT) {
            contentPart[ContentTypes.TEXT] = part[ContentTypes.TEXT];
          }
        }
      } else if (addedConvo && conversation) {
        // Pre-populate placeholders for smooth UI - these will be overridden/extended
        // as SSE events arrive with actual content, preserving the agent-based agentId
        initialResponse.content = createDualMessageContent(
          conversation,
          addedConvo,
          endpointsConfig,
          startupConfig?.modelSpecs?.list,
        );
      } else {
        initialResponse.content = [];
      }
      setIsSubmitting(true);
      setShowStopButton(true);
    }

    if (isContinued) {
      currentMessages = currentMessages.filter((msg) => msg.messageId !== responseMessageId);
    }

    logger.log('message_state', initialResponse);
    const submission: TSubmission = {
      conversation: {
        ...conversation,
        conversationId,
      },
      endpointOption,
      userMessage: {
        ...currentMsg,
        responseMessageId,
        overrideParentMessageId: isRegenerate ? messageId : null,
      },
      messages: currentMessages,
      isEdited: isEditOrContinue,
      isContinued,
      isRegenerate,
      initialResponse,
      isTemporary,
      ephemeralAgent,
      editedContent,
      addedConvo,
    };

    if (isRegenerate) {
      setMessages([...submission.messages, initialResponse]);
    } else {
      setMessages([...submission.messages, currentMsg, initialResponse]);
    }
    if (index === 0 && setLatestMessage) {
      setLatestMessage(initialResponse);
    }

    setSubmission(submission);
    logger.dir('message_stream', submission, { depth: null });
  };

  const regenerate = ({ parentMessageId }, options?: { addedConvo?: TConversation | null }) => {
    const messages = getMessages();
    const parentMessage = messages?.find((element) => element.messageId == parentMessageId);

    if (parentMessage && parentMessage.isCreatedByUser) {
      ask(
        { ...parentMessage },
        { isRegenerate: true, addedConvo: options?.addedConvo ?? undefined },
      );
    } else {
      console.error(
        'Failed to regenerate the message: parentMessage not found or not created by user.',
      );
    }
  };

  return {
    ask,
    regenerate,
  };
}
