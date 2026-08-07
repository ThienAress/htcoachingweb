import F1Customer from "../server/src/models/F1Customer.js";
import Order from "../server/src/models/Order.js";

const mongoose = F1Customer.db.base;

const EXPECTED_FIELDS = ["originBookingId", "originContactMessageId"];

const inspectModel = (model) => {
  const indexes = model.schema.indexes();
  const fields = Object.fromEntries(
    EXPECTED_FIELDS.map((field) => {
      const match = indexes.find(
        ([definition, options]) =>
          definition[field] === 1 &&
          options.unique === true &&
          options.partialFilterExpression?.[field]?.$type === "objectId",
      );
      return [field, Boolean(match)];
    }),
  );
  return { model: model.modelName, fields };
};

export const inspectConversionOriginIndexes = () => [
  inspectModel(F1Customer),
  inspectModel(Order),
];

const isLocalMongoUri = (value) =>
  /^mongodb:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(
    String(value || ""),
  );

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const report = inspectConversionOriginIndexes();
  const missing = report.flatMap(({ model, fields }) =>
    Object.entries(fields)
      .filter(([, present]) => !present)
      .map(([field]) => `${model}.${field}`),
  );
  if (missing.length > 0) {
    throw new Error(`Thiếu index contract: ${missing.join(", ")}`);
  }

  if (!args.has("--apply")) {
    console.log(JSON.stringify({ mode: "dry-run", success: true, report }, null, 2));
    return;
  }
  if (
    !args.has("--confirm-index-create") ||
    !args.has("--target=local") ||
    !isLocalMongoUri(process.env.MONGODB_URI)
  ) {
    throw new Error(
      "Apply bị chặn: cần --confirm-index-create --target=local và MONGODB_URI local",
    );
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await Promise.all([F1Customer.createIndexes(), Order.createIndexes()]);
    console.log(JSON.stringify({ mode: "apply-local", success: true, report }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
