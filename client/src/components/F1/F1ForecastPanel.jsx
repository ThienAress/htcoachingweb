import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCcw, TrendingUp } from "lucide-react";
import {
  generateOutcomeForecast,
  getLatestOutcomeForecast,
} from "../../services/f1Customer.service";

const InfoCard = ({ label, value }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value || "--"}</p>
    </div>
  );
};

const ListCard = ({ title, items = [], emptyText = "Chưa có dữ liệu" }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>

      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
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
};

const ForecastCaseCard = ({ title, data }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-3xl font-bold text-[#1C2D42]">
        {data?.months ? `${data.months} tháng` : "--"}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {data?.summary || "Chưa có mô tả"}
      </p>
    </div>
  );
};

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
        console.error("GET LATEST FORECAST ERROR:", error);
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
      console.error("GENERATE FORECAST ERROR:", error);
      alert(
        error?.response?.data?.message || "Generate dự đoán kết quả thất bại",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Quay lại chi tiết khách hàng
      </button>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Dự đoán kết quả • {customer?.code || "--"}
            </p>
            <h2 className="text-2xl font-bold text-slate-900">
              {customer?.fullName}
            </h2>
            <p className="mt-1 text-slate-500">
              Ước tính thời gian đạt mục tiêu dựa trên intake, đánh giá thể chất
              và AI report
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || loadingLatest}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C2D42] px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {forecast ? <RefreshCcw size={18} /> : <TrendingUp size={18} />}
            {generating
              ? "Đang generate..."
              : forecast
                ? "Generate lại forecast"
                : "Generate dự đoán kết quả"}
          </button>
        </div>

        {loadingLatest ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
            Đang tải dự đoán kết quả...
          </div>
        ) : !forecast ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-semibold text-slate-700">
              Chưa có dự đoán kết quả
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Bấm nút generate để hệ thống ước tính thời gian đạt mục tiêu cho
              khách hàng này.
            </p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-4 gap-4">
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

            <div className="grid md:grid-cols-3 gap-4">
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
              emptyText="Chưa có blocker nổi bật"
            />

            <ListCard
              title="Assumptions"
              items={forecast?.forecast?.assumptions || []}
              emptyText="Chưa có assumption"
            />

            <ListCard
              title="Milestones"
              items={forecast?.forecast?.milestones || []}
              emptyText="Chưa có milestone"
            />
          </>
        )}
      </div>
    </section>
  );
};

export default F1ForecastPanel;
