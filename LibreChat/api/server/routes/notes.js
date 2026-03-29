const express = require('express');
const OpenAI = require('openai');
const { ContentTypes } = require('librechat-data-provider');
const { requireJwtAuth } = require('~/server/middleware');
const { configMiddleware } = require('~/server/middleware');
const { getProviderConfig } = require('@librechat/api');
const { createSafeUser, resolveHeaders } = require('@librechat/api');
const {
  upsertNote,
  getNoteByConversation,
  getNoteById,
  deleteNote,
  listNotesByUser,
  createNote,
  moveNote,
  upsertLearningState,
  getConvo,
  getMessages,
} = require('~/models');

const router = express.Router();
const notePayloadLimit = express.json({ limit: '2mb' });

function getMessageText(message) {
  if (!message) {
    return '';
  }

  if (typeof message.text === 'string' && message.text.trim() !== '') {
    return message.text.trim();
  }

  if (!Array.isArray(message.content)) {
    return '';
  }

  return message.content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }
      if (part.type === ContentTypes.TEXT && typeof part.text === 'string') {
        return part.text;
      }
      if (part.type === ContentTypes.THINK && typeof part.think === 'string') {
        return part.think;
      }
      return '';
    })
    .filter((text) => text.trim() !== '')
    .join('\n')
    .trim();
}

function serializeConversation(messages) {
  return messages
    .map((message) => {
      const role = message.isCreatedByUser ? 'User' : message.sender || 'Assistant';
      const text = getMessageText(message);
      return text ? `${role}:\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildOrganizePrompt(transcript) {
  return [
    'You are organizing a chat transcript into a clean study/work note.',
    'Rewrite the conversation into concise markdown with these sections when relevant:',
    '## Summary',
    '## Key Points',
    '## Decisions',
    '## Action Items',
    '## Open Questions',
    'Keep facts grounded in the transcript. Remove chatter and duplication. Do not mention that you are summarizing.',
    'Return markdown only.',
    '',
    'Transcript:',
    transcript,
  ].join('\n');
}

async function generateLLMOrganizedNote({ req, conversation, transcript }) {
  const appConfig = req.config;
  const providerConfig = getProviderConfig({ provider: conversation.endpoint, appConfig });
  const options = await providerConfig.getOptions({
    req,
    endpoint: conversation.endpoint,
    model_parameters: {
      model: conversation.model,
    },
    db: {
      getUserKey: require('~/models').getUserKey,
      getUserKeyValues: require('~/models').getUserKeyValues,
    },
  });

  const apiKey = options.modelOptions?.apiKey ?? options.apiKey ?? options.llmConfig?.apiKey;
  const baseURL =
    options.configOptions?.baseURL ??
    options.llmConfig?.configuration?.baseURL ??
    options.llmConfig?.baseURL ??
    options.reverseProxyUrl;

  if (!apiKey || !baseURL) {
    throw new Error('Current endpoint does not expose a usable OpenAI-compatible summary configuration.');
  }

  const headers =
    options.configOptions?.defaultHeaders != null
      ? resolveHeaders({
          headers: options.configOptions.defaultHeaders,
          user: createSafeUser(req.user),
          body: {
            conversationId: conversation.conversationId,
          },
        })
      : undefined;

  const openai = new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: headers,
  });

  const completion = await openai.chat.completions.create({
    model: conversation.model,
    messages: [
      {
        role: 'user',
        content: buildOrganizePrompt(transcript),
      },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}

function parseNoteBlocks(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildOrganizedBlocks(title, organizedContent) {
  return [
    {
      type: 'heading',
      props: { level: 2 },
      content: title,
    },
    {
      type: 'paragraph',
      content: organizedContent,
    },
  ];
}

router.use(requireJwtAuth);
router.use(configMiddleware);

router.get('/', async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (typeof conversationId === 'string' && conversationId.trim() !== '') {
      const note = await getNoteByConversation({
        userId: req.user.id,
        conversationId: conversationId.trim(),
      });

      return res.json({ note });
    }

    const notes = await listNotesByUser(req.user.id);
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/learning-state', async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (typeof conversationId !== 'string' || conversationId.trim() === '') {
      return res.status(400).json({ error: 'conversationId is required.' });
    }

    const note = await getNoteByConversation({
      userId: req.user.id,
      conversationId: conversationId.trim(),
    });

    return res.json({ learningState: note?.learningState ?? null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/learning-state', notePayloadLimit, async (req, res) => {
  try {
    const { conversationId, learningState } = req.body || {};

    if (typeof conversationId !== 'string' || conversationId.trim() === '') {
      return res.status(400).json({ error: 'conversationId is required.' });
    }

    const note = await upsertLearningState({
      userId: req.user.id,
      conversationId: conversationId.trim(),
      learningState:
        learningState != null && typeof learningState === 'object'
          ? learningState
          : learningState ?? null,
    });

    return res.json({ learningState: note.learningState ?? null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/organize', notePayloadLimit, async (req, res) => {
  try {
    const { conversationId, noteId = null } = req.body || {};

    if (typeof conversationId !== 'string' || conversationId.trim() === '') {
      return res.status(400).json({ error: 'conversationId is required.' });
    }

    const trimmedConversationId = conversationId.trim();
    const conversation = await getConvo(req.user.id, trimmedConversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    let targetNote = null;
    let targetFolder = null;
    if (typeof noteId === 'string' && noteId.trim() !== '') {
      targetNote = await getNoteById({ userId: req.user.id, noteId: noteId.trim() });
      if (!targetNote) {
        return res.status(404).json({ error: 'Selected note not found.' });
      }

      if (targetNote.type === 'folder') {
        targetFolder = targetNote;
        targetNote = null;
      }
    }

    const messages = await getMessages({ conversationId: trimmedConversationId });
    const transcript = serializeConversation(messages ?? []);
    if (!transcript) {
      return res.status(400).json({ error: 'Conversation has no text content to organize.' });
    }

    const organizedContent = await generateLLMOrganizedNote({
      req,
      conversation,
      transcript,
    });

    if (!organizedContent) {
      return res.status(500).json({ error: 'Failed to generate organized note content.' });
    }

    const sectionTitle = conversation.title?.trim() || 'Organized Note';

    const note = targetNote
      ? await upsertNote({
          userId: req.user.id,
          noteId: targetNote._id,
          parentId: targetNote.parentId ?? null,
          conversationId: targetNote.conversationId,
          type: targetNote.type,
          title: targetNote.title,
          content: JSON.stringify([
            ...parseNoteBlocks(targetNote.content),
            ...buildOrganizedBlocks(sectionTitle, organizedContent),
          ]),
          sortOrder: targetNote.sortOrder,
        })
      : await createNote({
          userId: req.user.id,
          parentId: targetFolder?._id ?? null,
          type: 'note',
          title: sectionTitle,
          content: JSON.stringify(buildOrganizedBlocks(sectionTitle, organizedContent)),
          conversationId: trimmedConversationId,
          sortOrder: 0,
        });

    return res.json({ organized: true, note });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', notePayloadLimit, async (req, res) => {
  try {
    const { parentId = null, title, type = 'note', content = '', conversationId, sortOrder = 0 } = req.body || {};

    if (type !== 'note' && type !== 'folder') {
      return res.status(400).json({ error: 'type must be note or folder.' });
    }

    const note = await createNote({
      userId: req.user.id,
      parentId,
      title: typeof title === 'string' ? title : undefined,
      type,
      content: typeof content === 'string' ? content : '',
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    });

    res.status(201).json({ note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:noteId', async (req, res) => {
  try {
    const note = await getNoteById({
      userId: req.user.id,
      noteId: req.params.noteId,
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:noteId', notePayloadLimit, async (req, res) => {
  try {
    const { parentId = null, conversationId, title, content = '', type, sortOrder } = req.body || {};

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string.' });
    }

    const note = await upsertNote({
      userId: req.user.id,
      noteId: req.params.noteId,
      parentId,
      conversationId: typeof conversationId === 'string' ? conversationId.trim() : undefined,
      type: type === 'folder' ? 'folder' : 'note',
      title: typeof title === 'string' ? title : undefined,
      content,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
    });

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:noteId/move', notePayloadLimit, async (req, res) => {
  try {
    const { parentId = null, sortOrder } = req.body || {};
    const note = await moveNote({
      userId: req.user.id,
      noteId: req.params.noteId,
      parentId,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:noteId', async (req, res) => {
  try {
    const result = await deleteNote({
      userId: req.user.id,
      noteId: req.params.noteId,
    });

    if (!result.ok) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
