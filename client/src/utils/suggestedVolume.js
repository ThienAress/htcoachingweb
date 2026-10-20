// Khối lượng tập đề xuất (Sets x Reps / Sets x Time) của thẻ bài test
export const range = (min, max) => (min === max ? String(min) : `${min}–${max}`);

export const formatVolume = (protocol) => {
  if (!protocol) return "";
  const unit = protocol.mode === "time" ? "giây" : "reps";
  return `${range(protocol.setsMin, protocol.setsMax)} sets x ${range(protocol.valueMin, protocol.valueMax)} ${unit}`;
};

// Trả về { protocol } hợp lệ hoặc { error } để hiện ngay dưới ô nhập.
export const buildVolume = (base, draft) => {
  const numbers = ["setsMin", "setsMax", "valueMin", "valueMax"].map((key) => Number(draft[key]));
  if (numbers.some((value) => !Number.isInteger(value) || value < 1)) {
    return { error: "Nhập số nguyên từ 1 trở lên cho cả bốn ô." };
  }
  const [setsMin, setsMax, valueMin, valueMax] = numbers;
  if (setsMin > setsMax || valueMin > valueMax) {
    return { error: "Giá trị nhỏ nhất không được lớn hơn giá trị lớn nhất." };
  }
  const next = { ...base, setsMin, setsMax, valueMin, valueMax };
  next.label = `${range(setsMin, setsMax)} hiệp × ${range(valueMin, valueMax)} ${base.mode === "time" ? "giây" : "reps"}`;
  return { protocol: next };
};
