import { assertDeepseekTrialEnvironment } from "../../config/deepseekTrial.js";
import { searchKnowledgeBase } from "./embedding.service.js";
import { searchDeepseekKnowledgeBase } from "./deepseekKnowledgeSelection.service.js";

// Chat and Admin Search Test share this dispatch; KB writes retain vector flows.
export async function searchAssistantKnowledgeBase(query, options = {}) {
  const trial = assertDeepseekTrialEnvironment();
  if (trial.active) return searchDeepseekKnowledgeBase(query, options);
  return { results: await searchKnowledgeBase(query, options), retrieval: { method: "vector" } };
}
