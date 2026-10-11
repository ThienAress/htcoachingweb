const SIGNING_RECONCILIATION_CODES = new Set([
  "CONTRACT_SIGNING_CONFLICT",
  "CONTRACT_SIGNING_IN_PROGRESS",
  "CONTRACT_SIGNING_OUTCOME_UNKNOWN",
  // Backward-compatible with the pre-hardening in-progress response.
  "CONTRACT_SIGNING",
]);

const requireRevision = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Contract revision is missing or invalid");
  }
  return value;
};

export const getInitialDraftRevision = (contract) => {
  if (
    contract &&
    (!Object.prototype.hasOwnProperty.call(contract, "revision") ||
      contract.revision === undefined)
  ) {
    return 0;
  }
  return requireRevision(contract?.revision);
};

export const getSavedDraftRevision = (response) =>
  requireRevision(response?.data?.data?.revision);

export const buildSavedDraftSendCommand = (id, response) => ({
  id,
  expectedRevision: getSavedDraftRevision(response),
});

export const isContractRevisionConflict = (error) =>
  error?.response?.status === 409 &&
  error?.response?.data?.errorCode === "CONTRACT_REVISION_CONFLICT";

export const shouldRefetchSigningOutcome = (error) =>
  SIGNING_RECONCILIATION_CODES.has(error?.response?.data?.errorCode);
