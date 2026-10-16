import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import f1CustomerRoutes from "../../routes/f1Customer.routes.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import F1Customer from "../../models/F1Customer.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import {
  processF1DataDeletionBatch,
  purgeExpiredSoftDeletedF1Customers,
} from "../../services/f1PrivacyLifecycle.service.js";

let app;
let seq = 0;

const createTrainer = async (email, planCode = "professional") => {
  const actor = await createTestUser({ email, role: "trainer" });
  await TrainerSubscription.create({
    userId: actor.user._id,
    planTitle: planCode === "premium" ? "Cao cấp" : "Chuyên nghiệp",
    planCode,
    billingCycle: "month",
    source: "admin_grant",
    amount: 0,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "active",
    isActive: true,
  });
  return actor;
};

const payload = () => ({
  occupation: "Van phong",
  phone: "0912345678",
  email: "f1soft@gmail.com",
  fullName: "Khach Hang F1",
  age: 30,
  gender: "female",
});

const create = (actor) =>
  withAuth(request(app).post("/api/f1-customers"), actor.accessToken).send(
    payload(),
  );

// Tạo sẵn khách cho HLV mà không đi qua API để chạm nhanh tới hạn mức.
const seedCustomers = async (actor, count) => {
  const docs = Array.from({ length: count }, () => {
    seq += 1;
    return {
      code: `F1-SOFT-${seq}`,
      ...payload(),
      assignedTrainerId: actor.user._id,
      createdBy: actor.user._id,
    };
  });
  return F1Customer.create(docs);
};

const del = (actor, id) =>
  withAuth(request(app).delete(`/api/f1-customers/${id}`), actor.accessToken);
const restore = (actor, id) =>
  withAuth(
    request(app).post(`/api/f1-customers/${id}/restore`),
    actor.accessToken,
  );

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/f1-customers", f1CustomerRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("F1 soft delete", () => {
  it("hides a deleted customer from the list and keeps every field for restore", async () => {
    const trainer = await createTrainer("f1-soft-hide@example.com");
    const [customer] = await seedCustomers(trainer, 1);

    const response = await del(trainer, customer._id);
    expect(response.status).toBe(200);
    expect(response.body.message).toContain("7 ngày");

    const stored = await F1Customer.findById(customer._id).lean();
    expect(stored.fullName).toBe("Khach Hang F1");
    expect(stored.deletionRequestedAt).toBeNull();
    const days =
      (stored.purgeAt.getTime() - stored.softDeletedAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(7, 5);

    const list = await withAuth(
      request(app).get("/api/f1-customers"),
      trainer.accessToken,
    );
    expect(list.body.data).toHaveLength(0);

    const deleted = await withAuth(
      request(app).get("/api/f1-customers/deleted"),
      trainer.accessToken,
    );
    expect(deleted.body.data.map((item) => item.fullName)).toEqual([
      "Khach Hang F1",
    ]);
  });

  it("blocks reading and writing a soft-deleted customer", async () => {
    const trainer = await createTrainer("f1-soft-block@example.com");
    const [customer] = await seedCustomers(trainer, 1);
    await del(trainer, customer._id);

    const detail = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}/intake/latest`),
      trainer.accessToken,
    );
    const patch = await withAuth(
      request(app).patch(`/api/f1-customers/${customer._id}`),
      trainer.accessToken,
    ).send({ fullName: "Doi ten" });
    const again = await del(trainer, customer._id);

    expect(detail.status).toBe(409);
    expect(detail.body.code).toBe("F1_CUSTOMER_SOFT_DELETED");
    expect(patch.status).toBe(409);
    expect(again.status).toBe(409);
  });

  it("restores the customer with its old data", async () => {
    const trainer = await createTrainer("f1-soft-restore@example.com");
    const [customer] = await seedCustomers(trainer, 1);
    await del(trainer, customer._id);

    const response = await restore(trainer, customer._id);
    expect(response.status).toBe(200);

    const stored = await F1Customer.findById(customer._id).lean();
    expect(stored.softDeletedAt).toBeNull();
    expect(stored.purgeAt).toBeNull();
    const list = await withAuth(
      request(app).get("/api/f1-customers"),
      trainer.accessToken,
    );
    expect(list.body.data).toHaveLength(1);
    expect((await restore(trainer, customer._id)).status).toBe(409);
  });

  it("does not let another trainer list or restore the customer", async () => {
    const owner = await createTrainer("f1-soft-owner@example.com");
    const other = await createTrainer("f1-soft-other@example.com");
    const [customer] = await seedCustomers(owner, 1);
    await del(owner, customer._id);

    const deleted = await withAuth(
      request(app).get("/api/f1-customers/deleted"),
      other.accessToken,
    );
    expect(deleted.body.data).toHaveLength(0);
    expect((await restore(other, customer._id)).status).toBe(403);
    expect((await del(other, customer._id)).status).toBe(403);
  });

  it("refuses to restore after the 7 days passed", async () => {
    const trainer = await createTrainer("f1-soft-expired@example.com");
    const [customer] = await seedCustomers(trainer, 1);
    await del(trainer, customer._id);
    await F1Customer.updateOne(
      { _id: customer._id },
      { $set: { purgeAt: new Date(Date.now() - 1000) } },
    );

    const response = await restore(trainer, customer._id);
    const deleted = await withAuth(
      request(app).get("/api/f1-customers/deleted"),
      trainer.accessToken,
    );

    expect(response.status).toBe(410);
    expect(deleted.body.data).toHaveLength(0);
  });

  it("purges only the customers whose 7 days are over", async () => {
    const trainer = await createTrainer("f1-soft-purge@example.com");
    const [expired, fresh] = await seedCustomers(trainer, 2);
    await del(trainer, expired._id);
    await del(trainer, fresh._id);
    await F1Customer.updateOne(
      { _id: expired._id },
      { $set: { purgeAt: new Date(Date.now() - 1000) } },
    );

    const result = await purgeExpiredSoftDeletedF1Customers();
    expect(result.queued).toBe(1);

    const purged = await F1Customer.findById(expired._id).lean();
    const kept = await F1Customer.findById(fresh._id).lean();
    expect(purged.deletionRequestedAt).not.toBeNull();
    expect(kept.deletionRequestedAt).toBeNull();
  });
});

describe("F1 customer detail", () => {
  it("lets the assigned trainer read the detail but not another trainer", async () => {
    const owner = await createTrainer("f1-detail-owner@example.com");
    const other = await createTrainer("f1-detail-other@example.com");
    const [customer] = await seedCustomers(owner, 1);

    const own = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}`),
      owner.accessToken,
    );
    const foreign = await withAuth(
      request(app).get(`/api/f1-customers/${customer._id}`),
      other.accessToken,
    );

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
  });
});

describe("F1 customer quota", () => {
  it("blocks creating beyond the plan limit with a Vietnamese message", async () => {
    const trainer = await createTrainer("f1-quota-limit@example.com");
    await seedCustomers(trainer, 20);

    const response = await create(trainer);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("F1_QUOTA_EXCEEDED");
    expect(response.body.message).toContain("tối đa 20 khách hàng F1");
    expect(await F1Customer.countDocuments({})).toBe(20);
  });

  it("still blocks after deleting customers: deleted ones keep counting", async () => {
    const trainer = await createTrainer("f1-quota-delete@example.com");
    const customers = await seedCustomers(trainer, 20);

    expect((await del(trainer, customers[0]._id)).status).toBe(200);
    expect((await del(trainer, customers[1]._id)).status).toBe(200);

    const response = await create(trainer);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("F1_QUOTA_EXCEEDED");
  });

  it("keeps counting customers whose data was permanently purged", async () => {
    const trainer = await createTrainer("f1-quota-purged@example.com");
    const customers = await seedCustomers(trainer, 20);
    await del(trainer, customers[0]._id);
    await F1Customer.updateOne(
      { _id: customers[0]._id },
      { $set: { purgeAt: new Date(Date.now() - 1000) } },
    );
    await purgeExpiredSoftDeletedF1Customers();
    await processF1DataDeletionBatch();

    const purged = await F1Customer.findById(customers[0]._id).lean();
    expect(purged.fullName).toBe("Deleted F1 Customer");
    expect(purged.assignedTrainerId).toBeNull();

    const response = await create(trainer);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("F1_QUOTA_EXCEEDED");
  });

  it("does not add to the count when restoring", async () => {
    const trainer = await createTrainer("f1-quota-restore@example.com");
    const customers = await seedCustomers(trainer, 19);
    await del(trainer, customers[0]._id);
    await restore(trainer, customers[0]._id);

    expect((await create(trainer)).status).toBe(201);
    expect((await create(trainer)).status).toBe(403);
    expect(await F1Customer.countDocuments({ createdBy: trainer.user._id })).toBe(
      20,
    );
  });

  it("uses the limit of the current plan", async () => {
    const trainer = await createTrainer("f1-quota-premium@example.com", "premium");
    await seedCustomers(trainer, 20);

    expect((await create(trainer)).status).toBe(201);
  });

  it("only counts customers created inside the current plan period", async () => {
    const trainer = await createTrainer("f1-quota-period@example.com");
    const customers = await seedCustomers(trainer, 20);
    await F1Customer.collection.updateMany(
      { _id: { $in: customers.map((item) => item._id) } },
      { $set: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } },
    );

    expect((await create(trainer)).status).toBe(201);
  });

  it("counts per trainer, not across trainers", async () => {
    const full = await createTrainer("f1-quota-full@example.com");
    const other = await createTrainer("f1-quota-other@example.com");
    await seedCustomers(full, 20);

    expect((await create(other)).status).toBe(201);
  });

  it("does not limit admins", async () => {
    const admin = await createTestUser({
      email: "f1-quota-admin@example.com",
      role: "admin",
    });
    await seedCustomers(admin, 25);

    expect((await create(admin)).status).toBe(201);
  });

  it("lets only the allowed number through when requests race", async () => {
    const trainer = await createTrainer("f1-quota-race@example.com");
    await seedCustomers(trainer, 18);

    const responses = await Promise.all([
      create(trainer),
      create(trainer),
      create(trainer),
      create(trainer),
    ]);
    const created = responses.filter((item) => item.status === 201);

    expect(created).toHaveLength(2);
    expect(
      responses.filter((item) => item.status === 403).length,
    ).toBeGreaterThanOrEqual(2);
    expect(await F1Customer.countDocuments({ createdBy: trainer.user._id })).toBe(
      20,
    );
  });
});
