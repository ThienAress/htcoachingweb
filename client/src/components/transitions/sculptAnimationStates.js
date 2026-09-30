const defineState = (state) => Object.freeze({
  ...state,
  activeLayers: Object.freeze(state.activeLayers),
});

export const SCULPT_ANIMATION_STATES = Object.freeze([
  defineState({
    id: "idle",
    label: "Tĩnh",
    description: "Giữ nguyên tư thế và silhouette đã duyệt.",
    activeLayers: ["main-body", "haze", "halo"],
  }),
  defineState({
    id: "anticipation",
    label: "Lấy đà",
    description: "Cơ thể giữ trọng tâm và cánh tay chuẩn bị cho cú bổ xuống.",
    activeLayers: ["main-body", "hammer-arm", "hammer", "chisel", "halo"],
  }),
  defineState({
    id: "hammer-swing",
    label: "Vung búa",
    description: "Tay búa và đầu búa đi theo một cung chuyển động rõ ràng.",
    activeLayers: ["main-body", "hammer-arm", "hammer", "chisel"],
  }),
  defineState({
    id: "impact",
    label: "Va chạm",
    description: "Búa chạm đục; flash, halo và bụi tập trung tại điểm va chạm.",
    activeLayers: ["hammer", "chisel", "cracks", "dust-particles", "halo"],
  }),
  defineState({
    id: "shell-crack",
    label: "Nứt vỏ đá",
    description: "Đường nứt truyền từ mũi đục xuống lớp vỏ thân dưới.",
    activeLayers: ["outer-stone-shell", "cracks"],
  }),
  defineState({
    id: "shell-breakup",
    label: "Vỡ lớp vỏ",
    description: "Các mảng vỏ tách khỏi silhouette nhưng chưa che khung hình.",
    activeLayers: [
      "outer-stone-shell",
      "floating-debris",
      "dust-particles",
    ],
  }),
  defineState({
    id: "muscle-reveal",
    label: "Lộ cơ bên trong",
    description: "Lớp vỏ mở ra, để lộ thân cơ bên trong trước khi bụi phủ qua.",
    activeLayers: [
      "main-body",
      "inner-muscular-body",
      "outer-stone-shell",
      "cracks",
      "dust-particles",
    ],
  }),
  defineState({
    id: "debris-expansion",
    label: "Mảnh vỡ bung ra",
    description: "Đá vụn và bụi mở rộng theo hướng từ tâm va chạm.",
    activeLayers: [
      "floating-debris",
      "dust-particles",
      "foreground-rubble",
    ],
  }),
  defineState({
    id: "transition-cover",
    label: "Che khung hình",
    description: "Bụi đá và mảnh vụn lướt qua camera để che nhịp đặt lại.",
    activeLayers: [
      "vignette",
      "floating-debris",
      "dust-particles",
      "foreground-rubble",
    ],
  }),
]);

const STATE_INDEX_BY_ID = new Map(
  SCULPT_ANIMATION_STATES.map((state, index) => [state.id, index]),
);

export const getSculptAnimationState = (stateId) =>
  SCULPT_ANIMATION_STATES[STATE_INDEX_BY_ID.get(stateId) ?? 0];

export const getAdjacentSculptState = (stateId, offset) => {
  const currentIndex = STATE_INDEX_BY_ID.get(stateId) ?? 0;
  const stateCount = SCULPT_ANIMATION_STATES.length;
  const nextIndex = (currentIndex + offset + stateCount) % stateCount;
  return SCULPT_ANIMATION_STATES[nextIndex];
};

export const isSculptLayerActive = (stateId, layerId) =>
  getSculptAnimationState(stateId).activeLayers.includes(layerId);
