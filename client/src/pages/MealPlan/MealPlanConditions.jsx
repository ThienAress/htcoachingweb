import { AlertTriangle, ShieldCheck } from "lucide-react";

import FoodAllergySymptomGuide from "./FoodAllergySymptomGuide";
import { analyzeOtherAllergenText } from "../../utils/mealPlanAllergenInput";

const ALLERGEN_OPTIONS = [
  ["milk", "Sữa"],
  ["egg", "Trứng"],
  ["fish", "Cá"],
  ["crustacean_shellfish", "Giáp xác (tôm, cua)"],
  ["tree_nut", "Hạt cây"],
  ["peanut", "Đậu phộng"],
  ["wheat", "Lúa mì"],
  ["soy", "Đậu nành"],
  ["sesame", "Mè"],
];

export default function MealPlanConditions({
  preferences,
  onChange,
  isAuthenticated,
  isLoading,
  isError,
  onRetry,
  onSave,
  isSaving,
  isDirty,
}) {
  const otherAnalysis = analyzeOtherAllergenText(
    preferences.otherAllergenText || "",
  );
  const hasOtherFormatBlock = Boolean(otherAnalysis.errorCode);
  const setStatus = (allergyStatus) =>
    onChange({
      ...preferences,
      allergyStatus,
      allergens: allergyStatus === "declared" ? preferences.allergens : [],
      otherAllergenText:
        allergyStatus === "declared" ? preferences.otherAllergenText || "" : "",
    });
  const toggleAllergen = (key) => {
    const selected = new Set(preferences.allergens || []);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    onChange({ ...preferences, allergens: [...selected] });
  };

  return (
    <section className="mx-auto mb-6 max-w-4xl rounded-2xl border border-white/10 bg-gray-800/70 p-4 shadow-xl sm:p-6" aria-labelledby="meal-plan-conditions-title">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id="meal-plan-conditions-title" className="text-lg font-bold text-white">
            Điều kiện thực đơn
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-300">
            Xác nhận dị ứng trước khi tạo để hệ thống loại trừ thực phẩm phù hợp.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-5 text-sm text-gray-300" role="status">Đang tải điều kiện đã lưu...</p>
      ) : isError ? (
        <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4" role="alert">
          <p className="text-sm text-red-200">Không thể tải điều kiện thực đơn đã lưu.</p>
          <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-white underline underline-offset-4 transition hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-white">Bạn có dị ứng thực phẩm không?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ["none_known", "Không có dị ứng"],
                ["declared", "Có, chọn nhóm bên dưới"],
                ["unsure", "Không chắc / cần kiểm tra"],
              ].map(([value, label]) => (
                <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${preferences.allergyStatus === value ? "border-primary bg-primary/15 text-white" : "border-white/10 bg-gray-900/50 text-gray-300 hover:border-white/30"}`}>
                  <input type="radio" name="meal-plan-allergy-status" value={value} checked={preferences.allergyStatus === value} onChange={() => setStatus(value)} className="accent-orange-500" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {preferences.allergyStatus === "declared" && (
            <fieldset className="mt-5">
              <legend className="text-sm font-bold text-white">Nhóm dị ứng cần loại trừ</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALLERGEN_OPTIONS.map(([key, label]) => (
                  <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 hover:border-white/30">
                    <input type="checkbox" name="meal-plan-allergens" value={key} checked={(preferences.allergens || []).includes(key)} onChange={() => toggleAllergen(key)} className="accent-orange-500" />
                    {label}
                  </label>
                ))}
              </div>
              <label className="mt-4 block max-w-2xl text-sm font-semibold text-white">
                Khác — tự nhập tên thực phẩm hoặc thành phần
                <input
                  type="text"
                  name="meal-plan-other-allergen"
                  autoComplete="off"
                  maxLength={120}
                  value={preferences.otherAllergenText || ""}
                  onChange={(event) =>
                    onChange({
                      ...preferences,
                      otherAllergenText: event.target.value,
                    })
                  }
                  placeholder="Ví dụ: gà bò cá hoặc ốc biển, mực"
                  aria-describedby="meal-plan-other-allergen-help"
                  className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-gray-950 px-3 py-2 font-normal text-white outline-none placeholder:text-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span
                  id="meal-plan-other-allergen-help"
                  className="mt-1 block text-xs font-normal leading-5 text-gray-400"
                >
                  Có thể ngăn cách bằng dấu phẩy hoặc khoảng trắng khi hệ thống đã
                  nhận diện tên. Không dùng dấu chấm; không nhập triệu chứng hoặc
                  thông tin cá nhân. Thẻ bên dưới là mục đã nhận diện, không cần
                  tick thêm ô phía trên. Hệ thống đối chiếu metadata và tên thực
                  phẩm hiện có; bạn vẫn nên kiểm tra nhãn sản phẩm.
                </span>
              </label>
              {otherAnalysis.items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Thực phẩm đã nhận diện">
                  {otherAnalysis.items.map((item) => (
                    <span
                      key={`${item.kind}:${item.key || item.label}`}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.kind === "unmapped" ? "border-amber-400/30 bg-amber-500/10 text-amber-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}
                    >
                      {item.label}{item.kind === "unmapped" ? " — chưa nhận diện" : ""}
                    </span>
                  ))}
                </div>
              )}
              {otherAnalysis.errorCode === "period_separator" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm leading-6 text-red-100" role="alert">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  Không dùng dấu chấm giữa các thực phẩm. Hãy dùng dấu phẩy hoặc khoảng trắng, ví dụ: gà, bò, cá.
                </div>
              )}
              {otherAnalysis.errorCode === "generic_meat" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100" role="alert">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    Nhập “thịt” còn quá chung chung. Hãy ghi rõ loại thịt bạn dị
                    ứng, ví dụ: gà, bò, heo, vịt, dê hoặc cừu.
                  </span>
                </div>
              )}
              {otherAnalysis.hasUnmapped && !hasOtherFormatBlock && (
                <div
                  className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100"
                  role="status"
                >
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  Mục chưa nhận diện vẫn được lưu để bạn theo dõi nhưng sẽ chặn tạo
                  thực đơn tự động cho đến khi có metadata loại trừ chính xác.
                </div>
              )}
              {otherAnalysis.errorCode === "too_many" && (
                <p className="mt-2 text-sm font-semibold text-red-200" role="alert">
                  Chỉ nhập tối đa 8 thực phẩm ở mục Khác.
                </p>
              )}
            </fieldset>
          )}

          {preferences.allergyStatus === "unsure" && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100" role="status">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              Hãy kiểm tra nhãn hoặc trao đổi với bác sĩ/chuyên gia dinh dưỡng trước khi dùng gợi ý. Hệ thống sẽ chưa tạo thực đơn khi trạng thái còn không chắc.
            </div>
          )}

          <FoodAllergySymptomGuide />

          {isAuthenticated && (
            <button type="button" onClick={onSave} disabled={!isDirty || isSaving || hasOtherFormatBlock} className="mt-5 min-h-11 rounded-lg border border-primary/60 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? "Đang lưu..." : isDirty ? "Lưu điều kiện vào tài khoản" : "Đã lưu vào tài khoản"}
            </button>
          )}
        </>
      )}

    </section>
  );
}
