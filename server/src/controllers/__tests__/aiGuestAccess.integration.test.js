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

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import { getAllConversations } from "../knowledgeBase.controller.js";

const TEST_CSRF = "test-csrf-token";
const GUEST_COOKIE_NAME = "htAiGuest";

let app;

const guestRequest = (payload, cookie) => {
  const cookies = [`csrfToken=${TEST_CSRF}`];
  if (cookie) cookies.push(cookie);
  return request(app)
    .post("/api/ai/chat")
    .set("Cookie", cookies)
    .set("X-CSRF-Token", TEST_CSRF)
    .send(payload);
};

const readGuestCookie = (response) =>
  response.headers["set-cookie"]
    ?.map((value) => value.split(";")[0])
    .find((value) => value.startsWith(`${GUEST_COOKIE_NAME}=`));

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

afterEach(clearCollections);

afterAll(async () => {
  await teardownTestDB();
});

describe("AI guest access", () => {
  it("requires exactly one conversation owner", async () => {
    await expect(
      ChatConversation.create({ title: "ownerless" }),
    ).rejects.toThrow("đúng một user hoặc guest session");
  });

  it("keeps guest conversations out of Knowledge Base mining", async () => {
    const { user } = await createTestUser();
    await ChatConversation.create([
      { userId: user._id, title: "User conversation" },
      { guestKey: "a".repeat(64), title: "Guest conversation" },
    ]);
    const res = { json: vi.fn((payload) => payload) };

    await getAllConversations({ query: {} }, res);

    expect(res.json.mock.calls[0][0].data).toHaveLength(1);
    expect(res.json.mock.calls[0][0].data[0].title).toBe("User conversation");
  });

  it("creates an isolated short-lived conversation without a user account", async () => {
    const response = await guestRequest({
      message: "Tóm tắt trang này giúp tôi",
      context: { page: "/blog", pageType: "wallet" },
    });

    expect(response.status).toBe(200);
    expect(readGuestCookie(response)).toBeTruthy();
    expect(response.text).toContain('"type":"quota"');
    expect(response.text).toContain('"limit":5');

    const conversation = await ChatConversation.findOne({ userId: null })
      .select("+guestKey")
      .lean();
    expect(conversation.guestKey).toMatch(/^[a-f0-9]{64}$/);
    expect(conversation.context.pageType).toBe("blog");
    expect(conversation.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000,
    );
  });

  it("does not let another guest continue a conversation by id", async () => {
    const first = await guestRequest({ message: "Xin chào" });
    const conversationId = first.text.match(/"conversationId":"([^"]+)"/)?.[1];
    expect(conversationId).toBeTruthy();

    const second = await guestRequest({
      message: "Tiếp tục",
      conversationId,
    });

    expect(second.status).toBe(404);
  });

  it("returns 401 for an invalid access token instead of downgrading to guest", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Cookie", [
        "accessToken=invalid-token",
        `csrfToken=${TEST_CSRF}`,
      ])
      .set("X-CSRF-Token", TEST_CSRF)
      .send({ message: "Xin chào" });

    expect(response.status).toBe(401);
  });

  it("keeps CSRF mandatory for guest chat", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .send({ message: "Xin chào" });

    expect(response.status).toBe(403);
  });

  it("rejects image input for guest mode", async () => {
    const response = await guestRequest({
      message: "Phân tích ảnh",
      context: {
        image: `data:image/png;base64,${Buffer.from("guest-image").toString("base64")}`,
      },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AI_GUEST_IMAGE_UNAVAILABLE");
  });
});
