import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";
import { instrumentCloudinaryStorage } from "../recipeUpload.js";

const invokeStorage = (method, storage) =>
  new Promise((resolve) => {
    storage[method]({}, {}, (error, result) => resolve({ error, result }));
  });

describe("recipe Cloudinary storage metrics", () => {
  beforeEach(resetMetricsForTests);

  it("records provider outcomes at the storage boundary", async () => {
    const engine = {
      _handleFile: vi.fn((_req, _file, callback) =>
        callback(null, { size: 1_024 }),
      ),
      _removeFile: vi.fn((_req, _file, callback) =>
        callback(null, { result: "ok" }),
      ),
    };
    const storage = instrumentCloudinaryStorage(engine);

    await invokeStorage("_handleFile", storage);
    await invokeStorage("_removeFile", storage);

    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.cloudinary_uploads": 1,
      "provider.cloudinary_upload_bytes": 1_024,
      "provider.cloudinary_deletes": 1,
    });
  });

  it("records only real storage failures", async () => {
    const engine = {
      _handleFile: vi.fn((_req, _file, callback) =>
        callback(new Error("provider upload failed")),
      ),
      _removeFile: vi.fn((_req, _file, callback) =>
        callback(new Error("provider delete failed")),
      ),
    };
    const storage = instrumentCloudinaryStorage(engine);

    await invokeStorage("_handleFile", storage);
    await invokeStorage("_removeFile", storage);

    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.cloudinary_upload_failures": 1,
      "provider.cloudinary_delete_failures": 1,
    });
  });
});
