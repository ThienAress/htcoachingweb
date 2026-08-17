import mongoose from "mongoose";

import FitnessPlusQuotaUsage from "../models/FitnessPlusQuotaUsage.js";

const createStoreError = (message) => {
  const error = new Error(message);
  error.code = "FITNESS_PLUS_QUOTA_STORE_FAILED";
  return error;
};

export class FitnessPlusQuotaStore {
  constructor({
    serviceKey,
    windowMs,
    maxHits,
    clock = Date.now,
    usageModel = FitnessPlusQuotaUsage,
  }) {
    if (!new Set(["ai_chat", "meal_scan"]).has(serviceKey)) {
      throw createStoreError("Unsupported HT Fitness+ quota service");
    }
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
      throw createStoreError("HT Fitness+ quota window must be positive");
    }
    if (!Number.isSafeInteger(maxHits) || maxHits <= 1) {
      throw createStoreError("HT Fitness+ quota storage bound must exceed one");
    }
    this.serviceKey = serviceKey;
    this.windowMs = windowMs;
    this.maxHits = maxHits;
    this.clock = clock;
    this.usageModel = usageModel;
  }

  init(options) {
    if (Number.isSafeInteger(options?.windowMs) && options.windowMs > 0) {
      this.windowMs = options.windowMs;
    }
  }

  getSubjectId(key) {
    if (!mongoose.isValidObjectId(key)) {
      throw createStoreError("HT Fitness+ quota subject is invalid");
    }
    return new mongoose.Types.ObjectId(String(key));
  }

  async increment(key) {
    const userId = this.getSubjectId(key);
    const now = new Date(this.clock());
    const cutoff = new Date(now.getTime() - this.windowMs);
    const filter = { userId, serviceKey: this.serviceKey };
    const pipeline = [
      {
        $set: {
          userId,
          serviceKey: this.serviceKey,
          timestamps: {
            $slice: [
              {
                $concatArrays: [
                  {
                    $filter: {
                      input: { $ifNull: ["$timestamps", []] },
                      as: "timestamp",
                      cond: { $gt: ["$$timestamp", cutoff] },
                    },
                  },
                  [now],
                ],
              },
              -this.maxHits,
            ],
          },
          expiresAt: new Date(now.getTime() + this.windowMs),
        },
      },
    ];

    let usage;
    try {
      usage = await this.usageModel
        .findOneAndUpdate(filter, pipeline, {
          upsert: true,
          returnDocument: "after",
          updatePipeline: true,
        })
        .select("+timestamps +expiresAt")
        .lean();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      usage = await this.usageModel
        .findOneAndUpdate(filter, pipeline, {
          returnDocument: "after",
          updatePipeline: true,
        })
        .select("+timestamps +expiresAt")
        .lean();
    }

    const timestamps = usage?.timestamps || [];
    if (timestamps.length === 0) {
      throw createStoreError("HT Fitness+ quota increment was not persisted");
    }
    return {
      totalHits: timestamps.length,
      resetTime: new Date(
        new Date(timestamps[0]).getTime() + this.windowMs,
      ),
    };
  }

  async decrement(key) {
    const userId = this.getSubjectId(key);
    await this.usageModel.updateOne(
      { userId, serviceKey: this.serviceKey },
      [
        {
          $set: {
            timestamps: {
              $let: {
                vars: { hits: { $ifNull: ["$timestamps", []] } },
                in: {
                  $cond: [
                    { $gt: [{ $size: "$$hits" }, 1] },
                    {
                      $slice: [
                        "$$hits",
                        { $subtract: [{ $size: "$$hits" }, 1] },
                      ],
                    },
                    [],
                  ],
                },
              },
            },
          },
        },
      ],
      { updatePipeline: true },
    );
  }

  async resetKey(key) {
    const userId = this.getSubjectId(key);
    await this.usageModel.deleteOne({ userId, serviceKey: this.serviceKey });
  }

  async resetAll() {
    await this.usageModel.deleteMany({ serviceKey: this.serviceKey });
  }
}
