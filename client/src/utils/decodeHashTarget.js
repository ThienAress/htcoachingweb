const decodeHashTarget = (hash) => {
  try {
    return decodeURIComponent(String(hash || "").replace(/^#/, ""));
  } catch {
    return null;
  }
};

export default decodeHashTarget;
