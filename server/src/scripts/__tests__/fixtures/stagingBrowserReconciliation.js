const SOURCE_URL = "https://example.com/reference";
const COMPLETE = "Synthetic answer with citation and final streamed suffix.";

export const reconciliationBrowserFixture = ({
  initiallyComplete = false, changedOnReturn = false, failedWaitPhase = null,
} = {}) => {
  const failWait = async phase => {
    if (failedWaitPhase !== phase) return;
    throw Object.assign(new Error("Synthetic locator contains private diagnostic text"), { name: "TimeoutError" });
  };
  const handlers = new Map();
  let routeHandler;
  let question;
  let sent = 0;
  let selected = "completed";
  let reconciled = initiallyComplete;
  let returned = false;
  const bodyText = () => {
    if (selected === "paced") return "AC009-PREFIX synthetic held frame";
    if (returned && changedOnReturn) return `${COMPLETE} Unexpected change.`;
    return reconciled ? COMPLETE : "Synthetic answer with citation";
  };
  const body = {
    last: () => body,
    filter: () => body,
    waitFor: async () => {},
    innerText: async () => bodyText(),
  };
  const citation = {
    last: () => citation,
    waitFor: async () => failWait("persisted_citation"),
    getAttribute: async () => SOURCE_URL,
  };
  const persisted = {
    waitFor: async () => {
      await failWait("persisted_message");
      reconciled = true;
    },
    locator: () => citation,
    innerText: async () => bodyText(),
  };
  const send = async () => {
    sent += 1;
    selected = sent === 1 ? "completed" : "paced";
    const request = { requestId: `request-${sent}`, message: question };
    await routeHandler({ continue: async () => {} }, {
      method: () => "POST",
      postDataJSON: () => request,
    });
    if (sent === 1) {
      await handlers.get("response")({
        request: () => ({ method: () => "GET" }),
        url: () => "https://example.com/api/ai/conversations/aaaaaaaaaaaaaaaaaaaaaaaa",
        json: async () => ({ data: { messages: [
          { role: "user", content: question },
          { _id: "assistant-final", role: "assistant", content: COMPLETE },
        ] } }),
      });
    }
  };
  const page = {
    on: (event, handler) => handlers.set(event, handler),
    route: async (url, handler) => { routeHandler = handler; },
    goto: async () => {},
    getByPlaceholder: () => ({ fill: async (value) => { question = value; } }),
    getByRole: (role, options) => ({
      waitFor: async () => {},
      click: async () => {
        if (options.name === "Gửi tin nhắn") return send();
        if (options.name === "Mở cuộc trò chuyện: synthetic grounded question") {
          selected = "completed";
          returned = true;
        } else if (String(options.name).startsWith("Mở cuộc trò chuyện:")) {
          selected = "paced";
        }
      },
    }),
    locator: (selector) => {
      if (selector === ".markdown-body") return body;
      if (selector.startsWith("[data-message-id=")) return persisted;
      return { ...citation, last: () => ({ ...citation, waitFor: () => failWait("first_citation") }) };
    },
  };
  const context = {
    addCookies: async () => {},
    newPage: async () => page,
    close: async () => {},
  };
  return {
    chromium: { launch: async () => ({ newContext: async () => context, close: async () => {} }) },
    clientUrl: "https://example.com",
    apiOrigin: "https://example.com",
    fixture: { question: "synthetic grounded question", variant: "synthetic variant" },
    sourceUrl: SOURCE_URL,
    prefix: "AC009-PREFIX",
    lateSuffix: "AC009-PREFIX",
    issueCapability: async () => "synthetic-capability",
    db: { collection: () => ({
      findOne: async () => ({ status: "first_frame" }),
      updateOne: async () => ({ modifiedCount: 1 }),
    }) },
    onLaneResult: (lane) => {
      if (lane.name === "paced-conversation-isolation") {
        const error = new Error("Reached isolation checkpoint");
        error.code = "TEST_ISOLATION_CHECKPOINT";
        throw error;
      }
    },
  };
};
