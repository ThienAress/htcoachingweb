import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStageImagesWithAI } from "../aiImageGenerator.service.js";

const SOURCE = "data:image/png;base64,iVBORw0KGgo=";
const RESULT_BASE64 = "R2VtaW5pUmVzdWx0";

const geminiBody = (overrides = {}) => ({
  candidates: [
    {
      content: {
        parts: [
          { text: "Done" },
          { inlineData: { mimeType: "image/jpeg", data: RESULT_BASE64 } },
        ],
      },
    },
  ],
  ...overrides,
});

const stubFetch = (handler) => {
  const calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      if (String(url).startsWith("data:")) {
        return { ok: true, blob: async () => new Blob(["img"], { type: "image/png" }) };
      }
      calls.push({ url: String(url), options });
      return handler({ url: String(url), options });
    }),
  );
  return calls;
};

const run = () =>
  generateStageImagesWithAI({
    beforeImages: { frontUrl: SOURCE, sideUrl: SOURCE },
    prompts: { front: "Front prompt", side: "Side prompt" },
    context: {},
    phaseKey: "phase_1",
  });

beforeEach(() => {
  vi.stubEnv("AI_IMAGE_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-gemini-test-key");
  vi.stubEnv("AI_IMAGE_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini (Nano Banana) stage images", () => {
  it("sends the photo and prompt to the Gemini image model and returns data URLs", async () => {
    const calls = stubFetch(async () => ({
      ok: true,
      json: async () => geminiBody(),
    }));

    const result = await run();

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/models/gemini-2.5-flash-image:generateContent");
    expect(calls[0].options.headers["x-goog-api-key"]).toBe("synthetic-gemini-test-key");
    const parts = JSON.parse(calls[0].options.body).contents[0].parts;
    expect(parts[0].text).toContain("Front prompt");
    expect(parts[1].inlineData.mimeType).toBe("image/png");
    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-2.5-flash-image");
    expect(result.frontUrl).toBe(`data:image/jpeg;base64,${RESULT_BASE64}`);
    expect(result.sideUrl).toBe(`data:image/jpeg;base64,${RESULT_BASE64}`);
  });

  it("uses AI_IMAGE_MODEL when it is configured", async () => {
    vi.stubEnv("AI_IMAGE_MODEL", "gemini-3-pro-image-preview");
    const calls = stubFetch(async () => ({
      ok: true,
      json: async () => geminiBody(),
    }));

    const result = await run();

    expect(calls[0].url).toContain("/models/gemini-3-pro-image-preview:generateContent");
    expect(result.model).toBe("gemini-3-pro-image-preview");
  });

  it("reports a safety block as 422 with a Vietnamese message", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ promptFeedback: { blockReason: "SAFETY" } }),
    }));

    await expect(run()).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("bộ lọc an toàn"),
    });
  });

  it("fails clearly when the response has no image part", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "no image" }] } }],
      }),
    }));

    await expect(run()).rejects.toMatchObject({ status: 502 });
  });

  it("requires GEMINI_API_KEY", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    stubFetch(async () => ({ ok: true, json: async () => geminiBody() }));

    await expect(run()).rejects.toMatchObject({
      message: "Thiếu GEMINI_API_KEY",
    });
  });
});
