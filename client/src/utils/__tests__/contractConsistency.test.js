import { describe, expect, it } from "vitest";

import {
  buildSavedDraftSendCommand,
  getInitialDraftRevision,
  isContractRevisionConflict,
  shouldRefetchSigningOutcome,
} from "../contractConsistency";

describe("contract consistency helpers", () => {
  it("treats only a missing legacy revision as revision zero", () => {
    expect({
      legacy: getInitialDraftRevision({ _id: "legacy" }),
      current: getInitialDraftRevision({ _id: "current", revision: 4 }),
      nullRevision: () => getInitialDraftRevision({ revision: null }),
    }).toMatchObject({
      legacy: 0,
      current: 4,
      nullRevision: expect.any(Function),
    });
    expect(() => getInitialDraftRevision({ revision: null })).toThrow(
      "revision",
    );
  });

  it("builds the send command from the saved response revision", () => {
    expect(
      buildSavedDraftSendCommand("contract-1", {
        data: { data: { _id: "contract-1", revision: 8 } },
      }),
    ).toEqual({ id: "contract-1", expectedRevision: 8 });
  });

  it("fails closed when the save response has no usable revision", () => {
    expect(() =>
      buildSavedDraftSendCommand("contract-1", {
        data: { data: { _id: "contract-1" } },
      }),
    ).toThrow("revision");
  });

  it("recognizes only the typed contract revision conflict", () => {
    expect(
      isContractRevisionConflict({
        response: {
          status: 409,
          data: { errorCode: "CONTRACT_REVISION_CONFLICT" },
        },
      }),
    ).toBe(true);
    expect(
      isContractRevisionConflict({
        response: { status: 409, data: { errorCode: "ANOTHER_CONFLICT" } },
      }),
    ).toBe(false);
  });

  it("refetches pending and unknown signing outcomes", () => {
    const codes = [
      "CONTRACT_SIGNING_CONFLICT",
      "CONTRACT_SIGNING_IN_PROGRESS",
      "CONTRACT_SIGNING_OUTCOME_UNKNOWN",
      "CONTRACT_SIGNING",
    ];

    expect(
      codes.map((errorCode) =>
        shouldRefetchSigningOutcome({ response: { data: { errorCode } } }),
      ),
    ).toEqual([true, true, true, true]);
  });
});
