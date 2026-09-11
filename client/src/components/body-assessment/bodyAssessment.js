import { z } from "zod";
import { getVietnamDateKey, isValidDateKey } from "../../utils/vietnamDate";

export const BODY_REGIONS = [
  ["leftArm", "Tay trái"], ["rightArm", "Tay phải"],
  ["trunk", "Bụng"], ["leftLeg", "Chân trái"], ["rightLeg", "Chân phải"],
];
export const MEASURE_FIELDS = ["leanKg", "leanReferencePercent", "fatKg", "fatReferencePercent"];
const optionalNumber = z.preprocess(
  (value) => value == null || (typeof value === "string" && value.trim() === "") ? null : typeof value === "string" ? Number(value) : value,
  z.number().finite().nonnegative("Không nhập số âm").nullable(),
);
const regionSchema = z.object(Object.fromEntries(MEASURE_FIELDS.map((key) => [key, optionalNumber])));
export const assessmentFormSchema = z.object({
  measuredDateKey: z.string().refine((value) => value === "" || (isValidDateKey(value) && value <= getVietnamDateKey()), "Ngày đo phải hợp lệ và không ở tương lai"),
  deviceLabel: z.string().trim().max(120),
  referenceBasis: z.string().max(120),
  note: z.string().trim().max(2000),
  segments: z.object(Object.fromEntries(BODY_REGIONS.map(([key]) => [key, regionSchema]))),
  reason: z.string().trim().max(500),
});
export const assessmentValues = (source) => {
  const snapshot = source || {};
  return ({
  measuredDateKey: snapshot.measuredDateKey || "",
  deviceLabel: snapshot.deviceLabel || "",
  referenceBasis: snapshot.referenceBasis || "unspecified",
  note: snapshot.note || "",
  reason: "",
  segments: Object.fromEntries(BODY_REGIONS.map(([region]) => [region,
    Object.fromEntries(MEASURE_FIELDS.map((field) => [field, snapshot.segments?.[region]?.[field] == null ? "" : String(snapshot.segments[region][field])])),
  ])),
  });
};
export const assessmentDelta = (current, previous) =>
  typeof current === "number" && Number.isFinite(current) &&
  typeof previous === "number" && Number.isFinite(previous) ? current - previous : null;
// Fixed precision is intentional for device measurement values, not general estimates.
export const measurementLabel = (value, unit = "kg") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value)}${unit ? ` ${unit}` : ""}`
    : "—";
export const measurementHistory = (items, region, field) => items
  .filter((item) => item.published?.measuredDateKey)
  .toSorted((a, b) => a.published.measuredDateKey.localeCompare(b.published.measuredDateKey))
  .map(({ published }) => ({ dateKey: published.measuredDateKey, value: published.segments?.[region]?.[field] ?? null }));
export const missingMassFields = (values) => BODY_REGIONS.flatMap(([region, label]) =>
  ["leanKg", "fatKg"].filter((field) => {
    const parsed = optionalNumber.safeParse(values.segments?.[region]?.[field]);
    return !parsed.success || parsed.data === null;
  })
    .map((field) => `${label} — ${field === "leanKg" ? "khối nạc" : "khối mỡ"}`),
);
export const assessmentActionCheck = ({ action, assessment, values, dirty, confirmPartial }) => {
  if (action === "save" && assessment?.published && !values.reason.trim()) return { field: "reason", error: "Nhập lý do cập nhật" };
  if (action !== "publish") return {};
  if (!assessment?.draft) return { error: "Không có bản nháp để gửi." };
  if (dirty) return { error: "Hãy lưu nháp các thay đổi trước khi gửi." };
  const missing = missingMassFields(values);
  if (!values.measuredDateKey || !values.deviceLabel || missing.length === 10) return { error: "Cần ngày đo, thiết bị/nguồn đo và ít nhất một giá trị kg." };
  return { partial: missing.length > 0 && !confirmPartial };
};
export const matchingReference = (a, b) => Boolean(a && b && a.deviceLabel &&
  a.deviceLabel === b.deviceLabel && a.referenceBasis && a.referenceBasis !== "unspecified" && a.referenceBasis === b.referenceBasis);
export const assessmentInputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 disabled:opacity-60";
export const assessmentButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50";
