import { describe, expect, it } from "vitest";
import {
  prepareExternalKnowledgeQuery,
  prepareKnowledgeRetrievalQuery,
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
    "Tôi tên là Nguyễn Văn An, bị béo bụng thì nên tập gì?",
    "Em bị béo bụng, số điện thoại của em là 0912345678.",
    "Mình bị thừa cân, email của mình là an.nguyen@example.com.",
    "Tôi sinh ngày 12/03/1990 và bị đau lưng.",
    "Tôi ở 25 Nguyễn Huệ, quận 1 và bị đau lưng.",
  ])("AC-006 still blocks the same complaint with an identifier: %s", (text) => {
    expect(isValid(variantOf(text))).toBe(false);
  });

  it.each([
    "Kết quả xét nghiệm HbA1c của tôi là 8,2% thì tập thế nào?",
    "Tôi đang uống metformin 500mg mỗi ngày thì tập thế nào?",
    "Bác sĩ chẩn đoán tôi bị suy thận độ 3 vào năm ngoái.",
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
