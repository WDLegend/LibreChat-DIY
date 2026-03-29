import type * as t from '~/types';
import { Types } from 'mongoose';

const DEFAULT_NOTE_TITLE = 'Untitled Note';

export function createNoteMethods(mongoose: typeof import('mongoose')) {
  async function listNotesByUser(userId: string | Types.ObjectId) {
    const Note = mongoose.models.Note;
    return (await Note.find({ userId }).sort({ sortOrder: 1, updatedAt: -1 }).lean()) as t.INoteLean[];
  }

  async function getNoteByConversation({ userId, conversationId }: t.GetNoteParams) {
    if (!conversationId) {
      return null;
    }

    const Note = mongoose.models.Note;
    return (await Note.findOne({ userId, conversationId, type: 'note' }).lean()) as t.INoteLean | null;
  }

  async function getNoteById({ userId, noteId }: t.GetNoteParams) {
    if (!noteId) {
      return null;
    }

    const Note = mongoose.models.Note;
    return (await Note.findOne({ _id: noteId, userId }).lean()) as t.INoteLean | null;
  }

  async function upsertNote({
    userId,
    noteId,
    parentId,
    conversationId,
    type,
    title,
    content,
    learningState,
    sortOrder,
  }: t.UpsertNoteParams) {
    const Note = mongoose.models.Note;
    const safeTitle = title?.trim() || DEFAULT_NOTE_TITLE;

    if (conversationId) {
      return (await Note.findOneAndUpdate(
        { userId, conversationId, type: 'note' },
        {
          $set: {
            title: safeTitle,
            content,
            learningState: learningState ?? null,
            conversationId,
            parentId: parentId ?? null,
            sortOrder: sortOrder ?? 0,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean()) as t.INoteLean;
    }

    if (noteId != null) {
      return (await Note.findOneAndUpdate(
        { _id: noteId, userId },
        {
          $set: {
            title: safeTitle,
            content,
            learningState: learningState ?? null,
            parentId: parentId ?? null,
            type: type ?? 'note',
            sortOrder: sortOrder ?? 0,
          },
        },
        {
          new: true,
        },
      ).lean()) as t.INoteLean | null;
    }

    return (await Note.create({
      userId,
      parentId: parentId ?? null,
      conversationId,
      type: type ?? 'note',
      title: safeTitle,
      content,
      learningState: learningState ?? null,
      sortOrder: sortOrder ?? 0,
    }).then((doc: t.INote) => doc.toObject())) as t.INoteLean;
  }

  async function createNote(params: t.UpsertNoteParams) {
    const Note = mongoose.models.Note;
    return (await Note.create({
      userId: params.userId,
      parentId: params.parentId ?? null,
      conversationId: params.conversationId,
      type: params.type ?? 'note',
      title: params.title?.trim() || DEFAULT_NOTE_TITLE,
      content: params.content,
      learningState: params.learningState ?? null,
      sortOrder: params.sortOrder ?? 0,
    }).then((doc: t.INote) => doc.toObject())) as t.INoteLean;
  }

  async function upsertLearningState({
    userId,
    conversationId,
    learningState,
  }: t.UpsertLearningStateParams) {
    const Note = mongoose.models.Note;
    return (await Note.findOneAndUpdate(
      { userId, conversationId, type: 'note' },
      {
        $set: {
          learningState: learningState ?? null,
          conversationId,
          type: 'note',
        },
        $setOnInsert: {
          title: DEFAULT_NOTE_TITLE,
          content: '',
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean()) as t.INoteLean;
  }

  async function moveNote({ userId, noteId, parentId, sortOrder }: t.MoveNoteParams) {
    const Note = mongoose.models.Note;
    return (await Note.findOneAndUpdate(
      { _id: noteId, userId },
      {
        $set: {
          parentId: parentId ?? null,
          ...(typeof sortOrder === 'number' ? { sortOrder } : {}),
        },
      },
      { new: true },
    ).lean()) as t.INoteLean | null;
  }

  async function deleteNote({ userId, noteId }: t.DeleteNoteParams) {
    const Note = mongoose.models.Note;
    await Note.deleteMany({ userId, parentId: noteId });
    const result = await Note.findOneAndDelete({ _id: noteId, userId });
    return { ok: !!result };
  }

  return {
    listNotesByUser,
    getNoteByConversation,
    getNoteById,
    upsertNote,
    createNote,
    upsertLearningState,
    moveNote,
    deleteNote,
  };
}

export type NoteMethods = ReturnType<typeof createNoteMethods>;
