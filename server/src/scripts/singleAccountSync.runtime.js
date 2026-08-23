import {
  ACCOUNT_COLLECTION_POLICIES,
  ACCOUNT_SYNC_EMAIL_DIGEST,
  PRODUCTION_ACCOUNT_DATABASE,
  buildOwnerQuery,
  fingerprintDocument,
  resolveAccountSyncEmail,
  sanitizeAccountUser,
} from "./singleAccountSync.contract.js";

const makeSyncError = (code, message = code) =>
  Object.assign(new Error(message), { code });

const SOURCE_WRITE_ACTIONS = new Set([
  "bypassDocumentValidation",
  "collMod",
  "convertToCapped",
  "createCollection",
  "createIndex",
  "dropCollection",
  "dropIndex",
  "insert",
  "remove",
  "renameCollectionSameDB",
  "update",
]);

export const assertProductionSourceReadOnly = async (sourceDb) => {
  let status;
  try {
    status = await sourceDb.command({ connectionStatus: 1, showPrivileges: true });
  } catch {
    throw makeSyncError("ACCOUNT_SYNC_SOURCE_ROLE_UNVERIFIED");
  }

  const roles = status?.authInfo?.authenticatedUserRoles || [];
  const hasOnlyExpectedReadRole =
    roles.length === 1 &&
    roles[0]?.role === "read" &&
    roles[0]?.db === PRODUCTION_ACCOUNT_DATABASE;
  if (!hasOnlyExpectedReadRole) {
    throw makeSyncError("ACCOUNT_SYNC_SOURCE_READ_ONLY_ROLE_REQUIRED");
  }

  const privileges = status?.authInfo?.authenticatedUserPrivileges || [];
  const hasWritePrivilege = privileges.some((privilege) =>
    (privilege?.actions || []).some((action) => SOURCE_WRITE_ACTIONS.has(action)),
  );
  if (hasWritePrivilege) {
    throw makeSyncError("ACCOUNT_SYNC_SOURCE_WRITE_PRIVILEGE_REJECTED");
  }

  return { verified: true };
};

export const listSourceAccountGraph = async (
  sourceDb,
  {
    accountEmail,
    accountEmailDigest = ACCOUNT_SYNC_EMAIL_DIGEST,
  } = {},
) => {
  const resolvedEmail = resolveAccountSyncEmail(accountEmail, {
    expectedDigest: accountEmailDigest,
  });
  const accountUsers = await sourceDb
    .collection("users")
    .find({ email: resolvedEmail })
    .limit(2)
    .toArray();
  if (accountUsers.length !== 1) {
    throw makeSyncError("ACCOUNT_SYNC_EXACT_SOURCE_USER_REQUIRED");
  }

  const accountUser = accountUsers[0];
  const graph = { users: [sanitizeAccountUser(accountUser)] };
  for (const policy of ACCOUNT_COLLECTION_POLICIES) {
    graph[policy.name] = await sourceDb
      .collection(policy.name)
      .find(buildOwnerQuery(policy, accountUser._id, resolvedEmail))
      .toArray();
  }

  const orderIds = graph.orders.map((document) => document._id);
  graph.checkins = orderIds.length
    ? await sourceDb
        .collection("checkins")
        .find({ orderId: { $in: orderIds } })
        .toArray()
    : [];
  return { accountUser, graph };
};

export const accountGraphCounts = (graph) =>
  Object.fromEntries(
    Object.entries(graph)
      .filter(([, documents]) => documents.length > 0)
      .map(([collection, documents]) => [collection, documents.length]),
  );

export const accountGraphFingerprint = (graph) =>
  fingerprintDocument(
    Object.fromEntries(
      Object.entries(graph).map(([collection, documents]) => [
        collection,
        documents
          .map((document) => ({
            id: String(document._id),
            fingerprint: fingerprintDocument(document),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ]),
    ),
  );

const preserveTargetAuthentication = (sourceUser, targetUser) => {
  if (!targetUser) return sourceUser;
  const preservedKeys = [
    "password",
    "passwordHash",
    "refreshToken",
    "accessToken",
    "resetPasswordToken",
    "resetPasswordExpires",
    "googleId",
    "providerId",
    "oauth",
    "session",
    "sessions",
    "twoFactorSecret",
  ];
  return preservedKeys.reduce(
    (result, key) =>
      Object.hasOwn(targetUser, key)
        ? { ...result, [key]: targetUser[key] }
        : result,
    { ...sourceUser },
  );
};

export const preflightTargetAccount = async (
  targetDb,
  sourceUser,
  {
    accountEmail,
    accountEmailDigest = ACCOUNT_SYNC_EMAIL_DIGEST,
  } = {},
) => {
  const resolvedEmail = resolveAccountSyncEmail(accountEmail, {
    expectedDigest: accountEmailDigest,
  });
  const users = targetDb.collection("users");
  const [matches, idMatch] = await Promise.all([
    users.find({ email: resolvedEmail }).limit(2).toArray(),
    users.findOne({ _id: sourceUser._id }),
  ]);
  if (matches.length > 1) {
    throw makeSyncError("ACCOUNT_SYNC_TARGET_USER_AMBIGUOUS");
  }
  if (matches.length === 1 && String(matches[0]._id) !== String(sourceUser._id)) {
    throw makeSyncError("ACCOUNT_SYNC_TARGET_USER_ID_CONFLICT");
  }
  if (
    idMatch &&
    String(idMatch.email || "").trim().toLowerCase() !== resolvedEmail
  ) {
    throw makeSyncError("ACCOUNT_SYNC_TARGET_USER_ID_CONFLICT");
  }
  return idMatch || matches[0] || null;
};

export const syncAccountGraphToTarget = async ({
  targetDb,
  targetClient,
  graph,
  apply = false,
}) => {
  if (!apply) return { written: 0 };
  if (!targetClient?.startSession) {
    throw makeSyncError("ACCOUNT_SYNC_TARGET_TRANSACTION_REQUIRED");
  }

  const session = targetClient.startSession();
  try {
    return await session.withTransaction(
      async () => {
        let written = 0;
        for (const [collectionName, documents] of Object.entries(graph)) {
          for (const sourceDocument of documents) {
            let documentToWrite = sourceDocument;
            if (collectionName === "users") {
              const targetUser = await targetDb
                .collection("users")
                .findOne({ _id: sourceDocument._id }, { session });
              if (
                targetUser &&
                String(targetUser.email || "").trim().toLowerCase() !==
                  String(sourceDocument.email || "").trim().toLowerCase()
              ) {
                throw makeSyncError("ACCOUNT_SYNC_TARGET_USER_ID_CONFLICT");
              }
              documentToWrite = preserveTargetAuthentication(
                sourceDocument,
                targetUser,
              );
            }
            try {
              await targetDb
                .collection(collectionName)
                .replaceOne({ _id: sourceDocument._id }, documentToWrite, {
                  upsert: true,
                  session,
                });
            } catch (error) {
              const syncError = makeSyncError(
                error?.code === 11000
                  ? "ACCOUNT_SYNC_TARGET_UNIQUE_CONFLICT"
                  : "ACCOUNT_SYNC_TARGET_WRITE_FAILED",
              );
              syncError.collection = collectionName;
              syncError.indexFields = Object.keys(error?.keyPattern || {});
              throw syncError;
            }
            written += 1;

            const targetDocument = await targetDb
              .collection(collectionName)
              .findOne({ _id: sourceDocument._id }, { session });
            const comparableTarget =
              collectionName === "users"
                ? sanitizeAccountUser(targetDocument)
                : targetDocument;
            if (
              !targetDocument ||
              fingerprintDocument(comparableTarget) !==
                fingerprintDocument(sourceDocument)
            ) {
              throw makeSyncError("ACCOUNT_SYNC_TARGET_FINGERPRINT_MISMATCH");
            }
          }
        }
        return { written };
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
};
