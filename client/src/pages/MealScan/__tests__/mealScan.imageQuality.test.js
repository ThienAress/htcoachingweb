import { describe, expect, test } from "vitest";

import {
  assessMealImageQuality,
  measureMealImagePixels,
} from "../mealScan.imageQuality.js";

const solidPixels = (width, height, value) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { data, width, height };
};

describe("meal scan image quality", () => {
  test("measures luminance and zero contrast for a solid image", () => {
    expect(measureMealImagePixels(solidPixels(4, 4, 100))).toMatchObject({
      luminanceMean: 100,
      contrastDeviation: 0,
      sharpnessVariance: 0,
    });
  });

  test("blocks images that are too small and effectively black", () => {
    expect(
      assessMealImageQuality({
        sourceWidth: 200,
        sourceHeight: 300,
        metrics: {
          luminanceMean: 5,
          contrastDeviation: 20,
          sharpnessVariance: 100,
        },
      }),
    ).toMatchObject({
      usable: false,
      blockingIssues: ["low_resolution", "too_dark"],
    });
  });

  test("keeps uncertain blur and contrast as warnings instead of false-positive blocks", () => {
    expect(
      assessMealImageQuality({
        sourceWidth: 1280,
        sourceHeight: 960,
        metrics: {
          luminanceMean: 110,
          contrastDeviation: 10,
          sharpnessVariance: 20,
        },
      }),
    ).toEqual({
      usable: true,
      blockingIssues: [],
      warnings: ["low_contrast", "possibly_blurry"],
      metrics: {
        luminanceMean: 110,
        contrastDeviation: 10,
        sharpnessVariance: 20,
      },
    });
  });
});
