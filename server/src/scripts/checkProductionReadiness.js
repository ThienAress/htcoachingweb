import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { validateProductionEnvironment } from "../config/productionReadiness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(serverRoot, ".env.production") });
dotenv.config({ path: path.join(serverRoot, ".env") });

const result = validateProductionEnvironment(process.env, { strict: true });
const safeOutput = {
  valid: result.valid,
  fullyReady: result.fullyReady,
  errors: result.errors,
  warnings: result.warnings,
  summary: result.summary,
};

process.stdout.write(JSON.stringify(safeOutput, null, 2) + "\n");
if (!result.valid) process.exitCode = 1;
