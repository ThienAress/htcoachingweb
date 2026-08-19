import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { createSkillRadarWorker } from "../skillRadarWorkerLifecycle.js";

const createDependencies = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  startCron: vi.fn().mockResolvedValue(undefined),
  stopCron: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
});

describe("Skill Radar worker lifecycle", () => {
  it("starts the database and Radar cron only once", async () => {
    const dependencies = createDependencies();
    const worker = createSkillRadarWorker(dependencies);

    await worker.start();
    await worker.start();

    expect(dependencies.connect).toHaveBeenCalledTimes(1);
    expect(dependencies.startCron).toHaveBeenCalledTimes(1);
  });

  it("stops the Radar cron before disconnecting once", async () => {
    const dependencies = createDependencies();
    const order = [];
    dependencies.stopCron.mockImplementation(async () => order.push("cron"));
    dependencies.disconnect.mockImplementation(async () => order.push("db"));
    const worker = createSkillRadarWorker(dependencies);
    await worker.start();

    await Promise.all([worker.stop(), worker.stop()]);

    expect(order).toEqual(["cron", "db"]);
  });

  it("disconnects when cron startup fails", async () => {
    const dependencies = createDependencies();
    dependencies.startCron.mockRejectedValue(new Error("synthetic start failure"));
    const worker = createSkillRadarWorker(dependencies);

    await expect(worker.start()).rejects.toThrow("synthetic start failure");
    expect(dependencies.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the web server free of the Radar cron lifecycle", async () => {
    const [serverSource, workerSource] = await Promise.all([
      readFile(new URL("../../../server.js", import.meta.url), "utf8"),
      readFile(new URL("../skillRadar.worker.js", import.meta.url), "utf8"),
    ]);

    expect(serverSource).not.toMatch(/(?:start|stop)SkillRadarCron/);
    expect(workerSource).toMatch(/startSkillRadarCron/);
    expect(workerSource).not.toMatch(
      /(?:Deposit|Subscription|ScheduleReminder|Contract|Cleanup|F1|SePay).*Cron/,
    );
  });
});
