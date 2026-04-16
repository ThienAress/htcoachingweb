export const summarizeMedia = (media) => ({
  frontImageUploaded: media.some((item) => item.type === "posture_front"),
  backImageUploaded: media.some((item) => item.type === "posture_back"),
  sideImageUploaded: media.some((item) => item.type === "posture_side"),
});
