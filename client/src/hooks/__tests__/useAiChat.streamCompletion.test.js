import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  hookRuntime,
  forkAiConversation,
  getAiConversationById,
  getAiConversations,
  getAiHistory,
  openAiChatStream,
} = vi.hoisted(() => ({
  hookRuntime: { slots: [], cursor: 0 },
  forkAiConversation: vi.fn(),
  getAiConversationById: vi.fn(),
  getAiConversations: vi.fn(),
  getAiHistory: vi.fn(),
  openAiChatStream: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useRef(initial) {
    const index = hookRuntime.cursor++;
    if (!(index in hookRuntime.slots)) {
      hookRuntime.slots[index] = { current: initial };
    }
    return hookRuntime.slots[index];
  },
  useState(initial) {
    const index = hookRuntime.cursor++;
    if (!(index in hookRuntime.slots)) hookRuntime.slots[index] = initial;
    return [
      hookRuntime.slots[index],
      (next) => {
        hookRuntime.slots[index] = typeof next === "function"
          ? next(hookRuntime.slots[index])
          : next;
      },
    ];
  },
  useCallback: (callback) => callback,
  useEffect: () => {},
}));

vi.mock("../../services/ai.service", () => ({
  forkAiConversation,
  getAiConversationById,
  getAiConversations,
  getAiHistory,
  openAiChatStream,
}));

import useAiChat, { mapAiMessages } from "../useAiChat";

const renderHook = (options = { persistenceEnabled: false }) => {
  hookRuntime.cursor = 0;
  // This Node-only fixture supplies its own React hook dispatcher.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAiChat(options);
};

const streamResponse = (...events) => {
  const encoder = new TextEncoder();
  const chunks = events.map((event) =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
  );
  let index = 0;
  return {
    ok: true,
    headers: { get: () => null },
    body: {
      getReader: () => ({
        read: async () => index < chunks.length
          ? { done: false, value: chunks[index++] }
          : { done: true },
      }),
    },
  };
};

const streamResponseWithConversationHeader = (conversationId, ...events) => ({
  ...streamResponse(...events),
  headers: {
    get: (name) => name.toLowerCase() === "x-ai-conversation-id"
      ? conversationId
      : null,
  },
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("AI chat SSE completion", () => {
  beforeEach(() => {
    hookRuntime.slots = [];
    hookRuntime.cursor = 0;
    vi.resetAllMocks();
    getAiConversations.mockResolvedValue({ data: [] });
  });

  it("preserves a persisted TDEE action for reload and retry", () => {
    const structuredAction = {
      type: "calculate_tdee",
      payload: {
        gender: "male",
        age: 28,
        heightCm: 175,
        weightKg: 75,
        dailyMovement: "mixed",
        steps: "between_5000_7999",
        trainingFrequency: "three_four",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "maintenance",
      },
    };

    expect(mapAiMessages([{
      _id: "u-tdee",
      role: "user",
      content: "Tính TDEE từ thông tin tôi đã xác nhận",
      structuredAction,
    }])).toEqual([
      expect.objectContaining({
        _id: "u-tdee",
        structuredAction,
      }),
    ]);
  });

  it("sends a structured TDEE action outside the untrusted page context", async () => {
    const structuredAction = {
      type: "calculate_tdee",
      payload: {
        gender: "male",
        age: 28,
        heightCm: 175,
        weightKg: 75,
        dailyMovement: "mixed",
        steps: "between_5000_7999",
        trainingFrequency: "three_four",
        trainingDuration: "between_45_60",
        trainingIntensity: "moderate",
        goal: "maintenance",
      },
    };
    openAiChatStream.mockResolvedValue(
      streamResponse({ type: "done", conversationId: "conversation-1" }),
    );

    await renderHook().sendMessage(
      "Tính TDEE từ thông tin tôi đã xác nhận",
      { page: "/tdee-calculator" },
      { structuredAction },
    );

    expect(openAiChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { page: "/tdee-calculator" },
        structuredAction,
      }),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("marks a clean EOF without done incomplete while keeping received text", async () => {
    openAiChatStream.mockResolvedValue(streamResponse({
      type: "text",
      content: "Phần câu trả lời đã nhận.",
    }));

    await renderHook().sendMessage("Cho tôi một câu trả lời");
    const view = renderHook();

    expect({
      error: view.error,
      text: view.messages.at(-1)?.content,
      isLoading: view.isLoading,
      terminalOutcome: view.terminalOutcome,
    }).toEqual({
      error: "Câu trả lời chưa hoàn tất do kết nối bị gián đoạn. Vui lòng gửi lại câu hỏi để thử lại.",
      text: "Phần câu trả lời đã nhận.",
      isLoading: false,
      terminalOutcome: "error",
    });
  });

  it("keeps the server's SSE error instead of replacing it with an EOF error", async () => {
    openAiChatStream.mockResolvedValue(streamResponse(
      { type: "text", content: "Đoạn tạm thời." },
      { type: "error", message: "Server không thể hoàn tất câu trả lời" },
    ));

    await renderHook().sendMessage("Câu hỏi thử nghiệm");
    const view = renderHook();

    expect({
      error: view.error,
      text: view.messages.at(-1)?.content,
      terminalOutcome: view.terminalOutcome,
    }).toEqual({
      error: "Server không thể hoàn tất câu trả lời",
      text: "Đoạn tạm thời.",
      terminalOutcome: "error",
    });
  });

  it("treats a protocol done as successful completion", async () => {
    openAiChatStream.mockResolvedValue(streamResponse(
      { type: "text", content: "Câu trả lời đầy đủ có thể hiển thị tăng dần." },
      { type: "done", conversationId: null },
    ));

    await renderHook().sendMessage("Câu hỏi thử nghiệm");
    const view = renderHook();

    expect({
      error: view.error,
      text: view.messages.at(-1)?.content,
      isLoading: view.isLoading,
      terminalOutcome: view.terminalOutcome,
    }).toEqual({
      error: null,
      text: "Câu trả lời đầy đủ có thể hiển thị tăng dần.",
      isLoading: false,
      terminalOutcome: "completed",
    });
  });

  it("keeps stale conversation context visible and asks for an explicit new chat on 404", async () => {
    const priorMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-stale", messages: priorMessages },
    });
    openAiChatStream.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Không tìm thấy cuộc trò chuyện" }),
    });

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi mới");
    const view = renderHook({ persistenceEnabled: true });

    expect(view.conversationId).toBe("conversation-stale");
    expect(view.error).toMatch(/không còn tồn tại.*cuộc trò chuyện mới/i);
    expect(view.messages.some(
      (message) => message.role === "user" && message.content === "Câu hỏi mới",
    )).toBe(true);
    expect(forkAiConversation).not.toHaveBeenCalled();
    expect(getAiConversationById).not.toHaveBeenCalled();
  });

  it("keeps a streamed suffix when navigating away from and back to the active conversation", async () => {
    const encoder = new TextEncoder();
    const releaseCompletion = deferred();
    let reads = 0;
    getAiHistory.mockResolvedValue({
      data: {
        conversationId: "conversation-a",
        messages: [
          { _id: "u-a", role: "user", content: "Câu hỏi A" },
          { _id: "a-a", role: "assistant", content: "Câu trả lời A" },
        ],
      },
    });
    getAiConversationById.mockResolvedValue({
      data: {
        messages: [
          { _id: "u-b", role: "user", content: "Câu hỏi B" },
          {
            _id: "a-b",
            role: "assistant",
            content: "AC009-PREFIX AC009-LATE-SUFFIX",
          },
        ],
      },
    });
    openAiChatStream.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            reads += 1;
            if (reads === 1) {
              return {
                done: false,
                value: encoder.encode(
                  'data: {"type":"conversation","conversationId":"conversation-b"}\n\n' +
                  'data: {"type":"text","content":"AC009-PREFIX"}\n\n',
                ),
              };
            }
            if (reads === 2) return releaseCompletion.promise;
            return { done: true };
          },
        }),
      },
    });

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    renderHook({ persistenceEnabled: true }).clearHistory();
    const request = renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi B");
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).conversationId,
    ).toBe("conversation-b"));
    await renderHook({ persistenceEnabled: true })
      .switchConversation("conversation-a");
    await renderHook({ persistenceEnabled: true })
      .switchConversation("conversation-b");

    releaseCompletion.resolve({
      done: false,
      value: encoder.encode(
        'data: {"type":"text","content":" AC009-LATE-SUFFIX"}\n\n' +
        'data: {"type":"done","conversationId":"conversation-b"}\n\n',
      ),
    });
    await request;
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).messages.at(-1)?.content,
    ).toContain("AC009-LATE-SUFFIX"));
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).isReconciling,
    ).toBe(false));

    expect(renderHook({ persistenceEnabled: true }).terminalOutcome)
      .toBe("completed");
  });

  it("keeps a completed outcome when post-done history reconciliation retries", async () => {
    const persistedMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi thử nghiệm" },
      { _id: "a1", role: "assistant", content: "Câu trả lời hoàn chỉnh." },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: [] },
    });
    getAiConversationById
      .mockRejectedValueOnce(new Error("Tạm thời chưa tải được history"))
      .mockResolvedValue({ data: { messages: persistedMessages } });
    openAiChatStream.mockResolvedValue(streamResponse(
      { type: "text", content: "Câu trả lời hoàn chỉnh." },
      { type: "done", conversationId: "conversation-1" },
    ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi thử nghiệm");
    const outcomeAfterDone = renderHook({ persistenceEnabled: true });
    await vi.waitFor(() => expect(getAiConversationById).toHaveBeenCalledTimes(2));
    const outcomeAfterRetry = renderHook({ persistenceEnabled: true });

    expect({
      afterDone: {
        error: outcomeAfterDone.error,
        terminalOutcome: outcomeAfterDone.terminalOutcome,
      },
      afterRetry: {
        error: outcomeAfterRetry.error,
        terminalOutcome: outcomeAfterRetry.terminalOutcome,
      },
    }).toEqual({
      afterDone: { error: null, terminalOutcome: "completed" },
      afterRetry: { error: null, terminalOutcome: "completed" },
    });
  });

  it("runs a trailing reconciliation when consecutive completed turns overlap", async () => {
    let resolveFirstReconcile;
    const firstSnapshot = [
      { _id: "u1", role: "user", content: "Câu hỏi một" },
      { _id: "a1", role: "assistant", content: "Câu trả lời một." },
    ];
    const latestSnapshot = [
      ...firstSnapshot,
      { _id: "u2", role: "user", content: "Câu hỏi hai" },
      {
        _id: "a2",
        role: "assistant",
        content: "Câu trả lời hai.",
        feedback: "up",
      },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: [] },
    });
    getAiConversationById
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstReconcile = resolve;
      }))
      .mockResolvedValueOnce({ data: { messages: latestSnapshot } });
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Câu trả lời một." },
        { type: "done", conversationId: "conversation-1" },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Câu trả lời hai." },
        { type: "done", conversationId: "conversation-1" },
      ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi một");
    await vi.waitFor(() => expect(getAiConversationById).toHaveBeenCalledTimes(1));
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi hai");
    resolveFirstReconcile({ data: { messages: firstSnapshot } });

    await vi.waitFor(() => expect(getAiConversationById).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).messages.at(-1)?._id,
    ).toBe("a2"));
    const messages = renderHook({ persistenceEnabled: true }).messages;

    expect(messages.map(({ _id, localId, feedback }) => ({
      _id,
      hasLocalIdentity: Boolean(localId),
      feedback,
    }))).toEqual([
      { _id: "u1", hasLocalIdentity: true, feedback: undefined },
      { _id: "a1", hasLocalIdentity: true, feedback: null },
      { _id: "u2", hasLocalIdentity: true, feedback: undefined },
      { _id: "a2", hasLocalIdentity: true, feedback: "up" },
    ]);
  });

  it("bounds retries when a completed assistant identity is not persisted yet", async () => {
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: [] },
    });
    getAiConversationById.mockResolvedValue({
      data: { messages: [] },
    });
    openAiChatStream.mockResolvedValueOnce(streamResponse(
      { type: "text", content: "Câu trả lời vẫn được giữ ở local." },
      { type: "done", conversationId: "conversation-1" },
    ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi đang chờ đồng bộ");
    await vi.waitFor(
      () => expect(getAiConversationById).toHaveBeenCalledTimes(3),
      { timeout: 1_500 },
    );
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).isReconciling,
    ).toBe(false));
    const assistant = renderHook({ persistenceEnabled: true }).messages.at(-1);

    expect({
      attempts: getAiConversationById.mock.calls.length,
      content: assistant.content,
      hasLocalIdentity: Boolean(assistant.localId),
      persistedId: assistant._id,
    }).toEqual({
      attempts: 3,
      content: "Câu trả lời vẫn được giữ ở local.",
      hasLocalIdentity: true,
      persistedId: undefined,
    });
  });

  it("does not show an incomplete error when the user stops the stream", async () => {
    const encoder = new TextEncoder();
    let releaseRead;
    let reads = 0;
    openAiChatStream.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => ++reads === 1
            ? Promise.resolve({
                done: false,
                value: encoder.encode('data: {"type":"text","content":"Đã nhận."}\n\n'),
              })
            : new Promise((resolve) => { releaseRead = resolve; }),
        }),
      },
    });

    const hook = renderHook();
    const request = hook.sendMessage("Câu hỏi thử nghiệm");
    await vi.waitFor(() => expect(reads).toBe(2));
    hook.cancelRequest();
    releaseRead({ done: true });
    await request;
    const view = renderHook();

    expect({
      error: view.error,
      text: view.messages.at(-1)?.content,
      terminalOutcome: view.terminalOutcome,
    }).toEqual({
      error: null,
      text: "Đã nhận.",
      terminalOutcome: "cancelled",
    });
  });

  it("keeps the concrete tool name while a tool call is active", async () => {
    const encoder = new TextEncoder();
    let releaseRead;
    let reads = 0;
    openAiChatStream.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => ++reads === 1
            ? Promise.resolve({
                done: false,
                value: encoder.encode(
                  'data: {"type":"tool_start","tool":"search_knowledge"}\n\n',
                ),
              })
            : new Promise((resolve) => { releaseRead = resolve; }),
        }),
      },
    });

    const hook = renderHook();
    const request = hook.sendMessage("Kiểm tra kiến thức");
    await vi.waitFor(() => expect(reads).toBe(2));
    const activeTool = renderHook().activeTool;
    renderHook().cancelRequest();
    releaseRead({ done: true });
    await request;

    expect(activeTool).toBe("search_knowledge");
  });

  it.each([
    ["retry", "Câu hỏi đang dừng"],
    ["edit", "Câu hỏi đã chỉnh sửa"],
  ])("waits for a stopped local message to reconcile before %s in the same conversation", async (action, nextText) => {
    const encoder = new TextEncoder();
    let releaseRead;
    let reads = 0;
    let resolveReconcile;
    const initialMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    const reconciledMessages = [
      ...initialMessages,
      { _id: "u2", role: "user", content: "Câu hỏi đang dừng" },
    ];

    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: initialMessages },
    });
    getAiConversationById
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveReconcile = resolve;
      }))
      .mockResolvedValue({
        data: { messages: initialMessages },
      });
    forkAiConversation.mockResolvedValue({
      data: {
        conversationId: "conversation-branch",
        messages: initialMessages,
      },
    });
    openAiChatStream
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => ++reads === 1
              ? Promise.resolve({
                  done: false,
                  value: encoder.encode(
                    'data: {"type":"conversation","conversationId":"conversation-1"}\n\n' +
                    'data: {"type":"text","content":"Đoạn đã nhận."}\n\n',
                  ),
                })
              : new Promise((resolve) => { releaseRead = resolve; }),
          }),
        },
      })
      .mockResolvedValueOnce(streamResponse({
        type: "done",
        conversationId: action === "retry"
          ? "conversation-1"
          : "conversation-branch",
      }));

    const initialHook = renderHook({ persistenceEnabled: true });
    await initialHook.loadHistory();
    const request = renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi đang dừng");
    await vi.waitFor(() => expect(reads).toBe(2));

    const stoppedHook = renderHook({ persistenceEnabled: true });
    stoppedHook.cancelRequest();
    if (action === "edit") stoppedHook.editMessage(undefined, nextText);
    else stoppedHook.retryLastMessage();
    const callsBeforeReconcile = {
      forks: forkAiConversation.mock.calls.length,
      streams: openAiChatStream.mock.calls.length,
      conversationId: renderHook({ persistenceEnabled: true }).conversationId,
    };
    releaseRead({ done: true });
    await request;
    resolveReconcile({ data: { messages: reconciledMessages } });

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(2));
    if (action === "edit") {
      expect(forkAiConversation).toHaveBeenCalledTimes(1);
    } else {
      expect(forkAiConversation).not.toHaveBeenCalled();
    }

    expect({
      callsBeforeReconcile,
      forkArgs: forkAiConversation.mock.calls[0] || null,
      streamPayloads: openAiChatStream.mock.calls.map(
        ([payload]) => ({
          conversationId: payload.conversationId,
          message: payload.message,
        }),
      ),
    }).toEqual({
      callsBeforeReconcile: {
        forks: 0,
        streams: 1,
        conversationId: "conversation-1",
      },
      forkArgs: action === "edit" ? ["conversation-1", "u2"] : null,
      streamPayloads: [
        {
          conversationId: "conversation-1",
          message: "Câu hỏi đang dừng",
        },
        {
          conversationId: action === "edit"
            ? "conversation-branch"
            : "conversation-1",
          message: nextText,
        },
      ],
    });
  });

  it.each([
    ["retry", "Câu hỏi đang dừng"],
    ["edit", "Câu hỏi đã chỉnh sửa"],
  ])("reconciles a longer persisted Stop prefix into one assistant bubble before %s", async (action, nextText) => {
    const encoder = new TextEncoder();
    let releaseRead;
    let reads = 0;
    const initialMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Đoạn đã nhận từ lượt trước." },
    ];
    const persistedMessages = [
      ...initialMessages,
      { _id: "u2", role: "user", content: "Câu hỏi đang dừng" },
      { _id: "a2", role: "assistant", content: "Đoạn đã nhận và server còn ghi thêm." },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: initialMessages },
    });
    getAiConversationById.mockResolvedValue({ data: { messages: persistedMessages } });
    forkAiConversation.mockResolvedValue({
      data: { conversationId: "conversation-branch", messages: initialMessages },
    });
    openAiChatStream
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => ++reads === 1
              ? Promise.resolve({
                  done: false,
                  value: encoder.encode(
                    'data: {"type":"conversation","conversationId":"conversation-1"}\n\n' +
                    'data: {"type":"text","content":"Đoạn đã nhận"}\n\n',
                  ),
                })
              : new Promise((resolve) => { releaseRead = resolve; }),
          }),
        },
      })
      .mockResolvedValueOnce(streamResponse({
        type: "done",
        conversationId: action === "retry"
          ? "conversation-1"
          : "conversation-branch",
      }));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    const request = renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi đang dừng");
    await vi.waitFor(() => expect(reads).toBe(2));
    renderHook({ persistenceEnabled: true }).cancelRequest();
    releaseRead({ done: true });
    await request;
    await vi.waitFor(() => expect(renderHook({ persistenceEnabled: true })
      .messages.some((message) => message._id === "a2")).toBe(true));
    const reconciled = renderHook({ persistenceEnabled: true }).messages;

    if (action === "edit") {
      renderHook({ persistenceEnabled: true }).editMessage("u2", nextText);
    } else {
      renderHook({ persistenceEnabled: true }).retryLastMessage();
    }
    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(2));

    expect(reconciled.map(({ _id }) => _id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(reconciled.at(-1).content).toBe("Đoạn đã nhận và server còn ghi thêm.");
    expect(reconciled.at(-1).localId).toMatch(/^assistant-/);
    expect(forkAiConversation.mock.calls[0] || null).toEqual(
      action === "edit" ? ["conversation-1", "u2"] : null,
    );
    expect(openAiChatStream.mock.calls[1][0].conversationId).toBe(
      action === "edit" ? "conversation-branch" : "conversation-1",
    );
  });

  it("reconciles an EOF error before retrying without creating a new conversation", async () => {
    const initialMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    const reconciledMessages = [
      ...initialMessages,
      { _id: "u2", role: "user", content: "Câu hỏi bị gián đoạn" },
      { _id: "a2", role: "assistant", content: "Đoạn đã nhận." },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: initialMessages },
    });
    getAiConversationById.mockResolvedValue({
      data: { messages: reconciledMessages },
    });
    forkAiConversation.mockResolvedValue({
      data: {
        conversationId: "conversation-branch",
        messages: initialMessages,
      },
    });
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "conversation", conversationId: "conversation-1" },
        { type: "text", content: "Đoạn đã nhận." },
      ))
      .mockResolvedValueOnce(streamResponse({
        type: "done",
        conversationId: "conversation-1",
      }));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi bị gián đoạn");
    const errorOutcome = renderHook({ persistenceEnabled: true }).terminalOutcome;
    renderHook({ persistenceEnabled: true }).retryLastMessage();

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(2));

    expect({
      errorOutcome,
      forkCount: forkAiConversation.mock.calls.length,
      streamConversationIds: openAiChatStream.mock.calls.map(
        ([payload]) => payload.conversationId,
      ),
    }).toEqual({
      errorOutcome: "error",
      forkCount: 0,
      streamConversationIds: ["conversation-1", "conversation-1"],
    });
  });

  it("resends a rolled-back provider error in the same conversation without a ghost turn", async () => {
    const priorMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: priorMessages },
    });
    getAiConversationById
      .mockResolvedValueOnce({ data: { messages: priorMessages } })
      .mockResolvedValue({
        data: {
          messages: [
            ...priorMessages,
            { _id: "u2", role: "user", content: "Câu hỏi bị lỗi" },
            { _id: "a2", role: "assistant", content: "Đã khắc phục." },
          ],
        },
      });
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "conversation", conversationId: "conversation-1" },
        { type: "error", message: "Có lỗi xảy ra, vui lòng thử lại", retryable: true },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Đã khắc phục." },
        { type: "done", conversationId: "conversation-1" },
      ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi bị lỗi");
    expect(renderHook({ persistenceEnabled: true }).terminalOutcome).toBe("error");
    renderHook({ persistenceEnabled: true }).retryLastMessage();

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(renderHook({ persistenceEnabled: true }).isLoading).toBe(false));
    const view = renderHook({ persistenceEnabled: true });

    expect(forkAiConversation).not.toHaveBeenCalled();
    expect(openAiChatStream.mock.calls.map(([payload]) => ({
      conversationId: payload.conversationId,
      message: payload.message,
    }))).toEqual([
      { conversationId: "conversation-1", message: "Câu hỏi bị lỗi" },
      { conversationId: "conversation-1", message: "Câu hỏi bị lỗi" },
    ]);
    expect(openAiChatStream.mock.calls[0][0].requestId)
      .not.toBe(openAiChatStream.mock.calls[1][0].requestId);
    expect(view.messages.filter(
      (message) => message.role === "user" && message.content === "Câu hỏi bị lỗi",
    )).toHaveLength(1);
    expect(view.messages.filter(
      (message) => message.role === "assistant" && message.content === "Đã khắc phục.",
    )).toHaveLength(1);
  });

  it("retries a pre-conversation provider error without clearing earlier local context", async () => {
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Câu trả lời local trước đó." },
        { type: "done", conversationId: null },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "error", message: "Provider tạm thời lỗi", retryable: true },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Đã thử lại thành công." },
        { type: "done", conversationId: null },
      ));

    const hook = renderHook();
    await hook.sendMessage("Câu hỏi đầu tiên");
    await renderHook().sendMessage("Câu hỏi bị lỗi trước conversation event");
    renderHook().retryLastMessage();

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(renderHook().isLoading).toBe(false));

    expect(renderHook().messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: "user", content: "Câu hỏi đầu tiên" },
      { role: "assistant", content: "Câu trả lời local trước đó." },
      { role: "user", content: "Câu hỏi bị lỗi trước conversation event" },
      { role: "assistant", content: "Đã thử lại thành công." },
    ]);
  });

  it("binds the acquired conversation from headers before an SSE error can be retried", async () => {
    getAiConversationById.mockResolvedValue({ data: { messages: [] } });
    openAiChatStream
      .mockResolvedValueOnce(streamResponseWithConversationHeader(
        "conversation-acquired",
        { type: "error", message: "Provider tạm thời lỗi", retryable: true },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Đã thử lại thành công." },
        { type: "done", conversationId: "conversation-acquired" },
      ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.sendMessage("Câu hỏi bị lỗi trước conversation event");
    renderHook({ persistenceEnabled: true }).retryLastMessage();

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(2));
    expect(openAiChatStream.mock.calls.map(([payload]) => payload.conversationId))
      .toEqual([null, "conversation-acquired"]);
    expect(renderHook({ persistenceEnabled: true }).conversationId)
      .toBe("conversation-acquired");
  });

  it("keeps local context retryable after a transport EOF before conversation acquisition", async () => {
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Câu trả lời local trước đó." },
        { type: "done", conversationId: null },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Phần dở dang." },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Đã thử lại thành công." },
        { type: "done", conversationId: null },
      ));

    const hook = renderHook();
    await hook.sendMessage("Câu hỏi đầu tiên");
    await renderHook().sendMessage("Câu hỏi bị ngắt kết nối");
    renderHook().retryLastMessage();

    await vi.waitFor(() => expect(openAiChatStream).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(renderHook().isLoading).toBe(false));
    expect(renderHook().messages.map(({ role, content }) => ({ role, content })))
      .toEqual([
        { role: "user", content: "Câu hỏi đầu tiên" },
        { role: "assistant", content: "Câu trả lời local trước đó." },
        { role: "user", content: "Câu hỏi bị ngắt kết nối" },
        { role: "assistant", content: "Đã thử lại thành công." },
      ]);
  });

  it("drops a rolled-back failed turn on an ordinary next send, even if history arrives late", async () => {
    let resolveOldHistory;
    const priorMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    const latestMessages = [
      ...priorMessages,
      { _id: "u2", role: "user", content: "Câu hỏi mới" },
      { _id: "a2", role: "assistant", content: "Câu trả lời mới." },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: priorMessages },
    });
    getAiConversationById
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOldHistory = resolve;
      }))
      .mockResolvedValue({ data: { messages: latestMessages } });
    openAiChatStream
      .mockResolvedValueOnce(streamResponse(
        { type: "conversation", conversationId: "conversation-1" },
        { type: "text", content: "Phần dở dang." },
        { type: "error", message: "Có lỗi xảy ra", retryable: true },
      ))
      .mockResolvedValueOnce(streamResponse(
        { type: "text", content: "Câu trả lời mới." },
        { type: "done", conversationId: "conversation-1" },
      ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi bị lỗi");
    await vi.waitFor(() => expect(getAiConversationById).toHaveBeenCalledTimes(1));
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi mới");
    resolveOldHistory({ data: { messages: priorMessages } });
    await vi.waitFor(() => expect(
      renderHook({ persistenceEnabled: true }).messages.at(-1)?._id,
    ).toBe("a2"));

    expect({
      streamConversationIds: openAiChatStream.mock.calls.map(
        ([payload]) => payload.conversationId,
      ),
      visibleMessages: renderHook({ persistenceEnabled: true }).messages.map(
        ({ _id, content }) => ({ _id, content }),
      ),
    }).toEqual({
      streamConversationIds: ["conversation-1", "conversation-1"],
      visibleMessages: [
        { _id: "u1", content: "Câu hỏi trước" },
        { _id: "a1", content: "Câu trả lời trước" },
        { _id: "u2", content: "Câu hỏi mới" },
        { _id: "a2", content: "Câu trả lời mới." },
      ],
    });
  });

  it("fails closed when a provider error has no confirmed rollback marker", async () => {
    const priorMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-1", messages: priorMessages },
    });
    getAiConversationById.mockResolvedValue({
      data: { messages: priorMessages },
    });
    openAiChatStream.mockResolvedValueOnce(streamResponse(
      { type: "conversation", conversationId: "conversation-1" },
      { type: "error", message: "Có lỗi xảy ra", retryable: false },
    ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true }).sendMessage("Câu hỏi bị lỗi");
    renderHook({ persistenceEnabled: true }).retryLastMessage();
    await vi.waitFor(() => expect(renderHook({ persistenceEnabled: true }).error)
      .toMatch(/chưa đồng bộ/));

    expect(openAiChatStream).toHaveBeenCalledTimes(1);
    expect(forkAiConversation).not.toHaveBeenCalled();
  });

  it("does not navigate back to a stale branch after the user switches conversations", async () => {
    const pendingFork = deferred();
    const sourceMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
      { _id: "u2", role: "user", content: "Câu hỏi cần thử lại" },
    ];
    const destinationMessages = [
      { _id: "u3", role: "user", content: "Cuộc trò chuyện B" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-a", messages: sourceMessages },
    });
    getAiConversationById.mockResolvedValue({ data: { messages: destinationMessages } });
    forkAiConversation.mockReturnValue(pendingFork.promise);

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    renderHook({ persistenceEnabled: true }).retryLastMessage("u2");
    await vi.waitFor(() => expect(forkAiConversation).toHaveBeenCalledTimes(1));
    await renderHook({ persistenceEnabled: true }).switchConversation("conversation-b");

    pendingFork.resolve({
      data: { conversationId: "conversation-a-branch", messages: sourceMessages },
    });
    await vi.waitFor(() => expect(renderHook({ persistenceEnabled: true }).conversationId)
      .toBe("conversation-b"));

    expect(openAiChatStream).not.toHaveBeenCalled();
  });

  it("does not resume a stale retry after navigating away and back during reconciliation", async () => {
    const pendingReconcile = deferred();
    const sourceMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "a1", role: "assistant", content: "Câu trả lời trước" },
    ];
    const reconciledMessages = [
      ...sourceMessages,
      { _id: "u2", role: "user", content: "Câu hỏi cần thử lại" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-a", messages: sourceMessages },
    });
    getAiConversationById.mockImplementation((conversationId) =>
      conversationId === "conversation-a"
        ? pendingReconcile.promise
        : Promise.resolve({
            data: {
              messages: [
                { _id: "u3", role: "user", content: "Conversation B" },
              ],
            },
          }),
    );
    openAiChatStream.mockResolvedValueOnce(streamResponse(
      { type: "conversation", conversationId: "conversation-a" },
      { type: "error", message: "Có lỗi xảy ra", retryable: false },
    ));

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    await renderHook({ persistenceEnabled: true })
      .sendMessage("Câu hỏi cần thử lại");
    renderHook({ persistenceEnabled: true }).retryLastMessage();
    await renderHook({ persistenceEnabled: true })
      .switchConversation("conversation-b");
    await renderHook({ persistenceEnabled: true })
      .switchConversation("conversation-a");

    pendingReconcile.resolve({ data: { messages: reconciledMessages } });
    await pendingReconcile.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(renderHook({ persistenceEnabled: true }).conversationId)
      .toBe("conversation-a");
    expect(forkAiConversation).not.toHaveBeenCalled();
    expect(openAiChatStream).toHaveBeenCalledTimes(1);
  });

  it("does not write a stale branch failure onto the newly selected conversation", async () => {
    const pendingFork = deferred();
    const sourceMessages = [
      { _id: "u1", role: "user", content: "Câu hỏi trước" },
      { _id: "u2", role: "user", content: "Câu hỏi cần thử lại" },
    ];
    getAiHistory.mockResolvedValue({
      data: { conversationId: "conversation-a", messages: sourceMessages },
    });
    getAiConversationById.mockResolvedValue({
      data: { messages: [{ _id: "u3", role: "user", content: "Conversation B" }] },
    });
    forkAiConversation.mockReturnValue(pendingFork.promise);

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    renderHook({ persistenceEnabled: true }).retryLastMessage("u2");
    await vi.waitFor(() => expect(forkAiConversation).toHaveBeenCalledTimes(1));
    await renderHook({ persistenceEnabled: true }).switchConversation("conversation-b");

    pendingFork.reject(new Error("Fork failed"));
    await Promise.resolve();
    await Promise.resolve();

    const current = renderHook({ persistenceEnabled: true });
    expect({ conversationId: current.conversationId, error: current.error }).toEqual({
      conversationId: "conversation-b",
      error: null,
    });
  });

  it("keeps persisted feedback in the conversation registry across navigation", async () => {
    getAiHistory.mockResolvedValue({
      data: {
        conversationId: "conversation-a",
        messages: [
          { _id: "u1", role: "user", content: "Câu hỏi" },
          { _id: "a1", role: "assistant", content: "Câu trả lời" },
        ],
      },
    });
    getAiConversationById.mockResolvedValue({
      data: {
        messages: [{ _id: "u2", role: "user", content: "Conversation B" }],
      },
    });

    const hook = renderHook({ persistenceEnabled: true });
    await hook.loadHistory();
    renderHook({ persistenceEnabled: true })
      .updateMessageFeedback("conversation-a", "a1", "up");
    await renderHook({ persistenceEnabled: true }).switchConversation("conversation-b");
    await renderHook({ persistenceEnabled: true }).switchConversation("conversation-a");

    expect(
      renderHook({ persistenceEnabled: true }).messages.find(
        (message) => message._id === "a1",
      )?.feedback,
    ).toBe("up");
  });
});
