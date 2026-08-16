import { createHash } from "node:crypto";

import { buildSystemPrompt } from "./systemPrompt.js";

export const AI_PROMPT_CONTRACT_VERSION = "2026-08-13.v1";

const corePrompt = buildSystemPrompt();
export const AI_PROMPT_CONTRACT_HASH = createHash("sha256")
  .update(corePrompt, "utf8")
  .digest("hex");

const metadata = Object.freeze({
  version: AI_PROMPT_CONTRACT_VERSION,
  hash: AI_PROMPT_CONTRACT_HASH,
});

export const getAiPromptContractMetadata = () => metadata;
