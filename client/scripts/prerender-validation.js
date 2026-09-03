const normalizedUrl = (value) => {
  try {
    return new URL(String(value || "")).href;
  } catch {
    return "";
  }
};

const hasSchemaType = (node, expectedType) => {
  const types = Array.isArray(node?.["@type"])
    ? node["@type"]
    : [node?.["@type"]];
  return types.includes(expectedType);
};

const listSchemaNodes = (structuredData) =>
  (structuredData || []).flatMap((entry) =>
    Array.isArray(entry?.["@graph"]) ? entry["@graph"] : [entry],
  );

const listServiceOffers = (structuredData) =>
  listSchemaNodes(structuredData)
    .filter((node) => hasSchemaType(node, "Service"))
    .flatMap((node) =>
      Array.isArray(node?.offers)
        ? node.offers
        : node?.offers
          ? [node.offers]
          : [],
    );

const offerContractKey = (offer) => {
  const price = Number(offer?.price);
  const currency = String(offer?.priceCurrency || "").trim();
  return Number.isSafeInteger(price) && price >= 0 && currency
    ? `${currency}:${price}`
    : "";
};

export const validatePrerenderSnapshot = (
  snapshot,
  expectedCanonical,
  requirements = {},
) => {
  const errors = [];
  const titles = snapshot?.titles || [];
  const descriptions = snapshot?.descriptions || [];
  const canonicals = snapshot?.canonicals || [];
  const robots = snapshot?.robots || [];

  if (!Number.isFinite(snapshot?.rootLength) || snapshot.rootLength <= 100) {
    errors.push("rendered root is empty");
  }
  if (Number(snapshot?.fatalFallbackCount || 0) > 0) {
    errors.push("fatal application fallback rendered");
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

  const expectedServiceOffers = requirements.expectedServiceOffers;
  if (Array.isArray(expectedServiceOffers)) {
    const receivedServiceOffers = listServiceOffers(snapshot?.structuredData);
    if (receivedServiceOffers.length !== expectedServiceOffers.length) {
      errors.push(
        `expected ${expectedServiceOffers.length} Service offers in JSON-LD, received ${receivedServiceOffers.length}`,
      );
    } else {
      const expectedKeys = expectedServiceOffers.map(offerContractKey).sort();
      const receivedKeys = receivedServiceOffers.map(offerContractKey).sort();
      if (
        expectedKeys.includes("") ||
        receivedKeys.includes("") ||
        expectedKeys.some((key, index) => key !== receivedKeys[index])
      ) {
        errors.push(
          "Service offer prices or currencies do not match the catalog",
        );
      }
    }
  }

  const requiredLinkHrefs = requirements.requiredLinkHrefs;
  if (Array.isArray(requiredLinkHrefs)) {
    const receivedLinkHrefs = new Set(snapshot?.linkHrefs || []);
    const missingLinkHrefs = requiredLinkHrefs.filter(
      (href) => !receivedLinkHrefs.has(href),
    );
    if (missingLinkHrefs.length > 0) {
      errors.push(
        `missing required internal links: ${missingLinkHrefs.join(", ")}`,
      );
    }
  }

  if (requirements.requireSettledExerciseReviews) {
    if (Number(snapshot?.exerciseReviewSectionCount || 0) !== 1) {
      errors.push("exercise review section is not ready");
    }
    if (Number(snapshot?.pendingExerciseReviewCount || 0) > 0) {
      errors.push("exercise reviews are still loading");
    }
    if (Number(snapshot?.exerciseReviewErrorCount || 0) > 0) {
      errors.push("exercise reviews failed to load");
    }
  }

  return errors;
};
