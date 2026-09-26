import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../services/ai/providers/index.js", () => ({
  llmStream: vi.fn(),
}));

vi.mock("../../utils/safeLogger.js", () => ({
  safeLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  clearCollections,
  createTestApp,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import { llmStream } from "../../services/ai/providers/index.js";

const TEST_CSRF = "test-csrf-token";

let app;

const readSseText = (response) =>
  response.text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
    .filter((event) => event.type === "text")
    .map((event) => event.content)
    .join("");

const guestRequest = (payload) =>
  request(app)
    .post("/api/ai/chat")
    .set("Cookie", `csrfToken=${TEST_CSRF}`)
    .set("X-CSRF-Token", TEST_CSRF)
    .send(payload);

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("AI workout equipment constraints", () => {
  it("keeps the four-day fallback within adjustable dumbbells and resistance bands", async () => {
    llmStream.mockImplementation(async function* invalidEquipmentResponse() {
      yield {
        type: "text",
        content:
          "Buổi 1: Barbell bench press 3 hiệp x 8 lần, RPE 7, nghỉ 90 giây.",
      };
    });

    const response = await guestRequest({
      message:
        "Tôi chỉ có tạ đơn điều chỉnh và dây kháng lực. Hãy lập lịch 4 buổi, có sets, reps, RPE, thời gian nghỉ, progression và deload.",
      requestId: "b5d2cd12-5d4e-435d-bf8f-e1dd5b4efac3",
    });
    const answer = readSseText(response);

    expect(response.status).toBe(200);
    expect(answer).toMatch(/Buổi 1[\s\S]*Buổi 2[\s\S]*Buổi 3[\s\S]*Buổi 4/u);
    expect(answer).toMatch(/hiệp[\s\S]*RPE[\s\S]*nghỉ/iu);
    expect(answer).toMatch(/tăng dần[\s\S]*deload/iu);
    expect(answer).not.toMatch(
      /\b(?:barbell|thanh đòn|machine|máy|cable|cáp|bench|ghế|bodyweight)\b|hít đất|squat trọng lượng cơ thể|glute bridge|split squat|reverse snow angel/iu,
    );
  });
});
