import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

const CategoryList = ({ categories, checkClass, className = "space-y-4" }) => (
  <div className={className}>
    {categories.map((category) => (
      <div key={category.key}>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          {category.name}
          {category.icon && <span aria-hidden="true">{category.icon}</span>}
        </h4>
        <ul className="space-y-1.5">
          {category.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
              <Check aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${checkClass}`} />
              <span className="leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

// Gói dành cho HLV: tính năng chung nêu một lần; mỗi thẻ có giá, số học viên tối đa và phần chỉ gói đó có.
// Nút mua, nhãn trạng thái dùng thử do trang cha quyết định (renderAction, renderBadge).
const TrainerPlans = ({ plans, shared, perPlan, billingCycle, renderAction, renderBadge }) => {
  const { t } = useTranslation("home");
  const hasExtras = Object.values(perPlan).some((categories) => categories.length > 0);

  return (
    <div className="mx-auto max-w-7xl">
      {shared.length > 0 && (
        <section
          aria-label={t("pricing.included_all")}
          className="mb-8 rounded-xl border border-gray-800 bg-[#1a1a1a] p-5 md:p-6"
        >
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-primary">
            {t("pricing.included_all")}
          </h3>
          <CategoryList categories={shared} checkClass="text-green-500" className="grid gap-6 md:grid-cols-2" />
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-8">
        {plans.map((plan) => {
          const price = plan.isFree ? 0 : billingCycle === "year" ? plan.priceYear : plan.priceMonth;
          const extras = perPlan[plan.code] || [];
          return (
            <article
              key={plan.code}
              className={`relative flex w-full flex-col rounded-xl border-2 bg-[#1a1a1a] p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary 2xl:p-8 ${
                plan.featured ? "border-primary" : "border-gray-800"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-md">
                  {t("pricing.popular")}
                </div>
              )}
              {renderBadge?.(plan)}

              <div className="text-center">
                <h3 className="text-fluid-xl font-bold uppercase text-white">{plan.title}</h3>
                <p className="mt-1 min-h-10 text-sm text-gray-400">{plan.subtitle}</p>
                <p className="mt-3 text-3xl font-bold leading-tight text-white xl:text-4xl">
                  {formatVnd(price)}
                  <span className="ml-1 text-sm font-normal text-gray-400">
                    /
                    {plan.isFree
                      ? t("pricing.trainer_plans.days", { count: plan.durationDays })
                      : billingCycle === "year"
                        ? t("pricing.year")
                        : t("pricing.month")}
                  </span>
                </p>
                <p className="mt-1 min-h-5 text-sm text-gray-500">
                  {!plan.isFree && billingCycle === "year"
                    ? `${t("pricing.avg_per_month")} ${formatVnd(Math.round(plan.priceYear / 12))}/${t("pricing.month")}`
                    : ""}
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center">
                <p className="font-display text-4xl font-black text-white">{plan.maxClients}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {t("pricing.trainer_plans.students_label")}
                </p>
              </div>

              {hasExtras && (
                <div className="my-5 min-h-[6rem] flex-1">
                  {extras.length > 0 && (
                    <>
                      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-yellow-400">
                        {t("pricing.trainer_plans.extra_label")}
                      </p>
                      <CategoryList categories={extras} checkClass="text-yellow-400" />
                    </>
                  )}
                </div>
              )}

              <div className="mt-auto pt-4">{renderAction(plan)}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default TrainerPlans;
