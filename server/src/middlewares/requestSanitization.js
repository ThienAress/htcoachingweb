const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const findUnsafePath = (value, prefix = "", seen = new WeakSet()) => {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      key.startsWith("$") ||
      key.includes(".") ||
      UNSAFE_KEYS.has(key.toLowerCase())
    ) {
      return path;
    }
    const nested = findUnsafePath(child, path, seen);
    if (nested) return nested;
  }
  return null;
};

export const rejectUnsafeMongoInput = (req, res, next) => {
  const unsafePath =
    findUnsafePath(req.body, "body") ||
    findUnsafePath(req.params, "params") ||
    findUnsafePath(req.query, "query");
  if (unsafePath) {
    return res.status(400).json({
      success: false,
      code: "UNSAFE_REQUEST_KEY",
      message: "Dữ liệu request chứa key không hợp lệ",
      requestId: req.id,
    });
  }
  return next();
};

export { findUnsafePath };
