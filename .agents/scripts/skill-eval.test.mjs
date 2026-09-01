import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  validateSkillEvalCorpus,
  validateSkillEvalDirectory,
} from "./skill-eval-contract.mjs";

const evalRoot = path.resolve(import.meta.dirname, "../evals/skills");
const skillsRoot = path.resolve(import.meta.dirname, "../skills");

const withEvalDirectory = (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ht-skill-eval-"));
  const target = path.join(root, "skills");
  fs.cpSync(evalRoot, target, { recursive: true });
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return target;
};

const validCorpus = {
  schemaVersion: 1,
  skill: "skill-radar",
  cases: [
    {
      id: "scan-upstream",
      kind: "should_trigger",
      prompt: "Quét upstream skill và báo thay đổi cần thích nghi cho project.",
      expectedEvidence: ["Đọc watchlist và tạo decision có provenance."],
    },
    {
      id: "review-candidate",
      kind: "should_trigger",
      prompt: "Đánh giá repository skill mới trước khi thêm vào watchlist.",
      expectedEvidence: ["Kiểm tra source, license và local overlap."],
    },
    {
      id: "local-skill-drift",
      kind: "should_not_trigger",
      prompt: "Skill debugging local có còn khớp codebase hiện tại không?",
      expectedEvidence: ["Định tuyến sang goad vì đây là internal drift."],
    },
    {
      id: "install-known-skill",
      kind: "should_not_trigger",
      prompt: "Cài skill đã được tôi chọn từ repository này.",
      expectedEvidence: ["Không chạy Radar cho yêu cầu cài đặt đã xác định."],
    },
  ],
};

test("validateSkillEvalCorpus accepts balanced trigger coverage", () => {
  const result = validateSkillEvalCorpus(validCorpus, {
    knownSkills: new Set(["skill-radar"]),
    fileName: "skill-radar.json",
  });
  assert.equal(result.cases.length, 4);
});

test("validateSkillEvalCorpus rejects duplicate case ids", () => {
  const input = structuredClone(validCorpus);
  input.cases[1].id = input.cases[0].id;
  assert.throws(() => validateSkillEvalCorpus(input), /duplicate case id/i);
});

test("validateSkillEvalCorpus rejects unknown top-level fields", () => {
  const input = structuredClone(validCorpus);
  input.description = "Unexpected corpus metadata";

  assert.throws(() => validateSkillEvalCorpus(input), /unsupported field/i);
});

test("validateSkillEvalCorpus rejects unknown case fields", () => {
  const input = structuredClone(validCorpus);
  input.cases[0].notes = "Unexpected case metadata";

  assert.throws(() => validateSkillEvalCorpus(input), /unsupported field/i);
});

test("validateSkillEvalCorpus requires positive and negative trigger cases", () => {
  const input = structuredClone(validCorpus);
  input.cases[2].kind = "should_trigger";
  assert.throws(() => validateSkillEvalCorpus(input), /two should_not_trigger/i);
});

test("validateSkillEvalCorpus rejects unknown skills and filename drift", () => {
  assert.throws(
    () => validateSkillEvalCorpus(validCorpus, { knownSkills: new Set(["qa"]) }),
    /unknown target skill/i,
  );
  assert.throws(
    () => validateSkillEvalCorpus(validCorpus, { fileName: "radar.json" }),
    /filename must match skill/i,
  );
});

test("validateSkillEvalCorpus rejects sensitive or non-canonical filenames without echoing them", () => {
  const filenames = [
    "private.owner@gmail.com.json",
    `${["ghp", "A".repeat(30)].join("_")}.json`,
    "safe\u202e.json",
  ];
  for (const fileName of filenames) {
    assert.throws(
      () => validateSkillEvalCorpus(validCorpus, { fileName }),
      (error) => !error.message.includes(fileName)
        && /filename|personal data|secret-like/i.test(error.message),
    );
  }
});

test("validateSkillEvalCorpus rejects absolute local paths", () => {
  const absolutePaths = [
    "C:\\private\\skill.md",
    "/etc/passwd",
    "/var/lib/private-state",
    "/opt/private/tool",
  ];

  for (const absolutePath of absolutePaths) {
    const input = structuredClone(validCorpus);
    input.cases[0].prompt = `Đọc file ${absolutePath} rồi đánh giá nội dung workflow.`;
    assert.throws(() => validateSkillEvalCorpus(input), /absolute path/i);
  }
});

test("validateSkillEvalCorpus allows an HTTPS URL containing a path-like suffix", () => {
  const input = structuredClone(validCorpus);
  input.cases[0].prompt =
    "Đánh giá tài liệu công khai tại https://example.com/etc/passwd theo đúng workflow.";

  assert.doesNotThrow(() => validateSkillEvalCorpus(input));
});

test("validateSkillEvalCorpus rejects secret-like content", () => {
  const input = structuredClone(validCorpus);
  const credential = ["qrst", "uvwx", "yzab", "cdef"].join("");
  input.cases[0].expectedEvidence = [`Dùng Bearer ${credential} để gọi API.`];
  assert.throws(() => validateSkillEvalCorpus(input), /secret-like/i);
});

test("validateSkillEvalCorpus rejects project keys and opaque hex tokens", () => {
  const sensitiveValues = [
    ["sk", "proj", "12345678901234567890"].join("-"),
    ["sk", "proj", "12345678901234567890"].join("－"),
    ["sk", "proj", "12345678901234567890"].join("\u00ad-"),
    ["AKIA", "A".repeat(16)].join(""),
    ["AIza", "A".repeat(35)].join(""),
    ["re", "A".repeat(24)].join("_"),
    ["rk", "test", "A".repeat(20)].join("_"),
    ["GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop"].join("="),
    "d".repeat(64),
  ];

  for (const sensitive of sensitiveValues) {
    const input = structuredClone(validCorpus);
    input.cases[0].expectedEvidence = [`Opaque credential ${sensitive}`];
    assert.throws(() => validateSkillEvalCorpus(input), /secret-like/i);
  }
});

test("validateSkillEvalCorpus rejects personal email and phone data", () => {
  const withEmail = structuredClone(validCorpus);
  withEmail.cases[0].prompt =
    "Đánh giá workflow và gửi kết quả tới private.owner@gmail.com sau khi chạy.";
  assert.throws(() => validateSkillEvalCorpus(withEmail), /personal data/i);

  const withPhone = structuredClone(validCorpus);
  withPhone.cases[0].expectedEvidence = ["Liên hệ số +84 912 345 678 để xác nhận."];
  assert.throws(() => validateSkillEvalCorpus(withPhone), /personal data/i);
});

test("validateSkillEvalCorpus privacy-scans every allowed string field", () => {
  const phone = "0912345678";
  const mutations = [
    (input) => { input.skill = `skill-${phone}`; },
    (input) => { input.cases[0].id = `case-${phone}`; },
    (input) => { input.cases[0].kind = `should_trigger-${phone}`; },
    (input) => { input.cases[0].prompt = `Liên hệ ${phone} để chạy workflow này.`; },
    (input) => { input.cases[0].expectedEvidence = [`Liên hệ ${phone} để xác minh.`]; },
  ];
  const rejectedAsPersonalData = mutations.map((mutate) => {
    const input = structuredClone(validCorpus);
    mutate(input);
    try {
      validateSkillEvalCorpus(input);
      return false;
    } catch (error) {
      return /personal data/i.test(error.message);
    }
  });

  assert.deepEqual(rejectedAsPersonalData, Array(mutations.length).fill(true));
});

test("validateSkillEvalDirectory rejects deletion of a required baseline corpus", (context) => {
  const rootDir = withEvalDirectory(context);
  fs.rmSync(path.join(rootDir, "qa.json"));

  assert.throws(
    () => validateSkillEvalDirectory({ rootDir, skillsRoot }),
    /required baseline corpus qa is missing/i,
  );
});

test("validateSkillEvalDirectory rejects reducing a required corpus below its floor", (context) => {
  const rootDir = withEvalDirectory(context);
  const corpusPath = path.join(rootDir, "code-review.json");
  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  corpus.cases = [
    corpus.cases[0],
    corpus.cases[1],
    corpus.cases[3],
    corpus.cases[4],
  ];
  fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  assert.throws(
    () => validateSkillEvalDirectory({ rootDir, skillsRoot }),
    /required baseline corpus code-review requires at least 6 scenarios/i,
  );
});

for (const unsafeName of [
  "private.owner@gmail.com.json",
  `${["ghp", "A".repeat(30)].join("_")}.json`,
  "safe\u202e.json",
]) {
  test("validateSkillEvalDirectory rejects an unsafe corpus filename without leaking it", (context) => {
    const rootDir = withEvalDirectory(context);
    fs.writeFileSync(
      path.join(rootDir, unsafeName),
      `${JSON.stringify(validCorpus, null, 2)}\n`,
      "utf8",
    );

    assert.throws(
      () => validateSkillEvalDirectory({ rootDir, skillsRoot }),
      (error) => !error.message.includes(unsafeName)
        && /filename|personal data|secret-like/i.test(error.message),
    );
  });
}
