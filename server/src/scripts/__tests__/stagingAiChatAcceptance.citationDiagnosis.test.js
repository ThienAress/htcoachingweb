import { describe, expect, it } from "vitest";
import { classifyMissingCitation, DIAGNOSIS_CODES } from "../stagingAiChatAcceptance.citationDiagnosis.js";

const URL_SOURCE = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";
const timeout = () => Object.assign(new Error("Timeout 90000ms exceeded"), { name: "TimeoutError" });
const dbWith = (messages) => ({
  collection: () => ({
    find: () => ({
      sort: () => ({ limit: () => ({ toArray: async () => (messages ? [{ messages }] : []) }) }),
    }),
  }),
});
const run = (messages, error = timeout()) => classifyMissingCitation({
  error, db: dbWith(messages), ownerObjectId: "owner", fixtureId: "fix1", sourceUrl: URL_SOURCE,
});

describe("citation diagnosis for the recovered answer", () => {
  it("passes through non-timeout errors unchanged", async () => {
    const other = new Error("boom");
    expect(await run([], other)).toBe(other);
  });

  it("reports that no assistant turn was persisted", async () => {
    expect((await run(null)).code).toBe(DIAGNOSIS_CODES.noAssistant);
  });

  it("reports that the fixture KB entry was not used", async () => {
    const messages = [{ role: "assistant", content: `x ${URL_SOURCE}`, answerTrace: { kbEntryIds: ["other"] } }];
    expect((await run(messages)).code).toBe(DIAGNOSIS_CODES.kbNotUsed);
  });

  it("reports that the answer omitted the reviewed source URL", async () => {
    const messages = [{ role: "assistant", content: "150 phút mỗi tuần.", answerTrace: { kbEntryIds: ["fix1"] } }];
    const diagnosed = await run(messages);
    expect(diagnosed.code).toBe(DIAGNOSIS_CODES.urlNotInAnswer);
    expect(diagnosed.cause.name).toBe("TimeoutError");
  });

  it("reports a rendering gap when the URL is persisted but not visible", async () => {
    const messages = [{ role: "assistant", content: `ok ${URL_SOURCE}`, answerTrace: { kbEntryIds: ["fix1"] } }];
    expect((await run(messages)).code).toBe(DIAGNOSIS_CODES.notRendered);
  });

  it("never copies message text into the diagnosis", async () => {
    const messages = [{ role: "assistant", content: "SECRET-ANSWER", answerTrace: { kbEntryIds: ["fix1"] } }];
    const diagnosed = await run(messages);
    expect(JSON.stringify({ message: diagnosed.message, code: diagnosed.code })).not.toMatch(/SECRET-ANSWER/);
  });
});
