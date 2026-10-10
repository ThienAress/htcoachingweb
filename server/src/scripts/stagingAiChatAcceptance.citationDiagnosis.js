const DIAGNOSIS_CODES = Object.freeze({
  noAssistant: "STAGING_AI_CITATION_DIAG_NO_ASSISTANT",
  kbNotUsed: "STAGING_AI_CITATION_DIAG_KB_NOT_USED",
  urlNotInAnswer: "STAGING_AI_CITATION_DIAG_URL_NOT_IN_ANSWER",
  notRendered: "STAGING_AI_CITATION_DIAG_NOT_RENDERED",
});

/**
 * Turns a browser TimeoutError on the recovered answer's source link into a
 * bounded, non-PII code that says which layer lost the citation.
 * Never reads or returns message text beyond a boolean URL check.
 */
export const classifyMissingCitation = async ({
  error,
  db,
  ownerObjectId,
  fixtureId,
  sourceUrl,
}) => {
  if (error?.name !== "TimeoutError") return error;
  let last = null;
  try {
    const [conversation] = await db.collection("chatconversations")
      .find({ userId: ownerObjectId }, { projection: { messages: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray();
    last = [...(conversation?.messages || [])].reverse().find((item) => item?.role === "assistant") || null;
  } catch {
    return error;
  }
  let code = DIAGNOSIS_CODES.notRendered;
  if (!last) code = DIAGNOSIS_CODES.noAssistant;
  else if (!(last.answerTrace?.kbEntryIds || []).some((id) => String(id) === String(fixtureId))) {
    code = DIAGNOSIS_CODES.kbNotUsed;
  } else if (!String(last.content || "").includes(sourceUrl)) {
    code = DIAGNOSIS_CODES.urlNotInAnswer;
  }
  const diagnosed = new Error("Recovered answer did not render the reviewed source link");
  diagnosed.code = code;
  diagnosed.cause = error;
  return diagnosed;
};

export { DIAGNOSIS_CODES };
