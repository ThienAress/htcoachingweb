import assert from "node:assert/strict";
import test from "node:test";

import { validateSkillEvalCorpus } from "./skill-eval-contract.mjs";

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

test("validateSkillEvalCorpus rejects absolute local paths", () => {
  const input = structuredClone(validCorpus);
  input.cases[0].prompt = "Đọc file C:\\private\\skill.md rồi đánh giá nội dung workflow.";
  assert.throws(() => validateSkillEvalCorpus(input), /absolute path/i);
});

test("validateSkillEvalCorpus rejects secret-like content", () => {
  const input = structuredClone(validCorpus);
  input.cases[0].expectedEvidence = ["Dùng Bearer abcdefghijklmnop để gọi API."];
  assert.throws(() => validateSkillEvalCorpus(input), /secret-like/i);
});
