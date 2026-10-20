const hasImage = (value) =>
  Array.isArray(value) ? value.some(Boolean) : Boolean(value);

const hasText = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

// Câu chuyện đủ ảnh trước/sau và số liệu thì mới đưa lên đầu trang công khai.
export const isStoryComplete = (story) =>
  Boolean(story) &&
  hasImage(story.beforeImg) &&
  hasImage(story.afterImg) &&
  hasText(story.result) &&
  hasText(story.duration);

// Giữ nguyên thứ tự gốc trong từng nhóm.
export const moveCompleteStoriesFirst = (stories) => {
  const list = Array.isArray(stories) ? stories : [];
  return [
    ...list.filter(isStoryComplete),
    ...list.filter((story) => !isStoryComplete(story)),
  ];
};
