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
      accountedFor: 7,
      created: first.filter(({ status }) => status === "missing").length,
      initiallyMissing: first.filter(({ status }) => status === "missing").length,
      present: 7,
      unchanged: 7,
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
});
