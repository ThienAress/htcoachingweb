import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PAGE_MARGIN = 32;
const TABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const TABLE_TOP = 445;
const TABLE_BOTTOM = 42;
const HEADER_HEIGHT = 25;
const CELL_PADDING = 5;
const BODY_FONT_SIZE = 7.4;
const BODY_LINE_HEIGHT = 9.4;
const COLUMN_WIDTHS = [58, 88, 65, 75, 210, 282];
const HEADERS = [
  "Ngày xác nhận",
  "Tính năng",
  "Nhóm",
  "Ưu tiên lúc xử lý",
  "Cơ hội đã cải thiện",
  "Kết quả xác nhận",
];

const COLORS = {
  text: rgb(0.11, 0.13, 0.12),
  muted: rgb(0.36, 0.4, 0.38),
  border: rgb(0.82, 0.85, 0.83),
  brand: rgb(0.02, 0.45, 0.34),
  brandSoft: rgb(0.91, 0.97, 0.94),
  rowAlt: rgb(0.975, 0.98, 0.978),
  white: rgb(1, 1, 1),
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const generatedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const formatDateOnly = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
};

const wrapText = (value, font, size, maxWidth, maxLines = 12) => {
  const words = String(value || "—").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.…]+$/u, "")}…`;
  return clipped;
};

const drawTextLines = (page, lines, font, x, y, color = COLORS.text) => {
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * BODY_LINE_HEIGHT,
      size: BODY_FONT_SIZE,
      font,
      color,
    });
  });
};

const loadFonts = async (pdfDoc) => {
  pdfDoc.registerFontkit(fontkit);
  const templateDir = path.join(__dirname, "../templates");
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(templateDir, "BeVietnamPro-Regular.ttf")),
    fs.readFile(path.join(templateDir, "BeVietnamPro-Bold.ttf")),
  ]);
  return {
    regular: await pdfDoc.embedFont(regularBytes),
    bold: await pdfDoc.embedFont(boldBytes),
  };
};

const drawPageHeader = (page, report, fonts) => {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 28,
    width: PAGE_WIDTH,
    height: 28,
    color: COLORS.brand,
  });
  page.drawText("HTCOACHING · BÁO CÁO CẢI TIẾN TÍNH NĂNG", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 18,
    size: 10,
    font: fonts.bold,
    color: COLORS.white,
  });
  page.drawText("Báo cáo cải tiến tính năng cộng đồng & khách hàng", {
    x: PAGE_MARGIN,
    y: 535,
    size: 17,
    font: fonts.bold,
    color: COLORS.text,
  });
  const range = report.filters.from
    ? `${formatDateOnly(report.filters.from)} – ${formatDateOnly(report.filters.to)}`
    : "Chưa có lịch sử";
  page.drawText(
    `Kỳ báo cáo: ${range} · ${report.filterLabels.group} · ${report.filterLabels.audience} · ${report.filterLabels.status}`,
    {
      x: PAGE_MARGIN,
      y: 515,
      size: 8.5,
      font: fonts.regular,
      color: COLORS.muted,
    },
  );
  const summary = [
    `Sự kiện: ${report.summary.eventCount}`,
    `Hạng mục: ${report.summary.improvementCount}`,
    `Tính năng: ${report.summary.featureCount}`,
    `Đã xác minh production: ${report.summary.productionVerifiedCount}`,
    `F0 còn mở: ${report.summary.openF0Count}`,
  ].join("   ·   ");
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: 476,
    width: TABLE_WIDTH,
    height: 26,
    color: COLORS.brandSoft,
  });
  page.drawText(summary, {
    x: PAGE_MARGIN + 9,
    y: 485,
    size: 8,
    font: fonts.bold,
    color: COLORS.brand,
  });
};

const drawTableHeader = (page, fonts) => {
  let x = PAGE_MARGIN;
  HEADERS.forEach((header, index) => {
    page.drawRectangle({
      x,
      y: TABLE_TOP,
      width: COLUMN_WIDTHS[index],
      height: HEADER_HEIGHT,
      color: COLORS.brand,
      borderColor: COLORS.white,
      borderWidth: 0.4,
    });
    page.drawText(header, {
      x: x + CELL_PADDING,
      y: TABLE_TOP + 8,
      size: 7.2,
      font: fonts.bold,
      color: COLORS.white,
    });
    x += COLUMN_WIDTHS[index];
  });
  return TABLE_TOP;
};

const buildRowCells = (row) => [
  formatDateOnly(row.statusDate),
  row.featureLabel,
  row.group.label,
  row.priority.code,
  row.opportunity,
  `${row.status.label} — ${row.result}`,
];

const drawTableRow = (page, row, rowIndex, y, fonts) => {
  const cells = buildRowCells(row);
  const wrappedCells = cells.map((cell, index) =>
    wrapText(
      cell,
      fonts.regular,
      BODY_FONT_SIZE,
      COLUMN_WIDTHS[index] - CELL_PADDING * 2,
    ),
  );
  const maxLines = Math.max(...wrappedCells.map((lines) => lines.length));
  const rowHeight = Math.max(25, maxLines * BODY_LINE_HEIGHT + 10);
  let x = PAGE_MARGIN;
  wrappedCells.forEach((lines, index) => {
    page.drawRectangle({
      x,
      y: y - rowHeight,
      width: COLUMN_WIDTHS[index],
      height: rowHeight,
      color: rowIndex % 2 === 0 ? COLORS.white : COLORS.rowAlt,
      borderColor: COLORS.border,
      borderWidth: 0.45,
    });
    drawTextLines(page, lines, fonts.regular, x + CELL_PADDING, y - 13);
    x += COLUMN_WIDTHS[index];
  });
  return rowHeight;
};

export const generateCommunityFeatureReportPdf = async (report) => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("Báo cáo cải tiến tính năng HTCOACHING");
  pdfDoc.setSubject("Lịch sử cải tiến tính năng cộng đồng và khách hàng");
  pdfDoc.setCreator("HTCOACHING");
  const fonts = await loadFonts(pdfDoc);
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageHeader(page, report, fonts);
  let y = drawTableHeader(page, fonts);

  if (report.rows.length === 0) {
    page.drawText("Không có hạng mục cải tiến trong khoảng thời gian đã chọn.", {
      x: PAGE_MARGIN + 8,
      y: y - 24,
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
    });
  } else {
    report.rows.forEach((row, index) => {
      const cells = buildRowCells(row);
      const maxLines = Math.max(
        ...cells.map(
          (cell, cellIndex) =>
            wrapText(
              cell,
              fonts.regular,
              BODY_FONT_SIZE,
              COLUMN_WIDTHS[cellIndex] - CELL_PADDING * 2,
            ).length,
        ),
      );
      const expectedHeight = Math.max(25, maxLines * BODY_LINE_HEIGHT + 10);
      if (y - expectedHeight < TABLE_BOTTOM) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawPageHeader(page, report, fonts);
        y = drawTableHeader(page, fonts);
      }
      y -= drawTableRow(page, row, index, y, fonts);
    });
  }

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawText(
      `Trang ${index + 1}/${pages.length} · Tạo lúc ${generatedAtFormatter.format(new Date(report.generatedAt))}`,
      {
        x: PAGE_MARGIN,
        y: 18,
        size: 7,
        font: fonts.regular,
        color: COLORS.muted,
      },
    );
  });
  return pdfDoc.save();
};
