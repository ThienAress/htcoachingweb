export const ENGINE_VERSION = "1.0.0";
export const RULESET_VERSION = "2026.08.2";

export const UI_AUDIT_RULES = Object.freeze([
  { id: "image-alt", category: "accessibility", severity: "error", confidence: "high" },
  { id: "personal-input-autocomplete", category: "forms", severity: "warning", confidence: "high" },
  { id: "form-button-type", category: "forms", severity: "error", confidence: "high" },
  { id: "icon-button-accessible-name", category: "accessibility", severity: "error", confidence: "high" },
  { id: "focus-visible-not-suppressed", category: "accessibility", severity: "warning", confidence: "medium" },
  { id: "transition-all", category: "motion", severity: "warning", confidence: "high" },
  { id: "nested-interactive-control", category: "accessibility", severity: "error", confidence: "high" },
  { id: "gradient-text", category: "design", severity: "error", confidence: "high" },
  { id: "extreme-z-index", category: "design", severity: "error", confidence: "high" },
  { id: "bounce-easing", category: "motion", severity: "error", confidence: "high" },
  { id: "reduced-motion-strategy", category: "motion", severity: "warning", confidence: "low" },
]);

export const UI_AUDIT_CATEGORIES = Object.freeze([
  ...new Set(UI_AUDIT_RULES.map((rule) => rule.category)),
]);

export const RULE_BY_ID = new Map(UI_AUDIT_RULES.map((rule, index) => [rule.id, { ...rule, index }]));
