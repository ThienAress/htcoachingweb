import { ListFilter } from "lucide-react";

import {
  filterCommunityFeaturesByGroup,
  getCommunityFeatureDeliveryMeta,
  getCommunityFeatureGroups,
  getCommunityFeatureHistoryRecords,
  getCommunityFeatureLatestMilestone,
  getCommunityFeaturePriorityMeta,
} from "./serviceAccessPolicyPresentation";
import CommunityFeatureReportToolbar from "./CommunityFeatureReportToolbar";

const PRIORITY_BADGE_CLASSES = {
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  planned: "border-sky-200 bg-sky-50 text-sky-800",
  later: "border-zinc-300 bg-zinc-100 text-zinc-700",
  unranked: "border-zinc-300 bg-white text-zinc-600",
};

const DELIVERY_BADGE_CLASSES = {
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
  implemented: "border-sky-200 bg-sky-50 text-sky-800",
  verified: "border-cyan-200 bg-cyan-50 text-cyan-800",
  production_verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unknown: "border-zinc-300 bg-white text-zinc-600",
};

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
            name="community-feature-group"
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
        <div className="text-sm text-zinc-600 sm:text-right">
          <p className="font-medium" role="status">
            Hiển thị {filteredItems.length}/{items.length} tính năng
          </p>
          <p className="mt-1 text-xs">
            F0 làm ngay · F1 kế tiếp · F2 cải tiến sau · F3 theo dõi dài hạn
          </p>
        </div>
      </div>

      <CommunityFeatureReportToolbar
        catalog={catalog}
        selectedGroup={selectedGroup}
      />

      {filteredItems.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-600">
          Không có tính năng thuộc nhóm đã chọn.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1580px] w-full border-collapse text-left">
            <thead className="bg-zinc-100 text-sm text-zinc-700">
              <tr>
                <th scope="col" className="w-[12%] px-5 py-4 font-semibold">
                  Tính năng
                </th>
                <th scope="col" className="w-[9%] px-5 py-4 font-semibold">
                  Nhóm
                </th>
                <th scope="col" className="w-[7%] px-5 py-4 font-semibold">
                  Ưu tiên
                </th>
                <th scope="col" className="w-[18%] px-5 py-4 font-semibold">
                  Giá trị chính
                </th>
                <th scope="col" className="w-[13%] px-5 py-4 font-semibold">
                  Đối tượng
                </th>
                <th scope="col" className="w-[21%] px-5 py-4 font-semibold">
                  Cơ hội cải thiện hiện tại
                </th>
                <th scope="col" className="w-[20%] px-5 py-4 font-semibold">
                  Kết quả gần nhất
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredItems.map((feature) => {
                const priority = getCommunityFeaturePriorityMeta(
                  feature.priority,
                );
                const improvementHistory =
                  getCommunityFeatureHistoryRecords(feature);
                const currentImprovement =
                  feature.currentImprovement?.description ||
                  feature.initialImprovement ||
                  "Chưa xác định cơ hội tiếp theo.";
                return (
                  <tr key={feature.featureKey} className="align-top">
                    <th scope="row" className="px-5 py-5 font-bold text-zinc-950">
                      {feature.label}
                    </th>
                    <td className="px-5 py-5">
                      <span className="inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {feature.group.label}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <span
                        className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${PRIORITY_BADGE_CLASSES[priority.tone]}`}
                        title={`${priority.code} — ${priority.label}`}
                        aria-label={`${priority.code}: ${priority.label}`}
                      >
                        {priority.code}
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
                      {currentImprovement}
                    </td>
                    <td className="px-5 py-5">
                      {improvementHistory.length ? (
                        <ul className="divide-y divide-zinc-200">
                          {improvementHistory.map((record) => {
                            const milestone =
                              getCommunityFeatureLatestMilestone(record);
                            const delivery =
                              getCommunityFeatureDeliveryMeta(milestone);
                            return (
                              <li
                                key={record.improvementKey}
                                className="py-3 first:pt-0 last:pb-0"
                              >
                                <p className="text-sm font-medium leading-5 text-zinc-800">
                                  {record.result || record.opportunity}
                                </p>
                                {record.result &&
                                  record.opportunity &&
                                  record.result !== record.opportunity && (
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                                      {record.opportunity}
                                    </p>
                                  )}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${DELIVERY_BADGE_CLASSES[delivery.tone]}`}
                                  >
                                    {delivery.label}
                                  </span>
                                  <time
                                    dateTime={
                                      delivery.code === "unknown"
                                        ? undefined
                                        : milestone?.statusDate
                                    }
                                    className="text-xs font-medium text-zinc-500"
                                  >
                                    {delivery.dateLabel}
                                  </time>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="text-sm text-zinc-500">
                          Chưa có cập nhật.
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
