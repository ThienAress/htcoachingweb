/**
 * Danh sách từ/nội dung cấm trong form đăng ký.
 * Tách riêng để tái sử dụng và giữ file chính gọn.
 */

const BAD_WORDS = [
  "địt", "dit", "đụ", "du", "đụ má", "đụ mẹ", "đm", "dm", "dmm", "dcm",
  "cặc", "cak", "cac", "cạc", "lồn", "lon", "loz", "l",
  "buồi", "buoi", "bùi", "bui", "chim", "bướm", "buom",
  "bú", "bu", "bú lol", "bú l", "ăn cặc", "ăn l", "ăn buồi",
  "đéo", "deo", "đếch", "dek", "vl", "vkl", "cl", "vcl", "cc",
  "shit", "fuck", "fml", "diss", "bitch",
  "bóp vú", "nứng", "nứng lồn", "nứng vl",
  "chịch", "chich", "xoạc", "xoc", "rape", "hiếp", "hiếp dâm",
  "gạ tình", "gạ gẫm", "sex", "sexy", "69", "xxx", "jav",
  "phim sex", "phim jav", "trai gọi", "gái gọi", "gái mại dâm",
  "bán dâm", "đi khách",
  "bong", "casino", "bet", "ku", "cmd368", "w88", "fun88", "fifa",
  "letou", "cacuoc", "1xbet", "dafabet", "188bet", "m88", "baccarat",
  "xoso", "xổ số", "danh bai", "game bai", "rakhoi", "choi casino",
  "vn88", "bong88", "new88", "nhacaionline", "nhà cái",
  "fck", "f u", "dmml", "dmvl", "ml", "ccmm", "đkm",
  "bố mày", "mẹ mày", "con đĩ", "con chó", "thằng chó",
  "clgt", "clmm", "sv", "óc chó", "súc vật", "não chó",
];

const DOMAIN_REGEX =
  /(https?:\/\/)?[a-z0-9.-]*(rakhoi|sv388|win88|cmd368|fun88|go88|f8bet|esball|ae888|123win|789win|hi88|okvip|new88|w88|m88|b52|uw88|nổhũ|bàiđổithưởng|cáđộ|cá cược)[^\s]*/gi;

const SCRIPT_REGEX = /<script.*?>.*?<\/script>/gis;

export const containsProhibitedContent = (text) => {
  const lowered = text.toLowerCase();
  return (
    BAD_WORDS.some((word) => lowered.includes(word)) ||
    DOMAIN_REGEX.test(lowered) ||
    SCRIPT_REGEX.test(text)
  );
};
