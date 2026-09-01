import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TrainerCustomerReports,
  TrainerJournalSummary,
  TrainerNutritionReport,
  TrainerWeeklyReviewAnchor,
} from "../TrainerClientOverview";
import {
  customerReportFromHash,
  getTrainerClientOverviewSurface,
} from "../trainerCustomerReports";
import {
  TrainerWeeklyMeasurements,
  TrainerWeeklyReview,
} from "../TrainerWeeklyReview";
import { TrainerAttentionPanel } from "../TrainerAttentionPanel";
import { TrainerHealthGoalsSection } from "../TrainerHealthGoalsSection";
import { TrainerSupportReminder } from "../TrainerClientWorkspace";

const renderWithQueryClient = (node) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
};

describe("TrainerJournalSummary", () => {
  it("renders customer reports only on the tracking and support surface", () => {
    expect(getTrainerClientOverviewSurface("overview")).toEqual({
      showAttention: false,
      showCustomerReports: false,
      showOverview: true,
    });
    expect(getTrainerClientOverviewSurface("reports")).toEqual({
      showAttention: true,
      showCustomerReports: true,
      showOverview: false,
    });
  });

  it("shows the daily report reminder immediately in the support tab", () => {
    const html = renderToStaticMarkup(<TrainerSupportReminder />);

    expect(html).toContain("Báo cáo từ khách hàng rất quan trọng");
    expect(html).toContain("kiểm tra mỗi ngày");
    expect(html).toContain('role="note"');
  });

  it("groups targets and customer habits under one health section", () => {
    const html = renderWithQueryClient(
      <TrainerHealthGoalsSection clientId="client-1" dateKey="2026-08-26" />,
    );

    expect(html).toContain("Mục tiêu sức khỏe");
    expect(html).toContain("Chỉ số mục tiêu");
    expect(html).toContain("Thói quen khách hàng");
    expect(html).toContain("Đặt mục tiêu và gửi cho khách hàng");
    expect(html).not.toContain("Thói quen hằng ngày");
  });

  it("exposes the journal anchor and only the shared note", () => {
    const html = renderToStaticMarkup(
      <TrainerJournalSummary
        clientName="Hoàng Thiện Võ"
        dateKey="2026-08-23"
        journal={{
          status: "submitted",
          wellness: { sleepHours: 7.5, energy: 8 },
          notes: { shared: "Hôm nay tập tốt", private: "Không chia sẻ" },
        }}
      />,
    );

    expect(html).toContain('id="journal"');
    expect(html).toContain("Sức khỏe");
    expect(html).not.toContain("Nhật ký ngày");
    expect(html).not.toContain("Thông tin khách hàng đã chia sẻ với HLV");
    expect(html).toContain("Hôm nay tập tốt");
    expect(html).toContain("Rất sung sức");
    expect(html).not.toContain("Không chia sẻ");
  });

  it("states clearly when the customer did not write a shared note", () => {
    const html = renderToStaticMarkup(
      <TrainerJournalSummary
        clientName="Hoàng Thiện Võ"
        dateKey="2026-08-23"
        journal={{ status: "submitted", wellness: {}, notes: { shared: "" } }}
      />,
    );

    expect(html).toContain("Khách hàng không ghi chú.");
    expect(html).not.toContain("chưa chia sẻ ghi chú");
  });

  it("exposes the stable weekly report anchor", () => {
    const html = renderToStaticMarkup(
      <TrainerWeeklyReviewAnchor>
        <p>Báo cáo tuần</p>
      </TrainerWeeklyReviewAnchor>,
    );

    expect(html).toContain('id="weekly-report"');
  });

  it("shows the weekly measurements without trainer review controls", () => {
    const html = renderToStaticMarkup(
      <TrainerWeeklyReview
        checkin={{
          status: "submitted",
          weekStartDateKey: "2026-08-17",
          body: { weightKg: 70, waistCm: 80 },
        }}
      />,
    );

    expect(html).toContain("Báo cáo tuần");
    expect(html).toContain("70 kg");
    expect(html).not.toContain("Nhận xét báo cáo tuần");
    expect(html).not.toContain("Phản hồi cho học viên");
    expect(html).not.toContain("Lưu nhận xét");
  });

  it("shows only eaten meals in the submitted nutrition report", () => {
    const html = renderToStaticMarkup(
      <TrainerNutritionReport
        nutrition={{
          submittedAt: "2026-08-25T10:00:00.000Z",
          dailyTotals: { calories: 187.5, protein: 30, carb: 0, fat: 7.5 },
          entries: [
            {
              entryId: "meal-1",
              mode: "follow_plan",
              status: "eaten",
              labelSnapshot: "Bữa 1",
              actualFoods: [
                {
                  foodId: "food-1",
                  labelSnapshot: "Gan gà",
                  actualAmountGrams: 150,
                  nutrition: { calories: 187.5, protein: 30, carb: 0, fat: 7.5 },
                },
              ],
              actualTotals: { calories: 187.5, protein: 30, carb: 0, fat: 7.5 },
            },
            {
              entryId: "meal-2",
              mode: "follow_plan",
              status: "skipped",
              labelSnapshot: "Bữa 2",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Dinh dưỡng");
    expect(html).toContain('id="nutrition-report"');
    expect(html).toContain("150g Gan gà");
    expect(html).toContain("188 kcal");
    expect(html).not.toContain("Bữa 2");
  });

  it("groups health and nutrition under one customer report navigation card", () => {
    const html = renderToStaticMarkup(
      <TrainerCustomerReports
        clientName="Hoàng Thiện Võ"
        journal={{ status: "submitted" }}
        nutrition={{ submittedAt: null, entries: [] }}
        activeReport={null}
        onReportChange={() => {}}
      />,
    );

    expect(html).toContain("Báo cáo khách hàng");
    expect(html).toContain("Hoàng Thiện Võ");
    expect(html).toContain("Sức khỏe");
    expect(html).toContain("Dinh dưỡng");
    expect(html).toContain('data-customer-report-navigation="true"');
    expect(html).not.toContain("Báo cáo từ khách hàng");
    expect(html).not.toContain("Báo cáo dinh dưỡng từ khách hàng");
  });

  it("uses the same large heading scale for attention and customer reports", () => {
    const attentionHtml = renderToStaticMarkup(
      <TrainerAttentionPanel items={[]} />,
    );
    const reportHtml = renderToStaticMarkup(
      <TrainerCustomerReports
        journal={null}
        nutrition={null}
        activeReport={null}
        onReportChange={() => {}}
      />,
    );

    expect(attentionHtml).toContain("text-2xl");
    expect(attentionHtml).toContain("sm:text-3xl");
    expect(attentionHtml).toContain("h-6 w-6");
    expect(reportHtml).toContain("text-2xl");
    expect(reportHtml).toContain("sm:text-3xl");
    expect(reportHtml).toContain("h-6 w-6");
  });

  it("maps notification anchors to the correct customer report", () => {
    expect([
      customerReportFromHash("#journal"),
      customerReportFromHash("#nutrition-report"),
      customerReportFromHash("#weekly-report"),
    ]).toEqual(["health", "nutrition", null]);
  });

  it("does not expose an unsubmitted journal to the trainer", () => {
    const html = renderToStaticMarkup(
      <TrainerJournalSummary
        dateKey="2026-08-23"
        journal={{
          status: "draft",
          wellness: { energy: 9 },
          notes: { shared: "Nội dung chưa gửi" },
        }}
      />,
    );

    expect(html).toContain("Chưa có nhật ký đã gửi cho ngày này");
    expect(html).not.toContain("Nội dung chưa gửi");
    expect(html).not.toContain("Rất sung sức");
  });

  it("shows all four weekly measurements without inventing missing values", () => {
    const html = renderToStaticMarkup(
      <TrainerWeeklyMeasurements
        body={{
          weightKg: 72.5,
          waistCm: 82,
          bodyFatPercent: 18.5,
          skeletalMusclePercent: null,
        }}
      />,
    );

    expect(html).toContain("72,5 kg");
    expect(html).toContain("18,5 %");
    expect(html).toContain("Tỷ lệ cơ xương");
    expect(html).toContain("Chưa ghi");
  });
});
