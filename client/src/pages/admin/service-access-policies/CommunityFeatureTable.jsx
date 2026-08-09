import { ListFilter } from "lucide-react";

import {
  filterCommunityFeaturesByGroup,
  getCommunityFeatureGroups,
} from "./serviceAccessPolicyPresentation";

export default function CommunityFeatureTable({
  catalog,
  selectedGroup,
  onGroupChange,
}) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const groups = getCommunityFeatureGroups(items);
  const filteredItems = filterCommunityFeaturesByGroup(items, selectedGroup);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full max-w-xs" htmlFor="community-feature-group">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <ListFilter className="size-4 text-emerald-700" aria-hidden="true" />
            Lọc theo nhóm
          </span>
          <select
            id="community-feature-group"
            value={selectedGroup}
            onChange={(event) => onGroupChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
          >
            <option value="all">Tất cả nhóm</option>
            {groups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm font-medium text-zinc-600" role="status">
          Hiển thị {filteredItems.length}/{items.length} tính năng
        </p>
      </div>

      {filteredItems.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-600">
          Không có tính năng thuộc nhóm đã chọn.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-left">
            <thead className="bg-zinc-100 text-sm text-zinc-700">
              <tr>
                <th scope="col" className="w-[16%] px-5 py-4 font-semibold">
                  Tính năng
                </th>
                <th scope="col" className="w-[13%] px-5 py-4 font-semibold">
                  Nhóm
                </th>
                <th scope="col" className="w-[26%] px-5 py-4 font-semibold">
                  Giá trị chính
                </th>
                <th scope="col" className="w-[18%] px-5 py-4 font-semibold">
                  Đối tượng
                </th>
                <th scope="col" className="w-[27%] px-5 py-4 font-semibold">
                  Cơ hội cải thiện ban đầu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredItems.map((feature) => (
                <tr key={feature.featureKey} className="align-top">
                  <th scope="row" className="px-5 py-5 font-bold text-zinc-950">
                    {feature.label}
                  </th>
                  <td className="px-5 py-5">
                    <span className="inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      {feature.group.label}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-sm leading-6 text-zinc-700">
                    {feature.primaryValue}
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex flex-wrap gap-2">
                      {feature.audiences.map((audience) => (
                        <span
                          key={audience}
                          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                        >
                          {audience}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-5 text-sm leading-6 text-zinc-700">
                    {feature.initialImprovement}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
