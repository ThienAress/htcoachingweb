export const getReferenceId = (value) => value?._id ?? value;

export const referencesSameDocument = (left, right) => {
  const leftId = getReferenceId(left);
  const rightId = getReferenceId(right);
  if (!leftId || !rightId) return false;
  return String(leftId) === String(rightId);
};
