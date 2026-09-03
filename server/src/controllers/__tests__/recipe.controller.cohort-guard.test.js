import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cloudinaryDestroy: vi.fn(),
  create: vi.fn(),
  deleteOne: vi.fn(),
  findById: vi.fn(),
  reviewDeleteMany: vi.fn(),
  triggerNetlifyBuild: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: { uploader: { destroy: mocks.cloudinaryDestroy } },
}));

vi.mock("../../models/Recipe.js", () => ({
  default: {
    create: mocks.create,
    deleteOne: mocks.deleteOne,
    findById: mocks.findById,
  },
}));

vi.mock("../../models/RecipeReview.js", () => ({
  default: { deleteMany: mocks.reviewDeleteMany },
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  triggerNetlifyBuild: mocks.triggerNetlifyBuild,
}));

import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
} from "../recipe.controller.js";

const PINNED_SLUG = "vietnamese-style-veggie-hotpot";
const substantiveStep = (label) =>
  `${label}: prepare every ingredient carefully, follow the safe cooking order, and verify doneness before continuing to the next detailed step.`;

const makePinnedRecipe = (overrides = {}) => {
  const recipe = {
    _id: "64b000000000000000000001",
    slug: PINNED_SLUG,
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

describe("Recipe search-index cohort mutation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creating an ineligible Recipe with a pinned slug", async () => {
    const res = makeResponse();

    await createRecipe(
      {
        body: {
          name: "Vietnamese Style Veggie Hotpot",
          slug: PINNED_SLUG,
          isPublished: true,
        },
      },
      res,
    );

    expect({
      status: res.statusCode,
      code: res.body?.details?.code,
      creates: mocks.create.mock.calls.length,
      builds: mocks.triggerNetlifyBuild.mock.calls.length,
    }).toEqual({
      status: 409,
      code: "PINNED_RECIPE_INELIGIBLE",
      creates: 0,
      builds: 0,
    });
  });

  it("rejects an update that makes a pinned Recipe ineligible", async () => {
    const recipe = makePinnedRecipe();
    mocks.findById.mockResolvedValue(recipe);
    const res = makeResponse();

    await updateRecipe(
      { params: { id: recipe._id }, body: { instructions: ["Cook briefly"] } },
      res,
    );

    expect({
      status: res.statusCode,
      code: res.body?.details?.code,
      saved: recipe.save.mock.calls.length,
      builds: mocks.triggerNetlifyBuild.mock.calls.length,
    }).toEqual({
      status: 409,
      code: "PINNED_RECIPE_INELIGIBLE",
      saved: 0,
      builds: 0,
    });
  });

  it("rejects changing the canonical slug of a pinned Recipe", async () => {
    const recipe = makePinnedRecipe();
    mocks.findById.mockResolvedValue(recipe);
    const res = makeResponse();

    await updateRecipe(
      { params: { id: recipe._id }, body: { slug: "renamed-hotpot" } },
      res,
    );

    expect({ status: res.statusCode, code: res.body?.details?.code }).toEqual({
      status: 409,
      code: "PINNED_RECIPE_SLUG_CHANGE_BLOCKED",
    });
  });

  it("rejects deleting a pinned Recipe before destructive side effects", async () => {
    const recipe = makePinnedRecipe();
    mocks.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue(recipe),
    });
    const res = makeResponse();

    await deleteRecipe({ params: { id: recipe._id } }, res);

    expect({
      status: res.statusCode,
      code: res.body?.details?.code,
      deletes: mocks.deleteOne.mock.calls.length,
      reviewDeletes: mocks.reviewDeleteMany.mock.calls.length,
      assetDeletes: mocks.cloudinaryDestroy.mock.calls.length,
    }).toEqual({
      status: 409,
      code: "PINNED_RECIPE_DELETE_BLOCKED",
      deletes: 0,
      reviewDeletes: 0,
      assetDeletes: 0,
    });
  });

});
