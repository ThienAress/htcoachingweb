import "../config/env.js";
import mongoose from "mongoose";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";

import AiModerationState from "../models/AiModerationState.js";
import ChatConversation from "../models/ChatConversation.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import { EMBEDDING_DIMENSION, EMBEDDING_VERSION } from "../services/ai/embedding.service.js";
import { MAX_STORED_CHAT_MESSAGES } from "../utils/aiChat.js";
import { normalizeKnowledgeQuestion } from "../utils/knowledgeBase.js";

const assertKnowledgePreconditions = async () => {
  const entries = await KnowledgeEntry.collection
    .find(
      {},
      { projection: { question: 1, variants: 1, tags: 1, embedding: 1, status: 1 } },
    )
    .toArray();
  const owners = new Map();

  for (const entry of entries) {
    const normalized = normalizeKnowledgeQuestion(entry.question);
    if (!normalized) {
      throw new Error(`Knowledge entry ${entry._id} has an empty question`);
    }
    const owner = owners.get(normalized);
    if (owner) {
      throw new Error(
        `Knowledge question collision: ${owner} and ${entry._id} -> ${normalized}`,
      );
    }
    owners.set(normalized, entry._id);

    if ((entry.variants?.length || 0) > 20) {
      throw new Error(`Knowledge entry ${entry._id} has more than 20 variants`);
    }
    if ((entry.tags?.length || 0) > 20) {
      throw new Error(`Knowledge entry ${entry._id} has more than 20 tags`);
    }
  }
  return entries;
};

const migrateKnowledgeEntries = async () => {
  const entries = await assertKnowledgePreconditions();
  const operations = entries.map((entry) => {
    const mainReady =
      Array.isArray(entry.embedding) &&
      entry.embedding.length === EMBEDDING_DIMENSION &&
      entry.embedding.every(Number.isFinite);
    const variantsReady = (entry.variants || []).every(
      (variant) =>
        Array.isArray(variant.embedding) &&
        variant.embedding.length === EMBEDDING_DIMENSION &&
        variant.embedding.every(Number.isFinite),
    );
    const ready = mainReady && variantsReady;

    return {
      updateOne: {
        filter: { _id: entry._id },
        update: {
          $set: {
            normalizedQuestion: normalizeKnowledgeQuestion(entry.question),
            variantCount: entry.variants?.length || 0,
            embeddingStatus: ready ? "ready" : "failed",
            embeddingVersion: ready ? EMBEDDING_VERSION : null,
            embeddingUpdatedAt: ready ? new Date() : null,
            embeddingError: ready
              ? null
              : "Backfill: embedding missing or invalid; regenerate required",
            ...(entry.status === "published" && !ready && { status: "draft" }),
          },
        },
      },
    };
  });

  if (operations.length) {
    await KnowledgeEntry.collection.bulkWrite(operations, { ordered: true });
  }
  await KnowledgeEntry.collection.createIndex(
    { normalizedQuestion: 1 },
    {
      unique: true,
      partialFilterExpression: { normalizedQuestion: { $type: "string" } },
      name: "uniq_knowledge_normalized_question",
    },
  );
  await KnowledgeEntry.collection.createIndex(
    { status: 1, embeddingStatus: 1, category: 1 },
    { name: "status_1_embeddingStatus_1_category_1" },
  );
};

const migrateChatConversations = async () => {
  const conversations = await ChatConversation.collection
    .find({}, { projection: { messages: 1, updatedAt: 1 } })
    .toArray();
  const operations = conversations.map((conversation) => {
    const allMessages = conversation.messages || [];
    const messages = allMessages.slice(-MAX_STORED_CHAT_MESSAGES).map((message) => ({
      ...message,
      ...(typeof message.image === "string" && message.image.length > 420000
        ? { image: null }
        : {}),
    }));
    const lastMeaningful = [...allMessages]
      .reverse()
      .find(
        (message) =>
          ["user", "assistant"].includes(message.role) && message.content,
      );
    return {
      updateOne: {
        filter: { _id: conversation._id },
        update: {
          $set: {
            messages,
            messageCount: allMessages.filter((message) =>
              ["user", "assistant"].includes(message.role),
            ).length,
            lastMessagePreview: String(lastMeaningful?.content || "").slice(0, 120),
            lastMessageAt: lastMeaningful?.timestamp || conversation.updatedAt || null,
            recentRequestIds: [],
            activeStreamId: null,
            activeStreamStartedAt: null,
          },
          $unset: { "context.image": "" },
        },
      },
    };
  });

  if (operations.length) {
    await ChatConversation.collection.bulkWrite(operations, { ordered: true });
  }
  await ChatConversation.collection.createIndex(
    { userId: 1, recentRequestIds: 1 },
    {
      unique: true,
      partialFilterExpression: { recentRequestIds: { $type: "string" } },
      name: "uniq_ai_request_per_user",
    },
  );
};

export const runPhase2IntegrityMigration = async () => {
  await migrateKnowledgeEntries();
  await migrateChatConversations();
  await AiModerationState.collection.createIndex(
    { userId: 1 },
    { unique: true, name: "userId_1" },
  );
};

const runFromCli = async () => {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE2_AI_KB_MIGRATION",
  });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    await runPhase2IntegrityMigration();
    console.log("Phase 2 AI/KB integrity migration completed");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith("20260719-phase2-ai-kb-integrity.js")) {
  runFromCli();
}
