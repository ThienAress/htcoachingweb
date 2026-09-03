import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cloudinaryDestroy: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  triggerNetlifyBuild: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mocks.cloudinaryDestroy } },
}));
vi.mock("../../models/Recipe.js", () => ({
  default: { create: mocks.create, findById: mocks.findById },
}));
vi.mock("../../models/RecipeReview.js", () => ({ default: {} }));
vi.mock("../../utils/triggerBuild.js", () => ({
  triggerNetlifyBuild: mocks.triggerNetlifyBuild,
}));

import {
  createRecipe,
  updateRecipe,
  uploadThumbnail,
} from "../recipe.controller.js";

const substantiveStep = (label) =>
  `${label}: prepare every ingredient carefully, follow the safe cooking order, and verify doneness before continuing to the next detailed step.`;

const makeRecipe = (overrides = {}) => {
  const recipe = {
    _id: "64b000000000000000000001",
    slug: "vietnamese-style-veggie-hotpot",
    name: "Vietnamese Style Veggie Hotpot",
    thumbnail: "https://images.example.test/hotpot.jpg",
    sourceUrl: "https://source.example.test/hotpot",
    ingredients: [
      { name: "Carrot", measure: "100 g" },
      { name: "Tofu", measure: "200 g" },
      { name: "Mushroom", measure: "150 g" },
    ],
    instructions: [
      substantiveStep("Prepare"),
      substantiveStep("Cook"),
      substantiveStep("Finish"),
    ],
    nutrition: {
      scope: "whole_recipe",
      source: "admin_manual",
      calories: 520,
      protein: 42,
      fat: 18,
      carb: 48,
      sugars: 7,
      salt: 1.4,
    },
    isPublished: true,
    thumbnailPublicId: "htcoaching/recipes/hotpot",
    save: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(function set(updates) {
      Object.assign(this, updates);
    }),
    ...overrides,
  };
  recipe.toObject = vi.fn(function toObject() {
    const { save, set, toObject, ...plainRecipe } = this;
    return plainRecipe;
  });
  return recipe;
};

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,
  status: vi.fn(function status(code) {
    this.statusCode = code;
    return this;
  }),
  json: vi.fn(function json(body) {
    this.body = body;
    return this;
  }),
});

describe("Recipe admin response and thumbnail contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns canonical grams from create and update responses", async () => {
    const legacyNutrition = {
      ...makeRecipe().nutrition,
      additional: [{ label: "Natri", unit: "mg", value: 2000 }],
    };
    const createdRecipe = makeRecipe({
      slug: "admin-created-recipe",
      isPublished: false,
      nutrition: legacyNutrition,
    });
    mocks.create.mockResolvedValue(createdRecipe);
    const createRes = makeResponse();
    await createRecipe({ body: { name: "Admin created recipe" } }, createRes);

    const updatedRecipe = makeRecipe({ nutrition: legacyNutrition });
    mocks.findById.mockResolvedValue(updatedRecipe);
    const updateRes = makeResponse();
    await updateRecipe(
      { params: { id: updatedRecipe._id }, body: { name: updatedRecipe.name } },
      updateRes,
    );

    expect({
      created: createRes.body?.data?.nutrition?.additional,
      updated: updateRes.body?.data?.nutrition?.additional,
    }).toEqual({
      created: [{ label: "Natri", unit: "g", value: 2 }],
      updated: [{ label: "Natri", unit: "g", value: 2 }],
    });
  });

  it("rejects an ineligible pinned thumbnail and removes only the new asset", async () => {
    const recipe = makeRecipe({ sourceUrl: "" });
    const res = makeResponse();
    await uploadThumbnail(
      {
        file: {
          filename: "htcoaching/recipes/new-hotpot",
          path: "https://images.example.test/new-hotpot.jpg",
        },
        recipe,
      },
      res,
    );

    expect({
      status: res.statusCode,
      code: res.body?.details?.code,
      saved: recipe.save.mock.calls.length,
      destroyed: mocks.cloudinaryDestroy.mock.calls,
      builds: mocks.triggerNetlifyBuild.mock.calls.length,
    }).toEqual({
      status: 409,
      code: "PINNED_RECIPE_INELIGIBLE",
      saved: 0,
      destroyed: [["htcoaching/recipes/new-hotpot"]],
      builds: 0,
    });
  });

  it("persists a published thumbnail before cleanup and rebuild", async () => {
    const recipe = makeRecipe({
      nutrition: {
        ...makeRecipe().nutrition,
        additional: [{ label: "Kali", unit: "mg", value: 920 }],
      },
    });
    const res = makeResponse();
    await uploadThumbnail(
      {
        file: {
          filename: "htcoaching/recipes/new-hotpot",
          path: "https://images.example.test/new-hotpot.jpg",
        },
        recipe,
      },
      res,
    );

    expect({
      status: res.statusCode,
      saved: recipe.save.mock.calls.length,
      destroyed: mocks.cloudinaryDestroy.mock.calls,
      builds: mocks.triggerNetlifyBuild.mock.calls.length,
      nutrition: res.body?.data?.nutrition?.additional,
      internalAssetId: res.body?.data?.thumbnailPublicId,
      persistedBeforeCleanup:
        recipe.save.mock.invocationCallOrder[0] <
        mocks.cloudinaryDestroy.mock.invocationCallOrder[0],
      cleanedBeforeBuild:
        mocks.cloudinaryDestroy.mock.invocationCallOrder[0] <
        mocks.triggerNetlifyBuild.mock.invocationCallOrder[0],
    }).toEqual({
      status: 200,
      saved: 1,
      destroyed: [["htcoaching/recipes/hotpot"]],
      builds: 1,
      nutrition: [{ label: "Kali", unit: "g", value: 0.92 }],
      internalAssetId: undefined,
      persistedBeforeCleanup: true,
      cleanedBeforeBuild: true,
    });
  });

  it("cleans the new asset and skips rebuild when persistence fails", async () => {
    const recipe = makeRecipe({
      slug: "unpublished-admin-recipe",
      isPublished: false,
      save: vi.fn().mockRejectedValue(new Error("save failed")),
    });
    const res = makeResponse();
    await uploadThumbnail(
      {
        file: {
          filename: "htcoaching/recipes/new-admin-recipe",
          path: "https://images.example.test/new-admin-recipe.jpg",
        },
        recipe,
      },
      res,
    );

    expect({
      status: res.statusCode,
      destroyed: mocks.cloudinaryDestroy.mock.calls,
      builds: mocks.triggerNetlifyBuild.mock.calls.length,
    }).toEqual({
      status: 500,
      destroyed: [["htcoaching/recipes/new-admin-recipe"]],
      builds: 0,
    });
  });
});
