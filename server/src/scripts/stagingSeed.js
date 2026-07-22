import "../config/env.js";
import mongoose from "mongoose";
import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import BlogPost from "../models/BlogPost.js";
import CustomerStory from "../models/CustomerStory.js";
import Exercise from "../models/Exercise.js";
import Food from "../models/Food.js";
import Gym from "../models/Gym.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import Order from "../models/Order.js";
import Recipe from "../models/Recipe.js";
import Trainer from "../models/Trainer.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";

const DATABASE_NAME = "htcoaching_staging";
const FIXTURE_VERSION = "2026-07-23-v1";
const PRODUCTION_PUBLIC_API_ORIGIN = "https://htcoachingweb.onrender.com";
const cleanupMode = process.argv.includes("--cleanup");

const fixtureTag = (kind) => ({
  managed: true,
  version: FIXTURE_VERSION,
  kind,
  updatedAt: new Date(),
});

const asString = (value, maximum = 5000) =>
  String(value || "").trim().slice(0, maximum);

const asStringArray = (value, maximumItems = 50, maximumLength = 500) =>
  (Array.isArray(value) ? value : [])
    .map((item) => asString(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);

const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const escapeHtml = (value) =>
  asString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const ensureConnectedDatabase = () => {
  const databaseName = mongoose.connection.db?.databaseName;
  if (databaseName !== DATABASE_NAME) {
    throw new Error("Connected database is not the isolated staging database");
  }
};

const upsertFixture = async (Model, identity, values, kind) => {
  const existing = await Model.collection.findOne(identity, {
    projection: { _id: 1, _stagingFixture: 1 },
  });
  if (existing && existing._stagingFixture?.managed !== true) {
    throw new Error(
      `Refusing to overwrite an unmanaged staging ${Model.modelName} record`,
    );
  }

  const document = existing
    ? await Model.findById(existing._id)
    : new Model(identity);
  document.set(values);
  await document.save();
  await Model.collection.updateOne(
    { _id: document._id },
    { $set: { _stagingFixture: fixtureTag(kind) } },
  );
  return document;
};

const fetchJson = async (url, attempts = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: "application/json",
          "User-Agent": "htcoaching-staging-seed/1.0",
        },
      });
      if (!response.ok) {
        throw new Error(`Public content request failed with ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
};

const fetchOptionalPublicCollection = async (url) => {
  try {
    return { available: true, data: await fetchJson(url) };
  } catch (error) {
    if (error?.message?.match(/failed with 404$/)) {
      return { available: false, data: null };
    }
    throw error;
  }
};

const importPublicContent = async () => {
  if (process.env.STAGING_IMPORT_PUBLIC_CONTENT !== "true") {
    return { blogs: 0, recipes: 0 };
  }

  const source = new URL(
    process.env.STAGING_PUBLIC_CONTENT_SOURCE || PRODUCTION_PUBLIC_API_ORIGIN,
  );
  if (source.origin !== PRODUCTION_PUBLIC_API_ORIGIN) {
    throw new Error("Only the approved production public API may be imported");
  }

  const limit = boundedInteger(
    process.env.STAGING_PUBLIC_CONTENT_LIMIT,
    12,
    1,
    50,
  );
  const [blogSource, recipeSource] = await Promise.all([
    fetchOptionalPublicCollection(new URL(`/api/blog?limit=${limit}`, source)),
    fetchOptionalPublicCollection(
      new URL(`/api/recipes?limit=${limit}`, source),
    ),
  ]);
  const blogResponse = blogSource.data || {};
  const recipeResponse = recipeSource.data || {};

  const blogCategories = new Set([
    "tap-luyen",
    "dinh-duong",
    "hieu-co-the",
    "tu-duy-loi-song",
  ]);
  let importedBlogs = 0;
  for (const item of (blogResponse.data || []).slice(0, limit)) {
    const slug = asString(item.slug, 180).toLowerCase();
    const title = asString(item.title, 300);
    if (!slug || !title) continue;
    const excerpt = asString(item.excerpt, 2000);
    await upsertFixture(
      BlogPost,
      { slug },
      {
        title,
        content:
          `<p>${escapeHtml(excerpt || title)}</p>` +
          "<p><em>Staging copy created from the public listing. " +
          "The production detail endpoint is intentionally not read.</em></p>",
        excerpt,
        category: blogCategories.has(item.category)
          ? item.category
          : "tap-luyen",
        subCategory: asString(item.subCategory, 100),
        tags: asStringArray(item.tags, 20, 100),
        coverImage: asString(item.coverImage, 2048),
        author: null,
        metaTitle: asString(item.metaTitle || title, 70),
        metaDescription: asString(item.metaDescription || excerpt, 200),
        focusKeyword: asString(item.focusKeyword, 200),
        status: "published",
        featured: Boolean(item.featured),
        views: 0,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      },
      "public-blog-copy",
    );
    importedBlogs += 1;
  }

  let importedRecipes = 0;
  for (const item of (recipeResponse.data || []).slice(0, limit)) {
    const slug = asString(item.slug, 180).toLowerCase();
    if (!slug) continue;
    const detailResponse = await fetchJson(
      new URL(`/api/recipes/detail/${encodeURIComponent(slug)}`, source),
    );
    const detail = detailResponse.data || {};
    const name = asString(detail.name || item.name, 200);
    if (!name) continue;
    await upsertFixture(
      Recipe,
      { slug },
      {
        name,
        nameEn: asString(detail.nameEn, 200),
        category: asString(detail.category || item.category, 100),
        area: asString(detail.area || item.area, 100),
        thumbnail: asString(detail.thumbnail || item.thumbnail, 2048),
        prepTime: asString(detail.prepTime || item.prepTime, 100),
        ingredients: (Array.isArray(detail.ingredients)
          ? detail.ingredients
          : []
        ).slice(0, 100).map((ingredient) => ({
          name: asString(ingredient?.name, 200),
          measure: asString(ingredient?.measure, 100),
        })).filter((ingredient) => ingredient.name),
        instructions: asStringArray(detail.instructions, 100, 2000),
        youtubeUrl: asString(detail.youtubeUrl, 2048),
        sourceUrl: asString(detail.sourceUrl, 2048),
        source: ["mealdb", "ai", "manual"].includes(detail.source)
          ? detail.source
          : "manual",
        mealDbId: detail.mealDbId ? asString(detail.mealDbId, 100) : null,
        tags: asStringArray(detail.tags || item.tags, 50, 100),
        isPublished: true,
      },
      "public-recipe-copy",
    );
    importedRecipes += 1;
  }

  return {
    blogs: importedBlogs,
    recipes: importedRecipes,
    sourceAvailability: {
      blogs: blogSource.available,
      recipes: recipeSource.available,
    },
  };
};

const seedSyntheticData = async () => {
  const adminEmails = String(process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const admin = await User.findOne({ email: { $in: adminEmails } });
  if (!admin) {
    throw new Error("A staging admin must sign in before fixtures are seeded");
  }

  const trainerProfile = await upsertFixture(
    Trainer,
    { slug: "staging-demo-coach" },
    {
      name: "Staging Demo Coach",
      title: "Staging Trainer",
      experience: "Synthetic fixture",
      bio: "Synthetic trainer profile for staging acceptance tests.",
      specialties: [{ icon: "dumbbell", label: "Strength" }],
      status: "published",
      featured: true,
      sortOrder: -100,
      publishedAt: new Date(),
    },
    "synthetic-trainer-profile",
  );

  await upsertFixture(
    BlogPost,
    { slug: "staging-demo-training-guide" },
    {
      title: "Staging Demo Training Guide",
      content:
        "<h2>Staging fixture</h2><p>This article validates list and detail rendering without production data.</p>",
      excerpt: "Synthetic article used only in the isolated staging database.",
      category: "tap-luyen",
      tags: ["staging", "testing"],
      author: trainerProfile._id,
      status: "published",
      featured: true,
      views: 0,
      publishedAt: new Date(),
    },
    "synthetic-blog",
  );

  await upsertFixture(
    Recipe,
    { slug: "staging-demo-protein-bowl" },
    {
      name: "Staging Demo Protein Bowl",
      category: "High Protein",
      area: "Viet Nam",
      prepTime: "20 minutes",
      ingredients: [
        { name: "Chicken breast", measure: "150g" },
        { name: "Rice", measure: "100g" },
      ],
      instructions: ["Cook all ingredients safely.", "Serve in a bowl."],
      source: "manual",
      tags: ["staging", "protein"],
      isPublished: true,
    },
    "synthetic-recipe",
  );

  await upsertFixture(
    CustomerStory,
    { slug: "staging-demo-client-story" },
    {
      name: "Staging Demo Client",
      result: "Synthetic acceptance result",
      duration: "8 weeks",
      goal: "Validate staging UI",
      message: "This is synthetic data and does not represent a real person.",
      trainerId: trainerProfile._id,
      status: "published",
      featured: true,
      publishedAt: new Date(),
    },
    "synthetic-customer-story",
  );

  await upsertFixture(
    Exercise,
    { name: "Staging Demo Squat" },
    {
      muscleGroup: "Legs",
      description: "Synthetic exercise fixture.",
    },
    "synthetic-exercise",
  );
  await upsertFixture(
    Food,
    { label: "Staging Demo Chicken" },
    { protein: 31, carb: 0, fat: 3.6, calories: 165 },
    "synthetic-food",
  );
  await upsertFixture(
    Gym,
    { name: "Staging Demo Gym", address: "Staging only" },
    {
      district: "Staging",
      openingHours: "Test hours",
      note: "Synthetic fixture",
      status: "active",
      sortOrder: -100,
    },
    "synthetic-gym",
  );

  const trainerUser = await upsertFixture(
    User,
    { email: "staging.trainer@example.invalid" },
    { name: "Staging Trainer", role: "trainer" },
    "synthetic-trainer-user",
  );
  const clientUser = await upsertFixture(
    User,
    { email: "staging.client@example.invalid" },
    { name: "Staging Client", role: "user" },
    "synthetic-client-user",
  );
  const secondClientUser = await upsertFixture(
    User,
    { email: "staging.client.two@example.invalid" },
    { name: "Staging Client Two", role: "user" },
    "synthetic-client-user",
  );

  for (const user of [trainerUser, clientUser, secondClientUser]) {
    await upsertFixture(
      Wallet,
      { userId: user._id },
      { balance: 0, currency: "VND", version: 0 },
      "synthetic-wallet",
    );
  }

  const orders = [];
  for (const [index, client] of [clientUser, secondClientUser].entries()) {
    orders.push(
      await upsertFixture(
        Order,
        {
          userId: client._id,
          note: `staging-seed-${index + 1}`,
        },
        {
          trainerId: trainerUser._id,
          name: client.name,
          email: client.email,
          phone: "",
          package: "Staging PT 10",
          sessions: 10,
          totalSessions: 10,
          gym: "Staging Demo Gym",
          schedule: "Synthetic schedule",
          status: "approved",
          approvedAt: new Date(),
        },
        "synthetic-order",
      ),
    );
  }

  await upsertFixture(
    KnowledgeEntry,
    { question: "What is the staging knowledge fixture?" },
    {
      answer:
        "It is synthetic content used to validate the isolated staging admin UI.",
      category: "platform",
      tags: ["staging"],
      status: "draft",
      embeddingStatus: "pending",
      createdBy: admin._id,
    },
    "synthetic-knowledge-entry",
  );

  return {
    trainerUsers: 1,
    clientUsers: 2,
    orders: orders.length,
    baselineWallets: 3,
  };
};

const cleanupFixtures = async () => {
  const models = [
    KnowledgeEntry,
    CustomerStory,
    BlogPost,
    Recipe,
    Exercise,
    Food,
    Gym,
    Order,
    Wallet,
    User,
    Trainer,
  ];
  const deleted = {};
  for (const Model of models) {
    const result = await Model.collection.deleteMany({
      "_stagingFixture.managed": true,
    });
    deleted[Model.collection.collectionName] = result.deletedCount;
  }
  return deleted;
};

const main = async () => {
  assertStagingOperation({
    confirmationVariable: cleanupMode
      ? "CONFIRM_STAGING_CLEANUP"
      : "CONFIRM_STAGING_SEED",
  });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  ensureConnectedDatabase();

  if (cleanupMode) {
    const deleted = await cleanupFixtures();
    console.log(JSON.stringify({ operation: "cleanup", deleted }, null, 2));
    return;
  }

  const synthetic = await seedSyntheticData();
  const publicContent = await importPublicContent();
  console.log(
    JSON.stringify(
      {
        operation: "seed",
        database: DATABASE_NAME,
        fixtureVersion: FIXTURE_VERSION,
        synthetic,
        publicContent,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  await mongoose.disconnect();
}
