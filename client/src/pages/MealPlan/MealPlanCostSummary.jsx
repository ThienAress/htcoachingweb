const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const budgetLabels = {
  within: "Khoảng ước tính nằm trong ngân sách đã nhập.",
  above: "Khoảng ước tính cao hơn ngân sách đã nhập.",
  uncertain: "Khoảng giá dao động qua mức ngân sách đã nhập.",
  not_set: "Bạn chưa đặt giới hạn ngân sách.",
};

export default function MealPlanCostSummary({ estimate }) {
  if (!estimate || estimate.coverageStatus === "unavailable") return null;
  return (
    <section className="mx-auto mb-6 max-w-3xl rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-cyan-50" aria-labelledby="meal-plan-cost-title" aria-live="polite">
      <h2 id="meal-plan-cost-title" className="font-bold">Chi phí tham khảo · TP.HCM</h2>
      {estimate.coverageStatus === "sufficient" ? (
        <>
          <p className="mt-2 text-lg font-bold tabular-nums">{money.format(estimate.lowVndPerDay)} – {money.format(estimate.highVndPerDay)}/ngày</p>
          <p className="mt-1 text-sm leading-6">Mức giữa tham khảo: {money.format(estimate.typicalVndPerDay)}. {budgetLabels[estimate.budgetStatus]}</p>
          {estimate.asOf && <p className="mt-1 text-xs text-cyan-100/80">Giá cũ nhất trong tổ hợp được cập nhật: {new Date(estimate.asOf).toLocaleDateString("vi-VN")}.</p>}
        </>
      ) : (
        <p className="mt-2 text-sm leading-6">Chưa đủ hai nguồn giá còn mới cho toàn bộ thực đơn ({estimate.coveredFoods}/{estimate.totalFoods} món có coverage). Hệ thống không khẳng định thực đơn đạt ngân sách.</p>
      )}
    </section>
  );
}
