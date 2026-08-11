import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";

const normalizeSearch = (value) =>
  String(value || "").normalize("NFKC").toLocaleLowerCase("vi").trim();

export default function SystemDependencyTable({ inventory }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return inventory.items.filter((item) => {
      const matchesScope =
        scope === "all" ||
        item.declarations.some(({ scopeKey }) => scopeKey === scope);
      const matchesQuery =
        !normalizedQuery || normalizeSearch(item.name).includes(normalizedQuery);
      return matchesScope && matchesQuery;
    });
  }, [inventory.items, query, scope]);

  return (
    <div>
      <div className="grid gap-3 border-b border-zinc-200 p-5 sm:grid-cols-3">
        {inventory.manifests.map((manifest) => (
          <article
            key={manifest.scopeKey}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="flex items-center gap-2 text-emerald-800">
              <Package className="size-4" aria-hidden="true" />
              <h3 className="font-bold">{manifest.scopeLabel}</h3>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {manifest.file}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {manifest.dependencyCount} package · Node {manifest.nodeVersion}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 border-b border-zinc-200 p-5 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="block" htmlFor="system-dependency-search">
          <span className="text-sm font-semibold text-zinc-800">
            Tìm package
          </span>
          <span className="relative mt-2 block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              id="system-dependency-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ví dụ: react, mongoose, vite"
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
          </span>
        </label>
        <label className="block" htmlFor="system-dependency-scope">
          <span className="text-sm font-semibold text-zinc-800">Phạm vi</span>
          <select
            id="system-dependency-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            <option value="all">Tất cả</option>
            {inventory.manifests.map((manifest) => (
              <option key={manifest.scopeKey} value={manifest.scopeKey}>
                {manifest.scopeLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead className="bg-zinc-100 text-sm text-zinc-700">
            <tr>
              <th scope="col" className="w-[24%] px-5 py-4 font-semibold">
                Package
              </th>
              <th scope="col" className="w-[18%] px-5 py-4 font-semibold">
                Phạm vi
              </th>
              <th scope="col" className="w-[14%] px-5 py-4 font-semibold">
                Loại
              </th>
              <th scope="col" className="w-[18%] px-5 py-4 font-semibold">
                Phiên bản khai báo
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                Khuyến nghị
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredItems.map((item) => (
              <tr key={item.name} className="align-top">
                <th scope="row" className="px-5 py-4 font-semibold text-zinc-950">
                  {item.name}
                </th>
                <td className="px-5 py-4 text-sm text-zinc-700">
                  {item.declarations.map(({ scopeKey, scopeLabel }) => (
                    <div key={`${scopeKey}-${scopeLabel}`}>{scopeLabel}</div>
                  ))}
                </td>
                <td className="px-5 py-4 text-sm text-zinc-700">
                  {item.declarations.map(({ scopeKey, typeKey, typeLabel }) => (
                    <div key={`${scopeKey}-${typeKey}`}>{typeLabel}</div>
                  ))}
                </td>
                <td className="px-5 py-4 font-mono text-sm text-zinc-800">
                  {item.declarations.map(({ scopeKey, typeKey, version }) => (
                    <div key={`${scopeKey}-${typeKey}`}>{version}</div>
                  ))}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-zinc-600">
                  {item.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredItems.length === 0 && (
        <p className="p-6 text-center text-sm text-zinc-600" role="status">
          Không tìm thấy package phù hợp với bộ lọc.
        </p>
      )}
      <p className="border-t border-zinc-200 bg-amber-50 px-5 py-4 text-xs leading-5 text-amber-900">
        Bảng phản ánh phiên bản khai báo tại lần build hiện tại, không khẳng định
        đây là phiên bản mới nhất trên npm. Chỉ nâng cấp sau khi xem changelog,
        security audit và chạy đủ test liên quan.
      </p>
    </div>
  );
}
