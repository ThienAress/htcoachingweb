/**
 * Curated public figures the assistant may look up on the web by name, with the nicknames
 * people actually type. Only people whose training, physique or sport the product's
 * fitness assistant is realistically asked about are listed, in this priority order:
 *   1. vietnam_pro      Vietnamese bodybuilding / physique athletes (IFBB Pro card holders)
 *   2. vietnam          Other Vietnamese athletes (Olympic and Asian level, not football)
 *   3. vietnam_football Vietnamese footballers
 *   4. international    Strength / physique focused international figures
 *
 * Short given-name-only forms (for example "Quang Hai" or "Van Hau") are deliberately not
 * aliases: they are also ordinary private names. Those still work when the question carries
 * a role word such as "cau thu".
 */
const figure = (canonical, aliases = [], scope = "international", options = {}) =>
  Object.freeze({
    canonical,
    aliases: Object.freeze(aliases),
    scope,
    // false: the full name is an extremely common private name, so only the aliases match.
    matchCanonical: options.matchCanonical !== false,
  });

export const PUBLIC_FIGURE_REGISTRY = Object.freeze([
  // 1. Vietnam: IFBB Pro card holders (list checked by the owner on 2026-10-12).
  figure("Trần Tuấn Anh", ["Tuấn Anh IFBB Pro"], "vietnam_pro"),
  figure("Đinh Kim Loan", [], "vietnam_pro"),
  figure("Lương Hồng Sơn", [], "vietnam_pro"),
  figure("Vũ Minh Hiếu", [], "vietnam_pro"),
  figure("Hoàng Hải Đăng", ["Đăng Béo", "Dangbeoo"], "vietnam_pro"),
  figure("Đỗ Văn Quý", [], "vietnam_pro"),
  figure("Nguyễn Hoàng Phúc", [], "vietnam_pro"),
  figure("Kelvin Obinna", [], "vietnam_pro"),
  figure("Trần Xuân Quỳnh", [], "vietnam_pro"),
  figure("Alice Nguyễn", [], "vietnam_pro"),
  figure("Trần Quang Nam", ["Namcio"], "vietnam_pro"),
  figure("Nguyễn Ngọc Phong", [], "vietnam_pro"),
  figure("Bao Dang Hoang", [], "vietnam_pro"),
  figure("Phạm Hữu Hậu", ["Hậu Love"], "vietnam_pro"),
  figure("Trinh Kieu", [], "vietnam_pro"),
  figure("Nguyễn Thị Mai", ["Bi Mật"], "vietnam_pro", { matchCanonical: false }),
  figure("Dam Ho", [], "vietnam_pro"),
  figure("Đinh Trọng Hậu", [], "vietnam_pro"),
  figure("Trần Thùy Anh", [], "vietnam_pro"),
  figure("Bup Ny", ["Ny Búp"], "vietnam_pro"),
  figure("Phuc Do", [], "vietnam_pro"),
  figure("Giang Hoàng", ["Giang SmallGym"], "vietnam_pro"),
  // 2. Vietnam: other athletes
  figure("Nguyễn Thị Ánh Viên", ["Ánh Viên"], "vietnam"),
  figure("Hoàng Xuân Vinh", [], "vietnam"),
  figure("Nguyễn Tiến Minh", [], "vietnam"),
  figure("Lê Tú Chinh", [], "vietnam"),
  // 3. Vietnam: footballers
  figure("Nguyễn Quang Hải", [], "vietnam_football"),
  figure("Nguyễn Công Phượng", ["Công Phượng"], "vietnam_football"),
  figure("Đoàn Văn Hậu", [], "vietnam_football"),
  // 4. International, strength / physique focused
  figure("Cristiano Ronaldo", ["CR7"]),
  figure("LeBron James", ["King James"]),
  figure("Kobe Bryant", ["Black Mamba"]),
  figure("Dwayne Johnson", ["The Rock"]),
  figure("Arnold Schwarzenegger", ["Schwarzenegger"]),
  figure("Ronnie Coleman", []),
  figure("Chris Bumstead", ["CBum"]),
  figure("Jay Cutler", []),
  figure("Phil Heath", []),
  figure("Eddie Hall", []),
  figure("Mike Tyson", ["Iron Mike"]),
]);

// One UTF-16 unit in, one out, so indexes found on the folded text slice the original.
const foldText = (value) =>
  Array.from(String(value || "").normalize("NFC"), (character) => {
    if (character === "Đ" || character === "đ") return "d";
    const base = character.normalize("NFD")[0] || character;
    return character.length === base.length ? base.toLowerCase() : character;
  }).join("");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const termPattern = (term) =>
  new RegExp(
    `(?<![a-z0-9_])${escapeRegExp(foldText(term)).replace(/\s+/g, "\\s+")}(?![a-z0-9_])`,
    "g",
  );

const COMPILED_TERMS = PUBLIC_FIGURE_REGISTRY.flatMap((entry) =>
  [...(entry.matchCanonical ? [entry.canonical] : []), ...entry.aliases].map((term) => ({
    entry,
    pattern: termPattern(term),
  })),
);

/**
 * Finds registry figures in a message regardless of case or diacritics.
 * `surface` is the text exactly as the user typed it.
 */
export function findPublicFigures(value) {
  const original = String(value || "").normalize("NFC");
  const folded = foldText(original);
  const found = new Map();
  for (const { entry, pattern } of COMPILED_TERMS) {
    pattern.lastIndex = 0;
    for (const match of folded.matchAll(pattern)) {
      const surface = original.slice(match.index, match.index + match[0].length);
      const key = `${entry.canonical}|${foldText(surface)}`;
      if (!found.has(key)) found.set(key, { canonical: entry.canonical, surface });
    }
  }
  return [...found.values()];
}
