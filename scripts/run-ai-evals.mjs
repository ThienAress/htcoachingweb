import { readFile } from "node:fs/promises";

import { evaluateAiCorpus } from "../server/src/services/ai/evals/aiEvalRunner.js";

const corpusUrl = new URL(
  "../server/src/services/ai/evals/corpus/ai-eval-corpus.v1.json",
  import.meta.url,
);

try {
  const corpus = JSON.parse(await readFile(corpusUrl, "utf8"));
  const report = await evaluateAiCorpus(corpus);

  console.log(
    `AI eval ${report.corpusVersion}: ${report.passed}/${report.total} passed`,
  );
  for (const result of report.results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.id}`);
    for (const failure of result.failures) console.log(`  - ${failure}`);
  }
  process.exitCode = report.failed === 0 ? 0 : 1;
} catch (error) {
  console.error(`AI eval gate failed closed: ${error.message}`);
  process.exitCode = 1;
}
