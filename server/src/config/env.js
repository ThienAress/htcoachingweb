import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { safeLog } from "../utils/safeLogger.js";
import {
  assertProductionEnvironment,
  validateProductionEnvironment,
} from "./productionReadiness.js";
import { assertStagingEnvironment } from "./stagingSafety.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

// Hosting variables win; local files are profile-specific fallbacks only.
const profileFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

dotenv.config({ path: path.resolve(root, profileFile) });
dotenv.config({ path: path.resolve(root, ".env") });

if (process.env.NODE_ENV === "production") {
  const readiness = validateProductionEnvironment(process.env, {
    strict: false,
  });
  for (const finding of readiness.warnings) {
    safeLog.warn("environment.production_warning", finding.code);
  }
  assertProductionEnvironment(process.env, { strict: false });
}

assertStagingEnvironment(process.env);

safeLog.info("environment.loaded", {
  NODE_ENV: process.env.NODE_ENV,
  hasClientUrl: Boolean(process.env.CLIENT_URL),
  hasGoogleCallbackUrl: Boolean(process.env.GOOGLE_CALLBACK_URL),
  profileFile,
});
