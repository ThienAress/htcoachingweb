import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const scannerPath = path.join(repositoryRoot, "scripts", "check-docs-privacy.mjs");

const runScanner = (targets) =>
  spawnSync(process.execPath, [scannerPath, ...targets], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

const withFixtureDirectory = async (run) => {
  const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "docs-privacy-"));
  try {
    await run(fixtureDirectory);
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
};

test("fails for personal email and absolute Windows/Linux workspace paths", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "private-handoff.md");
    await writeFile(
      fixturePath,
      [
        "Owner: personal.owner@gmail.com",
        String.raw`Workspace: D:\private-workspace\project`,
        "Home: /home/private-user/project",
        "Dev container: /workspace/private-project",
      ].join("\n"),
    );

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout,
      [
        "private-handoff.md:1:personal-email",
        "private-handoff.md:2:absolute-local-path",
        "private-handoff.md:3:absolute-local-path",
        "private-handoff.md:4:absolute-local-path",
        "",
      ].join("\n"),
    );
  });
});

test("fails for Vietnamese personal phone numbers without echoing the number", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "phone.md");
    const privatePhone = "+84 912 345 678";
    await writeFile(fixturePath, `Owner phone: ${privatePhone}\n`);

    const result = runScanner([fixturePath]);
    const combinedOutput = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.equal(combinedOutput.includes(privatePhone), false);
    assert.equal(result.stdout, "phone.md:1:personal-phone\n");
  });
});

test("does not echo raw PII in findings", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "redacted-output.md");
    const privateEmail = "sensitive.person@outlook.com";
    const privatePath = String.raw`C:\Users\Sensitive Person\repository`;
    await writeFile(fixturePath, `${privateEmail}\n${privatePath}\n`);

    const result = runScanner([fixturePath]);
    const combinedOutput = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.equal(combinedOutput.includes(privateEmail), false);
    assert.equal(combinedOutput.includes(privatePath), false);
    assert.match(result.stdout, /^redacted-output\.md:1:personal-email\nredacted-output\.md:2:absolute-local-path\n$/);
  });
});

test("redacts a sensitive filename and reports the path finding", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const privateEmail = "personal.owner@gmail.com";
    const fixturePath = path.join(fixtureDirectory, `${privateEmail}.md`);
    await writeFile(fixturePath, "No sensitive body content.\n");

    const result = runScanner([fixturePath]);
    const combinedOutput = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.equal(combinedOutput.includes(privateEmail), false);
    assert.match(result.stdout, /^redacted-path-[0-9a-f]{12}:0:personal-email\n$/);
  });
});

test("does not expose an 0084 phone embedded in a filename", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const privatePhone = "0084 912 345 678";
    const fixturePath = path.join(fixtureDirectory, `${privatePhone}.md`);
    await writeFile(fixturePath, "Owner: synthetic.owner@privacy.invalid\n");

    const result = runScanner([fixturePath]);
    const output = `${result.stdout}${result.stderr}`;
    const records = result.stdout.trim().split("\n");
    const files = records.map((record) => record.split(":")[0]);

    assert.deepEqual(
      {
        status: result.status,
        leakedPhone: output.includes(privatePhone),
        types: records.map((record) => record.split(":").at(-1)),
        sameRedactedFile: new Set(files).size === 1
          && /^redacted-path-[0-9a-f]{12}$/.test(files[0]),
      },
      {
        status: 1,
        leakedPhone: false,
        types: ["personal-phone", "personal-email"],
        sameRedactedFile: true,
      },
    );
  });
});

test("allows explicit documentation and test placeholders", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "placeholders.md");
    await writeFile(
      fixturePath,
      [
        "Contact: owner@example.com",
        String.raw`Windows: C:\Users\<username>\project`,
        "Linux: /home/<user>/project",
        "Container: /workspace/<repository>",
      ].join("\n"),
    );

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });
});

test("does not let a trailing placeholder hide a real local identity", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "placeholder-bypass.md");
    await writeFile(
      fixturePath,
      String.raw`C:\Users\real-person\private\<user>` + "\n",
    );

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "placeholder-bypass.md:1:absolute-local-path\n");
  });
});

test("detects HOME assignments, file URIs and root home paths", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "path-forms.md");
    await writeFile(
      fixturePath,
      [
        "HOME=/home/private-user/project",
        "Open file:///home/private-user/project/readme.md",
        "Root workspace: /root/private-project",
        "workspace:/home/private-user/project",
        "path:/Users/private-user/project",
        "artifact:/workspace/private-project",
      ].join("\n"),
    );

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout,
      [
        "path-forms.md:1:absolute-local-path",
        "path-forms.md:2:absolute-local-path",
        "path-forms.md:3:absolute-local-path",
        "path-forms.md:4:absolute-local-path",
        "path-forms.md:5:absolute-local-path",
        "path-forms.md:6:absolute-local-path",
        "",
      ].join("\n"),
    );
  });
});

test("detects Vietnamese phone forms with country-code parentheses and trunk prefix", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "phone-forms.md");
    const firstPhone = "+84 (0) 912 345 678";
    const secondPhone = "(+84) 912 345 678";
    await writeFile(fixturePath, `${firstPhone}\n${secondPhone}\n`);

    const result = runScanner([fixturePath]);
    const combinedOutput = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.equal(combinedOutput.includes(firstPhone), false);
    assert.equal(combinedOutput.includes(secondPhone), false);
    assert.equal(
      result.stdout,
      "phone-forms.md:1:personal-phone\nphone-forms.md:2:personal-phone\n",
    );
  });
});

test("fails closed before reading oversized documentation", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "oversized.md");
    await writeFile(fixturePath, "x".repeat(2_000_001));

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "docs-privacy:0:scan-error\n");
  });
});

test("decodes BOM UTF-16 documentation before privacy classification", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "utf16.md");
    const privateEmail = "member@gmail.com";
    await writeFile(
      fixturePath,
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(`Owner: ${privateEmail}\n`, "utf16le"),
      ]),
    );

    const result = runScanner([fixturePath]);

    assert.equal(result.status, 1);
    assert.equal(`${result.stdout}${result.stderr}`.includes(privateEmail), false);
    assert.equal(result.stdout, "utf16.md:1:personal-email\n");
  });
});

test("fails closed for ambiguous NUL-delimited documentation", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const fixturePath = path.join(fixtureDirectory, "ambiguous.md");
    await writeFile(fixturePath, Buffer.from("Owner: member@gmail.com\n", "utf16le"));

    const result = runScanner([fixturePath]);

    assert.deepEqual(
      { status: result.status, stdout: result.stdout, stderr: result.stderr },
      { status: 2, stdout: "", stderr: "docs-privacy:0:scan-error\n" },
    );
  });
});

test("orders findings deterministically regardless of argument order", async () => {
  await withFixtureDirectory(async (fixtureDirectory) => {
    const alphaPath = path.join(fixtureDirectory, "alpha.md");
    const zetaPath = path.join(fixtureDirectory, "zeta.md");
    await writeFile(alphaPath, "alpha.owner@yahoo.com\n");
    await writeFile(zetaPath, "zeta.owner@gmail.com\n");

    const result = runScanner([zetaPath, alphaPath]);

    assert.equal(result.status, 1);
    assert.equal(
      result.stdout,
      "alpha.md:1:personal-email\nzeta.md:1:personal-email\n",
    );
  });
});
