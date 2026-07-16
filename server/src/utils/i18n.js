/**
 * i18n Helper — Resolve translated field từ document Mongoose.
 *
 * Logic: Nếu lang === "en" VÀ document có i18n.en.[field] không rỗng → trả bản EN.
 *        Ngược lại → trả field gốc (tiếng Việt).
 *
 * Usage trong controller:
 *   const { resolveField, resolveArray } = createI18nResolver(req.query.lang);
 *   const bio = resolveField(trainer, "bio");
 *   const achievements = resolveArray(trainer, "achievements");
 */

/**
 * Tạo resolver cho một request cụ thể.
 * @param {string} lang - Ngôn ngữ yêu cầu ("vi" | "en")
 * @returns {{ resolveField, resolveArray, resolveDoc }}
 */
export function createI18nResolver(lang = "vi") {
  const isEn = lang === "en";

  /**
   * Resolve một field text đơn.
   * @param {Object} doc - Mongoose document (plain object hoặc document)
   * @param {string} field - Tên field (vd: "bio", "message")
   * @returns {string}
   */
  function resolveField(doc, field) {
    if (!isEn) return doc[field] || "";
    const enValue = doc?.i18n?.en?.[field];
    return enValue || doc[field] || "";
  }

  /**
   * Resolve một field array.
   * @param {Object} doc - Mongoose document
   * @param {string} field - Tên field array (vd: "achievements", "highlights")
   * @returns {string[]}
   */
  function resolveArray(doc, field) {
    if (!isEn) return doc[field] || [];
    const enValue = doc?.i18n?.en?.[field];
    return enValue?.length > 0 ? enValue : doc[field] || [];
  }

  /**
   * Resolve nhiều fields cùng lúc, trả về object đã localized.
   * Fields không có trong translatable sẽ giữ nguyên giá trị gốc.
   * @param {Object} doc - Mongoose document
   * @param {string[]} textFields - Các field text cần resolve
   * @param {string[]} arrayFields - Các field array cần resolve
   * @returns {Object} Object chứa các field đã localized
   */
  function resolveDoc(doc, textFields = [], arrayFields = []) {
    const result = {};
    for (const f of textFields) {
      result[f] = resolveField(doc, f);
    }
    for (const f of arrayFields) {
      result[f] = resolveArray(doc, f);
    }
    return result;
  }

  return { resolveField, resolveArray, resolveDoc };
}
