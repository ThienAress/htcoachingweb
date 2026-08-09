import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import SEO from "../../components/SEO";
import { serviceAccessPoliciesQueryOptions } from "../../queries/serviceAccessPolicy.queries";
import CommunityFeatureTable from "./service-access-policies/CommunityFeatureTable";
import {
  enforcementLabel,
  formatPolicy,
  formatTrainerBenefitValue,
  formatTrainerPlanPrice,
  groupColumnPolicies,
} from "./service-access-policies/serviceAccessPolicyPresentation";

const PolicyCell = ({ service, column }) => {
  const groups = groupColumnPolicies(service, column);
  if (groups.length === 0) return <span className="text-sm text-zinc-500">—</span>;

  return (
    <div className="space-y-3">
      {groups.map(({ labels, policy }) => {
        const formatted = formatPolicy(policy);
        return (
          <div key={`${labels.join("-")}-${formatted.primary}`}>
            {groups.length > 1 && (
              <p className="mb-1 text-xs font-semibold text-cyan-800">
                {labels.join(" · ")}
              </p>
            )}
            <p className="font-semibold text-zinc-950">{formatted.primary}</p>
            {formatted.secondary && (
              <p className="mt-1 text-xs text-zinc-500">{formatted.secondary}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              {enforcementLabel(policy.enforcement)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

const CollapsibleSection = ({
  title,
  description,
  open,
  onToggle,
  panelId,
  children,
}) => (
  <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? "Thu gọn" : "Mở rộng"} ${title}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        {open ? (
          <ChevronUp className="size-5" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
    <div id={panelId} hidden={!open}>
      {children}
    </div>
  </section>
);

const ToolQuotaTable = ({ matrix }) => (
  <div className="overflow-x-auto">
    <table className="min-w-[900px] w-full border-collapse text-left">
      <thead className="bg-zinc-100 text-sm text-zinc-700">
        <tr>
          <th scope="col" className="w-[28%] px-5 py-4 font-semibold">
            Dịch vụ
          </th>
          {matrix.columns.map((column) => (
            <th key={column.id} scope="col" className="px-5 py-4 font-semibold">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200">
        {matrix.services.map((service) => (
          <tr key={service.serviceKey} className="align-top">
            <th scope="row" className="px-5 py-5">
              <p className="font-bold text-zinc-950">{service.label}</p>
              <p className="mt-1 text-xs font-medium text-emerald-800">
                {service.category}
              </p>
              <p className="mt-2 max-w-xs text-sm font-normal leading-5 text-zinc-600">
                {service.description}
              </p>
            </th>
            {matrix.columns.map((column) => (
              <td key={column.id} className="px-5 py-5 text-sm">
                <PolicyCell service={service} column={column} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TrainerBenefitTable = ({ trainerPlans }) => (
  <div className="overflow-x-auto">
    <table className="min-w-[1050px] w-full border-collapse text-left">
      <thead className="bg-zinc-100 text-sm text-zinc-700">
        <tr>
          <th scope="col" className="w-[28%] px-5 py-4 font-semibold">
            Quyền lợi
          </th>
          {trainerPlans.columns.map((plan) => (
            <th key={plan.id} scope="col" className="px-5 py-4 align-top">
              <p className="font-bold text-zinc-950">{plan.label}</p>
              <p className="mt-1 max-w-48 text-xs font-medium leading-5 text-zinc-500">
                {formatTrainerPlanPrice(plan)}
              </p>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200">
        {trainerPlans.benefits.map((benefit) => (
          <tr key={benefit.key} className="align-middle">
            <th scope="row" className="px-5 py-4">
              <p className="font-semibold text-zinc-950">{benefit.label}</p>
              <p className="mt-1 text-xs font-medium text-emerald-800">
                {benefit.category.label}
              </p>
            </th>
            {trainerPlans.columns.map((plan) => {
              const value = benefit.values[plan.id];
              const label = formatTrainerBenefitValue(value, benefit);
              return (
                <td key={plan.id} className="px-5 py-4 text-sm font-semibold text-zinc-800">
                  {benefit.valueType === "capacity" ? (
                    label
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      {value ? (
                        <Check className="size-4 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <Minus className="size-4 text-zinc-400" aria-hidden="true" />
                      )}
                      {label}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function ServiceAccessPoliciesPage() {
  const query = useQuery(serviceAccessPoliciesQueryOptions());
  const matrix = query.data;
  const [toolQuotaOpen, setToolQuotaOpen] = useState(true);
  const [trainerBenefitsOpen, setTrainerBenefitsOpen] = useState(true);
  const [communityFeaturesOpen, setCommunityFeaturesOpen] = useState(true);
  const [selectedFeatureGroup, setSelectedFeatureGroup] = useState("all");

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6">
      <SEO title="Quyền & hạn mức" noindex />
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <p className="text-sm font-semibold">Chính sách dịch vụ</p>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Quyền & hạn mức
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Đối chiếu hạn mức công cụ, quyền lợi gói HLV và các tính năng phục vụ cộng đồng, khách hàng. Dữ liệu chỉ đọc và lấy trực tiếp từ registry canonical.
            </p>
          </div>
          {matrix?.version && (
            <p className="w-fit rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Phiên bản {matrix.version}
            </p>
          )}
        </header>

        {query.isPending && (
          <div
            className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600"
            role="status"
          >
            Đang tải chính sách dịch vụ...
          </div>
        )}

        {query.isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
            <p className="font-semibold text-rose-900">Không thể tải quyền và hạn mức.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </button>
          </div>
        )}

        {matrix &&
          matrix.services.length === 0 &&
          matrix.trainerPlans?.benefits?.length === 0 &&
          !matrix.communityFeatures?.items?.length && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Registry chưa có hạn mức, quyền lợi hoặc tính năng nào.
          </div>
        )}

        {matrix?.services?.length > 0 && (
          <CollapsibleSection
            title="Hạn mức công cụ"
            description="Quota dùng thử và quyền sử dụng theo từng nhóm tài khoản."
            open={toolQuotaOpen}
            onToggle={() => setToolQuotaOpen((current) => !current)}
            panelId="tool-quota-panel"
          >
            <ToolQuotaTable matrix={matrix} />
          </CollapsibleSection>
        )}

        {matrix?.trainerPlans?.benefits?.length > 0 && (
          <CollapsibleSection
            title="Quyền lợi gói HLV"
            description="Bốn gói đang công bố tại Pricing, dùng chung catalog để tránh lệch quyền lợi."
            open={trainerBenefitsOpen}
            onToggle={() => setTrainerBenefitsOpen((current) => !current)}
            panelId="trainer-benefits-panel"
          >
            <TrainerBenefitTable trainerPlans={matrix.trainerPlans} />
          </CollapsibleSection>
        )}

        {matrix?.communityFeatures?.items?.length > 0 && (
          <CollapsibleSection
            title="Tính năng cộng đồng & khách hàng"
            description="Giá trị chính và cơ hội cải thiện ban đầu của các tính năng đang phục vụ người dùng."
            open={communityFeaturesOpen}
            onToggle={() => setCommunityFeaturesOpen((current) => !current)}
            panelId="community-features-panel"
          >
            <CommunityFeatureTable
              catalog={matrix.communityFeatures}
              selectedGroup={selectedFeatureGroup}
              onGroupChange={setSelectedFeatureGroup}
            />
          </CollapsibleSection>
        )}

        <p className="text-xs leading-5 text-zinc-500">
          Entitlement được backend xác định từ tài khoản, gói HLV và Order còn buổi; client không được tự khai báo tier.
        </p>
      </div>
    </main>
  );
}
