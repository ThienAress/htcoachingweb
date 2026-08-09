import { getSeoConversionIndexContracts } from
  "../server/src/migrations/20260809-seo-conversion-indexes.js";

const mongoose = getSeoConversionIndexContracts()[0].model.db.base;

export const inspectSeoConversionIndexContracts = () =>
  getSeoConversionIndexContracts().map((contract) => ({
    collection: contract.collection,
    name: contract.name,
    unique: Boolean(contract.options.unique),
  }));

const isLocalMongoUri = (value) =>
  /^mongodb:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(
    String(value || ""),
  );

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const contracts = getSeoConversionIndexContracts();
  const report = inspectSeoConversionIndexContracts();
  if (contracts.length !== 9) {
    throw new Error(
      `Thiếu index contract: expected 9, received ${contracts.length}`,
    );
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

  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    for (const contract of contracts) {
      await contract.model.collection.createIndex(
        contract.keys,
        contract.options,
      );
    }
    console.log(JSON.stringify({ mode: "apply-local", success: true, report }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
