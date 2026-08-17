import { executeTool } from "./toolEngine.js";
import { toolRegistry } from "./toolRegistry.js";

export const TOOL_EXECUTION_MODES = Object.freeze({
  PARALLEL: "parallel",
  SEQUENTIAL: "sequential",
});

export const resolveToolExecutionMode = (
  calls,
  { registry = toolRegistry } = {},
) => {
  if (!Array.isArray(calls) || calls.length < 2) {
    return TOOL_EXECUTION_MODES.SEQUENTIAL;
  }
  const parallelSafe = calls.every((call) => {
    const tool = registry[call?.name];
    return (
      tool?.readOnly === true &&
      tool?.parallelSafe === true &&
      tool?.requiresConfirmation !== true
    );
  });
  return parallelSafe
    ? TOOL_EXECUTION_MODES.PARALLEL
    : TOOL_EXECUTION_MODES.SEQUENTIAL;
};

export async function executeToolBatch(
  calls,
  context,
  { registry = toolRegistry, executor = executeTool, onStart = () => {} } = {},
) {
  const boundedCalls = Array.isArray(calls) ? calls : [];
  const run = async (call) => {
    if (context?.signal?.aborted) {
      throw context.signal.reason || new Error("Tool batch aborted");
    }
    await onStart(call);
    const startedAt = Date.now();
    const result = await executor(call.name, call.args, context);
    return {
      call,
      result,
      durationMs: Date.now() - startedAt,
    };
  };

  if (
    resolveToolExecutionMode(boundedCalls, { registry }) ===
    TOOL_EXECUTION_MODES.PARALLEL
  ) {
    return Promise.all(boundedCalls.map(run));
  }

  const results = [];
  for (const call of boundedCalls) results.push(await run(call));
  return results;
}
