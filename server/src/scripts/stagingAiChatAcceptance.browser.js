import crypto from "node:crypto";

const assert = (condition, message, code = "STAGING_AI_BROWSER_ASSERTION_FAILED") => {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
};

export const selectNewReconciledAssistant = (items, cursor, questionDigest) =>
  items.slice(cursor).find((item) => item.questionDigest === questionDigest) || null;

export const STAGING_AI_CHAT_ATTEMPT_PLAN = Object.freeze([
  Object.freeze({ purpose: "live_kb_provider", mode: "observe_only" }),
  Object.freeze({ purpose: "paced_conversation", mode: "paced_response" }),
  Object.freeze({ purpose: "stop", mode: "paced_response" }),
  Object.freeze({ purpose: "provider_failure_retry", mode: "provider_failure_before_llm" }),
  Object.freeze({ purpose: "recovery_retry", mode: "observe_only" }),
  Object.freeze({ purpose: "provider_failure_edit", mode: "provider_failure_before_llm" }),
  Object.freeze({ purpose: "recovery_edit", mode: "observe_only" }),
]);

const waitStableText = async (locator, expected) => {
  await locator.filter({ hasText: expected }).waitFor({ state: "visible", timeout: 30_000 });
  const first = await locator.filter({ hasText: expected }).last().innerText();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const second = await locator.filter({ hasText: expected }).last().innerText();
  assert(first === second, "Paced response prefix was not stable after its first frame");
};

const waitControlStatus = async (collection, jti, status, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const control = await collection.findOne({ _id: jti }, { projection: { status: 1 } });
    if (control?.status === status) return control;
    if (["aborted", "timed_out", "completed"].includes(control?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(false, `Staging control did not reach ${status}`, "STAGING_AI_CONTROL_BARRIER_FAILED");
};

export const waitForFailedRecoveryReceipt = async ({
  collection,
  jti,
  requestId,
  runId,
  actorId,
  releaseSha,
  runtimeInstanceId,
  action,
  purpose,
  mode,
  timeoutMs = 30_000,
  pollMs = 100,
  now = () => Date.now(),
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) => {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const receipt = await collection.findOne(
      { _id: jti, recordType: "capability" },
      { projection: {
        _id: 1, recordType: 1, receiptVersion: 1, receiptState: 1, outcome: 1,
        runId: 1, actorId: 1, action: 1, purpose: 1, mode: 1, requestId: 1,
        releaseSha: 1, runtimeInstanceId: 1, admittedAt: 1, settledAt: 1,
      } },
    );
    if (receipt) {
      assert(
        String(receipt._id) === jti && receipt.recordType === "capability" && receipt.receiptVersion === 2 &&
          receipt.runId === runId && receipt.actorId === actorId && receipt.requestId === requestId &&
          receipt.action === action && receipt.purpose === purpose && receipt.mode === mode &&
          receipt.releaseSha === releaseSha && receipt.runtimeInstanceId === runtimeInstanceId,
        "Failure receipt did not match its exact recovery cohort contract",
        "STAGING_AI_RECEIPT_MISMATCH",
      );
      if (receipt.receiptState === "settled") {
        assert(receipt.outcome === "failed" && receipt.admittedAt && receipt.settledAt,
          "Failure receipt did not settle as failed before recovery",
          "STAGING_AI_RECEIPT_MISMATCH");
        return receipt;
      }
      assert(["issued", "admitted"].includes(receipt.receiptState),
        "Failure receipt entered an unexpected non-terminal state",
        "STAGING_AI_RECEIPT_MISMATCH");
    }
    await wait(pollMs);
  }
  assert(false, "Failure receipt did not settle before recovery admission", "STAGING_AI_RECEIPT_UNSETTLED");
};

const send = async (page, text) => {
  const composer = page.getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...");
  await composer.fill(text);
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
};

const newConversation = async (page) => {
  await page.getByRole("button", { name: "Cuộc trò chuyện mới" }).click();
};

export const runBrowserAcceptance = async ({
  chromium,
  clientUrl,
  apiOrigin,
  accessToken,
  csrfToken,
  actorId,
  releaseSha,
  runtimeInstanceId,
  runId,
  fixture,
  sourceUrl,
  prefix,
  lateSuffix,
  issueCapability,
  db,
  ownerObjectId,
  onLaneResult = () => {},
  onAttempt = () => {},
}) => {
  const browser = await chromium.launch({ headless: true });
  const requestIds = [];
  const controls = [];
  const reconciledAssistants = [];
  const uiAssistantEvidence = [];
  const laneResults = [];
  const attemptPlan = STAGING_AI_CHAT_ATTEMPT_PLAN.map((item) => ({ ...item }));
  const recordLane = (lane) => {
    laneResults.push(lane);
    onLaneResult(lane);
  };
  const controlCollection = db.collection("staging_ai_acceptance_claims");
  try {
    const context = await browser.newContext({
      locale: "vi-VN",
      recordHar: undefined,
      recordVideo: undefined,
      storageState: undefined,
    });
    await context.addCookies([
      { name: "accessToken", value: accessToken, url: apiOrigin, httpOnly: true, secure: true, sameSite: "None" },
      { name: "csrfToken", value: csrfToken, url: apiOrigin, httpOnly: false, secure: true, sameSite: "None" },
      { name: "csrfToken", value: csrfToken, url: clientUrl, httpOnly: false, secure: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss());
    page.on("response", async (response) => {
      if (response.request().method() !== "GET" || !/\/api\/ai\/conversations\/[a-f0-9]{24}$/i.test(response.url())) return;
      const payload = await response.json().catch(() => null);
      const messages = payload?.data?.messages || [];
      const assistantIndex = messages.findLastIndex((message) => message.role === "assistant");
      const assistant = messages[assistantIndex];
      const precedingUser = messages.slice(0, assistantIndex).findLast((message) => message.role === "user");
      if (assistant?._id && assistant.content) {
        reconciledAssistants.push({
          assistantId: String(assistant._id),
          contentDigest: crypto.createHash("sha256").update(assistant.content).digest("hex"),
          questionDigest: crypto.createHash("sha256").update(String(precedingUser?.content || "")).digest("hex"),
        });
      }
    });
    await page.route(`${apiOrigin}/api/ai/chat`, async (route, request) => {
      if (request.method() !== "POST") return route.continue();
      const body = request.postDataJSON();
      requestIds.push(body.requestId);
      const planned = attemptPlan.shift();
      assert(planned, "Chat POST exceeded the exact AC-009 request inventory", "STAGING_AI_REQUEST_INVENTORY_FAILED");
      const jti = crypto.randomUUID();
      controls.push({ jti, requestId: body.requestId, mode: planned.mode, purpose: planned.purpose });
      const token = await issueCapability({
        releaseSha, runtimeInstanceId, runId, actorId, request: body, mode: planned.mode, purpose: planned.purpose, action: "ai_chat", jti,
        ttlSeconds: 30,
      });
      onAttempt({ purpose: planned.purpose, action: "ai_chat", mode: planned.mode, jti, requestId: body.requestId });
      await route.continue({ postData: JSON.stringify({ ...body, stagingAcceptance: token }) });
    });
    await page.goto(clientUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    await page.getByRole("dialog", { name: "HT Assistant" }).waitFor();
    const assistantBodies = page.locator(".markdown-body");

    await send(page, fixture.question);
    const citation = page.locator(`a[href="${sourceUrl}"]`).last();
    await citation.waitFor({ state: "visible", timeout: 90_000 });
    const stableCitation = await citation.getAttribute("href");
    const stableBody = await assistantBodies.last().innerText();
    const captureUiEvidence = async (expectedQuestion, cursor = 0) => {
      const questionDigest = crypto.createHash("sha256").update(expectedQuestion).digest("hex");
      const deadline = Date.now() + 10_000;
      let reconciled;
      while (!reconciled && Date.now() < deadline) {
        reconciled = selectNewReconciledAssistant(reconciledAssistants, cursor, questionDigest);
        if (reconciled) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert(reconciled?.assistantId, "UI reconciliation did not expose assistant identity");
      const renderedMessage = page.locator(
        `[data-message-id="${reconciled.assistantId}"] .markdown-body`,
      );
      await renderedMessage.waitFor({ state: "visible", timeout: 10_000 });
      await renderedMessage.locator(`a[href="${sourceUrl}"]`).waitFor({
        state: "visible",
        timeout: 10_000,
      });
      uiAssistantEvidence.push({
        ...reconciled,
        renderedMessageId: reconciled.assistantId,
        renderedContentLength: (await renderedMessage.innerText()).length,
      });
    };
    await captureUiEvidence(fixture.question);
    recordLane({ name: "live-kb-provider", passed: true });

    await newConversation(page);
    const pacedQuestion = `${fixture.variant} lane-paced`;
    await send(page, pacedQuestion);
    const pacedControl = controls.at(-1);
    await waitControlStatus(controlCollection, pacedControl.jti, "first_frame");
    await waitStableText(assistantBodies, prefix);
    await page.getByText(fixture.question.slice(0, 55), { exact: false }).first().click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert((await citation.getAttribute("href")) === stableCitation, "Conversation B citation changed while A was pending");
    assert((await assistantBodies.last().innerText()) === stableBody, "Conversation B content changed while A was pending");
    const released = await controlCollection.updateOne({
      _id: pacedControl.jti,
      runId,
      actorId,
      requestId: pacedControl.requestId,
      releaseSha,
      status: "first_frame",
    }, { $set: { status: "released", releasedAt: new Date() } });
    assert(released.modifiedCount === 1, "Paced control release CAS failed");
    await page.getByText(pacedQuestion.slice(0, 55), { exact: false }).first().click();
    await assistantBodies.filter({ hasText: lateSuffix }).last().waitFor({ timeout: 30_000 });
    recordLane({ name: "paced-conversation-isolation", passed: true, injection: "paced response at server boundary" });

    await newConversation(page);
    await send(page, `${fixture.variant} lane-stop`);
    const stopControl = controls.at(-1);
    await waitControlStatus(controlCollection, stopControl.jti, "first_frame");
    await waitStableText(assistantBodies, prefix);
    const stoppedBody = assistantBodies.filter({ hasText: prefix }).last();
    await page.getByRole("button", { name: "Dừng phản hồi" }).click();
    const composer = page.getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...");
    await composer.waitFor({ state: "visible" });
    assert(await composer.isEnabled(), "Composer did not recover after Stop");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    assert(!(await stoppedBody.innerText()).includes(lateSuffix), "Held suffix appeared after Stop");
    assert((await page.getByRole("alert").count()) === 0, "Stop surfaced an unexpected error alert");
    await waitControlStatus(controlCollection, stopControl.jti, "aborted");
    const lateRelease = await controlCollection.updateOne({
      _id: stopControl.jti,
      runId,
      actorId,
      requestId: stopControl.requestId,
      releaseSha,
      status: "first_frame",
    }, { $set: { status: "released", releasedAt: new Date() } });
    assert(lateRelease.modifiedCount === 0, "Aborted control accepted a late release");
    let activeStreams = 1;
    const streamDeadline = Date.now() + 10_000;
    while (activeStreams > 0 && Date.now() < streamDeadline) {
      activeStreams = await db.collection("chatconversations").countDocuments({
        userId: ownerObjectId,
        activeStreamId: { $ne: null },
      });
      if (activeStreams > 0) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(activeStreams === 0, "Stop did not clear the active stream in MongoDB");
    recordLane({ name: "stop-recovery", passed: true, injection: "paced response at server boundary" });

    const runFailureRecovery = async (kind) => {
      await newConversation(page);
      const question = `${fixture.question} lane-${kind}`;
      const before = await db.collection("serviceusagebuckets").findOne({ userId: ownerObjectId });
      await send(page, question);
      const alert = page.getByRole("alert");
      await alert.waitFor({ timeout: 30_000 });
      assert((await alert.innerText()).includes("Có lỗi xảy ra"), "Failure lane did not show the generic SSE error");
      const retry = page.getByRole("button", { name: /Thử lại/ });
      assert(await retry.isEnabled(), "Failure lane did not enable retry");
      const failedId = requestIds.at(-1);
      const failedConversation = await db.collection("chatconversations").findOne({
        userId: ownerObjectId,
        recentRequestIds: failedId,
      });
      assert(!failedConversation, "Failed request key was retained");
      const after = await db.collection("serviceusagebuckets").findOne({ userId: ownerObjectId });
      const failedOperationHash = crypto.createHash("sha256").update(failedId).digest("hex");
      assert(
        !(after?.usageEvents || []).some((event) => event.operationHash === failedOperationHash) &&
          Number(after?.count || 0) === Number(before?.count || 0),
        "Failure lane did not remove its authoritative quota event",
      );
      const failedAttempt = controls.at(-1);
      assert(failedAttempt?.requestId === failedId,
        "Failure lane did not retain the exact capability attempt", "STAGING_AI_REQUEST_INVENTORY_FAILED");
      await waitForFailedRecoveryReceipt({
        collection: controlCollection,
        ...failedAttempt,
        runId,
        actorId,
        releaseSha,
        runtimeInstanceId,
        action: "ai_chat",
      });
      const reconciliationCursor = reconciledAssistants.length;
      let recoveryQuestion;
      if (kind === "retry") {
        recoveryQuestion = question;
        await retry.click();
      } else {
        await page.getByTitle("Chỉnh sửa câu hỏi").last().click();
        const textareas = page.locator("textarea");
        let editor = null;
        for (let index = 0; index < await textareas.count(); index += 1) {
          const candidate = textareas.nth(index);
          if ((await candidate.inputValue()) === question) editor = candidate;
        }
        assert(editor, "Edit lane did not expose the failed user message editor");
        recoveryQuestion = `${fixture.variant} recovery-edit`;
        await editor.fill(recoveryQuestion);
        await page.getByRole("button", { name: "Cập nhật" }).click();
      }
      await page.locator(`a[href="${sourceUrl}"]`).last().waitFor({ timeout: 90_000 });
      assert(requestIds.at(-1) !== failedId, "Recovery reused the failed requestId");
      await captureUiEvidence(recoveryQuestion, reconciliationCursor);
      recordLane({
        name: `provider-failure-${kind}`,
        passed: true,
        injection: "injected provider-boundary failure before LLM",
      });
    };
    await runFailureRecovery("retry");
    await runFailureRecovery("edit");
    assert(attemptPlan.length === 0 && requestIds.length === 7 && controls.length === 7,
      "Chat POST inventory did not contain exactly seven planned attempts", "STAGING_AI_REQUEST_INVENTORY_FAILED");
    await context.close();
    return {
      requestIds,
      attempts: controls.map(({ purpose, mode, jti, requestId }) => ({ purpose, action: "ai_chat", mode, jti, requestId })),
      uiAssistantEvidence,
      lanes: laneResults,
    };
  } finally {
    await browser.close().catch(() => {});
  }
};
