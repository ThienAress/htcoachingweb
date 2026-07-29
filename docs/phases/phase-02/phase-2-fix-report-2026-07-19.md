# Phase 2 Fix Report - AI and Knowledge Base

Date: 2026-07-19

## Result

- Full server suite: **14 files, 78 tests passed**.
- Targeted Phase 2 suite: **6 files, 15 tests passed**.
- Node syntax checks passed for the AI controller, providers, embedding service,
  Knowledge Base controller/models, and migrations.
- `npm audit` after adding Ajv reported 0 vulnerabilities.
- The production migration was created but **was not run** against a real database.

## AI Chat Hardening

- Added strict request bounds for message length, conversation/request IDs, page
  context, user metrics, image MIME type, and decoded image size.
- Added UUID request idempotency and an atomic per-conversation stream claim.
- Persist the user turn before calling the model, so disconnects no longer lose
  the submitted message.
- Forward client cancellation to the provider and enforce a provider deadline.
- Persist partial assistant/tool output on disconnect and always release the
  stream claim.
- Cap stored chat history at 40 messages and recent request IDs at 50.
- Store `messageCount`, preview, and timestamp summaries so list APIs no longer
  fetch and scan full message arrays.
- Update feedback atomically instead of saving the entire conversation document.
- Persist moderation warnings and temporary locks in MongoDB so behavior is
  consistent after restart and across multiple server instances.
- Compile all tool JSON schemas once with Ajv and validate every model-generated
  argument object before tool execution.
- Escape model-supplied regular expressions in blog/exercise search tools.

## Knowledge Base Hardening

- Added a lifecycle for embeddings: `pending`, `ready`, and `failed`.
- Publishing is rejected unless the main embedding is a valid 768-dimensional
  vector in `ready` state.
- Embedding failures now keep the entry in `draft`; failures are no longer
  silently published with an empty vector.
- Added normalized-question uniqueness and optimistic concurrency.
- Added strict DTO validation and server ownership of vectors. Client-provided
  embeddings are rejected, including merge requests.
- Added limits for tags, variants, strings, pagination, debug search, and AI
  suggestion scans.
- Escaped admin text search and validate the AI suggestion JSON with Ajv.
- Added provider timeouts, exact vector validation, a bounded query cache, and a
  fallback scan capped at 500 entries.
- Added optional MongoDB Atlas vector search. Set `KB_VECTOR_INDEX` to the name
  of a configured Atlas vector index on `embedding`; without it, the bounded
  fallback remains active.
- Conversation review lists now use stored summaries rather than full messages.

## Migration

Command (after backup and staging verification):

```bash
npm run migrate:phase2
```

The migration:

- stops on normalized Knowledge Base question collisions;
- stops if an existing entry exceeds the new tag/variant bounds;
- backfills embedding state/version and moves invalid published entries to draft;
- backfills chat summaries, removes oversized stored images, and caps history;
- creates the Knowledge Base, request-idempotency, and moderation indexes.

Run Phase 1 before Phase 2 on an existing production database. Take a backup,
run both migrations in staging, review entries moved to draft, then run production.

## Files Changed In Phase 2

### Server runtime

- `server/package.json`
- `server/package-lock.json`
- `server/src/controllers/ai.controller.js`
- `server/src/controllers/knowledgeBase.controller.js`
- `server/src/models/AiModerationState.js`
- `server/src/models/ChatConversation.js`
- `server/src/models/KnowledgeEntry.js`
- `server/src/services/ai/contentModeration.js`
- `server/src/services/ai/embedding.service.js`
- `server/src/services/ai/providers/gemini.provider.js`
- `server/src/services/ai/providers/mock.provider.js`
- `server/src/services/ai/tools/searchBlog.tool.js`
- `server/src/services/ai/tools/searchExercises.tool.js`
- `server/src/services/ai/tools/toolEngine.js`
- `server/src/services/ai/tools/toolRegistry.js`
- `server/src/utils/aiChat.js`
- `server/src/utils/escapeRegex.js`
- `server/src/utils/knowledgeBase.js`
- `server/src/migrations/20260719-phase2-ai-kb-integrity.js`

### Tests

- `server/src/controllers/__tests__/phase2.ai-kb.integration.test.js`
- `server/src/services/ai/__tests__/contentModeration.integration.test.js`
- `server/src/services/ai/tools/__tests__/toolEngine.test.js`
- `server/src/utils/__tests__/aiChat.test.js`
- `server/src/utils/__tests__/knowledgeBase.test.js`

## Remaining Operational Work

- Do not enable `KB_VECTOR_INDEX` until the Atlas vector index exists and its
  filter fields (`status`, `embeddingStatus`, `category`) are configured.
- Regenerate entries marked `failed`, review their content, then publish them.
- Add production metrics for provider latency, abort rate, embedding failures,
  stream conflicts, fallback scan usage, and vector-search hit rate.
