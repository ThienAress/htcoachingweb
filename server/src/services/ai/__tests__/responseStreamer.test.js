import { describe, expect, it, vi } from "vitest";

import {
  splitAssistantTextForStreaming,
  streamAssistantText,
  truncateAssistantText,
} from "../responseStreamer.js";

describe("sanitized assistant response streaming", () => {
  it("splits a long final answer into bounded frames without changing content", () => {
    const content =
      "Ronaldo ưu tiên sức mạnh thân dưới, khả năng bùng nổ và phục hồi.\n\nMỗi khẳng định về lịch tập cần đi kèm nguồn phù hợp.";
    const chunks = splitAssistantTextForStreaming(content, {
      maxFrames: 8,
      minChunkCharacters: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(8);
    expect(chunks.join("")).toBe(content);
  });

  it("bounds a long token that contains no whitespace", () => {
    const content = "x".repeat(20_000);
    const chunks = splitAssistantTextForStreaming(content, {
      maxFrames: 64,
      minChunkCharacters: 12,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(64);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(
      Math.ceil(content.length / 64),
    );
    expect(chunks.join("")).toBe(content);
  });

  it("never splits a composed grapheme between SSE frames", () => {
    const content = `aaaaaaaaaaa👨‍👩‍👧‍👦👍🏽é${"b".repeat(20)}`;
    const chunks = splitAssistantTextForStreaming(content, {
      maxFrames: 8,
      minChunkCharacters: 4,
    });
    const segmenter = new Intl.Segmenter("vi", { granularity: "grapheme" });
    const boundaries = new Set();
    let boundary = 0;
    for (const { segment } of segmenter.segment(content)) {
      boundary += segment.length;
      boundaries.add(boundary);
    }
    let streamedLength = 0;

    for (const chunk of chunks) {
      streamedLength += chunk.length;
      expect(boundaries.has(streamedLength)).toBe(true);
    }
    expect(chunks.join("")).toBe(content);
  });

  it("truncates at a grapheme boundary instead of splitting an emoji", () => {
    const prefix = "a".repeat(19_999);
    const content = `${prefix}👨‍👩‍👧‍👦 trailing text`;
    const truncated = truncateAssistantText(content, 20_000);

    expect(truncated).toBe(prefix);
    expect(truncated.length).toBeLessThanOrEqual(20_000);
    expect(truncated).not.toMatch(/[\uD800-\uDBFF]$/u);
  });

  it("writes frames in order and stops before writing when already aborted", async () => {
    const write = vi.fn();
    const controller = new AbortController();
    controller.abort(new Error("client disconnected"));

    await streamAssistantText("Nội dung không được gửi.", {
      write,
      signal: controller.signal,
      frameDelayMs: 0,
    });

    expect(write).not.toHaveBeenCalled();
  });

  it("streams multiple frames that reconstruct the exact final answer", async () => {
    const frames = [];
    const content = "Một câu trả lời dài vừa đủ để được hiển thị thành nhiều nhịp tự nhiên.";

    await streamAssistantText(content, {
      write: (chunk) => frames.push(chunk),
      frameDelayMs: 0,
      maxFrames: 6,
      minChunkCharacters: 8,
    });

    expect(frames.length).toBeGreaterThan(1);
    expect(frames.join("")).toBe(content);
  });

  it("stops after the current frame when the client aborts mid-stream", async () => {
    const frames = [];
    const controller = new AbortController();

    const result = await streamAssistantText(
      "Một câu trả lời đủ dài để tạo ra nhiều frame liên tiếp.",
      {
        write: (chunk) => {
          frames.push(chunk);
          controller.abort(new Error("client disconnected"));
        },
        signal: controller.signal,
        frameDelayMs: 0,
        maxFrames: 8,
        minChunkCharacters: 4,
      },
    );

    expect(frames).toHaveLength(1);
    expect(result).toEqual({
      writtenFrames: 1,
      writtenCharacters: frames[0].length,
      aborted: true,
    });
  });
});
