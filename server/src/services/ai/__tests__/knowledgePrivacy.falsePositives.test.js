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

describe("Knowledge privacy false positives: general terms never hide a person", () => {
  it.each([
    "Nguyễn Văn An đang áp dụng Body Recomposition và Progressive Overload.",
    "Khách hàng Trần Thị Bình áp dụng Fat Burner và bị tiểu đường, số điện thoại 0912345678.",
    "Bệnh nhân Lê Hoàng Nam bị HIV, nguồn tham khảo: NASM (National Academy of Sports Medicine).",
    "Tôi tên là Phạm Quốc Huy, sống ở Hà Nội và đang tập Mass Gainer.",
  ])("AC-001/002 still blocks a named person next to a general term: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(false);
  });
});

describe("Knowledge privacy false positives: place and title words after a form of address", () => {
  it.each([
    "Chị Thanh Hóa là khách của mình, đang học gói 3 tháng.",
    "Ms Bikini Open đã ký hợp đồng.",
    "Ông Hoa Kỳ Nguyễn đến phòng tập.",
  ])("F2 still blocks a name that looks like a place or title: %s", (answer) => {
    expect(isValid(answerOf(answer))).toBe(false);
  });

  it("F2 keeps ordinary place mentions valid", () => {
    expect(isValid(answerOf("Giải đấu diễn ra tại Thanh Hóa và Hà Nội, theo hướng dẫn của NASM."))).toBe(true);
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
    ["answer", answerOf("Xem PMID: 41940947 để biết thêm.")],
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
    "Tôi tên là Nguyễn Văn An, bị béo bụng thì nên tập gì?",
    "Em bị béo bụng, số điện thoại của em là 0912345678.",
    "Mình bị thừa cân, email của mình là an.nguyen@example.com.",
    "Tôi sinh ngày 12/03/1990 và bị đau lưng.",
    "Khách hàng Nguyễn Văn An bị huyết áp cao thì tập thế nào?",
    "Học viên Trần Thị Bình bị tiểu đường, số điện thoại 0912345678.",
    "Tôi bị huyết áp cao, liên hệ tôi qua an.nguyen@example.com.",
    "Tôi ở 25 Nguyễn Huệ, quận 1 và bị đau lưng.",
  ])("AC-006 still blocks the same complaint with an identifier: %s", (text) => {
    expect(isValid(variantOf(text))).toBe(false);
  });

  it.each([
    "Kết quả xét nghiệm HbA1c của tôi là 8,2% thì tập thế nào?",
    "Tôi đang uống metformin 500mg mỗi ngày thì tập thế nào?",
    "Bác sĩ chẩn đoán tôi bị suy thận độ 3 vào năm ngoái.",
    "Huyết áp của tôi là 150/95 mmHg thì tập thế nào?",
    "Tôi bị tiểu đường và đang uống thuốc metformin mỗi ngày.",
    "Tôi vừa phẫu thuật tim, bao lâu thì tập lại được?",
    "Tôi bị đau ngực khi tập thì có sao không?",
    "Tôi muốn tự tử.",
  ])("AC-007 still blocks specific medical data tied to a person: %s", (text) => {
    expect(isValid(variantOf(text))).toBe(false);
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
  const blockedEverywhere = [
    // tên riêng đứng sau tiền tố tổ chức
    "Viện Lan bị tiểu đường",
    "Hội Lan bị tiểu đường",
    "Bộ Minh bị cao huyết áp",
    "Báo Hùng có bệnh tim",
    "Cục Hùng bị cao huyết áp",
    "Sở Hoa bị tiểu đường",
    "Trung tâm Hùng bị đau lưng",
    "Trường Minh bị đau lưng",
    "Tổng cục Lan bị tiểu đường",
    "Tạp chí Lan bị tiểu đường",
    "Hiệp hội Lan bị tiểu đường",
    "Viện Lan Anh bị tiểu đường",
    // tên riêng viết thường, có dấu hoặc trùng đại từ
    "Minh bị tiểu đường nên kiêng đường",
    "Minh bị cao huyết áp",
    "Minh bị đau lưng",
    "học viên hùng bị cao huyết áp",
    "khách hàng tên hoa bị tiểu đường",
    "khách hàng minh bị đau gối",
    "lê thị hoa mắc bệnh tiểu đường",
    "Hùng Deadlift bị đau lưng",
    "An toàn bị tiểu đường",
    // người thân
    "Mẹ tôi bị tiểu đường",
    "Vợ tôi bị cao huyết áp",
    "Bố tôi bị đau lưng",
    "Em gái tôi bị tiểu đường",
    "Bạn tôi bị đau lưng",
    // chẩn đoán, sự kiện lâm sàng, nhóm bệnh nhạy cảm
    "I was diagnosed with diabetes",
    "Tôi bị đau lưng, bác sĩ chẩn đoán thoát vị",
    "Tôi bị đau lưng sau khi phẫu thuật",
    "Tôi bị đau lưng sau mổ",
    "Tôi bị đau lưng, vừa mổ thoát vị tuần trước",
    "Tôi bị đau lưng và phải nhập viện",
    "Tôi bị đau lưng, đã khám bác sĩ",
    "Tôi bị đau lưng, đã điều trị vật lý trị liệu",
    "Tôi bị đau lưng, đang điều trị tại bệnh viện",
    "Khách hàng bị đau lưng đã phẫu thuật",
    "I had a heart attack",
    "Tôi bị đau tim",
    "Tôi bị đau thắt ngực",
    "Tôi bị đau đầu dữ dội",
    "Tôi bị ung thư vú giai đoạn 2",
    "Tôi bị HIV",
    "Tôi bị nhiễm HIV dương tính",
    "Tôi bị suy thận",
    "Tôi bị mang thai 12 tuần",
    // số đo và thuốc
    "Tôi bị cao huyết áp, huyết áp của tôi 160/100",
    "Tôi bị đau lưng, uống thuốc Voltaren",
    "Tôi bị đau lưng và uống thuốc paracetamol",
    "Tôi bị cao huyết áp và đang dùng thuốc huyết áp",
    // ngày sinh đi cùng bệnh, thuốc bôi/dán có tên
    "Tôi bị tiểu đường, sinh ngày 12/03/1990",
    "Tôi bị tiểu đường, sinh năm 1990",
    "Tôi bị tiểu đường, 12/03/1990",
    "Tôi bị đau lưng, bôi Salonpas",
    "Tôi bị đau lưng, bôi dầu Salonpas",
    "Tôi bị đau lưng, dán cao Salonpas",
    "Tôi bị đau lưng, dùng Salonpas",
    "Tôi bị đau lưng, bôi Voltaren gel",
    // tự giới thiệu tên
    "Khách hàng bị tiểu đường type 2 tên là An",
  ];

  it.each(blockedEverywhere)("blocks %s in a knowledge entry and in internal retrieval", (text) => {
    expect(isValid(answerOf(text))).toBe(false);
    expect(isValid(variantOf(text))).toBe(false);
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(false);
  });

  it.each([
    "Tôi bị tiểu đường, email a.b@gmail.com",
    "Tôi bị tiểu đường, CCCD 012345678901",
    "Tôi bị tiểu đường, số điện thoại 0912345678",
    "Tôi bị tiểu đường, my phone is 0912345678",
    "Tôi tên là Lan và tôi bị tiểu đường",
  ])("blocks a condition that carries identity in internal retrieval: %s", (text) => {
    expect(prepareKnowledgeRetrievalQuery(text).eligible).toBe(false);
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
