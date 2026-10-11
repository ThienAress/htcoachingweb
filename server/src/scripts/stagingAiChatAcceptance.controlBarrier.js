const FIRST_FRAME_TIMEOUT_MS = 60_000;
const TERMINAL_STATUS_TIMEOUT_MS = 15_000;
const TERMINAL_STATUSES = new Set(["aborted", "timed_out", "completed"]);

export const waitControlStatus = async (collection, jti, status, options = {}) => {
  const timeoutMs = options.timeoutMs ?? (
    status === "first_frame" ? FIRST_FRAME_TIMEOUT_MS : TERMINAL_STATUS_TIMEOUT_MS
  );
  const pollMs = options.pollMs ?? 100;
  const now = options.now ?? (() => Date.now());
  const wait = options.wait ?? ((milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const control = await collection.findOne({ _id: jti }, { projection: { status: 1 } });
    if (control?.status === status) return control;
    if (TERMINAL_STATUSES.has(control?.status)) break;
    await wait(Math.min(pollMs, Math.max(1, deadline - now())));
  }
  throw Object.assign(new Error(`Staging control did not reach ${status}`), {
    code: "STAGING_AI_CONTROL_BARRIER_FAILED",
  });
};
