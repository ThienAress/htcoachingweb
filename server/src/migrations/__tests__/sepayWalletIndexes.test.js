import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import IncomingBankTransaction from "../../models/IncomingBankTransaction.js";
import ProviderSyncCursor from "../../models/ProviderSyncCursor.js";
import {
  applySePayWalletIndexes,
  getSePayWalletIndexContracts,
  inspectSePayWalletIndexes,
} from "../20260815-sepay-wallet-deposit-indexes.js";

describe("SePay wallet deposit index migration", () => {
  beforeAll(async () => {
    await setupTestDB();
    await Promise.all(
      [IncomingBankTransaction, ProviderSyncCursor].map((model) =>
        model.createCollection().catch((error) => {
          if (error?.codeName !== "NamespaceExists") throw error;
        }),
      ),
    );
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test("derives every required index from the model schemas", () => {
    expect(getSePayWalletIndexContracts().map(({ name }) => name).sort()).toEqual(
      [
        "incoming_cross_channel_fingerprint",
        "incoming_deposit_transaction_at",
        "incoming_status_created",
        "incoming_user_transaction_at",
        "provider_sync_cursor_lease_expiry",
        "uniq_incoming_provider_bank_reference",
        "uniq_incoming_provider_source_transaction",
        "uniq_provider_sync_cursor_account",
      ],
    );
  });

  test("creates missing indexes and is idempotent", async () => {
    await Promise.all(
      [IncomingBankTransaction, ProviderSyncCursor].map((model) =>
        model.collection.dropIndexes(),
      ),
    );
    const first = await inspectSePayWalletIndexes();
    const created = await applySePayWalletIndexes(first);
    const second = await inspectSePayWalletIndexes();
    const rerun = await applySePayWalletIndexes(second);

    expect({
      accountedFor:
        first.filter(({ status }) => status === "present").length +
        created.filter(({ status }) => status === "created").length,
      created: created.filter(({ status }) => status === "created").length,
      initiallyMissing: first.filter(({ status }) => status === "missing").length,
      present: second.filter(({ status }) => status === "present").length,
      unchanged: rerun.filter(({ status }) => status === "unchanged").length,
    }).toEqual({
      accountedFor: 8,
      created: first.filter(({ status }) => status === "missing").length,
      initiallyMissing: first.filter(({ status }) => status === "missing").length,
      present: 8,
      unchanged: 8,
    });
  });

  test("blocks apply when unique-key duplicates are reported", async () => {
    const [contract] = getSePayWalletIndexContracts();
    await expect(
      applySePayWalletIndexes([
        { contract, duplicateGroupCount: 1, status: "missing" },
      ]),
    ).rejects.toThrow("blocked by preflight findings");
  });

  test("keeps the ambiguous fingerprint lookup non-unique and blocks name conflicts", async () => {
    const contract = getSePayWalletIndexContracts().find(
      ({ name }) => name === "incoming_cross_channel_fingerprint",
    );
    expect({
      keys: contract.keys,
      unique: Boolean(contract.options.unique),
    }).toEqual({
      keys: {
        provider: 1,
        fingerprintDigest: 1,
        canonicalReferenceHash: 1,
        status: 1,
        source: 1,
      },
      unique: false,
    });
    await expect(
      applySePayWalletIndexes([
        { contract, duplicateGroupCount: 0, status: "name_conflict" },
      ]),
    ).rejects.toThrow("blocked by preflight findings");
  });
});
