// F1ForecastPanel.jsx
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  RefreshCcw,
  TrendingUp,
  Clock,
  Target,
  BarChart3,
} from "lucide-react";
import {
  generateOutcomeForecast,
  getLatestOutcomeForecast,
} from "../../services/f1Customer.service";

const InfoCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-bold text-slate-800">{value || "--"}</p>
  </div>
);

const ListCard = ({ title, items = [], emptyText = "Chưa có dữ liệu" }) => (
  <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
    {items.length ? (
      <div className="mt-3 space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-700"
          >
            {typeof item === "string"
              ? item
              : `${item.week} tuần • ${item.title}: ${item.expectedChange}`}
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
    )}
  </div>
);

const ForecastCaseCard = ({ title, data }) => (
  <div className="rounded-xl border-l-4 border-l-amber-500 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
    <p className="mt-2 text-3xl font-black text-amber-600">
      {data?.months ? `${data.months} tháng` : "--"}
    </p>
    <p className="mt-2 text-sm text-slate-600">
      {data?.summary || "Chưa có mô tả"}
    </p>
  </div>
);

const F1ForecastPanel = ({ customer, onBack, onGenerated }) => {
  const [forecast, setForecast] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadLatest = async () => {
      if (!customer?._id) return;
      try {
        setLoadingLatest(true);
        const res = await getLatestOutcomeForecast(customer._id);
        setForecast(res?.data || null);
      } catch (error) {
        console.error(error);
        setForecast(null);
      } finally {
        setLoadingLatest(false);
      }
    };
    loadLatest();
  }, [customer?._id]);

  const handleGenerate = async () => {
    if (!customer?._id) return;
    try {
      setGenerating(true);
      const res = await generateOutcomeForecast(customer._id);
      setForecast(res?.data || null);
      alert("Generate dự đoán kết quả thành công");
      onGenerated?.(res?.data);
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.message || "Generate dự đoán kết quả thất bại",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-2 text-slate-500 transition hover:text-amber-600"
      >
        <ArrowLeft
          size={18}
          className="transition-transform group-hover:-translate-x-1"
        />
        Quay lại chi tiết khách hàng
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                Dự đoán kết quả • {customer?.code || "--"}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800">
                {customer?.fullName}
              </h2>
              <p className="mt-1 text-slate-500">
                Ước tính thời gian đạt mục tiêu dựa trên intake, đánh giá thể
                chất và AI report
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || loadingLatest}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              {forecast ? <RefreshCcw size={18} /> : <TrendingUp size={18} />}
              {generating
                ? "Đang generate..."
                : forecast
                  ? "Generate lại forecast"
                  : "Generate dự đoán kết quả"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 md:px-8">
          {loadingLatest ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              Đang tải dự đoán kết quả...
            </div>
          ) : !forecast ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <BarChart3 size={36} className="mx-auto text-slate-400" />
              <p className="mt-3 font-semibold text-slate-700">
                Chưa có dự đoán kết quả
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Bấm nút generate để hệ thống ước tính thời gian đạt mục tiêu cho
                khách hàng này.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard
                  label="Primary Goal"
                  value={forecast?.inputSummary?.primaryGoal}
                />
                <InfoCard
                  label="Current Weight"
                  value={
                    forecast?.inputSummary?.currentWeightKg
                      ? `${forecast.inputSummary.currentWeightKg} kg`
                      : "--"
                  }
                />
                <InfoCard
                  label="Target Weight"
                  value={
                    forecast?.inputSummary?.targetWeightKg
                      ? `${forecast.inputSummary.targetWeightKg} kg`
                      : "--"
                  }
                />
                <InfoCard
                  label="Confidence"
                  value={forecast?.forecast?.confidence}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ForecastCaseCard
                  title="Fast Case"
                  data={forecast?.forecast?.fastCase}
                />
                <ForecastCaseCard
                  title="Realistic Case"
                  data={forecast?.forecast?.realisticCase}
                />
                <ForecastCaseCard
                  title="Slow Case"
                  data={forecast?.forecast?.slowCase}
                />
              </div>

              <ListCard
                title="Blockers"
                items={forecast?.forecast?.blockers || []}
              />
              <ListCard
                title="Assumptions"
                items={forecast?.forecast?.assumptions || []}
              />
              <ListCard
                title="Milestones"
                items={forecast?.forecast?.milestones || []}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default F1ForecastPanel;
