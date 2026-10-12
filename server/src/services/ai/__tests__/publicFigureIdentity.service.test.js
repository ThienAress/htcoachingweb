import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyPublicFigureName,
  isPublicFigureClassifierEnabled,
  resetPublicFigureIdentityCache,
  resolveClassifiedPublicFigures,
} from "../publicFigureIdentity.service.js";

const streamOf = (payload) =>
  vi.fn(async function* () {
    yield { type: "text", content: typeof payload === "string" ? payload : JSON.stringify(payload) };
  });

const yes = (canonical) => ({ public: true, confidence: "high", canonical });

describe("public figure identity classifier", () => {
  beforeEach(() => resetPublicFigureIdentityCache());

  it("accepts a confident answer and sends only the name", async () => {
    const stream = streamOf(yes("Conor McGregor"));
    await expect(classifyPublicFigureName("Conor McGregor", { stream })).resolves.toEqual({
      public: true,
      canonical: "Conor McGregor",
    });
    const [messages] = stream.mock.calls[0];
    expect(messages.at(-1).content).toBe(JSON.stringify({ name: "Conor McGregor" }));
  });

  it("caches the answer so the provider is asked once per name", async () => {
    const stream = streamOf(yes("Conor McGregor"));
    await classifyPublicFigureName("Conor McGregor", { stream });
    await classifyPublicFigureName("conor mcgregor", { stream });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["low confidence", { public: true, confidence: "low", canonical: "Conor McGregor" }],
    ["not public", { public: false, confidence: "high", canonical: "" }],
    ["a different person", yes("Floyd Mayweather")],
    ["a single token", yes("McGregor")],
    ["an array", []],
    ["invalid JSON", "not json"],
  ])("fails closed on %s", async (_label, payload) => {
    const stream = streamOf(payload);
    await expect(classifyPublicFigureName("Conor McGregor", { stream })).resolves.toEqual({
      public: false,
    });
  });

  it("fails closed and does not cache a provider error", async () => {
    const failing = vi.fn(async function* () {
      throw new Error("DEEPSEEK_DEADLINE_EXCEEDED");
    });
    await expect(classifyPublicFigureName("Conor McGregor", { stream: failing })).resolves.toEqual({
      public: false,
    });
    const stream = streamOf(yes("Conor McGregor"));
    await expect(classifyPublicFigureName("Conor McGregor", { stream })).resolves.toMatchObject({
      public: true,
    });
  });

  it("binds names only when every candidate is public", async () => {
    const stream = vi.fn(async function* (messages) {
      const { name } = JSON.parse(messages.at(-1).content);
      yield {
        type: "text",
        content: JSON.stringify(
          name === "Conor McGregor" ? yes("Conor McGregor") : { public: false, confidence: "high" },
        ),
      };
    });
    await expect(
      resolveClassifiedPublicFigures(["Conor McGregor"], { stream }),
    ).resolves.toEqual({
      names: ["Conor McGregor"],
      rewrites: [{ surface: "Conor McGregor", canonical: "Conor McGregor" }],
    });
    await expect(
      resolveClassifiedPublicFigures(["Conor McGregor", "Nguyễn Văn A"], { stream }),
    ).resolves.toEqual({ names: [], rewrites: [] });
    await expect(resolveClassifiedPublicFigures([], { stream })).resolves.toEqual({
      names: [],
      rewrites: [],
    });
  });

  it("is on for deepseek unless switched off", () => {
    expect(isPublicFigureClassifierEnabled({ AI_PROVIDER: "deepseek" })).toBe(true);
    expect(
      isPublicFigureClassifierEnabled({ AI_PROVIDER: "deepseek", AI_PUBLIC_FIGURE_CLASSIFIER: "off" }),
    ).toBe(false);
    expect(isPublicFigureClassifierEnabled({ AI_PROVIDER: "gemini" })).toBe(false);
  });
});
