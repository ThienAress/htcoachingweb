import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const createAccessToken = (user, secret) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, secret, {
    algorithm: "HS256",
    expiresIn: "15m",
  });

export const createApiClient = ({ origin, accessToken, csrfToken = crypto.randomBytes(32).toString("hex") }) => {
  const request = async (path, { method = "GET", body, expected = [200] } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Cookie: `accessToken=${accessToken}; csrfToken=${csrfToken}`,
        ...(body !== undefined && { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!expected.includes(response.status)) {
      const error = new Error(`Staging API ${path} returned HTTP ${response.status}`);
      error.code = "STAGING_AI_API_CONTRACT_FAILED";
      throw error;
    }
    return data;
  };
  return { request, csrfToken };
};

export const createKnowledgeFixture = async ({ api, marker, sourceUrl }) => {
  const { question, variant, label } = knowledgeFixtureQueries(marker);
  const response = await api.request("/api/knowledge-base", {
    method: "POST",
    expected: [201],
    body: {
      question,
      answer: `Theo WHO, người trưởng thành nên đạt ít nhất 150 phút hoạt động thể lực cường độ vừa mỗi tuần. Nguồn: [WHO](${sourceUrl}).`,
      category: "general",
      tags: ["ac009", label],
      variants: [variant],
      status: "published",
      evidenceLevel: "source_backed",
      freshnessClass: "stable",
      skipDuplicateCheck: true,
      sources: [{
        type: "official",
        title: "Physical activity",
        publisher: "World Health Organization",
        url: sourceUrl,
        evidenceTier: "primary",
        retrievedAt: new Date().toISOString(),
      }],
    },
  });
  const entry = response?.data;
  if (!entry?._id || entry.status !== "published" || entry.reviewStatus !== "reviewed" || entry.embeddingStatus !== "ready") {
    const error = new Error("Knowledge fixture was not published with a ready reviewed embedding");
    error.code = "STAGING_AI_KB_FIXTURE_FAILED";
    throw error;
  }
  return { id: String(entry._id), question, variant, embeddingVersion: entry.embeddingVersion };
};

export const knowledgeFixtureQueries = (marker) => {
  const suffix = String(marker || "").split(":").at(-1).replaceAll("-", "");
  const alphabet = "abcdefghijklmnop";
  const label = [...suffix].map((hex) => alphabet[Number.parseInt(hex, 16)]).join("");
  return {
    label,
    question: `Tập luyện thể lực mỗi tuần bao nhiêu phút để khỏe mạnh? Nhãn ${label}.`,
    variant: `Theo nhãn ${label}, người trưởng thành nên tập thể dục bao lâu mỗi tuần?`,
  };
};

export const fetchMetrics = async (api) => {
  const response = await api.request("/api/ops/metrics");
  if (!response?.success || !response?.data?.counters) {
    const error = new Error("Authenticated metrics response is missing counters");
    error.code = "STAGING_AI_METRICS_INCONCLUSIVE";
    throw error;
  }
  return response.data;
};
