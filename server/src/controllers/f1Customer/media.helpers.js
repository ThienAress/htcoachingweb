export const summarizeMedia = (media) => ({
  frontImageUploaded: media.some(
    (item) => item.type === "posture_front" && item.status === "ready",
  ),
  backImageUploaded: media.some(
    (item) => item.type === "posture_back" && item.status === "ready",
  ),
  sideImageUploaded: media.some(
    (item) => item.type === "posture_side" && item.status === "ready",
  ),
});
