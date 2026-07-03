# PDF Generation — Skill Guide

> Skill này dành cho AI agent khi cần tạo, chỉnh sửa, hoặc xử lý file PDF trong htcoachingweb.
> Đọc file này trước khi code bất kỳ tính năng nào liên quan đến PDF.

---

## Thư viện chính: pdf-lib (Node.js)

**Lý do chọn:** Native JavaScript, MIT License, chạy trực tiếp trên Express backend, không cần Python hay system dependencies.

```bash
npm install pdf-lib
```

---

## Quick Start

```javascript
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";

// Tạo PDF mới
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([595, 842]); // A4 size (points)
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

page.drawText("Hello HTCOACHING", {
  x: 50,
  y: 800,
  size: 18,
  font,
  color: rgb(0.2, 0.2, 0.8),
});

const pdfBytes = await pdfDoc.save();
fs.writeFileSync("output.pdf", pdfBytes);
```

---

## Các thao tác thường dùng

### 1. Load template PDF + điền text

```javascript
import { PDFDocument, rgb } from "pdf-lib";

async function fillTemplate(templatePath, data) {
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);

  const pages = pdfDoc.getPages();
  const page = pages[0]; // Trang đầu tiên
  const font = await pdfDoc.embedFont("Helvetica");

  // Điền text vào vị trí cụ thể (x, y tính từ góc DƯỚI-TRÁI)
  page.drawText(data.clientName, {
    x: 250,
    y: 620,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  return await pdfDoc.save();
}
```

> **Hệ tọa độ PDF:** Gốc (0,0) ở góc DƯỚI-TRÁI. Y tăng lên trên. Khác với HTML (gốc trên-trái).

### 2. Dán ảnh chữ ký (Base64 → PDF)

```javascript
async function embedSignature(pdfDoc, signatureBase64, page) {
  // Xóa prefix "data:image/png;base64," nếu có
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
  const signatureBytes = Buffer.from(base64Data, "base64");

  // Embed vào PDF
  const signatureImage = await pdfDoc.embedPng(signatureBytes);
  // Hoặc: await pdfDoc.embedJpg(signatureBytes)

  // Tính toán kích thước giữ tỷ lệ
  const dims = signatureImage.scale(0.5); // scale 50%

  page.drawImage(signatureImage, {
    x: 350,     // Vị trí chữ ký Bên B
    y: 100,
    width: dims.width,
    height: dims.height,
  });
}
```

### 3. Merge nhiều PDF

```javascript
async function mergePDFs(pdfPaths) {
  const mergedPdf = await PDFDocument.create();

  for (const path of pdfPaths) {
    const pdfBytes = fs.readFileSync(path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}
```

### 4. Tạo PDF có bảng (table)

```javascript
function drawTable(page, font, data, startX, startY, colWidths, rowHeight) {
  let currentY = startY;

  for (const row of data) {
    let currentX = startX;
    for (let i = 0; i < row.length; i++) {
      // Vẽ ô
      page.drawRectangle({
        x: currentX,
        y: currentY - rowHeight,
        width: colWidths[i],
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });

      // Vẽ text trong ô (padding 5pt)
      page.drawText(String(row[i]), {
        x: currentX + 5,
        y: currentY - rowHeight + 5,
        size: 10,
        font,
      });

      currentX += colWidths[i];
    }
    currentY -= rowHeight;
  }
}
```

### 5. Thêm watermark

```javascript
async function addWatermark(pdfDoc, watermarkText) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont("Helvetica");

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 4,
      y: height / 2,
      size: 60,
      font,
      color: rgb(0.9, 0.9, 0.9),
      rotate: { type: "degrees", angle: 45 },
      opacity: 0.3,
    });
  }
}
```

### 6. Flatten form fields (chống sửa)

```javascript
async function flattenPdf(pdfDoc) {
  const form = pdfDoc.getForm();
  form.flatten(); // Biến form fields thành static content
  return await pdfDoc.save();
}
```

### 7. Hash SHA-256 (đảm bảo tính toàn vẹn)

```javascript
import crypto from "crypto";

function hashPdf(pdfBytes) {
  return crypto.createHash("sha256").update(pdfBytes).digest("hex");
}
```

---

## Xử lý Font tiếng Việt

> [!WARNING]
> **StandardFonts (Helvetica, Times-Roman...)** không hỗ trợ tiếng Việt đầy đủ (thiếu dấu).
> Phải embed font `.ttf` để hiển thị tiếng Việt chính xác.

```javascript
import fontkit from "@pdf-lib/fontkit";

async function createVietnamesePdf() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load font có hỗ trợ tiếng Việt (Roboto, Noto Sans, Be Vietnam Pro...)
  const fontBytes = fs.readFileSync("path/to/Roboto-Regular.ttf");
  const customFont = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage();
  page.drawText("Hợp đồng Dịch vụ Huấn luyện Cá nhân", {
    x: 50,
    y: 780,
    size: 16,
    font: customFont,
  });

  return await pdfDoc.save();
}
```

**Dependencies cần cài:**
```bash
npm install pdf-lib @pdf-lib/fontkit
```

**Font khuyến nghị cho HTCOACHING:**
- **Be Vietnam Pro** — font Việt đẹp, modern
- **Roboto** — Google font phổ biến, hỗ trợ Việt tốt
- **Noto Sans** — coverage ký tự rộng nhất

---

## Page Sizes (points)

| Size | Width × Height (pt) | Dùng cho |
|------|---------------------|----------|
| **A4** | 595 × 842 | Hợp đồng, báo cáo |
| **Letter** | 612 × 792 | Ít dùng ở VN |
| **A5** | 420 × 595 | Biên lai nhỏ |

> 1 inch = 72 points. A4 = 210mm × 297mm.

---

## Patterns cho htcoachingweb

### Pattern 1: Sinh PDF trên API endpoint

```javascript
// contract.controller.js
export const downloadContract = async (req, res) => {
  try {
    const pdfBytes = await contractService.generatePdf(req.params.id);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="hop-dong.pdf"',
      "Content-Length": pdfBytes.length,
    });

    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo PDF" });
  }
};
```

### Pattern 2: Lưu PDF vào MongoDB GridFS

```javascript
import mongoose from "mongoose";

async function savePdfToGridFS(pdfBytes, filename) {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "contracts",
  });

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: "application/pdf",
    });

    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", reject);
    uploadStream.end(Buffer.from(pdfBytes));
  });
}

async function getPdfFromGridFS(fileId) {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "contracts",
  });

  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}
```

### Pattern 3: Stream PDF download từ GridFS

```javascript
export const downloadPdf = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract?.signedPdfFileId) {
      return res.status(404).json({ message: "PDF chưa được tạo" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "contracts",
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hop-dong-${contract._id}.pdf"`,
    });

    const downloadStream = bucket.openDownloadStream(contract.signedPdfFileId);
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tải PDF" });
  }
};
```

---

## Lưu ý quan trọng

### ✅ Nên làm

- **Luôn embed font tiếng Việt** — StandardFonts thiếu dấu
- **Flatten form** sau khi điền → chống sửa đổi
- **Hash SHA-256** file PDF sau khi sinh → lưu DB để đối chiếu
- **Stream response** cho file lớn thay vì load toàn bộ vào memory
- **Validate dữ liệu** trước khi điền vào PDF (tránh overflow)

### ❌ Không nên

- **Không hardcode tọa độ** mà không comment rõ vị trí
- **Không dùng StandardFonts** cho nội dung tiếng Việt
- **Không lưu PDF public** trên Cloudinary — chứa thông tin cá nhân
- **Không `console.log(pdfBytes)`** — sẽ flood terminal
- **Không tạo PDF phía client** — luôn sinh trên server để kiểm soát

### Khi cần thay đổi template PDF

1. Tạo template mới (Canva, Word → PDF, hoặc code)
2. Xác định tọa độ từng field cần điền (dùng tool đo hoặc thử sai)
3. Lưu template vào `server/src/templates/`
4. Cập nhật tọa độ trong service code
5. Test bằng cách sinh PDF và kiểm tra visual

---

## Dependencies

| Package | Version | Dùng cho |
|---------|---------|----------|
| `pdf-lib` | latest | Tạo/sửa/merge PDF |
| `@pdf-lib/fontkit` | latest | Embed custom fonts (tiếng Việt) |

**Không cần (cho scope hiện tại):**
- `pdfjs-dist` — chỉ cần khi render PDF trên browser
- `puppeteer` — overkill, dùng HTML→PDF
- `pdfplumber`, `reportlab` — Python only
