import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import SkillRadarSource from "../models/SkillRadarSource.js";

const CONFIRMATION_VARIABLE = "CONFIRM_SKILL_RADAR_INDEX_MIGRATION";
const TARGET_INDEX_NAME = "skill_radar_refresh_due";

const normalizeObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );

export const getSkillRadarIndexContract = () => {
  const match = SkillRadarSource.schema
    .indexes()
    .find(([, options]) => options.name === TARGET_INDEX_NAME);
  if (!match) throw new Error("Skill Radar index contract is missing");
  const [keys, options] = match;
  return {
    collection: SkillRadarSource.collection.name,
    name: options.name,
    keys,
    options,
  };
};

const listIndexes = async () => {
  try {
    return await SkillRadarSource.collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

const sameContract = (existing, contract) =>
  JSON.stringify(normalizeObject(existing.key)) ===
  JSON.stringify(normalizeObject(contract.keys));

export const inspectSkillRadarIndexes = async () => {
  const contract = getSkillRadarIndexContract();
  const existing = await listIndexes();
  const sameName = existing.find(({ name }) => name === contract.name);
  const equivalent = existing.find((index) => sameContract(index, contract));
  return [{
    contract,
    status: equivalent ? "present" : sameName ? "name_conflict" : "missing",
  }];
};

export const applySkillRadarIndexes = async (reports) => {
  if (reports.some(({ status }) => status === "name_conflict")) {
    throw new Error("Skill Radar index apply blocked by preflight findings");
  }
  const applied = [];
  for (const report of reports) {
    if (report.status === "present") {
      applied.push({ name: report.contract.name, status: "unchanged" });
      continue;
    }
    const name = await SkillRadarSource.collection.createIndex(
      report.contract.keys,
      report.contract.options,
    );
    applied.push({ name, status: "created" });
  }
  return applied;
};

const authorizeTarget = ({ args, apply }) => {
  const targetArgument = [...args].find((argument) =>
    argument.startsWith("--target="),
  );
  const target = targetArgument?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (process.env.APP_ENV !== target) {
    throw new Error("Skill Radar index target does not match APP_ENV");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  const uriDatabase = getMongoDatabaseName(process.env.MONGO_URI);
  const targetDatabase = String(
    process.env.MIGRATION_TARGET_DATABASE || "",
  ).trim();
  if (!uriDatabase || !targetDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Skill Radar index database target lock failed");
  }
  if (!apply) return { targetDatabase, valid: true };
  if (!args.has("--confirm-skill-radar-indexes")) {
    throw new Error("Apply requires --confirm-skill-radar-indexes");
  }
  return assertMigrationEnvironment({
    confirmationVariable: CONFIRMATION_VARIABLE,
  });
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const authorization = authorizeTarget({ args, apply });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const reports = await inspectSkillRadarIndexes();
    if (reports.some(({ status }) => status === "name_conflict")) {
      throw new Error("Skill Radar index preflight blocked");
    }
    const applied = apply ? await applySkillRadarIndexes(reports) : [];
    const verification = apply ? await inspectSkillRadarIndexes() : reports;
    const success = !apply || verification.every(({ status }) => status === "present");
    console.log(JSON.stringify({
      mode: apply ? "apply" : "preflight",
      success,
      indexes: verification.map(({ contract, status }) => ({
        collection: contract.collection,
        name: contract.name,
        status,
      })),
      applied,
    }, null, 2));
    if (!success) throw new Error("Skill Radar index verification failed");
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
