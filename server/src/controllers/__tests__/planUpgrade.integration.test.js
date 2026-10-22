import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import fitnessPlusRoutes from "../../routes/fitnessPlusSubscription.routes.js";
import trainerRoutes from "../../routes/trainerSubscription.routes.js";
import { getFitnessPlusCatalogMeta, getFitnessPlusPlanAmount } from "../../services/fitnessPlusCatalog.service.js";
import { getTrainerPlanAmount, getTrainerPlanCatalogMeta } from "../../services/trainerPlanCatalog.service.js";

let app;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/fitness-plus-subscriptions", fitnessPlusRoutes);
  app.use("/api/trainer-subscriptions", trainerRoutes);
  await Promise.all([FitnessSubscription.init(), TrainerSubscription.init()]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

let requestCounter = 0;
const nextRequestId = () => `${String(++requestCounter).padStart(8, "0")}-1111-4111-8111-111111111111`;

const fitnessBody = (planCode, billingCycle, expectedAmount) => {
  const { catalogFingerprint, protocolVersion } = getFitnessPlusCatalogMeta();
  return {
    planCode,
    billingCycle,
    requestId: nextRequestId(),
    expectedAmount: expectedAmount ?? getFitnessPlusPlanAmount(planCode, billingCycle),
    catalogFingerprint,
    protocolVersion,
  };
};
const trainerBody = (planCode, billingCycle, expectedAmount) => {
  const { catalogFingerprint, protocolVersion } = getTrainerPlanCatalogMeta();
  return {
    planCode,
    billingCycle,
    requestId: nextRequestId(),
    expectedAmount: expectedAmount ?? getTrainerPlanAmount(planCode, billingCycle),
    catalogFingerprint,
    protocolVersion,
  };
};

const buyFitness = (token, body) => withAuth(request(app).post("/api/fitness-plus-subscriptions").send(body), token);
const buyTrainer = (token, body) => withAuth(request(app).post("/api/trainer-subscriptions").send(body), token);
const quoteFitness = (token, planCode, cycle) =>
  withAuth(request(app).get(`/api/fitness-plus-subscriptions/quotes?planCode=${planCode}&billingCycle=${cycle}`), token);
const quoteTrainer = (token, planCode, cycle) =>
  withAuth(request(app).get(`/api/trainer-subscriptions/quotes?planCode=${planCode}&billingCycle=${cycle}`), token);

const fundedUser = async (email, balance = 5_000_000) => {
  const actor = await createTestUser({ email });
  await Wallet.create({ userId: actor.user._id, balance, version: 0 });
  return actor;
};

// Giả lập đã dùng 15/30 ngày của gói tháng đang chạy.
const ageFitness = (userId) =>
  FitnessSubscription.updateOne(
    { userId, isActive: true },
    { $set: { startDate: new Date(Date.now() - 15 * DAY), endDate: new Date(Date.now() + 15 * DAY) } },
  );
const ageTrainer = (userId) =>
  TrainerSubscription.updateOne(
    { userId, isActive: true },
    { $set: { startDate: new Date(Date.now() - 15 * DAY), endDate: new Date(Date.now() + 15 * DAY) } },
  );

describe("HT Fitness+: nâng cấp từ gói tháng lên gói năm", () => {
  it("báo giá đã trừ phần tháng chưa dùng (Nền tảng 15/30 ngày: 990.000 - 49.500 = 940.500đ)", async () => {
    const actor = await fundedUser("upgrade-quote@example.com");
    expect((await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "month"))).status).toBe(201);
    await ageFitness(actor.user._id);

    const quote = await quoteFitness(actor.accessToken, "fitness_plus_essential", "year");
    expect(quote.status).toBe(200);
    expect(quote.body.data).toMatchObject({
      eligible: true,
      action: "upgrade_to_year",
      listAmount: 990000,
      creditAmount: 49500,
      amount: 940500,
      remainingDays: 15,
      periodDays: 30,
    });
  });

  it("trừ ví đúng số đã trừ tín dụng, ghi giá niêm yết và tín dụng, thay thế gói tháng", async () => {
    const actor = await fundedUser("upgrade-buy@example.com");
    await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "month"));
    await ageFitness(actor.user._id);
    const before = (await Wallet.findOne({ userId: actor.user._id }).lean()).balance;

    const response = await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "year", 940500));
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ billingCycle: "year", amount: 940500 });
    expect((await Wallet.findOne({ userId: actor.user._id }).lean()).balance).toBe(before - 940500);

    const subs = await FitnessSubscription.find({ userId: actor.user._id }).sort({ createdAt: 1 }).lean();
    expect(subs).toHaveLength(2);
    expect(subs[0]).toMatchObject({ status: "superseded", isActive: false });
    expect(subs[1]).toMatchObject({
      billingCycle: "year",
      amount: 940500,
      listAmount: 990000,
      upgradeCreditAmount: 49500,
      isActive: true,
    });
    const tx = await WalletTransaction.findOne({ userId: actor.user._id, referenceId: subs[1]._id }).lean();
    expect(tx.amount).toBe(-940500);
  });

  it("từ chối khi client gửi giá niêm yết thay vì giá đã trừ tín dụng và không trừ ví", async () => {
    const actor = await fundedUser("upgrade-stale@example.com");
    await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "month"));
    await ageFitness(actor.user._id);
    const before = (await Wallet.findOne({ userId: actor.user._id }).lean()).balance;

    const response = await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "year"));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("FITNESS_PLUS_CATALOG_CHANGED");
    expect((await Wallet.findOne({ userId: actor.user._id }).lean()).balance).toBe(before);
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(1);
  });

  it("nâng từ gói tháng lên gói năm của gói cao hơn vẫn được trừ tín dụng", async () => {
    const actor = await fundedUser("upgrade-higher@example.com");
    await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "month"));
    await ageFitness(actor.user._id);
    const quote = await quoteFitness(actor.accessToken, "fitness_plus_smart", "year");
    expect(quote.body.data).toMatchObject({ action: "upgrade_to_year", listAmount: 1990000, creditAmount: 49500, amount: 1940500 });
    expect((await buyFitness(actor.accessToken, fitnessBody("fitness_plus_smart", "year", 1940500))).status).toBe(201);
  });

  it("không cho chuyển gói năm về gói tháng và không cho mua trùng cùng gói cùng chu kỳ", async () => {
    const actor = await fundedUser("upgrade-blocked@example.com");
    await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "year"));

    const down = await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "month"));
    expect(down.status).toBe(409);
    expect(down.body.code).toBe("FITNESS_PLUS_DOWNGRADE_NOT_ALLOWED");
    const same = await buyFitness(actor.accessToken, fitnessBody("fitness_plus_essential", "year"));
    expect(same.status).toBe(409);
    expect(same.body.code).toBe("FITNESS_PLUS_PLAN_ALREADY_ACTIVE");

    const quote = await quoteFitness(actor.accessToken, "fitness_plus_essential", "month");
    expect(quote.body.data).toMatchObject({ eligible: false, code: "FITNESS_PLUS_DOWNGRADE_NOT_ALLOWED" });
    expect(await FitnessSubscription.countDocuments({ userId: actor.user._id })).toBe(1);
  });

  it("gói tặng 0 đồng lên gói năm trả đủ giá niêm yết; báo giá yêu cầu đăng nhập và kiểm tra tham số", async () => {
    const actor = await fundedUser("upgrade-grant@example.com");
    await FitnessSubscription.create({
      userId: actor.user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      source: "admin_grant",
      amount: 0,
      startDate: new Date(Date.now() - 10 * DAY),
      endDate: new Date(Date.now() + 20 * DAY),
      status: "active",
      isActive: true,
    });
    const quote = await quoteFitness(actor.accessToken, "fitness_plus_essential", "year");
    expect(quote.body.data).toMatchObject({ creditAmount: 0, amount: 990000 });

    expect((await request(app).get("/api/fitness-plus-subscriptions/quotes?planCode=fitness_plus_essential&billingCycle=year")).status).toBe(401);
    expect((await quoteFitness(actor.accessToken, "khong_ton_tai", "year")).status).toBe(400);
  });
});

describe("Gói HLV: nâng cấp từ gói tháng lên gói năm", () => {
  it("Tiêu chuẩn tháng đã dùng 15/30 ngày lên năm: 2.000.000 - 100.000 = 1.900.000đ", async () => {
    const actor = await fundedUser("trainer-upgrade@example.com");
    expect((await buyTrainer(actor.accessToken, trainerBody("standard", "month"))).status).toBe(201);
    await ageTrainer(actor.user._id);

    const quote = await quoteTrainer(actor.accessToken, "standard", "year");
    expect(quote.body.data).toMatchObject({ eligible: true, listAmount: 2000000, creditAmount: 100000, amount: 1900000 });

    const before = (await Wallet.findOne({ userId: actor.user._id }).lean()).balance;
    const response = await buyTrainer(actor.accessToken, trainerBody("standard", "year", 1900000));
    expect(response.status).toBe(201);
    expect((await Wallet.findOne({ userId: actor.user._id }).lean()).balance).toBe(before - 1900000);
    const subs = await TrainerSubscription.find({ userId: actor.user._id }).sort({ createdAt: 1 }).lean();
    expect(subs[0]).toMatchObject({ status: "superseded", isActive: false });
    expect(subs[1]).toMatchObject({ billingCycle: "year", amount: 1900000, listAmount: 2000000, upgradeCreditAmount: 100000 });
  });

  it("nâng lên gói năm của gói cao hơn được; sang gói thấp hơn hoặc gói tháng khác bị chặn", async () => {
    const actor = await fundedUser("trainer-tier@example.com");
    await buyTrainer(actor.accessToken, trainerBody("professional", "month"));
    await ageTrainer(actor.user._id);

    const higher = await quoteTrainer(actor.accessToken, "premium", "year");
    expect(higher.body.data).toMatchObject({ eligible: true, creditAmount: 125000, amount: 2875000 });
    const lower = await buyTrainer(actor.accessToken, trainerBody("standard", "year"));
    expect(lower.status).toBe(409);
    expect(lower.body.code).toBe("ACTIVE_SUBSCRIPTION_EXISTS");
    const otherMonth = await buyTrainer(actor.accessToken, trainerBody("premium", "month"));
    expect(otherMonth.status).toBe(409);
    expect(otherMonth.body.code).toBe("ACTIVE_SUBSCRIPTION_EXISTS");
    expect(await TrainerSubscription.countDocuments({ userId: actor.user._id })).toBe(1);
  });

  it("đang dùng gói năm hoặc mua trùng đúng gói thì bị chặn kèm thông báo tiếng Việt", async () => {
    const actor = await fundedUser("trainer-year@example.com");
    await buyTrainer(actor.accessToken, trainerBody("standard", "year"));
    const again = await buyTrainer(actor.accessToken, trainerBody("standard", "year"));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ACTIVE_SUBSCRIPTION_EXISTS");
    expect(again.body.message).toContain("Bạn đang sử dụng gói này");
    const quote = await quoteTrainer(actor.accessToken, "premium", "year");
    expect(quote.body.data.eligible).toBe(false);
  });

  it("giá gửi lên là giá niêm yết thì bị từ chối và không trừ ví", async () => {
    const actor = await fundedUser("trainer-stale@example.com");
    await buyTrainer(actor.accessToken, trainerBody("standard", "month"));
    await ageTrainer(actor.user._id);
    const before = (await Wallet.findOne({ userId: actor.user._id }).lean()).balance;
    const response = await buyTrainer(actor.accessToken, trainerBody("standard", "year"));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CATALOG_CHANGED");
    expect((await Wallet.findOne({ userId: actor.user._id }).lean()).balance).toBe(before);
  });
});
