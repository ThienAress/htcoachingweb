const NAVIGATOR_LABEL_MAX_LENGTH = 61;

const normalizeQuestionLabel = (message) => {
  const normalized = String(message?.content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return message?.image ? "Câu hỏi bằng hình ảnh" : "Câu hỏi chưa có nội dung";
  }

  if (normalized.length <= NAVIGATOR_LABEL_MAX_LENGTH) return normalized;

  return `${normalized
    .slice(0, NAVIGATOR_LABEL_MAX_LENGTH - 1)
    .trimEnd()}…`;
};

export const getConversationMessageKey = (message, messageIndex) =>
  String(message?._id || message?.localId || `message-${messageIndex}`);

export const buildConversationQuestionItems = (messages = []) =>
  messages.flatMap((message, messageIndex) => {
    if (message?.role !== "user") return [];

    return [{
      key: getConversationMessageKey(message, messageIndex),
      messageIndex,
      label: normalizeQuestionLabel(message),
    }];
  });

export const shouldShowConversationNavigator = ({
  clientHeight,
  scrollHeight,
  questionCount,
}) =>
  Number(questionCount) >= 2 &&
  Number(scrollHeight) - Number(clientHeight) > 80;
