import { describe, expect, it } from "vitest";
import { buildCompletedKbFailureProof, validateCompletedKbFailureProof } from "../stagingAiChatAcceptance.kbFailure.js";

import { proofInputs } from "./stagingKbFailure.fixture.js";
describe("operator-attested completed read-only KB failure proof", () => {
  it("binds the one registered failure without certifying the failed acceptance", () => {
    const inputs = proofInputs();
    const proof = buildCompletedKbFailureProof(inputs);
    expect(validateCompletedKbFailureProof(proof, inputs.intent)).toMatchObject({
      proofMethod: "operator_attested_render_completed_readonly_kb",
      jti: "2e4b64d0-bc8a-4bc8-8f31-91d5c7eb54ca",
      capabilityRequestId: "09cd2948-8c7f-421c-841b-758b93990eb6",
      httpRequestId: "9d43dd56-557f-4eb1-98c0-426f77730cd0", verified: true,
    });
  });

  it.each(["paginated", "overlapping", "malformed", "duplicate", "wrong-provider", "wrong-status"])
    ("rejects %s logs", (kind) => {
      const inputs = proofInputs();
      if (kind === "paginated") inputs.logs.hasMore = true;
      if (kind === "malformed") inputs.logs.logs[0].message = "not JSON";
      if (kind === "duplicate") inputs.logs.logs.push(inputs.logs.logs[0]);
      if (kind === "overlapping") {
        const other = structuredClone(inputs.logs.logs[0]);
        other.id = "overlapping-http";
        const message = JSON.parse(other.message);
        message.requestId = "818d958f-64d1-4df0-a22b-d0eab5b8d1e9";
        other.message = JSON.stringify(message);
        inputs.logs.logs.push(other);
      }
      if (kind === "wrong-provider") {
        const message = JSON.parse(inputs.logs.logs[1].message);
        message.success = true;
        inputs.logs.logs[1].message = JSON.stringify(message);
      }
      if (kind === "wrong-status") {
        const message = JSON.parse(inputs.logs.logs[0].message);
        message.status = 200;
        inputs.logs.logs[0].message = JSON.stringify(message);
      }
      expect(() => buildCompletedKbFailureProof(inputs)).toThrow();
    });

  it.each(["runId", "jti", "actorId", "capabilityRequestId", "httpRequestId", "releaseSha"])
    ("rejects another %s or a proof with extra fields", (field) => {
      const inputs = proofInputs();
      const proof = buildCompletedKbFailureProof(inputs);
      expect(() => validateCompletedKbFailureProof({ ...proof, [field]: "different" }, inputs.intent)).toThrow();
      expect(() => validateCompletedKbFailureProof({ ...proof, rawPrompt: "forbidden" }, inputs.intent)).toThrow();
    });
});
