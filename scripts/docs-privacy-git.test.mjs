import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectScanTargets,
  findPrivacyTypes,
  formatFinding,
  MAX_DOCUMENT_COUNT,
  scanDocuments,
} from "./lib/docs-privacy.mjs";
import {
  decodeSensitiveTextBytes,
  findCanonicalSecretTypes,
  hasSecretLikeText,
} from "./lib/sensitive-text.mjs";

const withFixtureDirectory = async (run) => {
  const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "docs-privacy-git-"));
  try {
    await run(fixtureDirectory);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
};

const credentialAssignment = (
  name,
  value,
  { quote = "", separator = "=" } = {},
) => `${name}${separator}${quote}${value}${quote}`;
const bearerCredential = (value) => ["Bearer", value].join(" ");

test("default discovery includes untracked candidate documents in governed directories", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(path.join(handoffDirectory, "candidate.md"), "No private data.\n");

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });

    assert.deepEqual(
      targets.map((target) => target.displayPath),
      ["docs/handoffs/candidate.md"],
    );
  });
});

test("privacy scan fails closed before reading an excessive target count", async () => {
  const targets = Array.from({ length: MAX_DOCUMENT_COUNT + 1 }, (_, index) => ({
    source: "working-tree",
    absolutePath: `unused-${index}.md`,
    displayPath: `unused-${index}.md`,
  }));

  await assert.rejects(
    () => scanDocuments(targets),
    /target count exceeds the scan limit/i,
  );
});

test("repository containment accepts a canonical filename starting with two dots", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    await writeFile(
      path.join(fixtureDirectory, "..candidate.md"),
      "Owner: synthetic.owner@privacy.invalid\n",
    );

    const discovered = await collectScanTargets({
      repositoryRoot: fixtureDirectory,
      trackedPaths: ["."],
    });
    const explicit = await collectScanTargets({
      repositoryRoot: fixtureDirectory,
      inputs: ["..candidate.md"],
    });
    const findings = await scanDocuments(discovered);

    assert.deepEqual(
      {
        discovered: discovered.map(({ displayPath }) => displayPath),
        explicit: explicit.map(({ displayPath }) => displayPath),
        findings,
      },
      {
        discovered: ["..candidate.md"],
        explicit: ["..candidate.md"],
        findings: [{ file: "..candidate.md", line: 1, type: "personal-email" }],
      },
    );
  });
});

test("default discovery scans machine-readable plan JSON candidates", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const traceDirectory = path.join(
      fixtureDirectory,
      "docs",
      "plans",
      "traceability",
    );
    await mkdir(traceDirectory, { recursive: true });
    await writeFile(
      path.join(traceDirectory, "079.json"),
      `${JSON.stringify({ owner: "synthetic.owner@privacy.invalid" })}\n`,
    );

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);

    assert.deepEqual(findings, [
      {
        file: "docs/plans/traceability/079.json",
        line: 1,
        type: "personal-email",
      },
    ]);
  });
});

test("classification normalizes NFKC and slash-like separators", () => {
  const values = [
    "synthetic.owner＠privacy.invalid",
    String.raw`Ｃ：＼Ｕｓｅｒｓ＼synthetic-user＼project`,
    "/ｍｎｔ⁄ｃ⁄Ｕｓｅｒｓ⁄synthetic-user⁄project",
  ];

  assert.deepEqual(values.map(findPrivacyTypes), [
    ["personal-email"],
    ["absolute-local-path"],
    ["absolute-local-path"],
  ]);
});

test("classification covers UNC, WSL, hosted file URI and local POSIX roots", () => {
  const values = [
    String.raw`\\synthetic-host\share\Users\synthetic-user\project`,
    "//synthetic-host/share/Users/synthetic-user/project",
    "/mnt/c/Users/synthetic-user/project",
    "file://synthetic-host/Users/synthetic-user/project",
    "/Users/synthetic-user/project",
    "/private/var/folders/synthetic-cache/session",
    "/private/tmp/synthetic-workspace/artifact",
    "/var/tmp/synthetic-workspace/artifact",
    "/tmp/synthetic-workspace/artifact",
    "/workspace/synthetic-project",
  ];

  assert.deepEqual(
    values.map(findPrivacyTypes),
    values.map(() => ["absolute-local-path"]),
  );
});

test("classification preserves explicit placeholders without treating web URLs as local paths", () => {
  const values = [
    "/mnt/c/Users/<user>/project",
    "/private/tmp/<workspace>/artifact",
    "file:///Users/<username>/project",
    "file://localhost/Users/<user>/project",
    "https://docs.example.com/Users/synthetic-user/project",
    "/usr/local/bin/node",
  ];

  assert.deepEqual(values.map(findPrivacyTypes), values.map(() => []));
});

test("classification detects Vietnamese phone numbers with parenthesized groups", () => {
  const values = [
    "Synthetic phone: 0912 (345) 678",
    "Synthetic phone: (+84) 912 (345) 678",
    "Synthetic phone: +84 (0) 912 (345) 678",
  ];

  assert.deepEqual(
    values.map(findPrivacyTypes),
    values.map(() => ["personal-phone"]),
  );
});

test("classification detects Vietnamese fixed-line numbers in domestic and international forms", () => {
  const values = [
    "Synthetic phone: 024 1234 5678",
    "Synthetic phone: (028) 1234-5678",
    "Synthetic phone: +84 24 1234 5678",
    "Synthetic phone: (+84) 28 1234 5678",
  ];

  assert.deepEqual(
    values.map(findPrivacyTypes),
    values.map(() => ["personal-phone"]),
  );
});

test("classification detects 0084 phones and Unicode-separated digits", () => {
  const values = [
    "Synthetic phone: 0084 912 345 678",
    "Synthetic phone: 0\u200b912\u2011345\u2013678",
    "Synthetic phone: 0\u00ad912 345 678",
    "Synthetic phone: 0084 24 1234 5678",
  ];

  assert.deepEqual(
    values.map(findPrivacyTypes),
    values.map(() => ["personal-phone"]),
  );
});

test("classification detects bare Vietnamese country-code phones", () => {
  const values = [
    "Synthetic mobile: 84912345678",
    "Synthetic mobile: 84 912 345 678",
    "Synthetic fixed line: 842412345678",
  ];

  assert.deepEqual(
    values.map(findPrivacyTypes),
    values.map(() => ["personal-phone"]),
  );
});

test("shared secret classifier covers every repository scanner credential family", () => {
  const cases = [
    ["private-key", ["-----BEGIN ", "PRIVATE KEY-----"].join("")],
    ["mongodb-credentials", ["mongodb://user", "pass@host/db"].join(":")],
    ["cloudinary-credentials", ["cloudinary://key", "secret@cloud"].join(":")],
    ["openai-key", ["sk", "proj", "A".repeat(24)].join("-")],
    ["google-api-key", ["AIza", "A".repeat(35)].join("")],
    [
      "google-app-password",
      "abcd efgh ijkl mnop",
      { allowStandaloneGoogleAppPassword: true },
    ],
    [
      "google-app-password",
      ["GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop"].join("="),
    ],
    [
      "google-app-password",
      ["docs/secrets", "abcd efgh ijkl mnop", "value.md"].join("/"),
      { repositoryPath: true },
    ],
    ["github-token", ["ghp", "A".repeat(30)].join("_")],
    ["github-token", ["github", "pat", "A".repeat(40)].join("_")],
    ["aws-access-key", ["AKIA", "A".repeat(16)].join("")],
    ["resend-key", ["re", "A".repeat(24)].join("_")],
    ["stripe-secret", ["rk", "test", "A".repeat(20)].join("_")],
    ["slack-token", ["xoxb", "A".repeat(24)].join("-")],
    ["npm-token", ["npm", "A".repeat(36)].join("_")],
    ["bearer-token", `Bearer ${"A".repeat(24)}`],
    ["credential-assignment", `api_key=${"A".repeat(24)}`],
  ];

  assert.deepEqual(
    cases.map(([expectedType, value, options]) => ({
      expectedType,
      types: findCanonicalSecretTypes(value, options),
      sensitive: hasSecretLikeText(value, options),
    })),
    cases.map(([expectedType]) => ({
      expectedType,
      types: [expectedType],
      sensitive: true,
    })),
  );
});

test("secret classification does not treat ordinary four-word prose as an app password", () => {
  assert.deepEqual(
    ["this test will pass", "risk from test skip"].map(hasSecretLikeText),
    [false, false],
  );
});

test("secret classification does not suppress placeholder words embedded in opaque values", () => {
  const values = [
    "realtestcredentialvalue",
    "ABCDlocalEFGHcredential",
    "realexampleopaquevalue",
  ];

  assert.deepEqual(
    values.map((value) => findCanonicalSecretTypes(
      credentialAssignment("api_key", value),
    )),
    values.map(() => ["credential-assignment"]),
  );
});

test("secret classification detects quoted assignments before object and array closers", () => {
  const values = [
    `const item = { ${credentialAssignment("password", "p@ss!word-long-value", {
      quote: '"', separator: ": ",
    })} };`,
    `{${credentialAssignment("api_key", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", {
      quote: '"', separator: ":",
    })}}`,
    `const values = [{ ${credentialAssignment("token", "A+BCDEFGHIJKLMNOPQRST==", {
      quote: '"', separator: ": ",
    })} }];`,
  ];

  assert.deepEqual(
    values.map((value) => findCanonicalSecretTypes(value, {
      allowUnquotedCredentialAssignment: false,
    })),
    values.map(() => ["credential-assignment"]),
  );
});

test("secret classification does not let an earlier placeholder mask a later secret", () => {
  const values = [
    [
      credentialAssignment("token", "placeholder-token"),
      credentialAssignment("api_key", "realtestcredentialvalue"),
    ].join("\n"),
    [
      bearerCredential("placeholder-token"),
      bearerCredential(`A+${"C".repeat(22)}==`),
    ].join("\n"),
  ];

  assert.deepEqual(
    values.map((value) => findCanonicalSecretTypes(value)),
    [["credential-assignment"], ["bearer-token"]],
  );
});

test("secret classification rejects hardcoded runtime fallbacks", () => {
  const hardcoded = ["Q7m", "P9x", "R4v", "T8k", "W2n"].join("_");
  const shellFallback = credentialAssignment(
    "API_KEY",
    `\${API_KEY:-${hardcoded}}`,
  );
  const javascriptFallback = credentialAssignment(
    "api_key",
    `process.env.API_KEY || "${hardcoded}"`,
  );
  const backtickFallback = credentialAssignment(
    "api_key",
    `process.env.API_KEY ?? \`${hardcoded}\``,
  );

  assert.deepEqual(
    [shellFallback, javascriptFallback, backtickFallback].map(findCanonicalSecretTypes),
    [
      ["credential-assignment"],
      ["credential-assignment"],
      ["credential-assignment"],
    ],
  );
});

test("secret classification permits runtime references without hardcoded fallbacks", () => {
  const values = [
    credentialAssignment("API_KEY", "${API_KEY}"),
    credentialAssignment("API_KEY", "${API_KEY:?required}"),
    credentialAssignment("API_KEY", "${API_KEY:-}"),
    credentialAssignment("api_key", "process.env.API_KEY"),
    credentialAssignment("api_key", "environment.API_KEY"),
  ];

  assert.deepEqual(values.map(findCanonicalSecretTypes), values.map(() => []));
});

test("secret classification does not treat environment-prefixed literals as runtime references", () => {
  const values = [
    credentialAssignment("api_key", "environment-production-key"),
    credentialAssignment("jwtSecret", "env-local-secret"),
  ];

  assert.deepEqual(
    values.map(findCanonicalSecretTypes),
    values.map(() => ["credential-assignment"]),
  );
});

test("sensitive byte decoder handles BOM encodings and rejects ambiguous bytes", () => {
  const content = "Owner: member@gmail.com\n";
  const utf16LeBody = Buffer.from(content, "utf16le");
  const utf16BeBody = Buffer.from(utf16LeBody);
  for (let index = 0; index < utf16BeBody.length; index += 2) {
    [utf16BeBody[index], utf16BeBody[index + 1]] = [
      utf16BeBody[index + 1],
      utf16BeBody[index],
    ];
  }

  assert.deepEqual(
    [
      decodeSensitiveTextBytes(Buffer.from(content, "utf8")),
      decodeSensitiveTextBytes(Buffer.concat([Buffer.from([0xff, 0xfe]), utf16LeBody])),
      decodeSensitiveTextBytes(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16BeBody])),
    ],
    [content, content, content],
  );
  assert.throws(
    () => decodeSensitiveTextBytes(Buffer.from([0x61, 0x00, 0x62, 0x00])),
    /encoding is invalid/i,
  );
  assert.throws(
    () => decodeSensitiveTextBytes(Buffer.from([0xc3, 0x28])),
    /encoded data|encoding/i,
  );
});

test("secret classification removes Unicode format characters before matching", () => {
  const values = [
    ["sk", "proj", "A".repeat(24)].join("\u00ad-"),
    `${["AKIA", "A".repeat(8)].join("")}\u061c${"A".repeat(8)}`,
    `${["AIza", "A".repeat(17)].join("")}\u200b${"A".repeat(18)}`,
  ];

  assert.deepEqual(values.map(hasSecretLikeText), [true, true, true]);
});

test("secret classification removes every default-ignorable code point before matching", () => {
  const ignored = ["\u034f", "\ufe0f", "\u115f", "\u17b4", "\u{e0100}"];
  const values = ignored.map((codePoint) =>
    `${["AKIA", "A".repeat(8)].join("")}${codePoint}${"A".repeat(8)}`,
  );

  assert.deepEqual(values.map(hasSecretLikeText), ignored.map(() => true));
});

test("secret classification removes non-ignorable Unicode format controls", () => {
  const controls = ["\u0600", "\u0601", "\u06dd", "\u070f", "\ufff9"];
  const values = controls.map((codePoint) =>
    `${["AKIA", "A".repeat(8)].join("")}${codePoint}${"A".repeat(8)}`,
  );

  assert.deepEqual(values.map(hasSecretLikeText), controls.map(() => true));
});

test("formatFinding hashes every Unicode format-control path", () => {
  const unsafePaths = ["docs/safe\u061c.md", "docs/safe\u00ad.md", "docs/safe\u180e.md"];
  const outputs = unsafePaths.map((file) => formatFinding({
    file,
    line: 1,
    type: "personal-email",
  }));

  assert.deepEqual(
    outputs.map((output) => ({
      redacted: /^redacted-path-[0-9a-f]{12}:1:personal-email$/.test(output),
      leakedControl: unsafePaths.some((value) => output.includes(value)),
    })),
    unsafePaths.map(() => ({ redacted: true, leakedControl: false })),
  );
});

test("formatFinding hashes paths containing non-control default-ignorable code points", () => {
  const unsafePaths = [
    "docs/safe\u034f.md",
    "docs/safe\ufe0f.md",
    "docs/safe\u115f.md",
    "docs/safe\u{e0100}.md",
  ];

  assert.deepEqual(
    unsafePaths.map((file) => formatFinding({
      file,
      line: 1,
      type: "personal-email",
    })).map((output) => ({
      redacted: /^redacted-path-[0-9a-f]{12}:1:personal-email$/.test(output),
      leaked: unsafePaths.some((value) => output.includes(value)),
    })),
    unsafePaths.map(() => ({ redacted: true, leaked: false })),
  );
});

test("secret scanner hashes a sensitive filename before writing findings", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const credential = ["AKIA", "A".repeat(16)].join("");
    const phone = "0912 345 678";
    const filename = `${credential}-${phone}.md`;
    await writeFile(path.join(fixtureDirectory, filename), "Synthetic fixture.\n");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });
    const output = `${result.stdout}${result.stderr}`;

    assert.deepEqual(
      {
        status: result.status,
        redacted: /redacted-path-[0-9a-f]{12}/.test(output),
        leaksRawValue: [credential, phone, filename].some((value) => output.includes(value)),
        hasUnsafeControl:
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u202a-\u202e]/u.test(output),
      },
      { status: 1, redacted: true, leaksRawValue: false, hasUnsafeControl: false },
    );
  });
});

test("secret scanner fails closed for a non-canonical control filename", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const credential = ["AKIA", "A".repeat(16)].join("");
    const filename = `${credential}\u061c.md`;
    await writeFile(path.join(fixtureDirectory, filename), "Synthetic fixture.\n");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });
    const output = `${result.stdout}${result.stderr}`;

    assert.deepEqual(
      {
        status: result.status,
        leaksRawValue: [credential, filename].some((value) => output.includes(value)),
        hasUnsafeControl:
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u202a-\u202e]/u.test(output),
      },
      { status: 1, leaksRawValue: false, hasUnsafeControl: false },
    );
  });
});

test("secret scanner inspects staged bytes after the working copy is redacted", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const credential = ["sk", "proj", "A".repeat(24)].join("-");
    const candidatePath = path.join(fixtureDirectory, "config.js");
    await writeFile(candidatePath, `export default "${credential}";\n`);
    assert.equal(
      spawnSync("git", ["add", "config.js"], { cwd: fixtureDirectory }).status,
      0,
    );
    await writeFile(candidatePath, "export default null;\n");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /openai-key/);
    assert.equal(`${result.stdout}${result.stderr}`.includes(credential), false);
  });
});

for (const source of ["committed", "untracked"]) {
  test(`secret scanner decodes a BOM UTF-16 ${source} text candidate`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      const runGit = (args) => {
        const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit(["init", "--quiet"]);
      const credential = ["Q7m", "P9x", "R4vZ"].join("_");
      const sourceText = `export const jwtSecret = "${credential}";\n`;
      await writeFile(
        path.join(fixtureDirectory, "source.js"),
        Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from(sourceText, "utf16le"),
        ]),
      );
      if (source === "committed") {
        runGit(["config", "user.email", "fixture@example.com"]);
        runGit(["config", "user.name", "Fixture"]);
        runGit(["add", "source.js"]);
        runGit(["commit", "--quiet", "-m", "fixture"]);
      }
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(credential-assignment)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

for (const credentialName of [
    "api_key",
    "apiToken",
    "clientSecret",
    "accessToken",
    "sessionToken",
    "jwtSecret",
    "encryptionKey",
    "password",
    "token",
]) {
  test(`secret scanner blocks a clean committed ${credentialName} literal`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      const runGit = (args) => {
        const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit(["init", "--quiet"]);
      runGit(["config", "user.email", "fixture@example.com"]);
      runGit(["config", "user.name", "Fixture"]);
      const credential = ["Q7m", "P9x", "R4vZ"].join("_");
      await writeFile(
        path.join(fixtureDirectory, "source.js"),
        `export const ${credentialAssignment(credentialName, credential, { quote: '"' })};\n`,
      );
      runGit(["add", "source.js"]);
      runGit(["commit", "--quiet", "-m", "fixture"]);
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(credential-assignment)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

for (const bearerToken of [
  "A".repeat(24),
  `A+${"C".repeat(22)}==`,
]) {
  test("secret scanner blocks a clean committed Bearer literal", async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      const runGit = (args) => {
        const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit(["init", "--quiet"]);
      runGit(["config", "user.email", "fixture@example.com"]);
      runGit(["config", "user.name", "Fixture"]);
      const credential = bearerCredential(bearerToken);
      await writeFile(
        path.join(fixtureDirectory, "source.js"),
        `export const auth = "${credential}";\n`,
      );
      runGit(["add", "source.js"]);
      runGit(["commit", "--quiet", "-m", "fixture"]);
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(bearer-token)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

for (const [syntaxName, sourceFor] of [
  [
    "one-line backtick",
    (credential) => `export const ${credentialAssignment("password", credential, {
      quote: "`",
    })};\n`,
  ],
  [
    "object backtick",
    (credential) => `export const item = { ${credentialAssignment("password", credential, {
      quote: "`", separator: ": ",
    })} };\n`,
  ],
  [
    "single newline",
    (credential) => `export const item = { ${credentialAssignment("password", credential, {
      quote: '"', separator: ":\n  ",
    })} };\n`,
  ],
  [
    "runtime fallback backtick",
    (credential) => `export const api_key = process.env.API_KEY ?? \`${credential}\`;\n`,
  ],
  [
    "environment-prefixed literal",
    (credential) => `export const api_key = "environment-${credential}";\n`,
  ],
]) {
  test(`secret scanner blocks a clean committed ${syntaxName} literal`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      const runGit = (args) => {
        const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit(["init", "--quiet"]);
      runGit(["config", "user.email", "fixture@example.com"]);
      runGit(["config", "user.name", "Fixture"]);
      const credential = ["Q7m", "P9x", "R4v", "T8k", "W2n"].join("_");
      await writeFile(path.join(fixtureDirectory, "source.js"), sourceFor(credential));
      runGit(["add", "source.js"]);
      runGit(["commit", "--quiet", "-m", "fixture"]);
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(credential-assignment)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

for (const hiddenFlag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`secret scanner rejects Git ${hiddenFlag.slice(2)} index flags`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      const runGit = (args) => {
        const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
        assert.equal(result.status, 0);
      };
      runGit(["init", "--quiet"]);
      runGit(["config", "user.email", "fixture@example.com"]);
      runGit(["config", "user.name", "Fixture"]);
      const candidatePath = path.join(fixtureDirectory, "config.js");
      await writeFile(candidatePath, "export default null;\n");
      runGit(["add", "config.js"]);
      runGit(["commit", "--quiet", "-m", "fixture"]);
      runGit(["update-index", hiddenFlag, "config.js"]);
      const credential = ["sk", "proj", "A".repeat(24)].join("-");
      await writeFile(candidatePath, `export default "${credential}";\n`);
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          blockedHiddenFlag: /hidden Git index flags/i.test(output),
          leakedCredential: output.includes(credential),
        },
        { status: 1, blockedHiddenFlag: true, leakedCredential: false },
      );
    });
  });
}

test("secret scanner fails closed when Git state changes during scanning", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const runGit = (args) => {
      const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
      assert.equal(result.status, 0);
    };
    runGit(["init", "--quiet"]);
    runGit(["config", "user.email", "fixture@example.com"]);
    runGit(["config", "user.name", "Fixture"]);
    const targetPath = path.join(fixtureDirectory, "target.js");
    await writeFile(targetPath, "export default null;\n");
    runGit(["add", "target.js"]);
    runGit(["commit", "--quiet", "-m", "fixture"]);
    for (let index = 0; index < 80; index += 1) {
      await writeFile(
        path.join(fixtureDirectory, `pad-${String(index).padStart(3, "0")}.txt`),
        `${index}\n${"x".repeat(50_000)}\n`,
      );
    }
    runGit(["add", "."]);
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));
    const child = spawn(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { output += chunk.toString("utf8"); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const credential = ["sk", "proj", "A".repeat(24)].join("-");
    await writeFile(targetPath, `export default "${credential}";\n`);
    const status = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    assert.deepEqual(
      {
        status,
        blocked: /openai-key|Git state changed during scanning/i.test(output),
        leakedCredential: output.includes(credential),
      },
      { status: 1, blocked: true, leakedCredential: false },
    );
  });
});

test("secret scanner rejects a content swap that preserves dirty Git status", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const runGit = (args) => {
      const result = spawnSync("git", args, { cwd: fixtureDirectory, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    runGit(["init", "--quiet"]);
    runGit(["config", "user.email", "fixture@example.com"]);
    runGit(["config", "user.name", "Fixture"]);
    const targetPath = path.join(fixtureDirectory, "000-target.js");
    await writeFile(targetPath, "export default null;\n");
    runGit(["add", "000-target.js"]);
    runGit(["commit", "--quiet", "-m", "fixture"]);
    await writeFile(targetPath, "export default true;\n");
    const preloadPath = path.join(fixtureDirectory, "race-preload.mjs");
    await writeFile(preloadPath, [
      'import fs from "node:fs";',
      'const target = process.env.HT_SECRET_RACE_TARGET;',
      'const targetStat = fs.lstatSync(target, { bigint: true });',
      'const replacement = ["sk", "proj", "R".repeat(24)].join("-");',
      'const originalReadFileSync = fs.readFileSync;',
      'let swapped = false;',
      'fs.readFileSync = function(file, ...args) {',
      '  const result = originalReadFileSync.call(this, file, ...args);',
      '  let matches = typeof file === "number"',
      '    ? (() => { const stat = fs.fstatSync(file, { bigint: true }); return stat.dev === targetStat.dev && stat.ino === targetStat.ino; })()',
      '    : String(file) === target;',
      '  if (matches && !swapped) {',
      '    swapped = true;',
      '    fs.writeFileSync(target, `export default "${replacement}";\\n`);',
      '  }',
      '  return result;',
      '};',
      '',
    ].join("\n"));
    const credential = ["sk", "proj", "R".repeat(24)].join("-");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        HT_SECRET_RACE_TARGET: targetPath,
        NODE_OPTIONS: `--import=${pathToFileURL(preloadPath).href}`,
      },
    });
    const output = `${result.stdout}${result.stderr}`;
    const swappedContent = await readFile(targetPath, "utf8");

    assert.deepEqual(
      {
        status: result.status,
        blocked: /changed during scanning|secret scan failed|openai-key/i.test(output),
        swapped: swappedContent.includes(credential),
        leakedCredential: output.includes(credential),
      },
      {
        status: 1,
        blocked: true,
        swapped: true,
        leakedCredential: false,
      },
    );
  });
});

for (const source of ["staged", "untracked"]) {
  test(`secret scanner rejects an oversized ${source} text candidate`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
      const credential = ["sk", "proj", "A".repeat(24)].join("-");
      const candidatePath = path.join(fixtureDirectory, "large.txt");
      await writeFile(candidatePath, `${"x".repeat(2_000_001)}${credential}\n`);
      if (source === "staged") {
        assert.equal(
          spawnSync("git", ["add", "large.txt"], { cwd: fixtureDirectory }).status,
          0,
        );
      }
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          blockedOversized: /oversized-candidate/i.test(output),
          leakedCredential: output.includes(credential),
        },
        { status: 1, blockedOversized: true, leakedCredential: false },
      );
    });
  });
}

test("secret scanner blocks every typed credential family", async () => {
  const cases = [
    ["slack-token", ["xoxb", "A".repeat(24)].join("-"), "config.ini"],
    ["npm-token", ["npm", "A".repeat(36)].join("_"), "config.ini"],
    ["bearer-token", bearerCredential("A".repeat(24)), "config.ini"],
    [
      "credential-assignment",
      credentialAssignment("api_key", "A".repeat(24)),
      "config.ini",
    ],
    [
      "bearer-token",
      `const h = "${bearerCredential("A".repeat(24))}";`,
      "config.js",
    ],
    [
      "credential-assignment",
      `const ${credentialAssignment("api_key", "A".repeat(24), { quote: '"' })};`,
      "config.js",
    ],
  ];
  for (const [expectedType, credential, filename] of cases) {
    await withFixtureDirectory(async (fixtureDirectory) => {
      spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
      await writeFile(path.join(fixtureDirectory, filename), `${credential}\n`);
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes(`(${expectedType})`),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  }
});

test("secret scanner treats multi-suffix env examples as config candidates", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const credential = "p@ss!word-long-value";
    await writeFile(
      path.join(fixtureDirectory, ".env.example"),
      `${credentialAssignment("CUSTOM_API_KEY", credential)}\n`,
    );
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });
    const output = `${result.stdout}${result.stderr}`;

    assert.deepEqual(
      {
        status: result.status,
        typed: output.includes("(credential-assignment)"),
        leakedCredential: output.includes(credential),
      },
      { status: 1, typed: true, leakedCredential: false },
    );
  });
});

for (const source of ["staged", "untracked"]) {
  test(`secret scanner scans a ${source} text lockfile`, async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
      const credential = ["npm", "A".repeat(36)].join("_");
      await writeFile(path.join(fixtureDirectory, "yarn.lock"), `${credential}\n`);
      if (source === "staged") {
        assert.equal(
          spawnSync("git", ["add", "yarn.lock"], { cwd: fixtureDirectory }).status,
          0,
        );
      }
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(npm-token)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

for (const generatedDirectory of ["node_modules", "test-results", "playwright-report"]) {
  test("secret scanner scans a force-added generated-directory candidate", async () => {
    await withFixtureDirectory(async (fixtureDirectory) => {
      spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
      const credential = ["npm", "A".repeat(36)].join("_");
      const relativePath = `${generatedDirectory}/candidate.txt`;
      await mkdir(path.dirname(path.join(fixtureDirectory, relativePath)), { recursive: true });
      await writeFile(path.join(fixtureDirectory, relativePath), `${credential}\n`);
      assert.equal(
        spawnSync("git", ["add", "-f", relativePath], { cwd: fixtureDirectory }).status,
        0,
      );
      const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: fixtureDirectory,
        encoding: "utf8",
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.deepEqual(
        {
          status: result.status,
          typed: output.includes("(npm-token)"),
          leakedCredential: output.includes(credential),
        },
        { status: 1, typed: true, leakedCredential: false },
      );
    });
  });
}

test("secret scanner preserves fail-closed detection for a standalone app password", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    await writeFile(path.join(fixtureDirectory, "raw-secret.txt"), "abcd efgh ijkl mnop\n");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /google-app-password/);
  });
});

test("secret scanner does not treat ordinary prose in a text file as an app password", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    await writeFile(path.join(fixtureDirectory, "note.txt"), "this test will pass\n");
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });

    assert.deepEqual(
      { status: result.status, stdout: result.stdout, stderr: result.stderr },
      { status: 0, stdout: "Secret scan passed.\n", stderr: "" },
    );
  });
});

test("secret scanner inspects a dangling symlink target without following it", async (context) => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const credential = ["sk", "proj", "A".repeat(24)].join("-");
    const linkPath = path.join(fixtureDirectory, "cover.png");
    try {
      await symlink(credential, linkPath, "file");
    } catch (error) {
      if (error?.code === "EPERM") {
        context.skip("File symlink creation requires Windows Developer Mode");
        return;
      }
      throw error;
    }
    const scriptPath = fileURLToPath(new URL("./check-secrets.mjs", import.meta.url));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /openai-key/);
    assert.equal(result.stderr.includes(credential), false);
  });
});

test("scan output hashes display paths containing log-control characters", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: fixtureDirectory,
      encoding: "utf8",
      input: "Owner: synthetic.owner@privacy.invalid\n",
    });
    assert.equal(blob.status, 0);
    const findings = await scanDocuments([{
      source: "git-index",
      objectId: blob.stdout.trim(),
      repositoryRoot: fixtureDirectory,
      displayPath: "docs/plans/safe\n\r\u001b\u202efile.md",
      allowedRoot: fixtureDirectory,
    }]);
    const output = findings.map(formatFinding).join("\n");

    assert.deepEqual(
      {
        filesAreRedacted: findings.every(({ file }) =>
          /^redacted-path-[0-9a-f]{12}$/.test(file)),
        recordCount: output.split("\n").length,
        hasUnsafeControl: /[\u0000-\u001f\u007f-\u009f\u202a-\u202e]/u.test(output),
      },
      { filesAreRedacted: true, recordCount: findings.length, hasUnsafeControl: false },
    );
  });
});

test("findings keep canonical sensitive filenames and body values redacted", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const filename = "synthetic.owner@privacy.invalid.json";
    const localPath = String.raw`\\synthetic-host\share\Users\synthetic-user\project`;
    const phone = "0912 (345) 678";
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(
      path.join(handoffDirectory, filename),
      `${JSON.stringify({ localPath, phone })}\n`,
    );

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);
    const output = findings.map(formatFinding).join("\n");

    assert.deepEqual(
      {
        redactedFiles: findings.every(({ file }) => /^redacted-path-[0-9a-f]{12}$/.test(file)),
        types: findings.map(({ line, type }) => `${line}:${type}`),
        leaksRawValue: [filename, localPath, phone].some((value) => output.includes(value)),
      },
      {
        redactedFiles: true,
        types: ["0:personal-email", "1:absolute-local-path", "1:personal-phone"],
        leaksRawValue: false,
      },
    );
  });
});

test("scan rejects a working document changed after its bytes were inspected", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const firstPath = path.join(fixtureDirectory, "alpha.md");
    const secondPath = path.join(fixtureDirectory, "zeta.md");
    await writeFile(firstPath, "Safe first document.\n");
    await writeFile(secondPath, "Safe second document.\n");
    const targets = await collectScanTargets({
      repositoryRoot: fixtureDirectory,
      inputs: [firstPath, secondPath],
    });
    let changed = false;
    const mutationTarget = new Proxy(targets[1], {
      get(target, property, receiver) {
        if (property === "displayPath" && !changed) {
          changed = true;
          writeFileSync(firstPath, "Owner: changed.owner@gmail.com\n");
        }
        return Reflect.get(target, property, receiver);
      },
    });

    await assert.rejects(
      () => scanDocuments([targets[0], mutationTarget]),
      /changed during scanning/i,
    );
  });
});

test("scan rejects a new document added to an explicit directory after discovery", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const firstPath = path.join(fixtureDirectory, "alpha.md");
    await writeFile(firstPath, "Safe first document.\n");
    const targets = await collectScanTargets({
      repositoryRoot: fixtureDirectory,
      inputs: [fixtureDirectory],
    });

    await writeFile(
      path.join(fixtureDirectory, "zeta.md"),
      "Owner: late.owner@gmail.com\n",
    );

    await assert.rejects(
      () => scanDocuments(targets),
      /directory changed during scanning/i,
    );
  });
});

test("scan rejects a Git index changed after candidate discovery", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const candidatePath = path.join(handoffDirectory, "candidate.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(candidatePath, "Safe staged document.\n");
    assert.equal(
      spawnSync("git", ["add", "docs/handoffs/candidate.md"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });

    await writeFile(candidatePath, "Owner: staged.owner@gmail.com\n");
    assert.equal(
      spawnSync("git", ["add", "docs/handoffs/candidate.md"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    await writeFile(candidatePath, "Safe working document.\n");

    await assert.rejects(
      () => scanDocuments(targets),
      /Git state changed during scanning/i,
    );
  });
});

test("scan rechecks Git after final working-document verification", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const candidatePath = path.join(handoffDirectory, "candidate.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(candidatePath, "Safe staged and working document.\n");
    assert.equal(
      spawnSync("git", ["add", "docs/handoffs/candidate.md"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const indexTarget = targets.find(({ source }) => source === "git-index");
    const workingTarget = targets.find(({ source }) => source === "working-tree");
    let allowedRootReads = 0;
    const mutationTarget = new Proxy(workingTarget, {
      get(target, property, receiver) {
        if (property === "allowedRoot") {
          allowedRootReads += 1;
          if (allowedRootReads === 2) {
            const blobResult = spawnSync(
              "git",
              ["hash-object", "-w", "--stdin"],
              {
                cwd: fixtureDirectory,
                encoding: "utf8",
                input: "Owner: final.index.owner@gmail.com\n",
              },
            );
            assert.equal(blobResult.status, 0);
            const updateResult = spawnSync(
              "git",
              [
                "update-index",
                "--cacheinfo",
                `100644,${blobResult.stdout.trim()},docs/handoffs/candidate.md`,
              ],
              { cwd: fixtureDirectory },
            );
            assert.equal(updateResult.status, 0);
          }
        }
        return Reflect.get(target, property, receiver);
      },
    });

    await assert.rejects(
      () => scanDocuments([indexTarget, mutationTarget]),
      /Git state changed during scanning/i,
    );
  });
});

test("default discovery scans staged bytes even after the working copy is redacted", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const candidatePath = path.join(handoffDirectory, "candidate.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(candidatePath, "Staged owner: staged.owner@gmail.com\n");
    const addResult = spawnSync("git", ["add", "docs/handoffs/candidate.md"], {
      cwd: fixtureDirectory,
    });
    assert.equal(addResult.status, 0);
    await writeFile(candidatePath, "Owner details have been redacted.\n");

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);

    assert.deepEqual(findings, [
      {
        file: "docs/handoffs/candidate.md",
        line: 1,
        type: "personal-email",
      },
    ]);
  });
});

test("default discovery decodes BOM UTF-16 bytes from the Git index", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const candidatePath = path.join(handoffDirectory, "candidate.md");
    const privateEmail = "staged.owner@gmail.com";
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(
      candidatePath,
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(`Owner: ${privateEmail}\n`, "utf16le"),
      ]),
    );
    assert.equal(
      spawnSync("git", ["add", "docs/handoffs/candidate.md"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    await writeFile(candidatePath, "Owner details have been redacted.\n");

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);

    assert.deepEqual(findings, [{
      file: "docs/handoffs/candidate.md",
      line: 1,
      type: "personal-email",
    }]);
  });
});

test("default discovery scans unchanged index bytes when a tracked working copy is redacted", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    spawnSync("git", ["config", "user.email", "fixture@example.com"], {
      cwd: fixtureDirectory,
    });
    spawnSync("git", ["config", "user.name", "Fixture"], {
      cwd: fixtureDirectory,
    });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const trackedPath = path.join(handoffDirectory, "tracked.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(trackedPath, "Tracked owner: tracked.owner@gmail.com\n");
    assert.equal(
      spawnSync("git", ["add", "docs/handoffs/tracked.md"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    assert.equal(
      spawnSync("git", ["commit", "--quiet", "-m", "fixture"], {
        cwd: fixtureDirectory,
      }).status,
      0,
    );
    await writeFile(trackedPath, "Owner details have been redacted.\n");

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);

    assert.deepEqual(findings, [
      {
        file: "docs/handoffs/tracked.md",
        line: 1,
        type: "personal-email",
      },
    ]);
  });
});

test("default discovery tolerates a tracked file deleted only from the working tree", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const deletedPath = path.join(handoffDirectory, "deleted.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(deletedPath, "Deleted candidate.\n");
    const addResult = spawnSync("git", ["add", "docs/handoffs/deleted.md"], {
      cwd: fixtureDirectory,
    });
    assert.equal(addResult.status, 0);
    await unlink(deletedPath);

    const targets = await collectScanTargets({ repositoryRoot: fixtureDirectory });
    const findings = await scanDocuments(targets);

    assert.deepEqual(findings, []);
  });
});

test("default discovery rejects documentation symlinks outside the repository", async (context) => {
  const externalDirectory = await mkdtemp(path.join(tmpdir(), "docs-privacy-external-"));
  context.after(() => rm(externalDirectory, { recursive: true, force: true }));
  await withFixtureDirectory(async (fixtureDirectory) => {
    spawnSync("git", ["init", "--quiet"], { cwd: fixtureDirectory });
    const handoffDirectory = path.join(fixtureDirectory, "docs", "handoffs");
    const externalPath = path.join(externalDirectory, "private.md");
    const linkPath = path.join(handoffDirectory, "linked.md");
    await mkdir(handoffDirectory, { recursive: true });
    await writeFile(externalPath, "Private external document.\n");
    try {
      await symlink(externalPath, linkPath, "file");
    } catch (error) {
      if (error?.code === "EPERM") {
        context.skip("File symlink creation requires Windows Developer Mode");
        return;
      }
      throw error;
    }

    await assert.rejects(
      () => collectScanTargets({ repositoryRoot: fixtureDirectory }),
      /symbolic links are not allowed/i,
    );
  });
});
