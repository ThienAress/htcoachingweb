import {
  assertHealthyVectorTopology,
  metricDelta,
} from "./stagingAiChatAcceptance.evidence.js";

const SHA = /^[a-f0-9]{40}$/;

const vectorFixturePresent = (response, fixtureId) =>
  response?.data?.some((entry) => String(entry?._id) === fixtureId) === true;

const vectorReadinessTimeout = () => {
  const error = new Error("Staging vector indexes did not expose the exact fixture before the cohort window");
  error.code = "STAGING_AI_VECTOR_INDEX_NOT_READY";
  return error;
};

const positiveDuration = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(1, Math.ceil(parsed)), 2_147_483_647);
};

const abortableWait = (milliseconds, { signal } = {}) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason || vectorReadinessTimeout());
    return;
  }
  const finish = () => {
    signal?.removeEventListener("abort", abort);
    resolve();
  };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => {
    clearTimeout(timer);
    reject(signal.reason || vectorReadinessTimeout());
  };
  signal?.addEventListener("abort", abort, { once: true });
});

const runWithSignal = async (operation, signal, timeoutError) => {
  if (signal.aborted) throw signal.reason || timeoutError;
  let removeAbortListener = () => {};
  const aborted = new Promise((_, reject) => {
    const onAbort = () => reject(signal.reason || timeoutError);
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation({ signal })),
      aborted,
    ]);
  } finally {
    removeAbortListener();
  }
};

export const assertExpectedRuntime = (
  snapshot,
  { expectedReleaseSha, expectedRuntimeInstanceId } = {},
) => {
  const lockedReleaseSha = expectedReleaseSha || snapshot?.runtimeReleaseSha;
  if (
    !SHA.test(lockedReleaseSha || "") ||
    typeof snapshot?.runtimeInstanceId !== "string" ||
    !snapshot.runtimeInstanceId ||
    snapshot.runtimeReleaseSha !== lockedReleaseSha ||
    (expectedRuntimeInstanceId && snapshot.runtimeInstanceId !== expectedRuntimeInstanceId)
  ) {
    const error = new Error("Staging metrics did not bind the expected runtime identity");
    error.code = "STAGING_AI_METRICS_INCONCLUSIVE";
    throw error;
  }
  return {
    runtimeInstanceId: snapshot.runtimeInstanceId,
    runtimeReleaseSha: snapshot.runtimeReleaseSha,
  };
};

export const runAfterRuntimePreflight = async ({
  fetchSnapshot,
  expectedReleaseSha,
  execute,
}) => {
  const runtime = assertExpectedRuntime(await fetchSnapshot(), {
    expectedReleaseSha,
  });
  return { runtime, result: await execute(runtime) };
};

export const waitForHealthyVectorFixture = async ({
  fetchSnapshot,
  search,
  fixtureId,
  queries,
  timeoutMs = 60_000,
  pollMs = 1_000,
  now = () => Date.now(),
  wait = abortableWait,
  expectedReleaseSha,
  expectedRuntimeInstanceId,
}) => {
  const timeout = positiveDuration(timeoutMs, 60_000);
  const interval = positiveDuration(pollMs, 1_000);
  const deadline = now() + timeout;
  const timeoutError = vectorReadinessTimeout();
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(timeoutError), timeout);
  let lockedReleaseSha = expectedReleaseSha;
  let lockedRuntimeInstanceId = expectedRuntimeInstanceId;

  const assertLockedRuntime = (snapshot) => {
    const runtime = assertExpectedRuntime(snapshot, {
      expectedReleaseSha: lockedReleaseSha,
      expectedRuntimeInstanceId: lockedRuntimeInstanceId,
    });
    lockedReleaseSha ||= runtime.runtimeReleaseSha;
    lockedRuntimeInstanceId ||= runtime.runtimeInstanceId;
  };
  const runStage = async (operation) => {
    if (now() >= deadline) throw timeoutError;
    const result = await runWithSignal(operation, deadlineController.signal, timeoutError);
    if (deadlineController.signal.aborted) {
      throw deadlineController.signal.reason || timeoutError;
    }
    if (now() >= deadline) throw timeoutError;
    return result;
  };

  try {
    while (now() < deadline) {
      const before = await runStage(({ signal }) => fetchSnapshot({ signal }));
      assertLockedRuntime(before);
      const responses = [];
      for (const query of queries) {
        responses.push(await runStage(({ signal }) => search(query, { signal })));
      }
      const after = await runStage(({ signal }) => fetchSnapshot({ signal }));
      assertLockedRuntime(after);
      const delta = metricDelta(before, after);
      let topologyHealthy = false;
      try {
        assertHealthyVectorTopology(delta);
        topologyHealthy = true;
      } catch (error) {
        if (error?.code !== "STAGING_AI_VECTOR_TOPOLOGY_BLOCKED") throw error;
      }

      if (
        topologyHealthy &&
        responses.every((response) => vectorFixturePresent(response, fixtureId))
      ) {
        if (now() >= deadline) throw timeoutError;
        return after;
      }

      const remaining = deadline - now();
      if (remaining <= 0) break;
      await runStage(({ signal }) => wait(Math.min(interval, remaining), { signal }));
    }
  } finally {
    clearTimeout(deadlineTimer);
  }

  throw timeoutError;
};
