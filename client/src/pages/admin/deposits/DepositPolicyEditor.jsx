import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Save, Settings2 } from "lucide-react";
import { formatVND } from "../depositAdmin.ui";
import {
  getAdminDepositPolicy,
  updateAdminDepositPolicy,
} from "../../../services/adminDeposit.service";
import {
  DEPOSIT_TIER_MINIMUM_STEP,
  MAX_DEPOSIT_TIER_LABEL_LENGTH,
  normalizeDepositPolicyResponse,
  parseDepositBonusRateDraft,
  parseDepositMinimumDraft,
} from "../../../utils/depositPolicy";
import { invalidateDepositPolicy } from "../../../queries/walletAccount.queries";

const QUERY_KEY = ["admin-deposit-policy"];
const DEFAULT_NAMES = { starter: "Khởi đầu", growth: "Tăng tốc", premium: "Tối ưu" };
const TIER_KEYS = ["starter", "growth", "premium"];

const draftFromPolicy = (policy) =>
  Object.fromEntries(
    policy.tiers.map((tier) => [
      tier.key,
      {
        rate: String(tier.bonusRate),
        min: String(tier.minAmount),
        label: tier.label || "",
      },
    ]),
  );

const inputClass =
  "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100";

// Chính sách thưởng nạp ví: tỷ lệ, mốc nạp (bậc 2 và 3) và tên từng bậc. Chỉ áp dụng cho hóa đơn tạo sau khi lưu.
const DepositPolicyEditor = () => {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState(null);
  const policyQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) =>
      getAdminDepositPolicy({ signal }).then(normalizeDepositPolicyResponse),
  });
  const policy = policyQuery.data;

  const original = policy ? draftFromPolicy(policy) : null;
  const draft = edits || original;
  const setField = (key, field, value) =>
    setEdits((current) => {
      const base = current || original;
      return { ...base, [key]: { ...base[key], [field]: value } };
    });

  const parsed = draft
    ? {
        rates: TIER_KEYS.map((key) => parseDepositBonusRateDraft(draft[key].rate)),
        growth: parseDepositMinimumDraft(draft.growth.min),
        premium: parseDepositMinimumDraft(draft.premium.min),
      }
    : null;
  const ratesValid =
    parsed && parsed.rates.every((rate) => rate !== null) &&
    parsed.rates.every((rate, index) => index === 0 || rate >= parsed.rates[index - 1]);
  const minimumsValid =
    parsed && parsed.growth !== null && parsed.premium !== null &&
    policy.minAmount < parsed.growth && parsed.growth < parsed.premium &&
    parsed.premium <= policy.maxAmount;
  const labelsValid =
    draft && TIER_KEYS.every((key) => draft[key].label.trim().length <= MAX_DEPOSIT_TIER_LABEL_LENGTH);
  const changed = Boolean(
    draft && original &&
      TIER_KEYS.some((key) => ["rate", "min", "label"].some((field) => String(draft[key][field]).trim() !== original[key][field])),
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAdminDepositPolicy({
        rates: Object.fromEntries(TIER_KEYS.map((key, index) => [key, parsed.rates[index]])),
        thresholds: { growth: parsed.growth, premium: parsed.premium },
        labels: Object.fromEntries(TIER_KEYS.map((key) => [key, draft[key].label.trim()])),
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(QUERY_KEY, normalizeDepositPolicyResponse(response));
      setEdits(null);
      await invalidateDepositPolicy(queryClient);
      toast.success(response.data.message);
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Không thể cập nhật chính sách thưởng"),
  });

  if (policyQuery.isPending) {
    return (
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6" role="status">
        <p className="text-sm text-gray-500">Đang tải chính sách thưởng...</p>
      </section>
    );
  }
  if (policyQuery.isError || !policy) {
    return (
      <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <p className="text-sm text-red-700">Không thể tải chính sách thưởng nạp tiền.</p>
        <button
          type="button"
          onClick={() => policyQuery.refetch()}
          className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 transition-colors duration-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Thử lại
        </button>
      </section>
    );
  }

  const tierTitle = (key, index) =>
    draft[key].label.trim() || `Bậc ${index + 1} · ${DEFAULT_NAMES[key]}`;
  const valid = ratesValid && minimumsValid && labelsValid;

  return (
    <section aria-labelledby="deposit-policy-heading" className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="deposit-policy-heading" className="flex items-center gap-2 text-lg font-black text-gray-900">
            <Settings2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Thưởng nạp ví theo bậc
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            Chỉnh tỷ lệ thưởng, mốc nạp và tên của từng bậc. Thay đổi chỉ áp dụng cho hóa đơn tạo sau khi lưu; hóa đơn
            đang chờ giữ nguyên bậc và quyền lợi. Đặt tỷ lệ 0% nếu không muốn thưởng ở bậc đó.
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={!valid || !changed || updateMutation.isPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-[background-color,box-shadow] duration-200 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {updateMutation.isPending ? "Đang lưu..." : "Lưu chính sách"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {TIER_KEYS.map((key, index) => (
          <fieldset
            key={key}
            className={`rounded-xl border p-4 ${
              key === "premium" ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <legend className="px-1 text-sm font-bold text-gray-800">{tierTitle(key, index)}</legend>

            <label className="mt-1 block text-xs font-semibold text-gray-600" htmlFor={`deposit-tier-min-${key}`}>
              Mốc nạp từ (đồng)
            </label>
            {key === "starter" ? (
              <p id={`deposit-tier-min-${key}`} className="mt-1 min-h-11 rounded-lg bg-white px-3 py-3 text-sm text-gray-700">
                {formatVND(policy.minAmount)} · mức nạp tối thiểu
              </p>
            ) : (
              <input
                id={`deposit-tier-min-${key}`}
                type="number"
                inputMode="numeric"
                min={policy.minAmount + DEPOSIT_TIER_MINIMUM_STEP}
                max={policy.maxAmount}
                step={DEPOSIT_TIER_MINIMUM_STEP}
                value={draft[key].min}
                onChange={(event) => setField(key, "min", event.target.value)}
                aria-invalid={!minimumsValid}
                className={`mt-1 ${inputClass}`}
              />
            )}
            {key !== "starter" && parsed[key] !== null && (
              <p className="mt-1 text-xs text-gray-500" aria-live="polite">= {formatVND(parsed[key])}</p>
            )}

            <label className="mt-3 block text-xs font-semibold text-gray-600" htmlFor={`deposit-tier-rate-${key}`}>
              Tỷ lệ thưởng (%)
            </label>
            <input
              id={`deposit-tier-rate-${key}`}
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              value={draft[key].rate}
              onChange={(event) => setField(key, "rate", event.target.value)}
              aria-invalid={!ratesValid}
              className={`mt-1 ${inputClass} text-lg font-black`}
            />

            <label className="mt-3 block text-xs font-semibold text-gray-600" htmlFor={`deposit-tier-label-${key}`}>
              Tên bậc (tùy chọn)
            </label>
            <input
              id={`deposit-tier-label-${key}`}
              type="text"
              maxLength={MAX_DEPOSIT_TIER_LABEL_LENGTH + 10}
              value={draft[key].label}
              onChange={(event) => setField(key, "label", event.target.value)}
              placeholder={DEFAULT_NAMES[key]}
              aria-invalid={!labelsValid}
              className={`mt-1 ${inputClass}`}
            />
          </fieldset>
        ))}
      </div>

      {!ratesValid && (
        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
          Tỷ lệ phải là số nguyên từ 0 đến 100 và không giảm ở bậc cao hơn.
        </p>
      )}
      {!minimumsValid && (
        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
          Mốc nạp phải là số nguyên chia hết cho {formatVND(DEPOSIT_TIER_MINIMUM_STEP)}, lớn hơn mốc bậc trước và không
          vượt quá {formatVND(policy.maxAmount)}.
        </p>
      )}
      {!labelsValid && (
        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
          Tên bậc tối đa {MAX_DEPOSIT_TIER_LABEL_LENGTH} ký tự.
        </p>
      )}
    </section>
  );
};

export default DepositPolicyEditor;
