import { Children, isValidElement } from "react";

/**
 * A paragraph that ends in several source links shows them as one grouped control instead
 * of one chip per sentence. `resolve` maps a link target to its source, or null.
 * Returns null when the paragraph has fewer than two trailing sources.
 */
export const splitTrailingCitations = (children, resolve) => {
  const items = Children.toArray(children);
  const sources = [];
  let leadEnd = items.length;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (typeof item === "string" && !item.trim()) continue;
    const source = isValidElement(item) && item.props?.href ? resolve(item.props.href) : null;
    if (!source) break;
    if (!sources.some((existing) => existing.uri === source.uri)) sources.unshift(source);
    leadEnd = index;
  }
  if (sources.length < 2) return null;
  return { lead: items.slice(0, leadEnd), sources };
};
