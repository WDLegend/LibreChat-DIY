import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import './NotesPanel.css';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FilePlus2,
  FolderPlus,
  Maximize2,
  Minimize2,
  NotebookPen,
  Trash2,
} from 'lucide-react';
import { BlockNoteSchema, PartialBlock, createCodeBlockSpec } from '@blocknote/core';
import { codeBlockOptions } from '@blocknote/code-block';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useParams } from 'react-router-dom';
import { dataService } from 'librechat-data-provider';
import {
  TNote,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNoteByConversationQuery,
  useNotesTreeQuery,
  useUpdateNoteMutation,
} from '~/data-provider/Notes';
import LearningTreeGraph from '~/components/Messages/Content/LearningTreeGraph';
import cn from '~/utils/cn';
import type { LearningMapState } from '~/types/learning';
import store from '~/store';

function safeParseBlocks(content?: string): PartialBlock[] {
  if (!content) {
    return [{ type: 'paragraph', content: '' }];
  }

  try {
    const parsed = JSON.parse(content) as PartialBlock[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ type: 'paragraph', content: '' }];
  } catch {
    return [{ type: 'paragraph', content: '' }];
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image dimensions'));
    };

    img.src = objectUrl;
  });
}

function collectChildMap(notes: TNote[]) {
  return notes.reduce<Record<string, TNote[]>>((acc, note) => {
    const key = note.parentId ?? 'root';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(note);
    return acc;
  }, {});
}

function sortNotes(notes: TNote[]) {
  return [...notes].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}

type TTreeNodeProps = {
  note: TNote;
  childrenMap: Record<string, TNote[]>;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (note: TNote) => void;
  onToggle: (id: string) => void;
  onRename: (note: TNote) => void;
  onDelete: (note: TNote) => void;
  onCreateNote: (parentId: string) => void;
};

function TreeNode({
  note,
  childrenMap,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onRename,
  onDelete,
  onCreateNote,
}: TTreeNodeProps) {
  const children = sortNotes(childrenMap[note._id] ?? []);
  const isFolder = note.type === 'folder';
  const expanded = expandedIds.has(note._id);

  return (
    <div>
      <div
        className={cn(
          'flex w-full min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover',
          selectedId === note._id && 'bg-surface-active',
        )}
      >
        <button
          type="button"
          onClick={() => (isFolder ? onToggle(note._id) : onSelect(note))}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {isFolder ? (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onToggle(note._id);
              }}
              className="flex h-4 w-4 items-center justify-center"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          ) : (
            <span className="h-4 w-4" />
          )}
          <span className="truncate">{note.title}</span>
        </button>
        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {isFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(note._id);
              }}
              className="rounded p-0.5 hover:bg-surface-hover"
              title="Create note in folder"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRename(note);
            }}
            className="rounded p-0.5 hover:bg-surface-hover"
            title="Rename"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note);
            }}
            className="rounded p-0.5 hover:bg-surface-hover"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isFolder && expanded && children.length > 0 && (
        <div className="ml-4 border-l border-border-light pl-2">
          {children.map((child) => (
            <TreeNode
              key={child._id}
              note={child}
              childrenMap={childrenMap}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onCreateNote={onCreateNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg bg-surface-primary p-4 shadow-lg">
        <h3 className="mb-2 text-sm font-medium">{title}</h3>
        <p className="mb-4 text-xs text-text-secondary">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameDialog({
  note,
  onSave,
  onCancel,
}: {
  note: TNote;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note.title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-72 rounded-lg bg-surface-primary p-4 shadow-lg">
        <h3 className="mb-3 text-sm font-medium">Rename {note.type}</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && title.trim() && onSave(title.trim())}
          className="mb-3 w-full rounded border border-border-light px-2 py-1.5 text-sm"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => title.trim() && onSave(title.trim())}
            disabled={!title.trim()}
            className="rounded bg-surface-active px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function LearningMapPreview({
  state,
  expanded,
  onToggle,
}: {
  state: LearningMapState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = state.map.nodes.length;
  const masteredCount = state.masteredNodeIds.length;

  return (
    <>
      <div className="mb-2 rounded-lg border border-border-light bg-surface-primary p-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="truncate text-xs font-medium">{state.map.title ?? 'Learning Progress'}</div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 hover:bg-surface-hover"
            title={expanded ? 'Minimize' : 'Maximize'}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mb-2 h-2 rounded bg-surface-secondary">
          <div
            className="h-full rounded bg-emerald-500 transition-all"
            style={{ width: `${total > 0 ? (masteredCount / total) * 100 : 0}%` }}
          />
        </div>
        <LearningTreeGraph
          map={state.map}
          masteredNodeIds={state.masteredNodeIds}
          currentNodeId={state.currentNodeId}
          compact
          className="max-h-40"
        />
      </div>
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border-light bg-surface-primary p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">{state.map.title ?? 'Learning Progress'}</div>
              <button
                type="button"
                onClick={onToggle}
                className="rounded p-1 hover:bg-surface-hover"
                title="Close"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
            <LearningTreeGraph
              map={state.map}
              masteredNodeIds={state.masteredNodeIds}
              currentNodeId={state.currentNodeId}
              className="max-h-[70vh]"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function NotesPanel() {
  const learningMapState = useRecoilValue(store.learningMapState);
  const { conversationId } = useParams();
  const activeConversationId = conversationId ?? 'new';
  const notesTreeQuery = useNotesTreeQuery();
  const noteByConversationQuery = useNoteByConversationQuery(conversationId);
  const createNoteMutation = useCreateNoteMutation();
  const updateNoteMutation = useUpdateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const [selectedId, setSelectedId] = useRecoilState(store.selectedNoteId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [renameNote, setRenameNote] = useState<TNote | null>(null);
  const [deleteNote, setDeleteNote] = useState<TNote | null>(null);
  const [treeExpanded, setTreeExpanded] = useState(true);
  const [learningPreviewExpanded, setLearningPreviewExpanded] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const notes = notesTreeQuery.data?.notes ?? [];

  const selectedNote = useMemo(
    () => notes.find((note) => note._id === selectedId && note.type === 'note') ?? null,
    [notes, selectedId],
  );

  const selectedFolder = useMemo(
    () => notes.find((note) => note._id === selectedId && note.type === 'folder') ?? null,
    [notes, selectedId],
  );

  const childMap = useMemo(() => collectChildMap(notes), [notes]);
  const rootNotes = useMemo(() => sortNotes(childMap.root ?? []), [childMap]);

  const codeBlock = useMemo(() => createCodeBlockSpec(codeBlockOptions), []);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const { width, height } = await getImageDimensions(file);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_id', crypto.randomUUID());
    formData.append('width', String(width));
    formData.append('height', String(height));
    const response = await dataService.uploadImage(formData);
    return response.filepath;
  }, []);

  const getInitialContent = () => safeParseBlocks(selectedNote?.content);

  const editor = useCreateBlockNote({
    initialContent: getInitialContent(),
    uploadFile,
    schema: BlockNoteSchema.create().extend({
      blockSpecs: {
        codeBlock,
      },
    }),
  });



  useEffect(() => {
    const initialNote = noteByConversationQuery.data?.notes?.[0];
    if (!selectedId && initialNote?._id) {
      setSelectedId(initialNote._id);
    }
  }, [selectedId, noteByConversationQuery.data?.notes]);

  useEffect(() => {
    if (!editor || !selectedNote) {
      return;
    }

    const newContent = selectedNote.content || '';
    if (newContent === lastSavedContentRef.current) {
      return;
    }

    const blocks = safeParseBlocks(selectedNote.content);
    editor.replaceBlocks(editor.document, blocks);
    lastSavedContentRef.current = newContent;
  }, [editor, selectedNote?._id]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current != null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const onToggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const createNode = async (type: 'note' | 'folder', parentId?: string) => {
    const note = await createNoteMutation.mutateAsync({
      type,
      parentId: parentId ?? null,
      title: type === 'folder' ? 'New Folder' : 'Untitled Note',
      content: type === 'folder' ? '' : JSON.stringify([{ type: 'paragraph', content: '' }]),
    });

    if (note.note) {
      setSelectedId(note.note._id);
      if (note.note.type === 'folder') {
        setExpandedIds((prev) => new Set([...prev, note.note!._id]));
      }
    }
  };

  const handleRename = async (title: string) => {
    if (!renameNote) return;

    await updateNoteMutation.mutateAsync({
      noteId: renameNote._id,
      title,
      type: renameNote.type,
      parentId: renameNote.parentId ?? null,
      content: renameNote.content,
    });
    setRenameNote(null);
  };

  const handleDelete = async () => {
    if (!deleteNote) return;

    await deleteNoteMutation.mutateAsync(deleteNote._id);
    if (selectedId === deleteNote._id) {
      setSelectedId(null);
    }
    setDeleteNote(null);
  };

  const onChange = async () => {
    if (!selectedNote) {
      return;
    }

    const content = JSON.stringify(editor.document);
    if (content === lastSavedContentRef.current) {
      return;
    }

    if (saveTimeoutRef.current != null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    setSaveState('saving');
    saveTimeoutRef.current = window.setTimeout(async () => {
      await updateNoteMutation.mutateAsync({
        noteId: selectedNote._id,
        title: selectedNote.title,
        type: selectedNote.type,
        parentId: selectedNote.parentId ?? null,
        conversationId: selectedNote.conversationId,
        sortOrder: selectedNote.sortOrder,
        content,
      });
      lastSavedContentRef.current = content;
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1200);
    }, 3000);
  };

  const handleSelect = (note: TNote) => {
    setSelectedId(note._id);
  };

  const handleCreateNoteInFolder = (parentId: string) => {
    createNode('note', parentId);
  };

  const currentTitle = selectedNote?.title ?? selectedFolder?.title ?? 'Select a note';

  return (
    <div className="flex h-full min-w-0 overflow-hidden border-l border-border-light bg-surface-primary">
      <div
        className={cn(
          'flex flex-col border-r border-border-light bg-surface-secondary transition-all duration-200',
          treeExpanded ? 'w-[260px] md:w-[260px] sm:w-[180px]' : 'w-0 overflow-hidden',
        )}
      >
        <div className={cn('flex items-center justify-between border-b border-border-light px-3 py-3', !treeExpanded && 'hidden')}>
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <NotebookPen className="h-4 w-4" />
            <span>Notes</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => createNode('folder')}
              className="rounded p-1 hover:bg-surface-hover"
              title="New Folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => createNode('note')}
              className="rounded p-1 hover:bg-surface-hover"
              title="New Note"
            >
              <FilePlus2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {treeExpanded && (
          <div className="flex-1 overflow-auto px-2 py-2">
            {rootNotes.length === 0 ? (
              <div className="p-2 text-xs text-text-secondary">No notes yet. Click + to create one.</div>
            ) : (
              rootNotes.map((note) => (
                <TreeNode
                  key={note._id}
                  note={note}
                  childrenMap={childMap}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={handleSelect}
                  onToggle={onToggle}
                  onRename={setRenameNote}
                  onDelete={setDeleteNote}
                  onCreateNote={handleCreateNoteInFolder}
                />
              ))
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-4 py-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 truncate">
            <button
              type="button"
              onClick={() => setTreeExpanded(!treeExpanded)}
              className="rounded p-0.5 hover:bg-surface-hover"
              title={treeExpanded ? 'Collapse tree' : 'Expand tree'}
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform', treeExpanded && 'rotate-180')} />
            </button>
            <span className="truncate font-medium">{currentTitle}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {(selectedNote || selectedFolder) && (
              <>
                <span>
                  {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Ready'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const noteToDelete = selectedNote || selectedFolder;
                    if (noteToDelete) setDeleteNote(noteToDelete);
                  }}
                  className="rounded p-1 hover:bg-surface-hover"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-surface-primary-alt p-2 md:p-3">
          {learningMapState && learningMapState.conversationId === activeConversationId && (
            <LearningMapPreview
              state={learningMapState}
              expanded={learningPreviewExpanded}
              onToggle={() => setLearningPreviewExpanded((prev) => !prev)}
            />
          )}
          {selectedNote ? (
            <div className="notes-editor mx-auto h-full min-h-[300px] sm:min-h-[400px] rounded-lg border border-border-light bg-surface-primary shadow-sm">
              <BlockNoteView editor={editor} onChange={onChange} theme="light" />
            </div>
          ) : selectedFolder ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border-light bg-surface-primary text-sm text-text-secondary">
              <p className="mb-2">Folder: {selectedFolder.title}</p>
              <button
                type="button"
                onClick={() => createNode('note', selectedFolder._id)}
                className="flex items-center gap-2 rounded bg-surface-active px-3 py-1.5 hover:bg-surface-hover"
              >
                <FilePlus2 className="h-4 w-4" />
                Create note in folder
              </button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border-light bg-surface-primary text-sm text-text-secondary">
              Create or select a note to start writing.
            </div>
          )}
        </div>
      </div>
      {renameNote && (
        <RenameDialog note={renameNote} onSave={handleRename} onCancel={() => setRenameNote(null)} />
      )}
      {deleteNote && (
        <ConfirmDialog
          title={`Delete ${deleteNote.type}`}
          message={`Are you sure you want to delete "${deleteNote.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteNote(null)}
        />
      )}
    </div>
  );
}
