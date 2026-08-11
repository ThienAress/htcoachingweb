import { describe, expect, it } from "vitest";

import { summarizeFoodPriceObservations } from "../foodPrice.service.js";

const observation = ({
  sourceKey = "bach_hoa_xanh",
  observedAt = "2026-08-11T00:00:00.000Z",
  packGrams = 500,
  regularPriceVnd = 60_000,
} = {}) => ({
  sourceKey,
  observedAt: new Date(observedAt),
  packGrams,
  regularPriceVnd,
});

describe("Food market price summary", () => {
  it("publishes a reference price from one observation", () => {
    expect(summarizeFoodPriceObservations([observation()])).toMatchObject({
      lowVndPer100g: 12_000,
      typicalVndPer100g: 12_000,
      highVndPer100g: 12_000,
      sourceCount: 1,
      coverageStatus: "sufficient",
    });
  });

  it("uses the newest observation and a stable source priority for equal dates", () => {
    const result = summarizeFoodPriceObservations([
      observation({
        sourceKey: "coop_online",
        observedAt: "2026-08-11T00:00:00.000Z",
        regularPriceVnd: 70_000,
      }),
      observation({
        sourceKey: "bach_hoa_xanh",
        observedAt: "2026-08-11T00:00:00.000Z",
        regularPriceVnd: 60_000,
      }),
      observation({
        sourceKey: "winmart",
        observedAt: "2026-08-12T00:00:00.000Z",
        regularPriceVnd: 65_000,
      }),
    ]);

    expect(result).toMatchObject({
      typicalVndPer100g: 13_000,
      sourceCount: 1,
      asOf: new Date("2026-08-12T00:00:00.000Z"),
    });
    expect(
      summarizeFoodPriceObservations([
        observation({ sourceKey: "coop_online", regularPriceVnd: 70_000 }),
        observation({ sourceKey: "bach_hoa_xanh", regularPriceVnd: 60_000 }),
      ]).typicalVndPer100g,
    ).toBe(12_000);
  });
});
