import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildCommunityFeatureReport } from "../communityFeatureReport.service.js";
import { generateCommunityFeatureReportPdf } from "../communityFeatureReportPdf.service.js";

describe("community feature report PDF service", () => {
  it("generates a valid Vietnamese PDF report", async () => {
    const report = buildCommunityFeatureReport(
      {},
      { now: new Date("2026-08-10T03:30:00.000Z") },
    );

    const bytes = await generateCommunityFeatureReportPdf(report);
    const document = await PDFDocument.load(bytes);

    expect({
      prefix: Buffer.from(bytes).subarray(0, 5).toString("ascii"),
      pageCount: document.getPageCount(),
      title: document.getTitle(),
    }).toEqual({
      prefix: "%PDF-",
      pageCount: 2,
      title: "Báo cáo cải tiến tính năng HTCOACHING",
    });
  });

  it("adds pages when the history table exceeds one page", async () => {
    const report = buildCommunityFeatureReport();
    const sample = report.rows[0];
    const expandedReport = {
      ...report,
      rows: Array.from({ length: 60 }, (_, index) => ({
        ...sample,
        eventKey: `${sample.eventKey}:${index}`,
        opportunity: `${sample.opportunity} — lần rà soát ${index + 1}`,
      })),
      summary: { ...report.summary, eventCount: 60 },
    };

    const bytes = await generateCommunityFeatureReportPdf(expandedReport);
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
