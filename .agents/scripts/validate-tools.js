#!/usr/bin/env node
// validate-tools.js — Kiểm tra tất cả AI tools trong toolRegistry
// Chạy: node .agents/scripts/validate-tools.js
// Dùng trong: /ai-check workflow (Bước 4)

import { toolRegistry, getToolSchemas } from "../../server/src/services/ai/tools/toolRegistry.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

console.log("\n🔍 AI Tool Validation\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const tools = Object.entries(toolRegistry);
console.log(`Found ${tools.length} tools in registry\n`);

for (const [key, tool] of tools) {
  console.log(`📦 ${key}`);

  // 1. Kiểm tra required fields
  if (!tool.name) fail("Missing 'name'");
  else if (tool.name !== key) fail(`name '${tool.name}' !== key '${key}'`);
  else pass(`name: ${tool.name}`);

  if (!tool.description) fail("Missing 'description'");
  else if (tool.description.length < 20) warn("Description too short (< 20 chars)");
  else pass(`description: ${tool.description.substring(0, 60)}...`);

  if (!tool.parameters) fail("Missing 'parameters'");
  else if (tool.parameters.type !== "object") fail("parameters.type must be 'object'");
  else pass("parameters: valid schema");

  if (typeof tool.execute !== "function") fail("Missing or invalid 'execute' function");
  else pass("execute: function ✓");

  if (typeof tool.requiresAuth !== "boolean") warn("Missing 'requiresAuth' flag");
  if (typeof tool.requiresConfirmation !== "boolean") warn("Missing 'requiresConfirmation' flag");

  // 2. Kiểm tra file tồn tại
  const toolDir = path.join(ROOT, "server/src/services/ai/tools");
  const possibleFiles = fs.readdirSync(toolDir).filter((f) => f.endsWith(".tool.js"));
  const matchingFile = possibleFiles.find((f) => {
    // Convert snake_case key to camelCase filename
    const camelName = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return f.startsWith(camelName);
  });

  if (matchingFile) pass(`file: ${matchingFile}`);
  else warn(`No matching .tool.js file for '${key}'`);

  console.log("");
}

// 3. Check orphan tool files (có file nhưng chưa registered)
const toolDir = path.join(ROOT, "server/src/services/ai/tools");
const toolFiles = fs.readdirSync(toolDir).filter((f) => f.endsWith(".tool.js"));
const registeredNames = tools.map(([key]) => {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
});

console.log("🔎 Orphan Check (files not in registry):");
for (const file of toolFiles) {
  const baseName = file.replace(".tool.js", "");
  if (!registeredNames.includes(baseName)) {
    warn(`File '${file}' exists but NOT registered in toolRegistry`);
  }
}

// 4. Check getToolSchemas() output
const schemas = getToolSchemas();
if (schemas.length !== tools.length) {
  fail(`getToolSchemas() returns ${schemas.length} but registry has ${tools.length}`);
} else {
  pass(`getToolSchemas() returns ${schemas.length} schemas ✓`);
}

// Report
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (errors === 0) {
  console.log(`✅ ALL PASS — ${tools.length} tools validated, ${warnings} warnings`);
  process.exit(0);
} else {
  console.log(`❌ FAIL — ${errors} errors, ${warnings} warnings`);
  process.exit(1);
}
