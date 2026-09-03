import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import Recipe from "../../models/Recipe.js";
import { getRecipes } from "../recipe.controller.js";

describe("GET /api/recipes prerender view", () => {
  afterEach(() => vi.restoreAllMocks());

  it("includes public detail fields only for the prerender view", async () => {
    const aggregate = vi.spyOn(Recipe, "aggregate").mockResolvedValue([
      {
        slug: "mon-prerender",
        name: "Món prerender",
        nutrition: {
          calories: 520,
          protein: 42,
          fat: 18,
          carb: 48,
          sugars: 7,
          salt: 1.4,
          additional: [{ label: "Kali", unit: "mg", value: 920 }],
        },
      },
    ]);
    vi.spyOn(Recipe, "countDocuments").mockResolvedValue(1);
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
      nutrition: 1,
    });
    expect(project).not.toHaveProperty("youtubeUrl");
    expect(response.body.data[0].nutrition).toEqual({
      status: "available",
      source: "admin_manual",
      scope: "whole_recipe",
      values: {
        calories: 520,
        protein: 42,
        fat: 18,
        carb: 48,
        sugars: 7,
        salt: 1.4,
      },
      additional: [{ label: "Kali", unit: "g", value: 0.92 }],
    });
  });
});
