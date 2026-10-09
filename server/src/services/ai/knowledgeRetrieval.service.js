import { assertDeepseekProfile } from "../../config/deepseekProfile.js";
import { searchKnowledgeBase } from "./embedding.service.js";
import { searchDeepseekKnowledgeBase } from "./deepseekKnowledgeSelection.service.js";

// Chat and Admin Search Test share this dispatch; KB writes retain vector flows.
export async function searchAssistantKnowledgeBase(query, options = {}) {
  const trial = assertDeepseekProfile();
  if (trial.active) return searchDeepseekKnowledgeBase(query, options);
  return { results: await searchKnowledgeBase(query, options), retrieval: { method: "vector" } };
}
