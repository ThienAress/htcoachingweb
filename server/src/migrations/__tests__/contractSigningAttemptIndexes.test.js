import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import ContractSigningAttempt from "../../models/ContractSigningAttempt.js";
import {
  applyContractSigningAttemptIndexes,
  authorizeContractSigningAttemptIndexTarget,
  getContractSigningAttemptIndexContracts,
  inspectContractSigningAttemptIndexes,
} from "../20260918-contract-signing-attempt-indexes.js";

describe("Contract signing-attempt index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await ContractSigningAttempt.createCollection().catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    });
    await ContractSigningAttempt.init();
  });

  afterAll(teardownTestDB);

  test("derives the complete non-TTL journal index contract from the model", () => {
    expect(
      getContractSigningAttemptIndexContracts().map(({ name, options }) => ({
        name,
        ttl: options.expireAfterSeconds ?? null,
      })),
    ).toEqual([
      { name: "uniq_contract_signing_candidate", ttl: null },
      { name: "contract_signing_recovery_claim", ttl: null },
      { name: "contract_signing_history", ttl: null },
    ]);
  });

  test("creates missing indexes and remains idempotent", async () => {
    await ContractSigningAttempt.collection.deleteMany({});
    await ContractSigningAttempt.collection.dropIndexes();

    const first = await inspectContractSigningAttemptIndexes();
    const created = await applyContractSigningAttemptIndexes(first);
    const second = await inspectContractSigningAttemptIndexes();
    const rerun = await applyContractSigningAttemptIndexes(second);

    expect(created.filter(({ status }) => status === "created")).toHaveLength(3);
    expect(second.every(({ status }) => status === "present")).toBe(true);
    expect(rerun.filter(({ status }) => status === "unchanged")).toHaveLength(3);
  });

  test("blocks apply when candidate bindings are duplicated", async () => {
    await ContractSigningAttempt.collection.deleteMany({});
    await ContractSigningAttempt.collection.dropIndexes();
    const candidateFileId = new mongoose.Types.ObjectId();
    const now = new Date();
    const base = {
      contractId: new mongoose.Types.ObjectId(),
      candidateFileId,
      phase: "aborted",
      leaseUntil: now,
      leaseToken: "00000000-0000-4000-8000-000000000000",
      nextRecoveryAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await ContractSigningAttempt.collection.insertMany([
      base,
      { ...base, contractId: new mongoose.Types.ObjectId() },
    ]);

    const reports = await inspectContractSigningAttemptIndexes();
    const candidate = reports.find(
      ({ contract }) => contract.name === "uniq_contract_signing_candidate",
    );

    expect(candidate.duplicateGroupCount).toBe(1);
    await expect(applyContractSigningAttemptIndexes(reports)).rejects.toThrow(
      "blocked by preflight findings",
    );
  });

  test("requires a locked target and explicit apply confirmation", () => {
    const env = {
      APP_ENV: "staging",
      MONGO_URI: "mongodb://127.0.0.1:27017/htcoaching_staging",
      MIGRATION_TARGET_DATABASE: "htcoaching_staging",
      CONFIRM_CONTRACT_SIGNING_ATTEMPT_INDEX_MIGRATION: "yes",
    };

    expect(() =>
      authorizeContractSigningAttemptIndexTarget({
        args: new Set(["--target=staging", "--apply"]),
        apply: true,
        env,
      }),
    ).toThrow("Apply requires --confirm-contract-signing-attempt-indexes");

    expect(
      authorizeContractSigningAttemptIndexTarget({
        args: new Set([
          "--target=staging",
          "--apply",
          "--confirm-contract-signing-attempt-indexes",
        ]),
        apply: true,
        env,
      }),
    ).toMatchObject({ valid: true, targetDatabase: "htcoaching_staging" });
  });
});
