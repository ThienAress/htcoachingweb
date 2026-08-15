import { createHash } from "node:crypto";

import { RULE_BY_ID } from "./catalog.mjs";
import { compactSnippet, lineAt } from "./source.mjs";

const CLASS_NAME = /className\s*=\s*(?:\{\s*)?(["'`])([\s\S]*?)\1(?:\s*\})?/g;
const PERSONAL_INPUT = /(?:email|tel|phone|mobile|full[-_]?name|first[-_]?name|last[-_]?name|given[-_]?name|family[-_]?name|street[-_]?address|address[-_]?(?:line)?\d*)/i;
const ACCESSIBLE_NAME = /\baria-(?:label|labelledby)\s*=|\btitle\s*=/i;

const matches = (source, expression) => [...source.matchAll(expression)];

const openingTagEnd = (source, start) => {
  let quote = null;
  let braces = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === ">" && braces === 0) return index;
  }
  return -1;
};

const openingTags = (source, tagNames) => {
  const expression = new RegExp(`<(${tagNames.join("|")})\\b`, "gi");
  const tags = [];
  for (const match of matches(source, expression)) {
    const end = openingTagEnd(source, match.index);
    if (end < 0) continue;
    const tag = source.slice(match.index, end + 1);
    tags.push({
      tagName: match[1],
      index: match.index,
      end,
      tag,
      selfClosing: /\/\s*>$/.test(tag),
    });
  }
  return tags;
};

const closingTag = (source, tagName, start) => {
  const expression = new RegExp(`<\\/${tagName}\\s*>`, "i");
  const match = expression.exec(source.slice(start));
  return match ? { index: start + match.index, end: start + match.index + match[0].length } : null;
};

const literalAttribute = (tag, name) => {
  const expression = new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|\\{\\s*["']([^"']*)["']\\s*\\})`, "i");
  const match = tag.match(expression);
  return match ? match[1] ?? match[2] ?? "" : null;
};

const finding = ({ ruleId, file, source, index, evidence, message, remediation, status = "fail" }) => {
  const rule = RULE_BY_ID.get(ruleId);
  const normalizedEvidence = compactSnippet(evidence);
  const key = createHash("sha256")
    .update(`${ruleId}\n${file}\n${normalizedEvidence}`)
    .digest("hex")
    .slice(0, 16);
  return {
    key,
    ruleId,
    category: rule.category,
    severity: rule.severity,
    confidence: rule.confidence,
    status,
    file,
    line: lineAt(source, index),
    evidence: normalizedEvidence,
    message,
    remediation,
  };
};

const imageAlt = ({ file, source }) =>
  openingTags(source, ["img"])
    .filter((match) => !/\balt\s*=/i.test(match.tag))
    .map((match) => finding({
      ruleId: "image-alt", file, source, index: match.index, evidence: match.tag,
      message: "Ảnh native thiếu thuộc tính alt.",
      remediation: "Thêm alt mô tả ngắn hoặc alt rỗng cho ảnh trang trí.",
    }));

const personalAutocomplete = ({ file, source }) =>
  openingTags(source, ["input"])
    .filter((match) => {
      const type = literalAttribute(match.tag, "type")?.toLowerCase() ?? "text";
      const name = literalAttribute(match.tag, "name") ?? literalAttribute(match.tag, "id") ?? "";
      const personal = type === "email" || type === "tel" || PERSONAL_INPUT.test(name);
      return personal && !["file", "number", "hidden"].includes(type) && !/\bautocomplete\s*=/i.test(match.tag);
    })
    .map((match) => finding({
      ruleId: "personal-input-autocomplete", file, source, index: match.index, evidence: match.tag,
      message: "Input dữ liệu cá nhân thiếu autocomplete purpose.",
      remediation: "Thêm autoComplete token phù hợp như email, tel, name hoặc street-address.",
    }));

const formButtonType = ({ file, source }) => {
  const findings = [];
  for (const form of openingTags(source, ["form"])) {
    const closing = closingTag(source, form.tagName, form.end + 1);
    if (!closing) continue;
    const bodyStart = form.end + 1;
    const body = source.slice(bodyStart, closing.index);
    for (const button of openingTags(body, ["button"])) {
      if (/\btype\s*=/i.test(button.tag)) continue;
      findings.push(finding({
        ruleId: "form-button-type", file, source, index: bodyStart + button.index,
        evidence: button.tag, message: "Button trong form thiếu type tường minh.",
        remediation: "Đặt type=\"button\" hoặc type=\"submit\" theo hành vi thực tế.",
      }));
    }
  }
  return findings;
};

const iconButtonName = ({ file, source }) =>
  openingTags(source, ["button"])
    .filter((match) => !match.selfClosing)
    .filter((match) => {
      if (ACCESSIBLE_NAME.test(match.tag)) return false;
      const closing = closingTag(source, match.tagName, match.end + 1);
      if (!closing) return false;
      const body = source.slice(match.end + 1, closing.index);
      const hasIcon = /<[A-Z][\w.]*\b[^>]*\/?\s*>/.test(body);
      const visibleText = body
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\{\s*\}/g, "")
        .trim();
      return hasIcon && visibleText.length === 0;
    })
    .map((match) => finding({
      ruleId: "icon-button-accessible-name", file, source, index: match.index,
      evidence: match.tag, message: "Icon-only button không có accessible name.",
      remediation: "Thêm aria-label/aria-labelledby hoặc text sr-only mô tả hành động.",
    }));

const focusVisible = ({ file, source }) =>
  matches(source, CLASS_NAME)
    .filter((match) => /(?:focus:)?outline-none/.test(match[2]))
    .filter((match) => {
      const tagStart = source.lastIndexOf("<", match.index);
      const tagEnd = tagStart >= 0 ? openingTagEnd(source, tagStart) : -1;
      const openingTag = tagStart >= 0 && tagEnd >= match.index ? source.slice(tagStart, tagEnd + 1) : "";
      const tagName = openingTag.match(/^<([A-Za-z][\w.-]*)/)?.[1] ?? "";
      const nativeInteractive = /^(?:a|button|input|select|textarea)$/i.test(tagName);
      const interactiveRole = /\brole\s*=\s*["'](?:button|checkbox|link|menuitem|radio|switch|tab|textbox)["']/i.test(openingTag);
      return (nativeInteractive || interactiveRole) && !/\b(?:disabled|readOnly)\b/.test(openingTag);
    })
    .filter((match) => !/(?:focus|focus-visible):[^\s]*(?:ring|outline|border)/.test(match[2]))
    .map((match) => finding({
      ruleId: "focus-visible-not-suppressed", file, source, index: match.index,
      evidence: match[0], message: "Focus outline bị tắt mà chưa thấy replacement style.",
      remediation: "Thêm focus-visible ring/outline có contrast hoặc bỏ outline-none.",
    }));

const transitionAll = ({ file, source }) =>
  matches(source, CLASS_NAME)
    .filter((match) => /(?:^|\s)transition-all(?:\s|$)/.test(match[2]))
    .map((match) => finding({
      ruleId: "transition-all", file, source, index: match.index, evidence: match[0],
      message: "transition-all làm animation scope không rõ và dễ animate property đắt.",
      remediation: "Liệt kê property thực sự đổi bằng transition-[...], transition-colors hoặc transition-transform.",
    }));

const nestedInteractive = ({ file, source }) => {
  const findings = [];
  for (const outer of openingTags(source, ["a", "button"])) {
    if (outer.selfClosing) continue;
    const closing = closingTag(source, outer.tagName, outer.end + 1);
    if (!closing) continue;
    const body = source.slice(outer.end + 1, closing.index);
    const inner = body.match(/<(button|a|input|select|textarea)\b/i);
    if (!inner) continue;
    findings.push(finding({
      ruleId: "nested-interactive-control", file, source, index: outer.index,
      evidence: `${outer.tag}${body.slice(0, (inner.index ?? 0) + inner[0].length)}`,
      message: "Interactive control bị lồng trong interactive control khác.",
      remediation: "Giữ một interactive root và chuyển phần còn lại thành nội dung không tương tác.",
    }));
  }
  return findings;
};

const gradientText = ({ file, source }) =>
  matches(source, CLASS_NAME)
    .filter((match) => match[2].includes("bg-clip-text") && match[2].includes("text-transparent"))
    .map((match) => finding({
      ruleId: "gradient-text", file, source, index: match.index, evidence: match[0],
      message: "Gradient text thuộc AI-slop pattern bị cấm.", remediation: "Dùng màu chữ solid theo palette của surface.",
    }));

const extremeZIndex = ({ file, source }) =>
  matches(source, /z-\[(\d+)\]/g)
    .filter((match) => Number(match[1]) > 60)
    .map((match) => finding({
      ruleId: "extreme-z-index", file, source, index: match.index, evidence: match[0],
      message: "Arbitrary z-index vượt semantic scale của dự án.",
      remediation: "Dùng z-10/20/40/50 hoặc z-[60] cho toast; sửa stacking context gốc nếu cần.",
    }));

const bounceEasing = ({ file, source }) =>
  matches(source, /(?:ease\s*:\s*["'`][^"'`]*(?:bounce|elastic|back)\b|ease-(?:bounce|elastic|back))/gi)
    .map((match) => finding({
      ruleId: "bounce-easing", file, source, index: match.index, evidence: match[0],
      message: "Bounce/elastic/back easing không phù hợp motion discipline.",
      remediation: "Dùng power3.out, power4.out, expo.out hoặc cubic-bezier tương đương.",
    }));

const reducedMotion = ({ file, source }) => {
  const motion = source.match(/\bgsap\b|animate-[\w-[\]]+/);
  if (!motion || /prefers-reduced-motion|motion-reduce:/.test(source)) return [];
  return [finding({
    ruleId: "reduced-motion-strategy", file, source, index: motion.index,
    evidence: motion[0], status: "advisory",
    message: "File có motion nhưng static scan chưa thấy reduced-motion strategy.",
    remediation: "Xác minh runtime/CSS dùng prefers-reduced-motion hoặc motion-reduce; không sửa chỉ để ép advisory pass.",
  })];
};

export const RULE_RUNNERS = new Map([
  ["image-alt", imageAlt],
  ["personal-input-autocomplete", personalAutocomplete],
  ["form-button-type", formButtonType],
  ["icon-button-accessible-name", iconButtonName],
  ["focus-visible-not-suppressed", focusVisible],
  ["transition-all", transitionAll],
  ["nested-interactive-control", nestedInteractive],
  ["gradient-text", gradientText],
  ["extreme-z-index", extremeZIndex],
  ["bounce-easing", bounceEasing],
  ["reduced-motion-strategy", reducedMotion],
]);
