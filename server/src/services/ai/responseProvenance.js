export function resolveResponseProvenance({
  model = "",
  webSearchRequired = false,
  webEvidenceAvailable = false,
  internalSourceCount = 0,
} = {}) {
  if (webEvidenceAvailable) return "web_grounded";
  if (webSearchRequired || /^server:(?:capability|web_evidence)_unavailable$/u.test(model)) {
    return "capability_unavailable";
  }
  if (/^(?:server_|static_|staging_acceptance_)/u.test(model)) return "deterministic_server";
  if (internalSourceCount > 0) return "internal_kb";
  return "model_prior";
}
