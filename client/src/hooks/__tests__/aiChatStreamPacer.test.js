import { describe, expect, it } from "vitest";

import {
  createAiChatStreamPacer,
  stopAiChatStreamPacer,
  stopAiChatStreamSession,
} from "../aiChatStreamPacer.js";

describe("AI chat progressive display pacer", () => {
  it("reveals a coalesced final response over multiple bounded revisions", () => {
    const pacer = createAiChatStreamPacer({
      liveRevealGraphemes: 8,
      maxCompletionTicks: 8,
    });
    const finalText =
      "Một câu trả lời đã bị transport gộp chung với event done nhưng vẫn phải hiện dần.";

    pacer.append(finalText);
    pacer.markComplete();

    const revisions = [];
    let displayed = "";
    while (pacer.hasPending()) {
      displayed += pacer.takeNext();
      revisions.push(displayed);
    }

    expect(revisions.length).toBeGreaterThanOrEqual(3);
    expect(revisions[0].length).toBeLessThan(finalText.length);
    expect(revisions.every((value, index) =>
      index === 0 || value.startsWith(revisions[index - 1]),
    )).toBe(true);
    expect(displayed).toBe(finalText);
  });

  it("preserves graphemes and reconstructs the exact markdown response", () => {
    const pacer = createAiChatStreamPacer({
      liveRevealGraphemes: 3,
      maxCompletionTicks: 6,
    });
    const finalText = "**Đúng rồi** bro 👨🏽‍💻 — tập đều nhé!";

    pacer.append(finalText.slice(0, 12));
    pacer.append(finalText.slice(12));
    pacer.markComplete();

    const frames = [];
    while (pacer.hasPending()) frames.push(pacer.takeNext());

    expect(frames.join("")).toBe(finalText);
  });

  it("drains queued backlog on Stop so persisted history cannot reveal a hidden suffix", () => {
    const pacer = createAiChatStreamPacer({ liveRevealGraphemes: 10 });
    const receivedText = "Phần đã nhận nhưng chưa hiển thị hết cho người dùng.";
    pacer.append(receivedText);
    const visiblePrefix = pacer.takeNext();

    const visibleRemainder = stopAiChatStreamPacer(pacer, {
      drainPending: true,
    });

    expect(visiblePrefix + visibleRemainder).toBe(receivedText);
    expect(pacer.hasPending()).toBe(false);
    expect(pacer.takeNext()).toBe("");
  });

  it("drops queued backlog when a hidden view is disposed", () => {
    const pacer = createAiChatStreamPacer({ liveRevealGraphemes: 10 });
    pacer.append("Nội dung không còn view để hiển thị.");

    const drained = stopAiChatStreamPacer(pacer);

    expect(drained).toBe("");
    expect(pacer.hasPending()).toBe(false);
  });

  it("cancels pacing, resolves a pending drain and aborts network on disposal", () => {
    const controller = new AbortController();
    let drainResolved = false;
    const session = {
      controller,
      streamPacer: createAiChatStreamPacer(),
      resolveDrain: () => {
        drainResolved = true;
      },
    };
    session.streamPacer.append("Đoạn đang chờ hiển thị.");

    stopAiChatStreamSession(session);

    expect({
      aborted: controller.signal.aborted,
      drainResolved,
      resolveDrain: session.resolveDrain,
      hasPending: session.streamPacer.hasPending(),
    }).toEqual({
      aborted: true,
      drainResolved: true,
      resolveDrain: null,
      hasPending: false,
    });
  });
});
