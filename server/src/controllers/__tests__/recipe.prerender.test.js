import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import Recipe from "../../models/Recipe.js";
import { getRecipes } from "../recipe.controller.js";

describe("GET /api/recipes prerender view", () => {
  afterEach(() => vi.restoreAllMocks());

  it("includes public detail fields only for the prerender view", async () => {
    const aggregate = vi.spyOn(Recipe, "aggregate").mockResolvedValue([]);
    vi.spyOn(Recipe, "countDocuments").mockResolvedValue(0);
    const app = express();
    app.get("/api/recipes", getRecipes);

    const response = await request(app).get(
      "/api/recipes?limit=50&page=1&view=prerender",
    );
    const project = aggregate.mock.calls[0][0].find(
      (stage) => stage.$project,
    ).$project;

    expect(response.status).toBe(200);
    expect(project).toMatchObject({
      ingredients: 1,
      instructions: 1,
      nameEn: 1,
      youtubeUrl: 1,
    });
  });
});
