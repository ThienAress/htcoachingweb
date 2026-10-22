import { describe, expect, it, vi } from "vitest";

import {
  buildKnowledgeExportDocument,
  buildKnowledgeExportEntry,
  buildKnowledgeExportFileName,
  collectAllKnowledgeEntries,
} from "../knowledgeBaseExport";

describe("knowledgeBaseExport", () => {
  it("builds a readable entry without embeddings or internal fields", () => {
    const exported = buildKnowledgeExportEntry(
      {
        _id: "abc",
        question: "Skinny Fat là gì?",
        answer: "Là tình trạng ít cơ, nhiều mỡ.",
        category: "nutrition",
        status: "draft",
        tags: ["skinny fat"],
        embedding: [0.1, 0.2],
        createdBy: { name: "Admin" },
        sources: [{ type: "official", title: "NASM", url: "https://example.com", embedding: [1] }],
      },
      [{ _id: "v1", text: "Tôi bị skinny fat thì sao?", hasEmbedding: true }],
    );

    expect(exported).toMatchObject({
      id: "abc",
      question: "Skinny Fat là gì?",
      status: "draft",
      tags: ["skinny fat"],
      variants: ["Tôi bị skinny fat thì sao?"],
      sources: [{ type: "official", title: "NASM", url: "https://example.com" }],
    });
    expect(exported).not.toHaveProperty("embedding");
    expect(exported).not.toHaveProperty("createdBy");
    expect(exported.sources[0]).not.toHaveProperty("embedding");
  });

  it("wraps entries in a versioned document with the count", () => {
    const doc = buildKnowledgeExportDocument([{ id: "1" }, { id: "2" }], new Date("2026-10-22T03:00:00Z"));
    expect(doc).toMatchObject({
      format: "htcoaching-knowledge-export",
      version: 1,
      count: 2,
      exportedAt: "2026-10-22T03:00:00.000Z",
    });
  });

  it("names files by scope and local time", () => {
    expect(buildKnowledgeExportFileName("all", new Date(2026, 9, 22, 9, 5))).toBe("knowledge-base-all-20261022-0905.json");
  });

  it("reads every page and each entry's variants, keeping the list order", async () => {
    const pages = {
      1: { data: { data: [{ _id: "a", question: "A" }, { _id: "b", question: "B" }], pagination: { totalPages: 2 } } },
      2: { data: { data: [{ _id: "c", question: "C" }], pagination: { totalPages: 2 } } },
    };
    const fetchPage = vi.fn(async ({ page }) => pages[page]);
    const fetchVariants = vi.fn(async (id) => ({ data: { data: { variants: [{ text: `biến thể ${id}` }] } } }));
    const onProgress = vi.fn();

    const result = await collectAllKnowledgeEntries({ fetchPage, fetchVariants, onProgress });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.map((item) => item.variants)).toEqual([["biến thể a"], ["biến thể b"], ["biến thể c"]]);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it("rejects instead of returning a partial file when a request fails", async () => {
    const fetchPage = async () => ({ data: { data: [{ _id: "a" }], pagination: { totalPages: 1 } } });
    const fetchVariants = async () => {
      throw new Error("network");
    };
    await expect(collectAllKnowledgeEntries({ fetchPage, fetchVariants })).rejects.toThrow("network");
  });
});
