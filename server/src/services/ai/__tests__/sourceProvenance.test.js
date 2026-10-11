import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeEvidenceSources,
  resolveSourceProvenance,
} from "../sourceProvenance.js";

const GOOGLE_REDIRECT =
  "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aBc_123=";
const response = (status, location, cancel = vi.fn().mockResolvedValue()) => ({
  status,
  headers: { get: vi.fn((name) => (name === "location" ? location : null)) },
  body: { cancel },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("source provenance resolver", () => {
  it("adds only the observed publisher host and cancels the redirect response body", async () => {
    const cancel = vi.fn().mockResolvedValue();
    const fetchMock = vi.fn().mockResolvedValue(
      response(302, "https://pmc.ncbi.nlm.nih.gov/articles/PMC1?x=1", cancel),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sources = await resolveSourceProvenance(
      [{ title: "Untrusted title", uri: GOOGLE_REDIRECT, provenance: { publisherHost: "spoof.test" } }],
      { deadlineAt: Date.now() + 2_000 },
    );

    expect(sources).toEqual([{
      title: "Untrusted title",
      uri: GOOGLE_REDIRECT,
      provenance: { kind: "google_grounding_redirect", publisherHost: "pmc.ncbi.nlm.nih.gov" },
    }]);
    expect(fetchMock).toHaveBeenCalledWith(GOOGLE_REDIRECT, expect.objectContaining({
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    "http://public.example.org/article",
    "https://user:password@public.example.org/article",
    "https://public.example.org:444/article",
    "https://127.0.0.1/article",
    "https://[::1]/article",
    "https://localhost/article",
    "https://service.internal/article",
    "https://singlelabel/article",
    "https://bad_host.example.org/article",
    "https://publisher.example./article",
    "https://publisher.123/article",
    "https://publisher.onion/article",
    "https://publisher.corp/article",
    "https://vertexaisearch.cloud.google.com/grounding-api-redirect/next",
    "https://publisher.example.org/line\nbreak",
    "https://publisher.example.org\\path",
  ])("omits provenance for an untrusted redirect Location: %s", async (location) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(302, location)));

    const sources = await resolveSourceProvenance(
      [{ title: "Source", uri: GOOGLE_REDIRECT }],
      { deadlineAt: Date.now() + 2_000 },
    );

    expect(sources).toEqual([{ title: "Source", uri: GOOGLE_REDIRECT }]);
  });

  it("never requests hostile source URLs or a redirect destination", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hostile = [
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a%2Fb",
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/token?next=https://evil.example",
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/token\\evil",
      "https://evil.example/grounding-api-redirect/token",
    ];

    const sources = await resolveSourceProvenance(
      hostile.map((uri, index) => ({ title: `Hostile ${index}`, uri })),
      { deadlineAt: Date.now() + 2_000 },
    );

    expect(sources).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps first URI order, strips provider provenance, dedupes, and caps at three", async () => {
    const sources = normalizeEvidenceSources([
      { title: "One", uri: "https://one.example/a#section", provenance: { publisherHost: "spoof.test" } },
      { title: "Duplicate", uri: "https://one.example/a" },
      { title: "Two", uri: "https://two.example/a" },
      { title: "Three", uri: "https://three.example/a" },
      { title: "Four", uri: "https://four.example/a" },
    ]);

    expect(sources).toEqual([
      { title: "One", uri: "https://one.example/a" },
      { title: "Two", uri: "https://two.example/a" },
      { title: "Three", uri: "https://three.example/a" },
    ]);
  });

  it("rejects oversize and lexical-control source URIs before URL normalization", () => {
    const sources = normalizeEvidenceSources([
      { title: "Oversize", uri: `https://example.org/${"a".repeat(2_100)}` },
      { title: "Control", uri: "https://example.org/line\nbreak" },
      { title: "Backslash", uri: "https://example.org\\path" },
      { title: "Safe", uri: "https://safe.example.org/article" },
    ]);

    expect(sources).toEqual([{ title: "Safe", uri: "https://safe.example.org/article" }]);
  });

  it("skips enrichment when the absolute tool deadline cannot reserve 500ms", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const sources = await resolveSourceProvenance(
      [{ title: "Source", uri: GOOGLE_REDIRECT }],
      { deadlineAt: Date.now() + 500 },
    );

    expect(sources).toEqual([{ title: "Source", uri: GOOGLE_REDIRECT }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits unresolved provenance after the bounded timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const pending = resolveSourceProvenance(
      [{ title: "Source", uri: GOOGLE_REDIRECT }],
      { deadlineAt: Date.now() + 2_000 },
    );

    await vi.advanceTimersByTimeAsync(750);

    await expect(pending).resolves.toEqual([{ title: "Source", uri: GOOGLE_REDIRECT }]);
  });

  it("propagates a caller abort without retaining provenance", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    })));
    const pending = resolveSourceProvenance(
      [{ title: "Source", uri: GOOGLE_REDIRECT }],
      { signal: controller.signal, deadlineAt: Date.now() + 2_000 },
    );
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
