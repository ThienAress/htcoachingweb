import { sanitizeAssistantOutput } from "../assistantOutput.js";
import { getAiPromptContractMetadata } from "../promptContract.js";
import { AI_RUNTIME_POLICY } from "../runtimePolicy.js";
import {
  buildKnowledgeReferenceBlock,
  buildPersonalMemoryBlock,
  buildSystemPrompt,
} from "../systemPrompt.js";
import {
  getToolSchemas,
  toolRegistry,
} from "../tools/toolRegistry.js";
import { serializeToolResultForModel } from "../tools/toolResultBoundary.js";

const SCHEMA_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,99}$/;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asStringArray = (value, field) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
};

const compareText = (text, expected) => {
  const failures = [];
  for (const value of asStringArray(expected.contains, "expected.contains")) {
    if (!text.includes(value)) failures.push(`missing required text: ${value}`);
  }
  for (const value of asStringArray(expected.excludes, "expected.excludes")) {
    if (text.includes(value)) failures.push(`contained forbidden text: ${value}`);
  }
  if (
    expected.maxCharacters !== undefined &&
    (!Number.isInteger(expected.maxCharacters) || expected.maxCharacters < 1)
  ) {
    throw new Error("expected.maxCharacters must be a positive integer");
  }
  if (expected.maxCharacters && text.length > expected.maxCharacters) {
    failures.push(
      `text length ${text.length} exceeded ${expected.maxCharacters} characters`,
    );
  }
  return failures;
};

const valueAtPath = (source, path) =>
  path.split(".").reduce((value, key) => value?.[key], source);

const comparePathEquals = (source, expected = {}) => {
  if (!isPlainObject(expected)) {
    throw new Error("expected.pathEquals must be an object");
  }
  const failures = [];
  for (const [path, value] of Object.entries(expected)) {
    const actual = valueAtPath(source, path);
    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      failures.push(
        `path ${path} expected ${JSON.stringify(value)}, received ${JSON.stringify(actual)}`,
      );
    }
  }
  return failures;
};

const textEvaluator = (render) => ({ input, expected }) =>
  compareText(String(render(input) || ""), expected);

const evaluators = {
  system_prompt_contract: textEvaluator((input) =>
    buildSystemPrompt(input.context || {}),
  ),
  knowledge_reference_contract: textEvaluator((input) =>
    buildKnowledgeReferenceBlock(input.results),
  ),
  personal_memory_contract: textEvaluator((input) =>
    buildPersonalMemoryBlock(input.entries),
  ),
  guest_tool_contract: ({ input, expected }) => {
    const tools = getToolSchemas({
      isAuthenticated: input.isAuthenticated === true,
    });
    const names = tools.map((tool) => tool.function.name);
    const failures = [];
    for (const name of asStringArray(expected.includes, "expected.includes")) {
      if (!names.includes(name)) failures.push(`missing tool: ${name}`);
    }
    for (const name of asStringArray(expected.excludes, "expected.excludes")) {
      if (names.includes(name)) failures.push(`forbidden tool exposed: ${name}`);
    }
    if (expected.count !== undefined && names.length !== expected.count) {
      failures.push(`expected ${expected.count} tools, received ${names.length}`);
    }
    if (expected.maxCount !== undefined && names.length > expected.maxCount) {
      failures.push(`tool count ${names.length} exceeded ${expected.maxCount}`);
    }
    return failures;
  },
  tool_schema_contract: ({ input, expected }) => {
    const tool = toolRegistry[input.toolName];
    if (!tool) return [`tool not found: ${input.toolName}`];
    return comparePathEquals(tool, expected.pathEquals);
  },
  runtime_limits_contract: ({ expected }) =>
    comparePathEquals(AI_RUNTIME_POLICY, expected.pathEquals),
  tool_result_contract: ({ input, expected }) => {
    const envelope = JSON.parse(
      serializeToolResultForModel({
        toolName: input.toolName,
        text: input.text,
        status: input.status,
      }),
    );
    return [
      ...comparePathEquals(envelope, expected.pathEquals),
      ...compareText(envelope.data.text, expected.text || {}),
    ];
  },
  assistant_output_contract: ({ input, expected }) => {
    const result = sanitizeAssistantOutput(input.text);
    return [
      ...comparePathEquals(result, expected.pathEquals),
      ...compareText(result.content, expected.text || {}),
    ];
  },
};

export const AI_EVAL_EVALUATORS = Object.freeze(Object.keys(evaluators));

export function validateAiEvalCorpus(corpus) {
  if (!isPlainObject(corpus)) throw new Error("AI eval corpus must be an object");
  if (corpus.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported AI eval schemaVersion: ${corpus.schemaVersion}`);
  }
  if (
    typeof corpus.corpusVersion !== "string" ||
    corpus.corpusVersion.length < 3 ||
    corpus.corpusVersion.length > 80
  ) {
    throw new Error("AI eval corpusVersion is invalid");
  }
  if (!Array.isArray(corpus.scenarios) || corpus.scenarios.length === 0) {
    throw new Error("AI eval corpus must contain scenarios");
  }

  const ids = new Set();
  for (const scenario of corpus.scenarios) {
    if (!isPlainObject(scenario) || !ID_PATTERN.test(scenario.id || "")) {
      throw new Error("AI eval scenario id is invalid");
    }
    if (ids.has(scenario.id)) {
      throw new Error(`Duplicate scenario id: ${scenario.id}`);
    }
    ids.add(scenario.id);
    if (!Object.hasOwn(evaluators, scenario.evaluator)) {
      throw new Error(`Unknown evaluator: ${scenario.evaluator}`);
    }
    if (!isPlainObject(scenario.input)) {
      throw new Error(`Scenario ${scenario.id} input must be an object`);
    }
    if (
      !isPlainObject(scenario.expected) ||
      Object.keys(scenario.expected).length === 0
    ) {
      throw new Error(`Scenario ${scenario.id} is missing expected contract`);
    }
  }
  return corpus;
}

export async function evaluateAiCorpus(corpus) {
  validateAiEvalCorpus(corpus);
  const results = [];

  for (const scenario of corpus.scenarios) {
    try {
      const failures = await evaluators[scenario.evaluator](scenario);
      results.push({
        id: scenario.id,
        evaluator: scenario.evaluator,
        passed: failures.length === 0,
        failures,
      });
    } catch (error) {
      results.push({
        id: scenario.id,
        evaluator: scenario.evaluator,
        passed: false,
        failures: [`evaluator error: ${error.message}`],
      });
    }
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    schemaVersion: SCHEMA_VERSION,
    corpusVersion: corpus.corpusVersion,
    promptContract: getAiPromptContractMetadata(),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
