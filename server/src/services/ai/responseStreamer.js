const DEFAULT_MAX_FRAMES = 64;
const DEFAULT_MIN_CHUNK_CHARACTERS = 12;
const DEFAULT_FRAME_DELAY_MS = 20;
const GRAPHEME_SEGMENTER =
  typeof Intl?.Segmenter === "function"
    ? new Intl.Segmenter("vi", { granularity: "grapheme" })
    : null;

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const getGraphemes = (value) =>
  GRAPHEME_SEGMENTER
    ? Array.from(GRAPHEME_SEGMENTER.segment(value), ({ segment }) => segment)
    : Array.from(value);

export function truncateAssistantText(value, maximumCharacters) {
  const text = String(value || "");
  const maximum = clampInteger(maximumCharacters, 20_000, 0, 100_000);
  if (!text || text.length <= maximum) return text;

  let consumedCharacters = 0;
  const accepted = [];
  for (const grapheme of getGraphemes(text)) {
    if (consumedCharacters + grapheme.length > maximum) break;
    accepted.push(grapheme);
    consumedCharacters += grapheme.length;
  }
  return accepted.join("");
}

export function splitAssistantTextForStreaming(value, options = {}) {
  const text = String(value || "");
  if (!text) return [];

  const maxFrames = clampInteger(
    options.maxFrames,
    DEFAULT_MAX_FRAMES,
    2,
    120,
  );
  const minChunkCharacters = clampInteger(
    options.minChunkCharacters,
    DEFAULT_MIN_CHUNK_CHARACTERS,
    1,
    500,
  );
  const characters = getGraphemes(text);
  const targetCharacters = Math.max(
    minChunkCharacters,
    Math.ceil(characters.length / maxFrames),
  );
  const chunks = [];
  for (let index = 0; index < characters.length; index += targetCharacters) {
    chunks.push(characters.slice(index, index + targetCharacters).join(""));
  }

  return chunks;
}

const waitForNextFrame = (delayMs, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let timeout;
    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    timeout = setTimeout(finish, delayMs);
    signal?.addEventListener("abort", finish, { once: true });
  });

export async function streamAssistantText(value, options = {}) {
  if (typeof options.write !== "function") {
    throw new TypeError("streamAssistantText requires a write callback");
  }
  if (options.signal?.aborted) {
    return { writtenFrames: 0, writtenCharacters: 0, aborted: true };
  }

  const chunks = splitAssistantTextForStreaming(value, options);
  const frameDelayMs = clampInteger(
    options.frameDelayMs,
    DEFAULT_FRAME_DELAY_MS,
    0,
    100,
  );
  let writtenFrames = 0;
  let writtenCharacters = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    if (options.signal?.aborted) break;
    options.write(chunks[index]);
    writtenFrames += 1;
    writtenCharacters += chunks[index].length;
    if (index < chunks.length - 1 && frameDelayMs > 0) {
      await waitForNextFrame(frameDelayMs, options.signal);
    }
  }

  return {
    writtenFrames,
    writtenCharacters,
    aborted: Boolean(options.signal?.aborted),
  };
}
