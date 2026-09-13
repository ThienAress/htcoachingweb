export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSION = 768;
export const LEGACY_EMBEDDING_VERSION =
  `${EMBEDDING_MODEL}:${EMBEDDING_DIMENSION}`;
export const LEGACY_EMBEDDING_PROFILE_ID = "legacy-symmetric-v1";
export const QUESTION_ANSWERING_EMBEDDING_PROFILE_ID = "question-answering-v1";

const QUESTION_ANSWERING_EMBEDDING_VERSION =
  `${LEGACY_EMBEDDING_VERSION}:${QUESTION_ANSWERING_EMBEDDING_PROFILE_ID}`;
const EMBEDDING_PROFILES = Object.freeze({
  [LEGACY_EMBEDDING_PROFILE_ID]: Object.freeze({
    version: LEGACY_EMBEDDING_VERSION,
    format: "legacy",
  }),
  [QUESTION_ANSWERING_EMBEDDING_PROFILE_ID]: Object.freeze({
    version: QUESTION_ANSWERING_EMBEDDING_VERSION,
    format: "question_answering",
  }),
});

export const getEmbeddingProfile = (profileId) =>
  EMBEDDING_PROFILES[profileId] || null;

export const EMBEDDING_PROFILE_ID =
  process.env.KB_EMBEDDING_PROFILE?.trim() || LEGACY_EMBEDDING_PROFILE_ID;
const activeEmbeddingProfile = getEmbeddingProfile(EMBEDDING_PROFILE_ID);
if (!activeEmbeddingProfile) {
  throw new Error(
    `KB_EMBEDDING_PROFILE không được hỗ trợ: ${EMBEDDING_PROFILE_ID}`,
  );
}
export const EMBEDDING_VERSION = activeEmbeddingProfile.version;
