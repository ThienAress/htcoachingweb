import dependencyManifests from "../../../generated/systemDependencyManifests.json";

const MANIFESTS = Object.freeze(dependencyManifests);

const dependencyEntries = (entry, typeKey, typeLabel) =>
  Object.entries(entry[typeKey] || {}).map(([name, version]) => ({
    name,
    scopeKey: entry.scopeKey,
    scopeLabel: entry.scopeLabel,
    typeKey,
    typeLabel,
    version,
  }));

const getRecommendation = (declarations) => {
  const versions = new Set(declarations.map(({ version }) => version));
  if (versions.size > 1) {
    return "Chạy npm outdated và kiểm tra đồng bộ phiên bản giữa các phạm vi trước khi nâng.";
  }
  if (declarations.some(({ version }) => /^[~^]?0\./u.test(version))) {
    return "Chạy npm outdated; đọc kỹ changelog vì package chưa đạt phiên bản 1.0.";
  }
  return "Giữ phiên bản khai báo; chạy npm outdated, audit và regression test trước khi nâng.";
};

const declarations = MANIFESTS.flatMap((entry) => [
  ...dependencyEntries(entry, "dependencies", "Runtime"),
  ...dependencyEntries(entry, "devDependencies", "Phát triển"),
]);

const itemsByName = new Map();
for (const declaration of declarations) {
  if (!itemsByName.has(declaration.name)) itemsByName.set(declaration.name, []);
  itemsByName.get(declaration.name).push(declaration);
}

export const SYSTEM_DEPENDENCY_INVENTORY = Object.freeze({
  manifests: MANIFESTS.map((entry) => ({
    ...entry,
    dependencyCount:
      Object.keys(entry.dependencies || {}).length +
      Object.keys(entry.devDependencies || {}).length,
  })),
  items: [...itemsByName]
    .map(([name, packageDeclarations]) => ({
      name,
      declarations: packageDeclarations,
      recommendation: getRecommendation(packageDeclarations),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en")),
});
