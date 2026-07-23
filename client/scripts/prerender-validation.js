const normalizedUrl = (value) => {
  try {
    return new URL(String(value || "")).href;
  } catch {
    return "";
  }
};

export const validatePrerenderSnapshot = (snapshot, expectedCanonical) => {
  const errors = [];
  const titles = snapshot?.titles || [];
  const descriptions = snapshot?.descriptions || [];
  const canonicals = snapshot?.canonicals || [];
  const robots = snapshot?.robots || [];

  if (!Number.isFinite(snapshot?.rootLength) || snapshot.rootLength <= 100) {
    errors.push("rendered root is empty");
  }
  if (titles.length !== 1 || !String(titles[0] || "").trim()) {
    errors.push(`expected one non-empty title, received ${titles.length}`);
  }
  if (
    descriptions.length !== 1 ||
    !String(descriptions[0] || "").trim()
  ) {
    errors.push(
      `expected one non-empty meta description, received ${descriptions.length}`,
    );
  }
  if (canonicals.length !== 1) {
    errors.push(`expected one canonical, received ${canonicals.length}`);
  } else if (
    normalizedUrl(canonicals[0]) !== normalizedUrl(expectedCanonical)
  ) {
    errors.push(
      `canonical mismatch: expected ${expectedCanonical}, received ${canonicals[0]}`,
    );
  }
  if (robots.length !== 1 || robots[0] !== "index,follow") {
    errors.push(
      `expected one index,follow robots tag, received ${robots.join(", ") || "none"}`,
    );
  }

  return errors;
};
