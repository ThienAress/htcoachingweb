import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  googleCredentialsFromEnv,
} from "../seoAnalyticsProvider.js";

const credentialFixture = JSON.stringify({
  type: "service_account",
  client_email: "analytics-reader@example.invalid",
  private_key: "test-key-line-one\\ntest-key-line-two\\n",
});

describe("googleCredentialsFromEnv", () => {
  it("loads credentials from GOOGLE_APPLICATION_CREDENTIALS file path", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "google-credentials-"));
    const credentialPath = path.join(directory, "service-account.json");
    fs.writeFileSync(credentialPath, credentialFixture, "utf8");

    try {
      expect(
        googleCredentialsFromEnv({
          GOOGLE_APPLICATION_CREDENTIALS: credentialPath,
        }),
      ).toEqual({
        client_email: "analytics-reader@example.invalid",
        private_key: "test-key-line-one\ntest-key-line-two\n",
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps inline GOOGLE_SERVICE_ACCOUNT_JSON compatible", () => {
    expect(
      googleCredentialsFromEnv({
        GOOGLE_SERVICE_ACCOUNT_JSON: credentialFixture,
      }),
    ).toEqual({
      client_email: "analytics-reader@example.invalid",
      private_key: "test-key-line-one\ntest-key-line-two\n",
    });
  });
});
