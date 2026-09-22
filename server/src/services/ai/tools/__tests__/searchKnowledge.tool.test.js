import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchKnowledge } from "../searchKnowledge.tool.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../../../observability/metrics.js";

beforeEach(resetMetricsForTests);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_SEARCH_MODEL;
});

describe("Google grounding source boundary", () => {
  it("shows the actual source host alongside an untrusted publisher title", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{
              content: { parts: [{ text: "Một dữ kiện được nguồn hỗ trợ." }] },
              groundingMetadata: {
                groundingSupports: [{
                  segment: { text: "Một dữ kiện được nguồn hỗ trợ." },
                  groundingChunkIndices: [0],
                }],
                groundingChunks: [{
                  web: {
                    title: "World Health Organization",
                    uri: "https://evil.example/phish",
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "fitness research" });

    expect(result.text).toContain(
      "[World Health Organization (evil.example)](<https://evil.example/phish>)",
    );
    expect(result.uiCard).toMatchObject({
      cardType: "webSources",
      data: {
        topic: "fitness research",
        searchedAt: expect.any(String),
        sources: [
          {
            title: "World Health Organization (evil.example)",
            uri: "https://evil.example/phish",
          },
        ],
      },
    });
  });

  it("does not render a provider-authored link or URL from a supported segment", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const segment = "Squat giúp tập chân. Xem [hướng dẫn](https://untrusted.example/phishing), https://untrusted.example/offer và <https://untrusted.example/more>.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{
              content: { parts: [{ text: segment }] },
              groundingMetadata: {
                groundingSupports: [{
                  segment: { text: segment },
                  groundingChunkIndices: [0],
                }],
                groundingChunks: [{
                  web: {
                    title: "Verified article",
                    uri: "https://trusted.example/squat",
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "squat mechanics" });

    expect(result.text).toBe(
      "Squat giúp tập chân. Xem hướng dẫn,  và .\n\n📎 *Nguồn: [Verified article (trusted.example)](<https://trusted.example/squat>)*",
    );
  });

  it("neutralizes provider-authored relative, reference and autolink syntax", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const segment = "Đọc [bài tập](/fake) và [hồ sơ][ref], ![ảnh](//untrusted.example/x), www.untrusted.example, coach@untrusted.example.\n\n[ref]: https://untrusted.example/ref";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{
              content: { parts: [{ text: segment }] },
              groundingMetadata: {
                groundingSupports: [{
                  segment: { text: segment },
                  groundingChunkIndices: [0],
                }],
                groundingChunks: [{
                  web: {
                    title: "Verified article",
                    uri: "https://trusted.example/squat",
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "squat mechanics" });

    expect(result.text).toBe(
      "Đọc bài tập và hồ sơ, ảnh, , .\n\n📎 *Nguồn: [Verified article (trusted.example)](<https://trusted.example/squat>)*",
    );
  });

  it("treats a URL-only grounded segment as unavailable evidence", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{
              content: { parts: [{ text: "https://untrusted.example/redirect" }] },
              groundingMetadata: {
                groundingSupports: [{
                  segment: { text: "https://untrusted.example/redirect" },
                  groundingChunkIndices: [0],
                }],
                groundingChunks: [{
                  web: {
                    title: "Verified article",
                    uri: "https://trusted.example/squat",
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "squat mechanics" });

    expect(result).toMatchObject({
      text: expect.stringMatching(/chưa tìm thấy nguồn/i),
      uiCard: null,
      meta: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "no_supported_source",
      },
    });
  });

  it("keeps only bounded HTTPS sources and safe Markdown labels", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: "Kết quả tra cứu." }] },
                groundingMetadata: {
                  groundingSupports: [
                    {
                      segment: { text: "Kết quả tra cứu." },
                      groundingChunkIndices: [0],
                    },
                  ],
                  groundingChunks: [
                    {
                      web: {
                        title: "Trusted [source]\u202Etxt.exe",
                        uri: "https://example.com/article#tracking",
                      },
                    },
                    {
                      web: {
                        title: "Unsafe",
                        uri: "javascript:alert(document.domain)",
                      },
                    },
                    {
                      web: {
                        title: "Credential URL",
                        uri: "https://user:password@example.com/private",
                      },
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 24,
              candidatesTokenCount: 6,
              totalTokenCount: 30,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "fitness research" });

    expect(result.meta).toEqual({
      evidenceAvailable: true,
      sourceCount: 1,
      searchOutcome: "grounded",
      diagnosticCode: "grounded",
      providerRequestMade: true,
      sources: [
        {
          title: "Trusted \\[source\\] txt.exe (example.com)",
          uri: "https://example.com/article",
        },
      ],
    });
    expect(result.text).toContain(
      "[Trusted \\[source\\] txt.exe (example.com)](<https://example.com/article>)",
    );
    expect(result.text).not.toContain("\u202E");
    expect(result.text).not.toContain("javascript:");
    expect(result.text).not.toContain("password");
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_search_grounding_requests": 1,
      "provider.gemini_search_grounding_succeeded": 1,
      "provider.gemini_search_grounding_prompt_tokens": 24,
      "provider.gemini_search_grounding_output_tokens": 6,
      "provider.gemini_search_grounding_total_tokens": 30,
    });
  });

  it("counts a rejected grounding request without logging its query", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { status: "UNAVAILABLE" },
            usageMetadata: {
              promptTokenCount: 5,
              candidatesTokenCount: 1,
              totalTokenCount: 6,
            },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const result = await searchKnowledge({ query: "synthetic private query" });

    expect(result).toMatchObject({
      text: expect.stringMatching(/không thể xác minh/i),
      meta: {
        evidenceAvailable: false,
        sourceCount: 0,
        searchOutcome: "provider_error",
        diagnosticCode: "upstream_error",
        providerRequestMade: true,
      },
    });
    expect(result.text).not.toMatch(/kiến thức có sẵn|hỏi trực tiếp/i);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_search_grounding_requests": 1,
      "provider.gemini_search_grounding_failed": 1,
      "provider.gemini_search_grounding_prompt_tokens": 5,
      "provider.gemini_search_grounding_output_tokens": 1,
      "provider.gemini_search_grounding_total_tokens": 6,
      "provider.gemini_search_grounding_upstream_error": 1,
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      "synthetic private query",
    );
  });

  it("reports a missing provider configuration without making a Gemini request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchKnowledge({ query: "fitness research" });

    expect({
      providerCalls: fetchMock.mock.calls.length,
      meta: result.meta,
      counters: getMetricsSnapshot().counters,
    }).toMatchObject({
      providerCalls: 0,
      meta: {
        searchOutcome: "provider_error",
        diagnosticCode: "not_configured",
        providerRequestMade: false,
      },
      counters: {
        "provider.gemini_search_grounding_requests": 0,
        "provider.gemini_search_grounding_not_configured": 1,
      },
    });
  });

  it.each([
    [400, "request_rejected", "provider.gemini_search_grounding_request_rejected"],
    [404, "request_rejected", "provider.gemini_search_grounding_request_rejected"],
    [401, "permission_denied", "provider.gemini_search_grounding_permission_denied"],
    [403, "permission_denied", "provider.gemini_search_grounding_permission_denied"],
    [429, "rate_limited", "provider.gemini_search_grounding_rate_limited"],
    [502, "upstream_error", "provider.gemini_search_grounding_upstream_error"],
    [422, "http_error", "provider.gemini_search_grounding_http_error"],
  ])(
    "classifies HTTP %i without exposing provider details",
    async (status, diagnosticCode, metricName) => {
      process.env.GEMINI_API_KEY = "test-key";
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response('{"error":{"message":"synthetic provider detail"}}', {
            status,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const result = await searchKnowledge({ query: "fitness research" });
      const counters = getMetricsSnapshot().counters;

      expect({
        textLeaksProviderDetail: result.text.includes("synthetic provider detail"),
        meta: result.meta,
        requestCount: counters["provider.gemini_search_grounding_requests"],
        failureCount: counters["provider.gemini_search_grounding_failed"],
        dispositionCount: counters[metricName],
      }).toEqual({
        textLeaksProviderDetail: false,
        meta: {
          evidenceAvailable: false,
          sourceCount: 0,
          sources: [],
          searchOutcome: "provider_error",
          diagnosticCode,
          providerRequestMade: true,
        },
        requestCount: 1,
        failureCount: 1,
        dispositionCount: 1,
      });
    },
  );

  it("classifies a network failure and never logs the query", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const query = "synthetic query that must stay private";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`network failure for ${query}`);
      }),
    );

    const result = await searchKnowledge({ query });

    expect({
      meta: result.meta,
      queryLeaked: JSON.stringify(warnSpy.mock.calls).includes(query),
      counters: getMetricsSnapshot().counters,
    }).toMatchObject({
      meta: {
        searchOutcome: "provider_error",
        diagnosticCode: "network_error",
        providerRequestMade: true,
      },
      queryLeaked: false,
      counters: {
        "provider.gemini_search_grounding_failed": 1,
        "provider.gemini_search_grounding_network_error": 1,
      },
    });
  });

  it("classifies a successful HTTP response with invalid JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await searchKnowledge({ query: "fitness research" });

    expect({
      meta: result.meta,
      counters: getMetricsSnapshot().counters,
    }).toMatchObject({
      meta: {
        searchOutcome: "provider_error",
        diagnosticCode: "invalid_response",
        providerRequestMade: true,
      },
      counters: {
        "provider.gemini_search_grounding_failed": 1,
        "provider.gemini_search_grounding_invalid_response": 1,
      },
    });
  });

  it("records an aborted grounding request before propagating cancellation", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const controller = new AbortController();
    controller.abort(new Error("synthetic abort"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw controller.signal.reason;
      }),
    );
    let caught;

    try {
      await searchKnowledge(
        { query: "fitness research" },
        { signal: controller.signal },
      );
    } catch (error) {
      caught = error;
    }

    expect({
      caught: caught?.message,
      counters: getMetricsSnapshot().counters,
    }).toMatchObject({
      caught: "synthetic abort",
      counters: {
        "provider.gemini_search_grounding_requests": 1,
        "provider.gemini_search_grounding_failed": 1,
        "provider.gemini_search_grounding_aborted": 1,
      },
    });
  });

  it("uses a neutral evidence instruction for safe general web queries", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Lisa là một nghệ sĩ." }] },
              groundingMetadata: {
                groundingSupports: [
                  {
                    segment: { text: "Lisa là một nghệ sĩ." },
                    groundingChunkIndices: [0],
                  },
                ],
                groundingChunks: [
                  {
                    web: {
                      title: "Official profile",
                      uri: "https://example.com/lisa",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchKnowledge(
      { query: "Lisa latest public profile" },
      { allowedPublicPersonNames: ["Lisa"] },
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect({
      instruction: requestBody.systemInstruction.parts[0].text,
      tools: requestBody.tools,
      mapsToolPresent: JSON.stringify(requestBody.tools).includes("googleMaps"),
    }).toEqual({
      instruction: expect.stringMatching(
        /bằng chứng web công khai[\s\S]*mọi chủ đề an toàn/i,
      ),
      tools: [{ googleSearch: {} }],
      mapsToolPresent: false,
    });
  });

  it("marks a source-free answer as unavailable evidence", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Unsupported text" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge(
      { query: "Ronaldo routine" },
      { allowedPublicPersonNames: ["Ronaldo"] },
    );

    expect(result).toMatchObject({
      text: expect.stringMatching(/chưa tìm thấy nguồn/i),
      meta: {
        evidenceAvailable: false,
        sourceCount: 0,
        searchOutcome: "no_supported_source",
        diagnosticCode: "no_supported_source",
        providerRequestMade: true,
      },
    });
  });

  it("rejects HTTPS chunks that are not referenced by grounding supports", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: "Unsupported claim." }] },
                groundingMetadata: {
                  groundingChunks: [
                    {
                      web: {
                        title: "Unbound source",
                        uri: "https://example.com/unbound",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await searchKnowledge(
      { query: "Ronaldo routine" },
      { allowedPublicPersonNames: ["Ronaldo"] },
    );

    expect(result).toMatchObject({
      text: expect.stringMatching(/chưa tìm thấy nguồn/i),
      meta: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "no_supported_source",
      },
    });
  });

  it("searches a caller-vetted public DOB without weakening other privacy sinks", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Ngày sinh công khai." }] },
              groundingMetadata: {
                groundingSupports: [
                  {
                    segment: { text: "Ngày sinh công khai." },
                    groundingChunkIndices: [0],
                  },
                ],
                groundingChunks: [
                  {
                    web: {
                      title: "Official profile",
                      uri: "https://example.com/ronaldo",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const query = "Cristiano Ronaldo DOB is 1985-02-05, verify it";
    const result = await searchKnowledge(
      { query },
      { allowedPublicPersonNames: ["Cristiano Ronaldo"] },
    );

    expect({
      providerCalls: fetchMock.mock.calls.length,
      providerQuery: JSON.parse(fetchMock.mock.calls[0][1].body).contents[0]
        .parts[0].text,
      evidenceAvailable: result.meta.evidenceAvailable,
    }).toEqual({
      providerCalls: 1,
      providerQuery: query,
      evidenceAvailable: true,
    });
  });

  it("keeps a private Lisa DOB away from web search despite an allowed alias", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchKnowledge(
      { query: "Lisa học viên của tôi DOB: 27/03/1997" },
      { allowedPublicPersonNames: ["Lisa"] },
    );

    expect({
      providerCalls: fetchMock.mock.calls.length,
      evidence: result.meta,
      requestCount:
        getMetricsSnapshot().counters[
          "provider.gemini_search_grounding_requests"
        ],
      privacyBlockedCount:
        getMetricsSnapshot().counters[
          "provider.gemini_search_grounding_privacy_blocked"
        ],
    }).toEqual({
      providerCalls: 0,
      evidence: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "not_called",
        diagnosticCode: "privacy_blocked",
        providerRequestMade: false,
      },
      requestCount: 0,
      privacyBlockedCount: 1,
    });
  });

  it.each([
    "Hôm nay tôi đau ngực, tên là Nguyễn Văn A, email nguyenvana@example.com",
    "Client John Doe has HIV and needs a workout plan",
    "Patient John Doe has diabetes and weighs 80kg",
    "She has HIV and weighs 52kg",
    "Nguyễn Văn A bị hen suyễn, nên tập thế nào?",
    "My blood pressure is 160/100, what should I do?",
    "I have cancer, which exercises are safe?",
    "Tôi bị PCOS và muốn có lịch tập phù hợp",
    "Tôi được chẩn đoán PCOS và cần lịch tập",
    "Tôi bị buồng trứng đa nang và cần lịch tập",
    "Tôi bị đa nang buồng trứng và cần lịch tập",
    "I have polycystic ovarian syndrome and need exercise advice",
    "Tôi có câu hỏi: tôi bị PCOS thì tập gì?",
    "my friend bob who tore his ACL",
    "my son who is autistic",
    "my kid with covid",
    "I have migraine",
    "I take prednisone",
    "client Bob has epilepsy",
    "Tôi sinh ngày 01/02/1990 và muốn có lịch tập phù hợp",
    "Ngày sinh của tôi: 01/02/1990",
    "DOB: 01/02/1990",
    "Date of birth: 1990-02-01",
    "Tôi sinh vào ngày 01/02/1990",
    "Ngày sinh của khách hàng Lan là 01/02/1990",
    "bob was born on 1990-01-01",
    "Cầu thủ Cristiano Ronaldo DOB 1985-02-05",
    "current workout recommendation for bob",
    "latest routine for my friend mai",
  ])("blocks personal health data before direct tool execution: %s", async (query) => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchKnowledge({ query });

    expect({
      providerCalled: fetchMock.mock.calls.length,
      evidence: result.meta,
    }).toEqual({
      providerCalled: 0,
      evidence: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "not_called",
        diagnosticCode: "privacy_blocked",
        providerRequestMade: false,
      },
    });
  });

  it("does not trust a public-person label invented by a model-generated query", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchKnowledge({
      query: "Vận động viên Nguyễn Văn An thường tập gì?",
    });

    expect({
      providerCalled: fetchMock.mock.calls.length,
      evidence: result.meta,
    }).toEqual({
      providerCalled: 0,
      evidence: {
        evidenceAvailable: false,
        sourceCount: 0,
        sources: [],
        searchOutcome: "not_called",
        diagnosticCode: "privacy_blocked",
        providerRequestMade: false,
      },
    });
  });

  it.each([
    ["mai thường tập gì?", []],
    ["nguyễn văn a thường tập gì?", []],
    ["MAI thường tập gì?", []],
    ["mai đang tập gì?", []],
    ["nguyễn văn a...", []],
    ["MAI...", []],
    ["Lisa cua toi tap gi?", ["Lisa"]],
    ["Lisa học viên của tôi tập gì?", ["Lisa"]],
    ["Ronaldo routine cho mai", ["Ronaldo"]],
    ["Send workout to John Smith and cite sources", []],
    ["ronaldo routine sources for bob", ["Ronaldo"]],
    [
      "ronaldo official workout advice for hoang thien 170cm 80kg",
      ["Ronaldo"],
    ],
  ])(
    "never sends a private identity to the grounding provider: %s",
    async (query, allowedPublicPersonNames) => {
      process.env.GEMINI_API_KEY = "test-key";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await searchKnowledge(
        { query },
        { allowedPublicPersonNames },
      );

      expect({
        providerCalled: fetchMock.mock.calls.length,
        evidence: result.meta,
      }).toEqual({
        providerCalled: 0,
        evidence: {
          evidenceAvailable: false,
          sourceCount: 0,
          sources: [],
          searchOutcome: "not_called",
          diagnosticCode: "privacy_blocked",
          providerRequestMade: false,
        },
      });
    },
  );

  it("redacts a contextual private name before building the provider payload", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Hướng dẫn squat chung." }] },
              groundingMetadata: {
                groundingSupports: [
                  {
                    segment: { text: "Hướng dẫn squat chung." },
                    groundingChunkIndices: [0],
                  },
                ],
                groundingChunks: [
                  {
                    web: {
                      title: "Exercise guidance",
                      uri: "https://example.com/exercise-guidance",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchKnowledge({ query: "khách hàng mai hỏi cách squat" });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const providerQuery = requestBody.contents[0].parts[0].text;
    expect(providerQuery).toContain("[đã ẩn tên]");
    expect(providerQuery).not.toMatch(/\bmai\b/iu);
  });
});
