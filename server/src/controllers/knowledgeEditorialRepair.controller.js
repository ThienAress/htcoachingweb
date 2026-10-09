import { getKnowledgeEditorialState, repairKnowledgeEditorialDraft, KnowledgeEditorialError } from "../services/knowledgeEditorialRepair.service.js";

const validId = (id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
const fail = (res, error) => {
  const known = error instanceof KnowledgeEditorialError;
  return res.status(known ? error.status : 500).json({
    success: false,
    code: known ? error.code : "KNOWLEDGE_EDITORIAL_FAILED",
    message: "Không thể hoàn tất thao tác Knowledge Entry. Hãy kiểm tra trạng thái trước khi thử lại.",
  });
};

export async function getEditorialState(req, res) {
  res.set("Cache-Control", "no-store");
  if (!validId(req.params.id)) return fail(res, new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_PRECONDITION_INVALID", 400));
  try {
    return res.json({ success: true, data: await getKnowledgeEditorialState(req.params.id) });
  } catch (error) { return fail(res, error); }
}

export async function repairEditorialDraft(req, res) {
  res.set("Cache-Control", "no-store");
  if (!validId(req.params.id)) return fail(res, new KnowledgeEditorialError("KNOWLEDGE_EDITORIAL_PRECONDITION_INVALID", 400));
  const controller = new AbortController();
  const abortOnClose = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", abortOnClose);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]);
  try {
    const data = await repairKnowledgeEditorialDraft(req.params.id, req.body, req.headers["if-match"], {
      signal, deadlineAt: Date.now() + 60_000,
    });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
  finally { res.removeListener("close", abortOnClose); }
}
