export const KNOWLEDGE_EXPORT_FORMAT = "htcoaching-knowledge-export";
export const KNOWLEDGE_EXPORT_VERSION = 1;
const EXPORT_PAGE_SIZE = 100;
const VARIANT_CONCURRENCY = 6;

const text = (value) => (typeof value === "string" ? value : "");

export const buildKnowledgeExportEntry = (entry, variants = []) => ({
  id: String(entry?._id || ""),
  question: text(entry?.question),
  answer: text(entry?.answer),
  category: text(entry?.category),
  status: text(entry?.status),
  tags: Array.isArray(entry?.tags) ? entry.tags.map(text) : [],
  variants: (Array.isArray(variants) ? variants : []).map((item) => text(item?.text ?? item)),
  evidenceLevel: text(entry?.evidenceLevel),
  freshnessClass: text(entry?.freshnessClass),
  reviewDueAt: entry?.reviewDueAt || null,
  embeddingStatus: text(entry?.embeddingStatus),
  updatedAt: entry?.updatedAt || null,
  sources: (Array.isArray(entry?.sources) ? entry.sources : []).map((source) => ({
    type: text(source?.type),
    title: text(source?.title),
    publisher: text(source?.publisher),
    url: text(source?.url),
    publishedAt: source?.publishedAt || null,
    retrievedAt: source?.retrievedAt || null,
    evidenceTier: text(source?.evidenceTier),
  })),
});

export const buildKnowledgeExportDocument = (entries, now = new Date()) => ({
  format: KNOWLEDGE_EXPORT_FORMAT,
  version: KNOWLEDGE_EXPORT_VERSION,
  exportedAt: now.toISOString(),
  count: entries.length,
  entries,
});

const pad = (value) => String(value).padStart(2, "0");

export const buildKnowledgeExportFileName = (scope, now = new Date()) => {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `knowledge-base-${scope}-${stamp}.json`;
};

export const downloadJsonFile = (fileName, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const readVariants = async (fetchVariants, id) => {
  const response = await fetchVariants(id);
  return response.data?.data?.variants || [];
};

/**
 * Collect every entry (all pages) plus its variants. Read-only; `onProgress(done, total)` is optional.
 */
export const collectAllKnowledgeEntries = async ({ fetchPage, fetchVariants, onProgress }) => {
  const entries = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetchPage({ page, limit: EXPORT_PAGE_SIZE });
    entries.push(...(response.data?.data || []));
    totalPages = response.data?.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  const result = new Array(entries.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      result[index] = buildKnowledgeExportEntry(entries[index], await readVariants(fetchVariants, entries[index]._id));
      done += 1;
      onProgress?.(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(VARIANT_CONCURRENCY, entries.length) }, worker));
  return result;
};
