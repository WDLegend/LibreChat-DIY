import type { Types, Document } from 'mongoose';

export interface INote extends Document {
  userId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  conversationId?: string;
  type: 'note' | 'folder';
  title: string;
  content: string;
  learningState?: Record<string, unknown> | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export interface INoteLean {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  conversationId?: string;
  type: 'note' | 'folder';
  title: string;
  content: string;
  learningState?: Record<string, unknown> | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export interface UpsertNoteParams {
  userId: string | Types.ObjectId;
  noteId?: string | Types.ObjectId;
  parentId?: string | Types.ObjectId | null;
  conversationId?: string;
  type?: 'note' | 'folder';
  title?: string;
  content: string;
  learningState?: Record<string, unknown> | null;
  sortOrder?: number;
}

export interface UpsertLearningStateParams {
  userId: string | Types.ObjectId;
  conversationId: string;
  learningState: Record<string, unknown> | null;
}

export interface GetNoteParams {
  userId: string | Types.ObjectId;
  conversationId?: string;
  noteId?: string | Types.ObjectId;
}

export interface DeleteNoteParams {
  userId: string | Types.ObjectId;
  noteId: string | Types.ObjectId;
}

export interface MoveNoteParams {
  userId: string | Types.ObjectId;
  noteId: string | Types.ObjectId;
  parentId?: string | Types.ObjectId | null;
  sortOrder?: number;
}
