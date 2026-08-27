import { writeFile } from "node:fs/promises";
import path from "node:path";

const PRODUCTION_API_ORIGIN = "https://api.htcoachingweb.io.vn";
const PRODUCTION_EXERCISES_PATH = "/api/exercises";
const OUTPUT_PATH = path.resolve(
  "docs/operations/production-exercises-for-setup.md",
);

const markdownEscape = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]<>])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();

const fetchPage = async (page, limit) => {
  const url = new URL(PRODUCTION_EXERCISES_PATH, PRODUCTION_API_ORIGIN);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (url.origin !== PRODUCTION_API_ORIGIN) {
    throw new Error("Production Exercise URL is outside the allowlisted origin");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Production Exercise API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error("Production Exercise API response is invalid");
  }
  return payload;
};

const fetchAllExercises = async () => {
  const limit = 5000;
  const firstPage = await fetchPage(1, limit);
  const totalPages = Number(firstPage.pagination?.totalPages || 1);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
      fetchPage(index + 2, limit),
    ),
  );
  const exercises = [
    ...firstPage.data,
    ...remainingPages.flatMap((payload) => payload.data),
  ];
  const expectedTotal = Number(firstPage.pagination?.total);

  if (!Number.isInteger(expectedTotal) || exercises.length !== expectedTotal) {
    throw new Error(
      `Production Exercise count mismatch: expected ${expectedTotal}, received ${exercises.length}`,
    );
  }
  const names = exercises.map((exercise) => String(exercise?.name || "").trim());
  if (names.some((name) => !name)) {
    throw new Error("Production Exercise catalog contains an empty name");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("Production Exercise catalog contains duplicate names");
  }

  return exercises;
};

const renderCatalog = (exercises) => {
  const lines = [
    "# Danh sách bài tập và mô tả trên production",
    "",
    `Nguồn: \`${PRODUCTION_API_ORIGIN}${PRODUCTION_EXERCISES_PATH}\``,
    `Ngày xuất: ${new Date().toISOString().slice(0, 10)}`,
    `Tổng số bài tập: **${exercises.length}**`,
    "",
  ];

  exercises.forEach((exercise, index) => {
    const ordinal = String(index + 1).padStart(4, "0");
    const name = markdownEscape(exercise.name);
    const description = markdownEscape(exercise.description);
    lines.push(`## ${ordinal}. ${name}`, "");
    lines.push(description || "_Chưa có mô tả._", "");
  });

  return `${lines.join("\n")}\n`;
};

const exercises = await fetchAllExercises();
await writeFile(OUTPUT_PATH, renderCatalog(exercises), "utf8");
process.stdout.write(
  `${JSON.stringify({ output: OUTPUT_PATH, exercises: exercises.length })}\n`,
);
