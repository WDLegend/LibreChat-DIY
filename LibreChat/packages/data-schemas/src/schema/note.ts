import { Schema } from 'mongoose';
import type { INote } from '~/types/note';

const NoteSchema: Schema<INote> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Note',
      index: true,
      default: null,
    },
    conversationId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['note', 'folder'],
      default: 'note',
      required: true,
    },
    title: {
      type: String,
      default: 'Untitled Note',
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      default: '',
    },
    learningState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
      required: true,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

NoteSchema.index({ userId: 1, parentId: 1, sortOrder: 1 });

export default NoteSchema;
