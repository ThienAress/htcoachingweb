import "../config/env.js";
import mongoose from "mongoose";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import { runSePayReconciliation } from "../services/sepayReconciliation.service.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
if (String(process.env.SEPAY_MODE || "").toLowerCase() !== "sandbox") {
  throw new Error("Manual staging reconciliation requires SEPAY_MODE=sandbox");
}
assertStagingOperation({
  env: process.env,
  confirmationVariable: "CONFIRM_SEPAY_SANDBOX_RECONCILIATION",
});

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  const result = await runSePayReconciliation();
  console.log(
    JSON.stringify(
      {
        success: true,
        imported: result.imported,
        processed: result.processed,
        deferred: result.deferred,
        locked: result.locked,
        cursorAdvanced: Boolean(result.lastTransactionId),
      },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
