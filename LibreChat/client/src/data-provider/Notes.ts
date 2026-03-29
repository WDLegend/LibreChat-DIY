import { dataService, QueryKeys } from 'librechat-data-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type TNoteType = 'note' | 'folder';

type TNote = {
  _id: string;
  userId: string;
  parentId?: string | null;
  conversationId?: string;
  type: TNoteType;
  title: string;
  content: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

type TListNotesResponse = {
  notes: TNote[];
};

type TCreateNoteVariables = {
  parentId?: string | null;
  title?: string;
  type?: TNoteType;
  content?: string;
  conversationId?: string;
  sortOrder?: number;
};

type TUpdateNoteVariables = {
  noteId: string;
  parentId?: string | null;
  title?: string;
  type?: TNoteType;
  content: string;
  conversationId?: string;
  sortOrder?: number;
};

export function useNotesTreeQuery() {
  return useQuery<TListNotesResponse>(
    [QueryKeys.files, 'notes-tree'],
    () => dataService.listNotes(),
    {
      refetchOnWindowFocus: false,
    },
  );
}

export function useNoteByConversationQuery(conversationId: string | null | undefined) {
  return useQuery<TListNotesResponse>(
    [QueryKeys.files, 'note-conversation', conversationId],
    () => dataService.listNotes(conversationId ?? undefined),
    {
      enabled: !!conversationId && conversationId !== 'new',
      refetchOnWindowFocus: false,
    },
  );
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    (variables: TCreateNoteVariables) => dataService.createNote(variables),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.files, 'notes-tree'] });
      },
    },
  );
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    (variables: TUpdateNoteVariables) => dataService.updateNote(variables),
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.files, 'notes-tree'] });
        if (variables.conversationId) {
          queryClient.invalidateQueries({
            queryKey: [QueryKeys.files, 'note-conversation', variables.conversationId],
          });
        }
      },
    },
  );
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    (noteId: string) => dataService.deleteNote(noteId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.files, 'notes-tree'] });
      },
    },
  );
}

export function useLearningStateQuery(conversationId: string | null | undefined) {
  return useQuery<{ learningState: Record<string, unknown> | null }>(
    [QueryKeys.files, 'learning-state', conversationId],
    () => dataService.getLearningState(conversationId ?? ''),
    {
      enabled: !!conversationId && conversationId !== 'new',
      refetchOnWindowFocus: false,
    },
  );
}

export function useUpdateLearningStateMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ conversationId, learningState }: { conversationId: string; learningState: Record<string, unknown> | null }) =>
      dataService.updateLearningState(conversationId, learningState),
    {
      onSuccess: (_data, variables) => {
        queryClient.setQueryData(
          [QueryKeys.files, 'learning-state', variables.conversationId],
          _data,
        );
      },
    },
  );
}

export function useOrganizeNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ conversationId, noteId }: { conversationId: string; noteId?: string | null }) =>
      dataService.organizeNote({ conversationId, noteId }),
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: [QueryKeys.files, 'notes-tree'] });
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.files, 'note-conversation', variables.conversationId],
        });
      },
    },
  );
}

export type { TNote, TNoteType };
