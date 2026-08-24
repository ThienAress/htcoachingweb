import {
  Activity,
  ArrowRight,
  BarChart3,
  HeartPulse,
  Ruler,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { BodyProgressReport } from "./BodyProgressReport";
import { ComplianceProgressReport } from "./ComplianceProgressReport";
import { ProgressWellnessOverview } from "./ProgressWellnessOverview";
import { normalizeProgressSection } from "./progressPresentation";

const PROGRESS_SECTIONS = [
  {
    key: "compliance",
    label: "Mức độ thực hiện",
    description: "So sánh mức hoàn thành lịch tập, giáo án, bữa ăn và thói quen.",
    icon: Activity,
    iconClass: "bg-orange-400/10 text-orange-300",
  },
  {
    key: "body",
    label: "Tiến trình cơ thể",
    description: "Theo dõi thay đổi số đo từ những báo cáo tuần đã gửi.",
    icon: Ruler,
    iconClass: "bg-cyan-400/10 text-cyan-300",
  },
  {
    key: "wellness",
    label: "Sức khỏe trung bình",
    description: "Xem xu hướng những chỉ số sức khỏe từ nhật ký đã gửi.",
    icon: HeartPulse,
    iconClass: "bg-emerald-400/10 text-emerald-300",
  },
];

const ProgressHeader = ({ actions, headingLevel: Heading = "h2" }) => (
  <header className="flex flex-col gap-5 border-b border-slate-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <Heading
        id="progress-navigation-title"
        className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl"
      >
        <BarChart3
          className="h-6 w-6 shrink-0 text-orange-400"
          aria-hidden="true"
        />
        Tiến trình cơ thể và huấn luyện
      </Heading>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Tổng hợp từ lịch tập, giáo án và những nhật ký hoặc báo cáo tuần bạn đã
        gửi. Bản nháp không được tính vào số liệu.
      </p>
    </div>
    {actions}
  </header>
);

const ProgressLanding = ({ buttonRefs, onSectionChange }) => (
  <section
    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
    aria-labelledby="progress-navigation-title"
  >
    <div className="divide-y divide-slate-800">
      {PROGRESS_SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.key}
            ref={(node) => {
              buttonRefs.current[section.key] = node;
            }}
            type="button"
            onClick={() => onSectionChange(section.key)}
            className="group grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 sm:px-6"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${section.iconClass}`}
            >
              <Icon size={21} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-slate-100">
                {section.label}
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-400">
                {section.description}
              </span>
            </span>
            <ArrowRight
              size={19}
              className="text-slate-500 transition-colors group-hover:text-orange-300"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  </section>
);

export const ProgressSummary = ({
  activeSection,
  landingActions,
  landingHeadingLevel = "h2",
  onSectionChange = () => {},
  progress,
  rangeControls,
}) => {
  const buttonRefs = useRef({});
  const headingRef = useRef(null);
  const lastSectionRef = useRef(null);
  const hasOpenedRef = useRef(false);
  const sectionKey = normalizeProgressSection(activeSection);
  const section = PROGRESS_SECTIONS.find(({ key }) => key === sectionKey);

  useEffect(() => {
    if (sectionKey) {
      lastSectionRef.current = sectionKey;
      hasOpenedRef.current = true;
      headingRef.current?.focus();
      return;
    }
    if (hasOpenedRef.current && lastSectionRef.current) {
      buttonRefs.current[lastSectionRef.current]?.focus();
    }
  }, [sectionKey]);

  const onBack = () => onSectionChange(null);

  return (
    <div className="space-y-5">
      <ProgressHeader
        actions={landingActions}
        headingLevel={landingHeadingLevel}
      />

      {!section && (
        <ProgressLanding
          buttonRefs={buttonRefs}
          onSectionChange={onSectionChange}
        />
      )}
      {sectionKey === "compliance" && (
        <ComplianceProgressReport
          compliance={progress.compliance}
          headingRef={headingRef}
          onBack={onBack}
          rangeControls={rangeControls}
        />
      )}
      {sectionKey === "body" && (
        <BodyProgressReport
          bodyProgress={progress.bodyProgress}
          headingRef={headingRef}
          onBack={onBack}
          range={progress.range}
          rangeControls={rangeControls}
        />
      )}
      {sectionKey === "wellness" && (
        <ProgressWellnessOverview
          headingRef={headingRef}
          onBack={onBack}
          range={progress.range}
          rangeControls={rangeControls}
          wellness={progress.wellness}
        />
      )}
    </div>
  );
};
