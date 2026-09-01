import path from "node:path";

const UNSAFE_PATH_CODEPOINT_PATTERN =
  /(?:[\p{C}\p{Zl}\p{Zp}\uFFFD]|\p{Default_Ignorable_Code_Point})/u;
const WINDOWS_FORBIDDEN_CHARACTER_PATTERN = /[<>:"\\|?*]/u;
const WINDOWS_RESERVED_SEGMENT_PATTERN =
  /^(?:(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)|(?:clock\$|conin\$|conout\$)$)/iu;

export const isCanonicalRepositoryRelativePath = (
  value,
  { maxLength = 240 } = {},
) => {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxLength
    || value.normalize("NFKC") !== value
    || UNSAFE_PATH_CODEPOINT_PATTERN.test(value)
    || WINDOWS_FORBIDDEN_CHARACTER_PATTERN.test(value)
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || value.includes("\\")
    || value.includes(":")
    || path.posix.normalize(value) !== value
    || value === "."
  ) {
    return false;
  }

  return value.split("/").every((segment) => (
    segment !== ""
    && segment !== "."
    && segment !== ".."
    && !/[. ]$/u.test(segment)
    && !WINDOWS_RESERVED_SEGMENT_PATTERN.test(segment)
  ));
};
