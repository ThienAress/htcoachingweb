import { Check, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ctaClass =
  "flex items-center justify-center w-full mt-auto py-3.5 2xl:py-4 bg-gradient-to-r from-primary to-primary-dark text-white font-bold uppercase tracking-wide rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 hover:brightness-110 transition-[transform,box-shadow,filter] duration-300 whitespace-nowrap text-fluid-base";

const CheckList = ({ items, tone = "primary" }) => (
  <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-1">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2 text-sm text-gray-200">
        <Check
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "primary" ? "text-primary" : "text-blue-400"}`}
        />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const sessionsPerWeek = (plan) =>
  plan.weeks > 0 ? Math.round((plan.totalSessions / plan.weeks) * 10) / 10 : null;

// Gói 1-1: quyền lợi chung nêu một lần; mỗi thẻ chỉ nêu điểm khác biệt (thời lượng, số buổi, quà tặng).
const OneOnOnePlans = ({ plans, sharedFeatures, systemFeatures, onRegister }) => {
  const { t } = useTranslation("home");

  return (
    <div className="mx-auto max-w-5xl">
      <section
        aria-label={t("pricing.included_all")}
        className="mb-8 rounded-xl border border-gray-800 bg-[#1a1a1a] p-5 md:p-6"
      >
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-primary">
          {t("pricing.included_all")}
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <CheckList items={sharedFeatures} />
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("pricing.system_benefits_plain")}
            </h4>
            <CheckList items={systemFeatures} tone="system" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:gap-8">
        {plans.map((plan) => {
          const perWeek = sessionsPerWeek(plan);
          return (
            <article
              key={plan.title}
              className={`relative flex w-full flex-col rounded-xl border-2 bg-[#1a1a1a] p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary 2xl:p-8 ${
                plan.featured ? "border-primary" : "border-gray-800"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-md">
                  {t("pricing.popular")}
                </div>
              )}
              <h3 className="text-fluid-xl font-bold uppercase text-white">{plan.title}</h3>
              <p className="mt-3 font-display text-4xl font-black text-white">{plan.durationText}</p>
              <p className="mt-1 text-sm text-gray-400">
                {t("pricing.sessions_count", { count: plan.totalSessions })}
                {perWeek ? ` · ${t("pricing.sessions_per_week", { count: perWeek })}` : ""}
              </p>

              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {t("pricing.coaching_cost_label")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">
                  {t("pricing.coaching_cost_assessment")}
                </p>
              </div>

              <div className="my-4 min-h-[5.5rem]">
                {plan.gifts?.length > 0 && (
                  <>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-yellow-400">
                      <Gift aria-hidden="true" className="h-4 w-4" />
                      {t("pricing.gifts_label")}
                    </p>
                    <ul className="space-y-1.5">
                      {plan.gifts.map((gift) => (
                        <li key={gift} className="flex items-start gap-2 text-sm text-gray-200">
                          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                          <span>{gift}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <Link
                to="/register"
                onClick={(event) => {
                  event.preventDefault();
                  onRegister(plan);
                }}
                className={ctaClass}
              >
                {t("pricing.book_assessment")}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default OneOnOnePlans;
