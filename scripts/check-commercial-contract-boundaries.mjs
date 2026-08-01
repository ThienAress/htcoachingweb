import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const failures = [];
const requirePattern = (file, pattern, message) => {
  if (!pattern.test(read(file))) failures.push(`${file}: ${message}`);
};
const forbidPattern = (file, pattern, message) => {
  if (pattern.test(read(file))) failures.push(`${file}: ${message}`);
};

for (const file of [
  "client/src/sections/Pricing.jsx",
  "client/src/pages/Home.jsx",
  "client/src/pages/admin/components/TrainerGrantPanel.jsx",
  "server/src/controllers/trainerSubscription.controller.js",
]) {
  forbidPattern(
    file,
    /\b(?:2000000?|2500000?|3000000?)\b/,
    "trainer price literal must come from the server catalog",
  );
}

forbidPattern(
  "server/src/controllers/trainerSubscription.controller.js",
  /TRAINER_PLANS/,
  "legacy trainer price table returned",
);
forbidPattern(
  "server/src/controllers/trainerSubscription.controller.js",
  /export const (?:purchaseTrainerPlan|getMySubscription|getMaxClientsByPlan)/,
  "legacy trainer subscription handler returned",
);
forbidPattern(
  "client/src/sections/Pricing.jsx",
  /days_30|["']30 ngày["']/,
  "Free duration must come from the server catalog",
);
forbidPattern(
  "client/src/utils/trainerPlanCatalog.js",
  /trial:\s*["']30 ngày["']/,
  "SEO trial duration must come from the server catalog",
);
forbidPattern(
  "client/src/services/user.service.js",
  /\/user\/(?:create-trainer|trainers)/,
  "client service calls a removed backend route",
);
forbidPattern(
  "client/src/pages/wallet/MyWallet.jsx",
  /(?:amount\s*[<>]\s*5000|min=\{5000\}|max=\{100000000\})/,
  "deposit validation must use the server policy",
);
requirePattern(
  "server/src/controllers/deposit.controller.js",
  /validateDepositAmount\(amount\)/,
  "deposit controller must use the canonical policy validator",
);
requirePattern(
  "client/src/hooks/useDepositPolicy.js",
  /useQuery\(depositPolicyQueryOptions\(\)\)/,
  "deposit policy hook must use the canonical validated query factory",
);
requirePattern(
  "client/src/queries/walletAccount.queries.js",
  /getDepositPolicy\(\{ signal \}\)\.then\(normalizeDepositPolicyResponse\)/,
  "deposit policy query factory must validate the response before caching",
);

for (const file of [
  "client/src/pages/trainer/Dashboard.jsx",
  "client/src/pages/admin/CustomerStoryManagement.jsx",
]) {
  forbidPattern(file, /getOrders\(1,\s*0\)/, "limit=0 sentinel loses records");
}

for (const field of ["expectedAmount", "catalogFingerprint", "protocolVersion"]) {
  requirePattern(
    "client/src/utils/trainerPlanCatalog.js",
    new RegExp(`\\b${field}\\b`),
    `purchase payload is missing ${field}`,
  );
  requirePattern(
    "server/src/middlewares/validation.js",
    new RegExp(`body\\(\"${field}\"\\)`),
    `server validation is missing ${field}`,
  );
}

requirePattern(
  "client/src/constants/orderStatus.js",
  /completed[\s\S]*cancelled/,
  "order status map must cover completed and cancelled",
);
requirePattern(
  "client/src/constants/contractStatus.js",
  /signing/,
  "contract status map must cover signing",
);
requirePattern(
  "client/src/constants/f1CustomerStatus.js",
  /program_started/,
  "F1 status map must cover program_started",
);
forbidPattern(
  "client/src/constants/f1CustomerStatus.js",
  /testing_completed/,
  "obsolete F1 status returned",
);

if (failures.length > 0) {
  console.error("Cross-layer contract drift detected:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Commercial and cross-layer contract boundaries: PASS");
