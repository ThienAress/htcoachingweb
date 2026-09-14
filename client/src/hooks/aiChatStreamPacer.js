const DEFAULT_LIVE_REVEAL_GRAPHEMES = 18;
const DEFAULT_MAX_COMPLETION_TICKS = 50;

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("vi", { granularity: "grapheme" })
    : null;

const toGraphemes = (value) =>
  graphemeSegmenter
    ? [...graphemeSegmenter.segment(value)].map(({ segment }) => segment)
    : Array.from(value);

/**
 * Điều tiết tốc độ hiển thị ở client để network/proxy có gộp SSE frames thì
 * câu trả lời vẫn xuất hiện tăng dần. Buffer chỉ nhận output đã sanitize từ server.
 */
export function createAiChatStreamPacer(options = {}) {
  const liveRevealGraphemes = clampInteger(
    options.liveRevealGraphemes,
    DEFAULT_LIVE_REVEAL_GRAPHEMES,
    1,
    128,
  );
  const maxCompletionTicks = clampInteger(
    options.maxCompletionTicks,
    DEFAULT_MAX_COMPLETION_TICKS,
    2,
    120,
  );
  let pendingText = "";
  let complete = false;
  let cancelled = false;
  let completionTicksRemaining = maxCompletionTicks;

  const append = (value) => {
    if (cancelled || complete) return;
    pendingText += String(value || "");
  };

  const markComplete = () => {
    if (cancelled) return;
    complete = true;
    completionTicksRemaining = maxCompletionTicks;
  };

  const takeNext = () => {
    if (cancelled || !pendingText) return "";
    const graphemes = toGraphemes(pendingText);
    const adaptiveCompletionSize = complete
      ? Math.ceil(
          graphemes.length / Math.max(1, completionTicksRemaining),
        )
      : 0;
    const revealCount = Math.min(
      graphemes.length,
      Math.max(liveRevealGraphemes, adaptiveCompletionSize),
    );
    const next = graphemes.slice(0, revealCount).join("");
    pendingText = graphemes.slice(revealCount).join("");
    if (complete) completionTicksRemaining -= 1;
    return next;
  };

  const takeAll = () => {
    if (cancelled) return "";
    const next = pendingText;
    pendingText = "";
    return next;
  };

  const cancel = () => {
    cancelled = true;
    pendingText = "";
  };

  return {
    append,
    markComplete,
    takeNext,
    takeAll,
    cancel,
    hasPending: () => pendingText.length > 0,
  };
}

export function stopAiChatStreamPacer(
  pacer,
  { drainPending = false } = {},
) {
  if (!pacer) return "";
  const pendingText = drainPending ? pacer.takeAll() : "";
  pacer.cancel();
  return pendingText;
}

export function stopAiChatStreamSession(
  session,
  { drainPending = false } = {},
) {
  if (!session) return "";
  const pendingText = stopAiChatStreamPacer(session.streamPacer, {
    drainPending,
  });
  if (session.resolveDrain) {
    const resolveDrain = session.resolveDrain;
    session.resolveDrain = null;
    resolveDrain();
  }
  session.controller?.abort();
  return pendingText;
}
