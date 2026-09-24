import { describe, expect, it } from "vitest";

import {
  buildScopePreservationFallback,
  parseScopePreservationRequest,
  validateScopePreservationOutput,
} from "../scopePreservation.js";

const scopedRequest =
  "Giữ nguyên toàn bộ kế hoạch vừa rồi nhưng đổi mức thâm hụt từ 300 kcal thành 700 kcal. Giải thích phần nào đã thay đổi.";

describe("AI scope preservation guard", () => {
  it("parses the explicit deficit-only transition", () => {
    expect(parseScopePreservationRequest(scopedRequest)).toEqual({
      applies: true,
      previousDeficit: 300,
      nextDeficit: 700,
    });
  });

  it("does not apply when the user did not lock the rest of the plan", () => {
    expect(
      parseScopePreservationRequest("Hãy đổi mức thâm hụt thành 700 kcal."),
    ).toMatchObject({ applies: false });
  });

  it("parses a locked plan when the only allowed change is training frequency", () => {
    expect(
      parseScopePreservationRequest(
        "Giữ nguyên toàn bộ kế hoạch vừa rồi, chỉ đổi số buổi tập từ 4 thành 3.",
      ),
    ).toMatchObject({
      applies: true,
      previousDeficit: null,
      nextDeficit: null,
      change: {
        id: "training_sessions",
        label: "số buổi tập",
        previousValue: "4",
        nextValue: "3",
      },
    });
  });

  it("parses decrease wording for the same locked training-frequency change", () => {
    expect(
      parseScopePreservationRequest(
        "Giữ nguyên toàn bộ kế hoạch vừa rồi, chỉ giảm số buổi tập từ 4 xuống 3.",
      ),
    ).toMatchObject({
      applies: true,
      change: {
        id: "training_sessions",
        previousValue: "4",
        nextValue: "3",
      },
    });
  });

  it("parses a locked exercise replacement with text values", () => {
    expect(
      parseScopePreservationRequest(
        "Giữ nguyên mọi thứ, chỉ thay bài Dumbbell Press thành Push-up.",
      ),
    ).toMatchObject({
      applies: true,
      change: {
        id: "workout_exercise",
        label: "bài tập",
        previousValue: "dumbbell press",
        nextValue: "push-up",
      },
    });
  });

  it.each([
    "Không cần giữ nguyên toàn bộ kế hoạch, hãy đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
    "Đừng giữ nguyên lịch tập; đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
    "Không phải giữ nguyên toàn bộ kế hoạch; đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
    "Không phải là giữ nguyên toàn bộ kế hoạch; đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
    "Không nhất thiết giữ nguyên lịch tập khi đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
    "Không nhất thiết phải giữ nguyên lịch tập khi đổi mức thâm hụt từ 300 kcal thành 700 kcal.",
  ])("does not treat a negated preservation request as a locked scope: %s", (message) => {
    expect(parseScopePreservationRequest(message)).toMatchObject({
      applies: false,
    });
  });

  it("rejects an answer that changes the workout without permission", () => {
    const request = parseScopePreservationRequest(scopedRequest);

    expect(
      validateScopePreservationOutput(
        request,
        "Đã đổi sang 700 kcal và giảm lịch tập từ 4 buổi xuống 3 buổi.",
      ),
    ).toMatchObject({
      applies: true,
      valid: false,
      reasonCodes: expect.arrayContaining(["unauthorized_plan_change"]),
    });
  });

  it("accepts the bounded fallback with advisory kept outside the requested change", () => {
    const request = parseScopePreservationRequest(scopedRequest);
    const fallback = buildScopePreservationFallback(request);

    expect(validateScopePreservationOutput(request, fallback)).toMatchObject({
      applies: true,
      valid: true,
      reasonCodes: [],
    });
  });

  it("accepts the natural verb-first wording without forcing another provider retry", () => {
    const request = parseScopePreservationRequest(scopedRequest);

    expect(
      validateScopePreservationOutput(
        request,
        "Mình chỉ đổi mức thâm hụt sang 700 kcal; lịch tập không thay đổi.",
      ),
    ).toMatchObject({ valid: true, reasonCodes: [] });
  });

  it("rejects changes outside a generic locked-scope request", () => {
    const request = parseScopePreservationRequest(
      "Giữ nguyên toàn bộ kế hoạch vừa rồi, chỉ đổi số buổi tập từ 4 thành 3.",
    );

    expect(
      validateScopePreservationOutput(
        request,
        "Chỉ số buổi tập thay đổi từ 4 thành 3; mọi phần khác giữ nguyên, nhưng giảm protein 20g.",
      ),
    ).toMatchObject({
      applies: true,
      valid: false,
      reasonCodes: expect.arrayContaining(["unauthorized_plan_change"]),
    });
  });

  it.each([
    "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi. Lịch tập giữ nguyên, nhưng giảm thực đơn từ 4 bữa xuống 3 bữa.",
    "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi; lịch tập giữ nguyên nhưng tăng cardio thêm 2 buổi.",
    "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi; lịch tập giữ nguyên nhưng số bữa giảm từ 4 xuống 3.",
    "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi; lịch tập giữ nguyên nhưng protein giảm 20g.",
  ])("rejects another mutation hidden beside an unchanged clause: %s", (answer) => {
    const request = parseScopePreservationRequest(scopedRequest);

    expect(validateScopePreservationOutput(request, answer)).toMatchObject({
      valid: false,
      reasonCodes: expect.arrayContaining(["unauthorized_plan_change"]),
    });
  });
});
