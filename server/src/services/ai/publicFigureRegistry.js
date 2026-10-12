/**
 * Curated public figures the assistant may look up on the web by name, with the nicknames
 * people actually type. Only people whose training, physique or sport the product's
 * fitness assistant is realistically asked about are listed, Vietnamese athletes first.
 *
 * Short given-name-only forms (for example "Quang Hai" or "Van Hau") are deliberately not
 * aliases: they are also ordinary private names. Those still work when the question carries
 * a role word such as "cau thu".
 */
const figure = (canonical, aliases = [], scope = "international") =>
  Object.freeze({ canonical, aliases: Object.freeze(aliases), scope });

export const PUBLIC_FIGURE_REGISTRY = Object.freeze([
  // Vietnam
  figure("Hoàng Hải Đăng", ["Đăng Béo"], "vietnam"),
  figure("Vũ Minh Hiếu", [], "vietnam"),
  figure("Nguyễn Thị Ánh Viên", ["Ánh Viên"], "vietnam"),
  figure("Hoàng Xuân Vinh", [], "vietnam"),
  figure("Nguyễn Tiến Minh", [], "vietnam"),
  figure("Thạch Kim Tuấn", [], "vietnam"),
  figure("Lê Tú Chinh", [], "vietnam"),
  figure("Nguyễn Trần Duy Nhất", [], "vietnam"),
  figure("Nguyễn Quang Hải", [], "vietnam"),
  figure("Nguyễn Công Phượng", ["Công Phượng"], "vietnam"),
  figure("Đoàn Văn Hậu", [], "vietnam"),
  figure("Nguyễn Tiến Linh", [], "vietnam"),
  figure("Đặng Văn Lâm", [], "vietnam"),
  figure("Quế Ngọc Hải", [], "vietnam"),
  figure("Nguyễn Hoàng Đức", [], "vietnam"),
  figure("Lương Xuân Trường", [], "vietnam"),
  figure("Đỗ Hùng Dũng", [], "vietnam"),
  figure("Bùi Tiến Dũng", [], "vietnam"),
  // International, strength / physique focused
  figure("Cristiano Ronaldo", ["CR7"]),
  figure("LeBron James", ["King James"]),
  figure("Kobe Bryant", ["Black Mamba"]),
  figure("Dwayne Johnson", ["The Rock"]),
  figure("Arnold Schwarzenegger", ["Schwarzenegger"]),
  figure("Ronnie Coleman", []),
  figure("Chris Bumstead", ["CBum"]),
  figure("Jay Cutler", []),
  figure("Phil Heath", []),
  figure("Dorian Yates", []),
  figure("Kai Greene", []),
  figure("Eddie Hall", []),
  figure("Hafþór Júlíus Björnsson", ["Thor Bjornsson", "Hafthor Bjornsson"]),
  figure("Brian Shaw", []),
  figure("Mike Tyson", ["Iron Mike"]),
  figure("Conor McGregor", []),
  figure("Khabib Nurmagomedov", ["Khabib"]),
  figure("Usain Bolt", []),
  figure("Michael Phelps", []),
  figure("Lionel Messi", ["Messi"]),
  figure("Zlatan Ibrahimović", ["Zlatan"]),
  figure("Erling Haaland", ["Haaland"]),
  figure("Mohamed Salah", []),
  figure("Giannis Antetokounmpo", ["Greek Freak"]),
  figure("Stephen Curry", []),
  figure("Novak Djokovic", ["Djokovic"]),
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
  [entry.canonical, ...entry.aliases].map((term) => ({
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
