import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { bodyAssessmentKey, listBodyAssessments } from "../../services/bodyAssessment.service";
import { ProgressSectionHeader } from "../../pages/progress/ProgressSectionHeader";
import { BodySilhouette } from "./BodySilhouette";
import { BodyAssessmentHistory } from "./BodyAssessmentHistory";
import { BODY_REGIONS, assessmentButtonClass, assessmentInputClass, assessmentDelta, matchingReference, measurementLabel } from "./bodyAssessment";

const dateLabel = (date) => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date(`${date}T12:00:00+07:00`));
const deltaLabel = (value, unit) => value == null ? "—"
  : `${value > 0 ? "+" : ""}${measurementLabel(value, unit === "%" ? "" : unit)}${unit === "%" ? "%" : ""}`;
const fieldFor = (kind, unit) => `${kind}${unit === "%" ? "ReferencePercent" : "Kg"}`;

const SegmentDiagram = ({ kind, unit, current, previous, comparable, region, onSelect }) => {
  const title = kind === "lean" ? "Phân bổ cơ nạc từng vùng" : "Phân bổ mỡ từng vùng";
  const field = fieldFor(kind, unit);
  return (
    <section aria-label={title}>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <div className="mt-3 grid items-center gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
        <BodySilhouette label={title} selectedRegion={region} onSelect={onSelect} />
        <dl className="divide-y divide-slate-800">
          {BODY_REGIONS.map(([key, label]) => {
            const value = current.segments?.[key]?.[field];
            const delta = comparable ? assessmentDelta(value, previous?.segments?.[key]?.[field]) : null;
            return <div key={key} className="py-2">
              <dt className="text-xs text-slate-400"><button type="button" onClick={() => onSelect(key)} aria-pressed={region === key} className="min-h-11 rounded px-2 text-left font-semibold hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{label}</button></dt>
              <dd className="mt-1 flex flex-wrap gap-x-3 text-sm tabular-nums text-slate-100">
                <span>{measurementLabel(value, unit)}</span>
                {previous && <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-300"><span className="sr-only">Thay đổi: </span>{deltaLabel(delta, unit)}</span>}
              </dd>
            </div>;
          })}
        </dl>
      </div>
    </section>
  );
};

const ComparisonTable = ({ current, previous, unit, comparable }) => (
  <div className="mt-8 grid gap-5 xl:grid-cols-2">
    {["lean", "fat"].map((kind) => <div key={kind} className="min-w-0 overflow-x-auto overscroll-contain rounded-xl border border-slate-700">
      <table className="w-full text-left text-sm">
        <caption className="border-b border-slate-700 bg-slate-900 px-4 py-4 text-left text-base font-semibold text-slate-100">{kind === "lean" ? "Đối chiếu cơ nạc" : "Đối chiếu mỡ"} <span className="text-sm font-normal text-slate-400">({unit})</span></caption>
        <thead className="bg-slate-900/50 text-xs text-slate-400"><tr>
          <th scope="col" className="px-2 py-3 sm:px-4">Vùng</th>
          <th scope="col" className="px-2 py-3">Trước</th><th scope="col" className="px-2 py-3">Đang xem</th><th scope="col" className="px-2 py-3">Thay đổi</th>
        </tr></thead>
        <tbody>{BODY_REGIONS.map(([region, label]) => {
          const field = fieldFor(kind, unit);
          const before = previous?.segments?.[region]?.[field];
          const after = current.segments?.[region]?.[field];
          return <tr key={region} className="border-t border-slate-800">
            <th scope="row" className="px-2 py-4 font-medium text-slate-300 sm:px-4">{label}</th>
            <td className="px-2 py-4 tabular-nums text-slate-400">{measurementLabel(before, "")}</td>
            <td className="px-2 py-4 font-semibold tabular-nums text-slate-100">{measurementLabel(after, "")}</td>
            <td className="px-2 py-4 tabular-nums text-slate-200">{deltaLabel(comparable ? assessmentDelta(after, before) : null, unit)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>)}
  </div>
);

const PublishedReport = ({ items, hasNextPage }) => {
  const [selectedKey, setSelectedKey] = useState("");
  const [compareKey, setCompareKey] = useState("previous");
  const [unit, setUnit] = useState("kg");
  const [region, setRegion] = useState("trunk");
  const [kind, setKind] = useState("lean");
  const currentRecord = items.find((item) => item.weekStartDateKey === selectedKey) || items[0];
  const current = currentRecord.published;
  const selectedIndex = items.indexOf(currentRecord);
  const previousRecord = compareKey === "previous" ? items[selectedIndex + 1]
    : compareKey === "first" ? items.at(-1)
      : items.find((item) => item.weekStartDateKey === compareKey);
  const previous = previousRecord !== currentRecord ? previousRecord?.published : null;
  const comparable = unit === "kg" || matchingReference(current, previous);
  const deviceChanged = previous && current.deviceLabel !== previous.deviceLabel;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-300">Lần đo đang xem
          <select className={assessmentInputClass} value={currentRecord.weekStartDateKey} onChange={(event) => setSelectedKey(event.target.value)}>
            {items.map((item) => <option key={item.weekStartDateKey} value={item.weekStartDateKey}>{dateLabel(item.published.measuredDateKey)} · kỳ {dateLabel(item.weekStartDateKey)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-300">So sánh với
          <select className={assessmentInputClass} value={compareKey} onChange={(event) => setCompareKey(event.target.value)} disabled={items.length < 2}>
            <option value="previous">Lần đo trước</option>
            <option value="first" disabled={hasNextPage}>Lần đo đầu tiên{hasNextPage ? " (cần tải hết lịch sử)" : ""}</option>
            {items.filter((item) => item !== currentRecord).map((item) => <option key={item.weekStartDateKey} value={item.weekStartDateKey}>{dateLabel(item.published.measuredDateKey)} · kỳ {dateLabel(item.weekStartDateKey)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 break-words text-sm leading-6 text-slate-300">Ngày đo: <time dateTime={current.measuredDateKey}>{dateLabel(current.measuredDateKey)}</time> · Thiết bị/nguồn: {current.deviceLabel || "Chưa ghi"}{previous ? ` · So với ${dateLabel(previous.measuredDateKey)}` : ""}</p>
      {!previous && <p className="mt-2 text-sm text-slate-400">{items.length < 2 ? "Cần ít nhất hai lần đo để so sánh." : "Không có lần đo trước phù hợp. Chọn một ngày khác hoặc tải thêm lịch sử."}</p>}
      {deviceChanged && <p role="status" className="mt-3 text-sm leading-6 text-amber-200">Khác thiết bị hoặc nguồn đo; chênh lệch kg có thể không so sánh trực tiếp được.</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-sm text-slate-300">Giá trị hiển thị
          <select value={unit} onChange={(event) => setUnit(event.target.value)} className={assessmentInputClass}><option value="kg">Khối lượng (kg)</option><option value="%">So với mức tham chiếu (%)</option></select>
        </label>
        <label className="text-sm text-slate-300">Vùng xem lịch sử
          <select value={region || "trunk"} onChange={(event) => setRegion(event.target.value)} className={assessmentInputClass}>{BODY_REGIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
        <label className="text-sm text-slate-300">Chỉ số lịch sử
          <select value={kind} onChange={(event) => setKind(event.target.value)} className={assessmentInputClass}><option value="lean">Khối nạc</option><option value="fat">Khối mỡ</option></select>
        </label>
      </div>
      {unit === "%" && <p className="mt-3 text-sm leading-6 text-slate-400">Đây là phần trăm so với mức tham chiếu của thiết bị, có thể trên 100%; không phải tỷ lệ mỡ toàn thân. Chênh lệch là phép trừ hai số trên phiếu: 110% → 111% hiển thị +1%, không phải tốc độ tăng tương đối.{!comparable && previous ? " Không tính chênh lệch phần trăm khi thiết bị hoặc mức tham chiếu khác nhau/chưa xác định." : ""}</p>}
      <div className="mt-5 flex gap-2 md:hidden" aria-label="Chọn sơ đồ">
        {["lean", "fat"].map((value) => <button key={value} type="button" aria-pressed={kind === value} className={assessmentButtonClass} onClick={() => setKind(value)}>{value === "lean" ? "Khối nạc" : "Khối mỡ"}</button>)}
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {["lean", "fat"].map((value) => <div key={value} className={kind === value ? "block min-w-0" : "hidden min-w-0 md:block"}>
          <SegmentDiagram kind={value} unit={unit} current={current} previous={previous} comparable={comparable} region={region} onSelect={setRegion} />
        </div>)}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">“Cơ nạc” hiển thị số đo khối nạc, không chỉ riêng cơ xương. “Bụng” tương ứng vùng thân (trunk) trên phiếu, không phải phép đo riêng bụng. Hình chỉ dùng để chọn vùng.</p>
      {current.note && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">Ghi chú từ HLV: {current.note}</p>}
      <ComparisonTable current={current} previous={previous} comparable={comparable} unit={unit} />
      <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Chọn vùng biểu đồ">
        {BODY_REGIONS.map(([key, label]) => <button type="button" key={key} aria-pressed={region === key} onClick={() => setRegion(key)} className={`${assessmentButtonClass} ${region === key ? "border-orange-400 bg-orange-950 text-orange-100" : ""}`}>{label}</button>)}
      </div>
      <BodyAssessmentHistory items={items} region={region || "trunk"} field={fieldFor(kind, unit)} unit={unit} referenceSnapshot={current} />
    </>
  );
};

const ReportForActor = ({ actorId, clientId, onBack, headingRef }) => {
  const queryClient = useQueryClient();
  const [accessDenied, setAccessDenied] = useState(false);
  const query = useInfiniteQuery({
    queryKey: bodyAssessmentKey(actorId, clientId, "published-history"),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      try {
        return (await listBodyAssessments({ clientId, page: pageParam, limit: 20, signal })).data.data;
      } catch (error) {
        if ([401, 403].includes(error.response?.status)) {
          setAccessDenied(true);
          queryClient.removeQueries({ queryKey: bodyAssessmentKey(actorId, clientId) });
        }
        throw error;
      }
    },
    getNextPageParam: (page) => page.pagination.page * page.pagination.limit < page.pagination.total ? page.pagination.page + 1 : undefined,
    enabled: Boolean(actorId) && !accessDenied,
    gcTime: 0,
    staleTime: 0,
    retry: (count, error) => ![401, 403].includes(error.response?.status) && count < 1,
  });
  const items = [...new Map((query.data?.pages || []).flatMap((page) => page.items || [])
    .filter((item) => item.published?.measuredDateKey)
    .map((item) => [item.weekStartDateKey, item])).values()]
    .sort((a, b) => b.published.measuredDateKey.localeCompare(a.published.measuredDateKey));
  const denied = accessDenied || [401, 403].includes(query.error?.response?.status);
  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950" aria-labelledby="body-assessment-report-title">
      <ProgressSectionHeader title="Phân bố thành phần cơ thể" titleId="body-assessment-report-title" headingRef={headingRef} onBack={onBack}
        description="Xem kết quả đo HLV đã gửi và đối chiếu từng vùng cơ thể theo ngày đo thực tế." source="Nguồn: Kết quả đo đã được HLV gửi cho học viên" />
      <div className="p-5 sm:p-6">
        {!actorId ? <p className="text-sm text-slate-300">Đăng nhập để xem kết quả đo của bạn.</p>
          : denied || query.isError ? <div role="alert"><p className="text-sm text-red-200">{denied ? "Bạn không còn quyền xem kết quả đo này." : "Không thể tải kết quả đo. Vui lòng thử lại."}</p>{!denied && <button type="button" onClick={() => query.refetch()} className={`${assessmentButtonClass} mt-3`}>Thử lại</button>}</div>
            : query.isPending ? <p role="status" className="text-sm text-slate-300">Đang tải kết quả đo...</p>
              : items.length === 0 ? <p className="text-sm text-slate-400">Chưa có kết quả đo được gửi. Khi HLV gửi kết quả, bạn sẽ xem được tại đây.</p>
                : <><PublishedReport items={items} hasNextPage={query.hasNextPage} />{query.hasNextPage && <button type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className={`${assessmentButtonClass} mt-5`}>{query.isFetchingNextPage ? "Đang tải..." : "Tải thêm lần đo"}</button>}</>}
      </div>
    </section>
  );
};

export const BodyAssessmentReport = (props) => {
  const { user } = useAuth();
  const actorId = user?._id || user?.id;
  return <ReportForActor key={`${actorId || "guest"}:${props.clientId || "self"}`} actorId={actorId} {...props} />;
};
