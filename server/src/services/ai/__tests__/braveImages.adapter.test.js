import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFigureImages, normalizeFigureImages } from "../tools/braveImages.adapter.js";

const result = (overrides = {}) => ({
  title: "LeBron James celebrates the title",
  url: "https://www.nba.com/news/lebron-james-title",
  thumbnail: { src: "https://imgs.search.brave.com/abc/rs:fit:500:0:0/g:ce/aHR0cHM", width: 500, height: 333 },
  ...overrides,
});

describe("normalizeFigureImages", () => {
  it("keeps proxied thumbnails of pages that name the person, one per publisher", () => {
    const body = {
      results: [
        result(),
        result({ url: "https://www.nba.com/another-page", title: "LeBron James dunk" }),
        result({ url: "https://www.mensfitness.com/lebron-training", title: "How LeBron trains" }),
      ],
    };
    const images = normalizeFigureImages(body, "LeBron James");
    expect(images.map((image) => image.host)).toEqual(["nba.com", "mensfitness.com"]);
    expect(images[0]).toMatchObject({ width: 500, height: 333, title: "LeBron James celebrates the title" });
  });

  it("drops images that are not proxied, not https, or not about the person", () => {
    const body = {
      results: [
        result({ thumbnail: { src: "https://cdn.publisher.example/lebron.jpg" } }),
        result({ thumbnail: { src: "http://imgs.search.brave.com/a" }, url: "https://a.example/lebron" }),
        result({ url: "https://b.example/page", title: "Stephen Curry shooting" }),
        result({ url: "javascript:alert(1)" }),
      ],
    };
    expect(normalizeFigureImages(body, "LeBron James")).toEqual([]);
  });

  it("matches the surname without diacritics", () => {
    const body = { results: [result({ title: "Hoang Hai Dang", url: "https://a.example/x" })] };
    expect(normalizeFigureImages(body, "Hoàng Hải Đăng")).toHaveLength(1);
  });
});

describe("fetchFigureImages", () => {
  afterEach(() => vi.unstubAllEnvs());

  const configure = () => {
    vi.stubEnv("AI_WEB_SEARCH_PROVIDER", "brave");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "synthetic-key");
  };

  it("asks the image endpoint with strict safe search and returns thumbnails", async () => {
    configure();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [result()] })));
    const images = await fetchFigureImages(["LeBron James"], { fetchImpl });
    expect(images).toHaveLength(1);
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/res/v1/images/search");
    expect(String(url)).toContain("safesearch=strict");
    expect(String(url)).toContain("q=LeBron+James");
  });

  it("returns nothing on provider errors, when disabled, or without subjects", async () => {
    configure();
    const failing = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(fetchFigureImages(["LeBron James"], { fetchImpl: failing })).resolves.toEqual([]);
    const throwing = vi.fn(async () => { throw new Error("network"); });
    await expect(fetchFigureImages(["LeBron James"], { fetchImpl: throwing })).resolves.toEqual([]);
    await expect(fetchFigureImages([], { fetchImpl: failing })).resolves.toEqual([]);
    vi.stubEnv("AI_PUBLIC_FIGURE_IMAGES", "off");
    const spy = vi.fn();
    await expect(fetchFigureImages(["LeBron James"], { fetchImpl: spy })).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
