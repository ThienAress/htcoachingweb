import { describe, expect, it } from "vitest";
import mongoose from "mongoose";

import {
  buildConversationKnowledgeSource,
  getPublicPersonLookupNames,
  isCallerVettedPublicDateOfBirth,
  prepareExternalKnowledgeQuery,
  validateKnowledgeEntryPrivacy,
  prepareKnowledgeRetrievalQuery,
  prepareKnowledgeSuggestionPair,
} from "../knowledgePrivacy.js";

const message = (role, content, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  role,
  content,
  timestamp: new Date("2026-09-12T01:00:00.000Z"),
  ...overrides,
});

const privateRecordHealthCases = [
  "Học viên nam đang điều trị ung thư nên tập gì?",
  "client john is receiving cancer treatment and needs exercise",
  "khách hàng lan đang uống insulin",
  "học viên nam có BMI 31 và body fat 35%",
  "học viên nam đường huyết 250",
  "khách hàng nam nhịp tim 190",
  "khách hàng mai đang dùng metformin và muốn tìm bài tập mới nhất",
  "học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
  "học viên Lan được kê Ozempic, nên tập cardio thế nào?",
  "client Jane uses warfarin and wants a workout",
  "client Jane is on warfarin and wants a workout",
  "client Jane was given lithium and wants exercise advice",
  "khách hàng An đang tiêm semaglutide, tìm nghiên cứu mới nhất",
  "client jane is receiving chemotherapy and needs a workout",
  "học viên nam HbA1c 9% nên tập gì",
  "học viên An có VO2max 28 ml/kg/min",
  "học viên Lan: VO2max 28 ml/kg/min, nên tập gì?",
  "khách hàng An có creatinine 2.1 mg/dL",
  "kết quả creatinine của khách hàng An là 2.1 mg/dL",
  "client Jane has SpO2 88% and wants cardio advice",
  "SpO2 của client Jane là 88%, latest research nói gì?",
  "khách hàng mai có cholesterol 280 mg/dL",
];

describe("Knowledge Base conversation privacy boundary", () => {
  it.each([
    "I have diabetes and weigh 80kg, what should I do?",
    "Tôi bị HIV, nên tập thế nào?",
    "Khách hàng Nguyễn Văn A bị HIV, hãy tra cứu giúp tôi",
    "Client John Doe has HIV and needs a workout plan",
    "Patient John Doe has diabetes and weighs 80kg",
    "She has HIV and weighs 52kg",
    "Nguyễn Văn A bị hen suyễn, nên tập thế nào?",
    "My blood pressure is 160/100, what should I do?",
    "I have cancer, which exercises are safe?",
    "Tôi bị viêm khớp dạng thấp, nên tập gì?",
    "Tôi bị thoát vị đĩa đệm, nên tập gì?",
    "Tôi vừa mổ dây chằng, nên tập gì?",
    "Tôi bị loãng xương, nên tập gì?",
    "Tôi đang khó thở",
    "Tôi vừa ngất xỉu",
    "I want to kill myself",
    "I am going to hurt myself",
    "Sau buổi tập tôi đang đau ngực và khó thở",
    "Người bên cạnh tôi đang đau ngực",
    "Một người vừa ngất xỉu trước mặt tôi",
    "Tôi sẽ tự sát tối nay",
    "I am going to end my life tonight",
  ])("blocks personal health text before external processing: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each(privateRecordHealthCases)(
    "fails closed for an explicit private health record before external search: %s",
    (query) => {
      expect(prepareExternalKnowledgeQuery(query)).toEqual({
        eligible: false,
        reason: "sensitive_personal_health",
      });
    },
  );

  it.each([
    "doctor prescribed me warfarin",
    "bác sĩ kê Ozempic cho tôi",
    "tôi được bác sĩ kê Ozempic",
  ])("blocks clinician-prescribed medication before external processing: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each(privateRecordHealthCases)(
    "fails closed for an explicit private health record before AI Suggest: %s",
    (content) => {
      const prepared = prepareKnowledgeSuggestionPair({
        conversationId: new mongoose.Types.ObjectId(),
        question: message("user", content),
        answer: message("assistant", "Synthetic personalized health answer."),
        questionIndex: 0,
        answerIndex: 1,
      });

      expect(prepared).toEqual({
        eligible: false,
        reason: "sensitive_personal_health",
      });
    },
  );

  it.each([
    "Tôi bị PCOS và muốn có lịch tập phù hợp",
    "Tôi được chẩn đoán PCOS và cần lịch tập",
    "Tôi bị buồng trứng đa nang và cần lịch tập",
    "Tôi bị đa nang buồng trứng và cần lịch tập",
    "I have polycystic ovarian syndrome and need exercise advice",
    "Tôi có câu hỏi: tôi bị PCOS thì tập gì?",
    "my friend bob who tore his ACL",
    "my son who is autistic",
    "my kid with covid",
    "I have migraine",
    "I take prednisone",
    "client Bob has epilepsy",
    "Tôi sinh ngày 01/02/1990 và muốn có lịch tập phù hợp",
    "Ngày sinh của tôi: 01/02/1990",
    "DOB: 01/02/1990",
    "Date of birth: 1990-02-01",
    "Tôi sinh vào ngày 01/02/1990",
    "Ngày sinh của khách hàng Lan là 01/02/1990",
    "bob was born on 1990-01-01",
  ])("keeps raw PHI and birth dates out of every knowledge sink: %s", (content) => {
    const suggestion = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Đây là hướng dẫn tổng quát."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect({
      external: prepareExternalKnowledgeQuery(content),
      retrieval: prepareKnowledgeRetrievalQuery(content),
      suggestion,
    }).toEqual({
      external: { eligible: false, reason: "sensitive_personal_health" },
      retrieval: { eligible: false, reason: "sensitive_personal_health" },
      suggestion: { eligible: false, reason: "sensitive_personal_health" },
    });
  });

  it("allows a caller-vetted public DOB only at the external search boundary", () => {
    const content = "Cầu thủ Cristiano Ronaldo DOB 1985-02-05";
    const allowedPublicPersonNames = getPublicPersonLookupNames(content);
    const suggestion = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Đây là ngày sinh công khai."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect({
      allowedPublicPersonNames: ["Cristiano Ronaldo"],
      external: prepareExternalKnowledgeQuery(content, {
        allowedPublicPersonNames,
      }),
      retrieval: prepareKnowledgeRetrievalQuery(content),
      suggestion,
    }).toEqual({
      allowedPublicPersonNames,
      external: { eligible: true, query: content, redacted: false },
      retrieval: { eligible: false, reason: "sensitive_personal_health" },
      suggestion: { eligible: false, reason: "sensitive_personal_health" },
    });
  });

  it.each([
    "Cristiano Ronaldo DOB is 1985-02-05, verify it",
    "When was Cristiano Ronaldo born?",
  ])("binds the exact full name when it contains a vetted public alias: %s", (content) => {
    expect(getPublicPersonLookupNames(content)).toEqual([
      "Cristiano Ronaldo",
    ]);
  });

  it("binds a public DOB exemption to the exact caller-vetted full name", () => {
    const content = "Cristiano Ronaldo DOB is 1985-02-05, verify it";
    expect(
      prepareExternalKnowledgeQuery(content, {
        allowedPublicPersonNames: ["Cristiano Ronaldo"],
      }),
    ).toEqual({
      eligible: true,
      query: content,
      redacted: false,
    });
  });

  it("allows a caller-vetted public DOB question without a disclosed date", () => {
    const content = "When was Cristiano Ronaldo born?";
    const allowedPublicPersonNames = getPublicPersonLookupNames(content);

    expect(
      prepareExternalKnowledgeQuery(content, { allowedPublicPersonNames }),
    ).toEqual({
      eligible: true,
      query: content,
      redacted: false,
    });
  });

  it.each([
    "When was Cristiano Ronaldo born? Bob likes running",
    "When was Cristiano Ronaldo born? and Bob born?",
    "When was Cristiano Ronaldo born? John Smith is nearby",
  ])("does not exempt another unbound name alongside a public DOB question: %s", (query) => {
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toEqual({ eligible: false, reason: "ambiguous_person_identity" });
  });

  it("validates every numeric birth fact against its exact public-person clause", () => {
    expect({
      bound: isCallerVettedPublicDateOfBirth(
        "Cristiano Ronaldo DOB is 1985-02-05, verify it",
        ["Cristiano Ronaldo"],
      ),
      unrelated: isCallerVettedPublicDateOfBirth(
        "Ronaldo was born in Portugal; DOB: 01/02/1990",
        ["Ronaldo"],
      ),
      mixedDob: isCallerVettedPublicDateOfBirth(
        "Ronaldo DOB is 1985-02-05 and bob DOB is 1990-01-01, verify both",
        ["Ronaldo"],
      ),
      mixedBorn: isCallerVettedPublicDateOfBirth(
        "Ronaldo was born on 1985-02-05 and bob was born on 1990-01-01",
        ["Ronaldo"],
      ),
    }).toEqual({
      bound: true,
      unrelated: false,
      mixedDob: false,
      mixedBorn: false,
    });
  });

  it.each([
    "Ronaldo DOB is 1985-02-05 and bob DOB is 1990-01-01, verify both",
    "Cầu thủ Cristiano Ronaldo DOB 1985-02-05; DOB: 1990-01-01",
    "Ronaldo was born on 1985-02-05 and bob was born on 1990-01-01",
  ])(
    "blocks a mixed public and unbound birth-date query before external search: %s",
    (content) => {
      expect(
        prepareExternalKnowledgeQuery(content, {
          allowedPublicPersonNames: ["Ronaldo", "Cristiano Ronaldo"],
        }),
      ).toEqual({
        eligible: false,
        reason: "sensitive_personal_health",
      });
    },
  );

  it.each([
    "Ronaldo DOB is 1985-02-05; bob has epilepsy",
    "Ronaldo DOB is 1985-02-05; bob takes prednisone",
    "Ronaldo DOB is 1985-02-05; HbA1c 9%",
    "Ronaldo DOB is 1985-02-05; migraine",
  ])(
    "does not let a vetted public DOB exempt other health data: %s",
    (content) => {
      expect({
        publicDobSafe: isCallerVettedPublicDateOfBirth(content, ["Ronaldo"]),
        external: prepareExternalKnowledgeQuery(content, {
          allowedPublicPersonNames: ["Ronaldo"],
        }),
      }).toEqual({
        publicDobSafe: false,
        external: {
          eligible: false,
          reason: "sensitive_personal_health",
        },
      });
    },
  );

  it("blocks a public-looking DOB when the caller did not vet the identity", () => {
    expect(
      prepareExternalKnowledgeQuery(
        "Cầu thủ Cristiano Ronaldo DOB 1985-02-05",
      ),
    ).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it("does not use an unrelated public name to exempt an unbound DOB", () => {
    expect(
      prepareExternalKnowledgeQuery(
        "Ronaldo routine. DOB: 01/02/1990",
        { allowedPublicPersonNames: ["Ronaldo"] },
      ),
    ).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it("keeps a private Lisa DOB blocked even when Lisa is passed in the allowlist", () => {
    const content = "Lisa học viên của tôi DOB: 27/03/1997";
    expect(
      prepareExternalKnowledgeQuery(content, {
        allowedPublicPersonNames: ["Lisa"],
      }),
    ).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([
    "current workout recommendation for bob",
    "latest routine for my friend mai",
  ])(
    "fails closed for a time-sensitive request about a private person: %s",
    (content) => {
      const suggestion = prepareKnowledgeSuggestionPair({
        conversationId: new mongoose.Types.ObjectId(),
        question: message("user", content),
        answer: message("assistant", "Synthetic general answer."),
        questionIndex: 0,
        answerIndex: 1,
      });

      expect({
        external: prepareExternalKnowledgeQuery(content),
        retrieval: prepareKnowledgeRetrievalQuery(content),
        suggestion,
      }).toEqual({
        external: { eligible: false, reason: "ambiguous_person_identity" },
        retrieval: { eligible: false, reason: "ambiguous_person_identity" },
        suggestion: { eligible: false, reason: "ambiguous_person_identity" },
      });
    },
  );

  it("keeps a time-sensitive query for a generic audience eligible", () => {
    expect(
      prepareExternalKnowledgeQuery("latest workout recommendations for beginners"),
    ).toMatchObject({ eligible: true });
  });

  it.each([
    "Bài tập cho người mới",
    "How to squat",
    "Latest mobility routine for beginners",
    "Workout plan for fat loss",
    "Workout plan for push pull legs",
    "Workout plan for lower back",
    "Exercise for office workers",
    "What exercise should my client do?",
    "Lịch tập của PPL",
    "Lịch tập cho nam",
    "Lịch tập cho nữ",
    "Thực đơn cho tăng cơ",
    "Thực đơn cho giảm mỡ",
    "Deadlift cho posterior chain",
    "Nghiên cứu mới nhất về creatine cho sức mạnh",
    "Nguồn mới nhất về whey cho tăng cơ",
    "Bài tập cho runner",
    "Bài tập cho dân chạy bộ",
  ])("does not mistake a clear non-person recipient for a private identity: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toMatchObject({
      eligible: true,
      redacted: false,
    });
  });

  it.each([
    "Ronaldo routine cho sức mạnh",
    "Ronaldo workout for explosive power",
    "Ronaldo routine for football",
  ])("keeps a public-person query eligible when the recipient is a fitness goal: %s", (query) => {
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toMatchObject({ eligible: true, redacted: false });
  });

  it("blocks model-composed private identity and body metrics at the external sink", () => {
    const privateMetrics =
      "ronaldo official workout advice for hoang thien 170cm 80kg";
    const privateRecipient = "ronaldo routine sources for bob";

    expect({
      privateMetrics: prepareExternalKnowledgeQuery(privateMetrics, {
        allowedPublicPersonNames: ["Ronaldo"],
      }),
      privateRecipient: prepareExternalKnowledgeQuery(privateRecipient, {
        allowedPublicPersonNames: ["Ronaldo"],
      }),
      metricsRetrieval: prepareKnowledgeRetrievalQuery(privateMetrics),
      recipientRetrieval: prepareKnowledgeRetrievalQuery(privateRecipient),
    }).toMatchObject({
      privateMetrics: {
        eligible: false,
        reason: "sensitive_personal_health",
      },
      privateRecipient: {
        eligible: false,
        reason: "ambiguous_person_identity",
      },
      metricsRetrieval: {
        eligible: false,
        reason: "sensitive_personal_health",
      },
      recipientRetrieval: { eligible: true, redacted: true },
    });
    expect(prepareKnowledgeRetrievalQuery(privateRecipient).query).not.toMatch(
      /\bbob\b/iu,
    );
  });

  it.each([
    "PCOS là gì?",
    "Hội chứng buồng trứng đa nang ảnh hưởng việc tập luyện thế nào?",
    "Tôi có câu hỏi: PCOS là gì?",
    "Tôi có thắc mắc về PCOS",
    "What is an ACL tear?",
    "What does autistic mean?",
    "What is COVID?",
    "What is migraine?",
    "What is prednisone used for?",
    "What is epilepsy?",
    "Lịch tập ngày 01/02/2027: squat 3 hiệp x 10 reps với 80kg",
    "Lịch thi đấu ngày 01/02/2027",
  ])("keeps non-personal health education and fitness dates eligible: %s", (content) => {
    const suggestion = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Đây là thông tin tổng quát."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect({
      externalEligible: prepareExternalKnowledgeQuery(content).eligible,
      retrievalEligible: prepareKnowledgeRetrievalQuery(content).eligible,
      suggestionEligible: suggestion.eligible,
    }).toEqual({
      externalEligible: true,
      retrievalEligible: true,
      suggestionEligible: true,
    });
  });

  it("excludes a downvoted assistant answer before provider preparation", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "Creatine có tác dụng gì?"),
      answer: message("assistant", "Một câu trả lời sai.", { feedback: "down" }),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toEqual({ eligible: false, reason: "downvoted" });
  });

  it("drops personal health and body-metric pairs instead of sending them to a provider", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message(
        "user",
        "Tôi đang đau đầu gối sau phẫu thuật, nặng 74kg và đang uống thuốc; nên tập gì?",
      ),
      answer: message("assistant", "Bạn nên trao đổi với bác sĩ điều trị."),
      questionIndex: 2,
      answerIndex: 3,
    });

    expect(prepared).toEqual({ eligible: false, reason: "sensitive_personal_health" });
  });

  it.each([
    "Tôi bị viêm khớp dạng thấp, nên tập gì?",
    "Tôi bị thoát vị đĩa đệm, nên tập gì?",
    "Tôi vừa mổ dây chằng, nên tập gì?",
    "Tôi bị loãng xương, nên tập gì?",
  ])("drops structurally personal medical disclosures before AI Suggest: %s", (content) => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Đây là câu trả lời sức khỏe cá nhân tổng hợp."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([
    "Client John Doe has HIV and needs a workout plan",
    "Patient John Doe has diabetes and weighs 80kg",
    "She has HIV and weighs 52kg",
    "Nguyễn Văn A bị hen suyễn, nên tập thế nào?",
    "My blood pressure is 160/100, what should I do?",
    "I have cancer, which exercises are safe?",
  ])("does not mine common English or Vietnamese health records: %s", (content) => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Synthetic personalized health answer."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it("redacts direct identifiers from an otherwise reusable fitness pair", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message(
        "user",
        "Gửi hướng dẫn squat cho email lan@example.com hoặc số 0912 345 678 nhé",
      ),
      answer: message(
        "assistant",
        "Bạn có thể xem hướng dẫn chung; không cần gửi tới lan@example.com.",
      ),
      questionIndex: 4,
      answerIndex: 5,
    });

    expect(prepared.eligible).toBe(true);
    expect(prepared.redacted).toBe(true);
    expect(`${prepared.question} ${prepared.answer}`).not.toMatch(
      /lan@example\.com|0912\s*345\s*678/i,
    );
  });

  it.each([
    "Khách hàng Nguyễn Văn An muốn giảm cân an toàn",
    "Học viên Trần Thị Mai hỏi cách squat",
    "Tôi là Nguyễn Văn An và muốn hỏi cách deadlift",
  ])("redacts a private person's name from reusable text: %s", (content) => {
    const prepared = prepareExternalKnowledgeQuery(content);

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toMatch(/Nguyễn Văn An|Trần Thị Mai/u);
  });

  it.each([
    ["Khách hàng Nam hỏi cách squat", /\bNam\b/u],
    ["khách hàng nam hỏi cách squat", /\bnam\b/u],
    ["khách hàng nguyễn văn an hỏi cách squat", /nguyễn văn an/iu],
    ["client john doe asks about squat", /john doe/iu],
  ])("redacts a one-word or lowercase contextual name: %s", (content, name) => {
    const prepared = prepareExternalKnowledgeQuery(content);

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toMatch(name);
    expect(prepared.query).toContain("[đã ẩn tên]");
  });

  it("redacts a lowercase contextual name case-insensitively on both sides of AI Suggest", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "khách hàng nguyễn văn an hỏi cách squat"),
      answer: message("assistant", "Nguyễn Văn An nên bắt đầu bằng kỹ thuật chung."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toMatch(/nguyễn văn an/iu);
  });

  it("redacts contextual private names from both sides of a suggestion pair", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "Học viên Trần Thị Mai hỏi cách squat"),
      answer: message("assistant", "Trần Thị Mai nên bắt đầu bằng kỹ thuật chung."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toContain("Trần Thị Mai");
  });

  it.each([
    "Tôi hỏi nghiên cứu gần đây về squat",
    "Học viên Trần Thị Mai nên bắt đầu bằng kỹ thuật squat cơ bản",
    "Học viên nam đang uống whey và dùng dây kháng lực",
    "Đây là lần đầu tôi tập deadlift",
    "học viên Lan tập RPE8 với 100kg",
    "tôi deadlift 100kg ở RPE8",
  ])("does not treat ordinary Vietnamese homophones as health data: %s", (content) => {
    expect(prepareExternalKnowledgeQuery(content)).toMatchObject({
      eligible: true,
    });
  });

  it("keeps immutable IDs, indices and hashes without copying raw text into provenance", () => {
    const conversationId = new mongoose.Types.ObjectId();
    const question = message("user", "Cách squat đúng?");
    const answer = message("assistant", "Giữ cột sống trung lập và kiểm soát biên độ.");
    const source = buildConversationKnowledgeSource({
      conversationId,
      question,
      answer,
      questionIndex: 6,
      answerIndex: 7,
      capturedAt: new Date("2026-09-12T02:00:00.000Z"),
    });

    expect(source).toMatchObject({
      conversationId,
      questionMessageId: question._id,
      answerMessageId: answer._id,
      questionIndex: 6,
      answerIndex: 7,
      messageIndex: 6,
    });
    expect(source.questionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(source.answerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(source)).not.toContain(question.content);
    expect(JSON.stringify(source)).not.toContain(answer.content);
  });

  it("blocks a personal health profile before an external search provider", () => {
    expect(
      prepareExternalKnowledgeQuery(
        "Tôi đau đầu gối sau phẫu thuật, nặng 74kg và đang uống thuốc; nên tập gì?",
      ),
    ).toEqual({ eligible: false, reason: "sensitive_personal_health" });
  });

  it("redacts direct identifiers from an otherwise safe external search query", () => {
    const query = "Ronaldo thường tập gì? gửi kết quả cho lan@example.com";
    const prepared = prepareExternalKnowledgeQuery(query, {
      allowedPublicPersonNames: getPublicPersonLookupNames(query),
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toContain("lan@example.com");
    expect(prepared.query).toContain("Ronaldo");
  });

  it("redacts an English self-disclosed address before every reusable query sink", () => {
    const query = "my address is 12 main street hanoi; show me a squat guide";
    const external = prepareExternalKnowledgeQuery(query);
    const retrieval = prepareKnowledgeRetrievalQuery(query);
    const suggestion = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", query),
      answer: message("assistant", "Use a general squat progression."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect({
      externalProtected:
        external.eligible &&
        external.redacted === true &&
        !external.query.includes("12 main street hanoi"),
      retrievalProtected:
        retrieval.eligible &&
        retrieval.redacted === true &&
        !retrieval.query.includes("12 main street hanoi"),
      suggestionProtected:
        suggestion.eligible &&
        suggestion.redacted === true &&
        !`${suggestion.question} ${suggestion.answer}`.includes(
          "12 main street hanoi",
        ),
    }).toEqual({
      externalProtected: true,
      retrievalProtected: true,
      suggestionProtected: true,
    });
  });

  it.each([
    "Nguyễn Văn A thường tập bài gì?",
    "John Smith thường tập bài gì?",
    "Nguyễn Văn A tập giống Cristiano Ronaldo thế nào?",
  ])("fails closed before searching for an unbound private-looking name: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
  });

  it("redacts an international phone number before external search", () => {
    const prepared = prepareExternalKnowledgeQuery(
      "Tìm nguồn bài tập rồi gửi cho số +1 415 555 1234",
    );

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toContain("+1 415 555 1234");
  });

  it("redacts an unbound private-looking name from both sides of a reusable pair", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "Nguyễn Văn A thường tập bài gì?"),
      answer: message("assistant", "Nguyễn Văn A có thể bắt đầu bằng squat."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toContain("Nguyễn Văn A");
  });

  it("redacts a private name without removing a recognized public name from a reusable pair", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message(
        "user",
        "Nguyễn Văn A tập giống Cristiano Ronaldo thế nào?",
      ),
      answer: message(
        "assistant",
        "Nguyễn Văn A không nên sao chép nguyên giáo án của Cristiano Ronaldo.",
      ),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toContain("Nguyễn Văn A");
    expect(`${prepared.question} ${prepared.answer}`).toContain("Cristiano Ronaldo");
  });

  it("does not let an assistant answer promote a private name to public identity", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "Nguyễn Văn An muốn tập squat"),
      answer: message(
        "assistant",
        "Vận động viên Nguyễn Văn An nên bắt đầu bằng kỹ thuật chung.",
      ),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toContain(
      "Nguyễn Văn An",
    );
  });

  it("keeps a public identity established by the original user question", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message(
        "user",
        "Vận động viên Cristiano Ronaldo thường tập gì?",
      ),
      answer: message(
        "assistant",
        "Cristiano Ronaldo có thay đổi giáo án theo từng giai đoạn.",
      ),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: false });
    expect(`${prepared.question} ${prepared.answer}`).toContain(
      "Cristiano Ronaldo",
    );
  });

  it.each([
    "Ca sĩ Taylor Swift tập gì?",
    "Nhà thơ Nguyễn Du có thói quen gì?",
  ])("allows an explicitly public person supplied from the raw request: %s", (query) => {
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toMatchObject({ eligible: true });
  });

  it.each([
    ["Taylor Swift đang lưu diễn ở đâu?", "Taylor Swift"],
    ["Kylian Mbappé chơi cho CLB nào?", "Kylian Mbappé"],
  ])(
    "binds a capitalized full name when the predicate is exclusive to a public figure: %s",
    (query, expectedName) => {
      const allowedPublicPersonNames = getPublicPersonLookupNames(query);
      expect({
        allowedPublicPersonNames,
        prepared: prepareExternalKnowledgeQuery(query, {
          allowedPublicPersonNames,
        }),
      }).toEqual({
        allowedPublicPersonNames: [expectedName],
        prepared: { eligible: true, query, redacted: false },
      });
    },
  );

  it("does not treat a clearly non-name phrase as a private identity", () => {
    expect(prepareExternalKnowledgeQuery("Tìm Nguồn fitness mới nhất")).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    "Thời tiết Hà Nội hôm nay thế nào?",
    "Du lịch New York cần chuẩn bị gì?",
    "Tìm phòng gym ở Hà Nội",
    "Lịch thi đấu Real Madrid",
  ])("allows a proper noun in a clear location or sports-team context: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toMatchObject({
      eligible: true,
      redacted: false,
    });
  });

  it.each([
    "Vận động viên Chris Bumstead thường tập gì?",
    "Vận động viên LeBron James tập gym như thế nào?",
    "Ca sĩ Taylor Swift tập gì?",
    "Vận động viên Serena Williams thường tập gì?",
    "Vận động viên Michael Phelps có routine nào?",
    "Vận động viên Novak Djokovic tập gym như thế nào?",
  ])("allows an explicitly public-person lookup without a global name allowlist: %s", (query) => {
    const allowedPublicPersonNames = getPublicPersonLookupNames(query);
    expect(allowedPublicPersonNames).toHaveLength(1);
    expect(
      prepareExternalKnowledgeQuery(query, { allowedPublicPersonNames }),
    ).toMatchObject({
      eligible: true,
      redacted: false,
    });
  });

  it.each([
    ["Nguyễn Văn An thường tập bài gì?", "ambiguous_person_identity"],
    ["John Smith thường tập bài gì?", "ambiguous_person_identity"],
    ["Trần Thị Mai bị chấn thương gì?", "sensitive_personal_health"],
    ["Chris Bumstead thường tập gì?", "ambiguous_person_identity"],
  ])("does not auto-bind an ambiguous capitalized name as a public person: %s", (query, reason) => {
    expect(getPublicPersonLookupNames(query)).toEqual([]);
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason,
    });
  });

  it.each([
    "Mai thường tập gì?",
    "Nam bị chấn thương gì?",
  ])("fails closed before web search for an ambiguous one-word name: %s", (query) => {
    expect(getPublicPersonLookupNames(query)).toEqual([]);
    expect(prepareExternalKnowledgeQuery(query).eligible).toBe(false);
  });

  it.each([
    "Ronaldo thường tập gì?",
    "Lisa thường tập gì?",
    "ronaldo thường tập gì?",
    "LISA thường tập gì?",
  ])("keeps a vetted public mononym available for sourced lookup: %s", (query) => {
    expect(getPublicPersonLookupNames(query)).toHaveLength(1);
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toMatchObject({ eligible: true, redacted: false });
  });

  it.each([
    "Ronaldo thường tập gì?",
    "ronaldo thường tập gì?",
    "lisa thường tập gì?",
    "Vận động viên Chris Bumstead thường tập gì?",
  ])("does not trust a public-person name inferred from a model/tool query: %s", (query) => {
    expect(getPublicPersonLookupNames(query).length).toBeGreaterThan(0);
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
  });

  it("redacts an ambiguous one-word name before Gemini embedding", () => {
    const prepared = prepareKnowledgeRetrievalQuery(
      "Mai muốn hỏi cách squat đúng?",
    );

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toMatch(/\bMai\b/u);
  });

  it.each([
    "Cho Mai một bài tập vai",
    "Mai ơi, tập squat thế nào?",
    "Kế hoạch tập cho Nam",
    "What workout suits Mai today?",
    "Lịch tập của Mai hôm nay thế nào?",
    "Bài tập phù hợp với Đức?",
    "Gửi bài tập cho (Đức).",
  ])("redacts an ambiguous one-word name anywhere in a retrieval query: %s", (query) => {
    const prepared = prepareKnowledgeRetrievalQuery(query);

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).not.toMatch(
      /(?<![\p{L}\p{N}_])(?:Mai|Nam|Đức)(?![\p{L}\p{N}_])/u,
    );
  });

  it("keeps the Vietnamese sentence starter while redacting the possessive name", () => {
    const prepared = prepareKnowledgeRetrievalQuery(
      "Lịch tập của Mai hôm nay thế nào?",
    );

    expect(prepared.query).toContain("Lịch tập của [đã ẩn tên]");
  });

  it("does not treat a possessive private Lisa reference as a public mononym", () => {
    const query = "Lisa của tôi tập gì?";

    expect(getPublicPersonLookupNames(query)).toEqual([]);
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
    expect(prepareKnowledgeRetrievalQuery(query)).toMatchObject({
      eligible: true,
      redacted: true,
    });
    expect(prepareKnowledgeRetrievalQuery(query).query).not.toContain("Lisa");
  });

  it("redacts an ambiguous one-word name from both sides of AI Suggest", () => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", "Nam cần bài tập phục hồi vai"),
      answer: message("assistant", "Nam nên bắt đầu bằng bài tập chung."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toMatch(/\bNam\b/u);
  });

  it.each([
    "Cho Mai một bài tập vai",
    "Mai ơi, tập squat thế nào?",
    "Kế hoạch tập cho Nam",
    "What workout suits Mai today?",
    "Gửi bài tập cho (Đức).",
    "Lisa của tôi tập gì?",
  ])("redacts a displaced one-word private name from AI Suggest: %s", (content) => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", "Mai và Nam nên dùng hướng dẫn chung."),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toMatch(
      /(?<![\p{L}\p{N}_])(?:Mai|Nam|Đức|Lisa)(?![\p{L}\p{N}_])/u,
    );
  });

  it.each([
    "Tôi bị sốt 39 độ sau khi tập",
    "I have a fever after training",
    "Liều warfarin của tôi là 5mg",
    "I am on Ozempic and need exercise advice",
    "I have chest pain after squat and want swimming stroke tips",
  ])("blocks common personal-health wording before external or embedding sinks: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
    expect(prepareKnowledgeRetrievalQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([
    "I have multiple sclerosis, latest exercise advice",
    "I have eczema, what is the latest workout guidance?",
    "I take levothyroxine, current exercise recommendations",
    "my friend has lupus, latest fitness advice",
    "I have Crohn disease, latest exercise research",
    "My doctor put me on levothyroxine, latest exercise advice",
    "I am allergic to latex, latest workout advice",
    "I have narcolepsy, what changed recently?",
    "My friend has Hashimotos, what changed recently?",
    "I am on methotrexate, latest research?",
    "I'm on methotrexate, latest research?",
    "My friend is on methotrexate, latest research?",
  ])("blocks unlisted structural health assertions at every retrieval sink: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
    expect(prepareKnowledgeRetrievalQuery(query)).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
    const suggestion = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", query),
      answer: message("assistant", "General answer"),
      questionIndex: 0,
      answerIndex: 1,
    });
    expect(suggestion).toEqual({
      eligible: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([
    "Du lịch New York cùng John Smith",
    "Lịch thi đấu Real Madrid cho Nguyễn Văn A",
  ])("still blocks an unbound private-looking name beside a non-person entity: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
  });

  it("does not redact an explicitly public-person claim", () => {
    const query = "Cầu thủ Cristiano Ronaldo thường tập gì?";
    const prepared = prepareExternalKnowledgeQuery(query, {
      allowedPublicPersonNames: getPublicPersonLookupNames(query),
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: false });
    expect(prepared.query).toContain("Cristiano Ronaldo");
  });

  it("does not treat an explicitly public-person injury claim as a private health record", () => {
    const query = "Cầu thủ Cristiano Ronaldo bị chấn thương gì?";
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toMatchObject({ eligible: true, redacted: false });
  });

  it("does not let a public-person clause exempt a distinct private diagnosis", () => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Cầu thủ Ronaldo thường tập gì?",
        answer: "Ronaldo trains. zoraqx quux was diagnosed with lupus",
      }),
    ).toEqual({
      valid: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([", ", " and ", " và ", " but ", " nhưng ", " — ", " / ", " | "])(
    "keeps a private diagnosis isolated across the natural separator %j",
    (separator) => {
      expect(
        validateKnowledgeEntryPrivacy({
          question: "Cầu thủ Ronaldo thường tập gì?",
          answer: `Ronaldo trains${separator}zoraqx quux was diagnosed with lupus`,
        }),
      ).toEqual({
        valid: false,
        reason: "sensitive_personal_health",
      });
    },
  );

  it.each([" while ", " because "])(
    "blocks a distinct private diagnosis after the connector %j",
    (connector) => {
      expect(
        validateKnowledgeEntryPrivacy({
          question: "Cầu thủ Ronaldo thường tập gì?",
          answer: `Ronaldo trains${connector}zoraqx quux was diagnosed with lupus`,
        }),
      ).toEqual({
        valid: false,
        reason: "sensitive_personal_health",
      });
    },
  );

  it.each([
    "Ronaldo says zoraqx quux who has lupus",
    "Ronaldo trains with zoraqx quux that has lupus",
  ])("blocks a distinct private health subject in a relative clause: %s", (answer) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Cầu thủ Ronaldo thường tập gì?",
        answer,
      }),
    ).toEqual({
      valid: false,
      reason: "sensitive_personal_health",
    });
  });

  it.each([
    "ronaldo smith has lupus",
    "ronaldo zoraqx was diagnosed with lupus",
    "zoraqx ronaldo has lupus",
  ])("does not extend a vetted public alias to a different health subject: %s", (answer) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Cầu thủ Ronaldo thường tập gì?",
        answer,
      }),
    ).toEqual({
      valid: false,
      reason: "sensitive_personal_health",
    });
  });

  it("never binds a client or patient label as a public-person lookup", () => {
    expect(getPublicPersonLookupNames("khách hàng Taylor Swift đang dùng metformin"))
      .toEqual([]);
  });

  it.each([
    "My friend Lisa Brown was born when?",
    "My friend Ronaldo Smith was born when?",
    "Lisa Brown is my friend, when was she born?",
  ])(
    "does not elevate a private relation merely because its name contains a public alias: %s",
    (query) => {
      const allowedPublicPersonNames = getPublicPersonLookupNames(query);

      expect({
        allowedPublicPersonNames,
        external: prepareExternalKnowledgeQuery(query, {
          allowedPublicPersonNames,
        }),
      }).toEqual({
        allowedPublicPersonNames: [],
        external: {
          eligible: false,
          reason: "ambiguous_person_identity",
        },
      });
    },
  );

  it.each([
    "latest exercise studies for me, my name is zoraqx",
    "nghiên cứu mới nhất về squat cho tôi, tôi tên là zoraqx",
    "latest exercise studies for me, my name is user_7f31",
  ])("redacts an explicit lowercase name or account handle before web search: %s", (query) => {
    const prepared = prepareExternalKnowledgeQuery(query);

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).toContain("[đã ẩn tên]");
    expect(prepared.query).not.toMatch(/zoraqx|user_7f31/iu);
  });

  it.each([
    "latest exercise research for passport A1234567",
    "current workout advice for account ID user_7f31",
    "latest creatine sources for member code HT-9382A",
  ])("redacts a labeled identifier before web search: %s", (query) => {
    const prepared = prepareExternalKnowledgeQuery(query);

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(prepared.query).toContain("[đã ẩn mã định danh]");
    expect(prepared.query).not.toMatch(/A1234567|user_7f31|HT-9382A/iu);
  });

  it.each([
    "Tôi muốn hỏi chân thường tập gì?",
    "Tôi muốn hỏi bệnh tiểu đường là gì?",
    "How do I improve my freestyle stroke?",
    "Squat thường tác động cơ nào?",
    "Deadlift thường tập mấy hiệp?",
    "Bench Press thường tác động cơ nào?",
    "Barbell Squat nên tập thế nào?",
  ])("does not treat a general question as a personal health disclosure: %s", (query) => {
    expect(prepareExternalKnowledgeQuery(query)).toMatchObject({
      eligible: true,
    });
  });

  it.each([
    "Tôi hỏi Lisa ở đâu?",
    "Em muốn biết tin gần đây về Ronaldo",
  ])("allows a public alias only when the raw-request allowlist is supplied: %s", (query) => {
    expect(
      prepareExternalKnowledgeQuery(query, {
        allowedPublicPersonNames: getPublicPersonLookupNames(query),
      }),
    ).toMatchObject({ eligible: true });
  });

  it.each([
    ["mai thường tập gì?", /\bmai\b/iu],
    ["nguyễn văn a thường tập gì?", /nguyễn văn a/iu],
    ["MAI thường tập gì?", /\bMAI\b/u],
    ["mai đang tập gì?", /\bmai\b/iu],
    ["nguyễn văn a...", /nguyễn văn a/iu],
    ["MAI...", /\bMAI\b/u],
  ])(
    "protects a lowercase or all-caps Vietnamese private name at external and embedding sinks: %s",
    (query, privateNamePattern) => {
      expect(getPublicPersonLookupNames(query)).toEqual([]);
      expect(prepareExternalKnowledgeQuery(query)).toEqual({
        eligible: false,
        reason: "ambiguous_person_identity",
      });

      const retrieval = prepareKnowledgeRetrievalQuery(query);
      expect(retrieval).toMatchObject({ eligible: true, redacted: true });
      expect(retrieval.query).not.toMatch(privateNamePattern);
    },
  );

  it("redacts only the name before a later Vietnamese predicate", () => {
    const retrieval = prepareKnowledgeRetrievalQuery(
      "nguyễn văn a đang tập gì?",
    );

    expect(retrieval.query).toBe("[đã ẩn tên] đang tập gì?");
  });

  it.each([
    "Lisa cua toi tap gi?",
    "Lisa học viên của tôi tập gì?",
  ])(
    "lets private relationship cues override the vetted Lisa alias: %s",
    (query) => {
      expect(getPublicPersonLookupNames(query)).toEqual([]);
      expect(
        prepareExternalKnowledgeQuery(query, {
          allowedPublicPersonNames: ["Lisa"],
        }),
      ).toEqual({
        eligible: false,
        reason: "ambiguous_person_identity",
      });

      const retrieval = prepareKnowledgeRetrievalQuery(query);
      expect(retrieval).toMatchObject({ eligible: true, redacted: true });
      expect(retrieval.query).not.toMatch(/\bLisa\b/u);
    },
  );

  it("keeps only the caller-allowed public name in a mixed public/private query", () => {
    const query = "Ronaldo routine cho mai";
    const allowedPublicPersonNames = getPublicPersonLookupNames(query);

    expect(allowedPublicPersonNames).toEqual(["Ronaldo"]);
    expect(
      prepareExternalKnowledgeQuery(query, { allowedPublicPersonNames }),
    ).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });

    const retrieval = prepareKnowledgeRetrievalQuery(query);
    expect(retrieval).toMatchObject({ eligible: true, redacted: true });
    expect(retrieval.query).toContain("Ronaldo");
    expect(retrieval.query).not.toMatch(/\bmai\b/iu);
  });

  it.each([
    {
      query: "zoraqx quux thường tập gì?",
      allowedPublicPersonNames: [],
      privateNamePattern: /zoraqx quux/iu,
    },
    {
      query: "Ronaldo routine cho zoraqx",
      allowedPublicPersonNames: ["Ronaldo"],
      privateNamePattern: /\bzoraqx\b/iu,
    },
  ])(
    "protects a previously unseen lowercase identity at every retrieval sink: $query",
    ({ query, allowedPublicPersonNames, privateNamePattern }) => {
      const retrieval = prepareKnowledgeRetrievalQuery(query);
      const suggestion = prepareKnowledgeSuggestionPair({
        conversationId: new mongoose.Types.ObjectId(),
        question: message("user", query),
        answer: message("assistant", `Hướng dẫn chung cho ${query}`),
        questionIndex: 0,
        answerIndex: 1,
      });

      expect({
        publicNames: getPublicPersonLookupNames(query),
        external: prepareExternalKnowledgeQuery(query, {
          allowedPublicPersonNames,
        }),
        retrieval: {
          eligible: retrieval.eligible,
          redacted: retrieval.redacted,
          leaksIdentity: privateNamePattern.test(retrieval.query || ""),
        },
        suggestion: {
          eligible: suggestion.eligible,
          redacted: suggestion.redacted,
          leaksIdentity: privateNamePattern.test(
            `${suggestion.question || ""} ${suggestion.answer || ""}`,
          ),
        },
      }).toEqual({
        publicNames: allowedPublicPersonNames,
        external: {
          eligible: false,
          reason: "ambiguous_person_identity",
        },
        retrieval: {
          eligible: true,
          redacted: true,
          leaksIdentity: false,
        },
        suggestion: {
          eligible: true,
          redacted: true,
          leaksIdentity: false,
        },
      });
    },
  );

  it.each([
    {
      query: "What exercise should zoraqx quux do?",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: false,
    },
    {
      query: "bài tập của zoraqx quux",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: false,
    },
    {
      query: "tôi là zoraqx quux, cần lịch tập",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: false,
    },
    {
      query: "client zoraqx quux should do squats",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: false,
    },
    {
      query: "zoraqx quux is my client",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: false,
    },
    {
      query: "zoraqx quux bị tiểu đường, nên tập squat thế nào?",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: true,
    },
    {
      query: "Workout advice for zoraqx quux who has lupus",
      privateNamePattern: /zoraqx quux/iu,
      sensitiveHealth: true,
    },
  ])(
    "protects a structural lowercase identity before every provider sink: $query",
    ({ query, privateNamePattern, sensitiveHealth }) => {
      const external = prepareExternalKnowledgeQuery(query);
      const retrieval = prepareKnowledgeRetrievalQuery(query);
      const suggestion = prepareKnowledgeSuggestionPair({
        conversationId: new mongoose.Types.ObjectId(),
        question: message("user", query),
        answer: message("assistant", "Synthetic general fitness guidance."),
        questionIndex: 0,
        answerIndex: 1,
      });

      if (sensitiveHealth) {
        expect({
          external: external.reason,
          retrieval: retrieval.reason,
          suggestion: suggestion.reason,
        }).toEqual({
          external: "sensitive_personal_health",
          retrieval: "sensitive_personal_health",
          suggestion: "sensitive_personal_health",
        });
      }

      expect({
        externalProtected: !external.eligible || external.redacted === true,
        externalLeaksIdentity: privateNamePattern.test(external.query || ""),
        retrievalProtected: !retrieval.eligible || retrieval.redacted === true,
        retrievalLeaksIdentity: privateNamePattern.test(retrieval.query || ""),
        suggestionProtected: !suggestion.eligible || suggestion.redacted === true,
        suggestionLeaksIdentity: privateNamePattern.test(
          `${suggestion.question || ""} ${suggestion.answer || ""}`,
        ),
      }).toEqual({
        externalProtected: true,
        externalLeaksIdentity: false,
        retrievalProtected: true,
        retrievalLeaksIdentity: false,
        suggestionProtected: true,
        suggestionLeaksIdentity: false,
      });
    },
  );

  it("protects a named recipient before web, embedding and AI Suggest processing", () => {
    const query = "Send workout to John Smith and cite sources";
    expect(prepareExternalKnowledgeQuery(query)).toEqual({
      eligible: false,
      reason: "ambiguous_person_identity",
    });

    const retrieval = prepareKnowledgeRetrievalQuery(query);
    expect(retrieval).toMatchObject({ eligible: true, redacted: true });
    expect(retrieval.query).not.toContain("John Smith");

    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", query),
      answer: message(
        "assistant",
        "Send this general workout guidance to John Smith.",
      ),
      questionIndex: 0,
      answerIndex: 1,
    });
    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toContain("John Smith");
  });

  it.each([
    "mai thường tập gì?",
    "nguyễn văn a thường tập gì?",
    "MAI thường tập gì?",
    "mai đang tập gì?",
    "nguyễn văn a...",
    "MAI...",
    "Lisa cua toi tap gi?",
    "Lisa học viên của tôi tập gì?",
    "Ronaldo routine cho mai",
  ])("redacts newly covered private-name forms from AI Suggest: %s", (content) => {
    const prepared = prepareKnowledgeSuggestionPair({
      conversationId: new mongoose.Types.ObjectId(),
      question: message("user", content),
      answer: message("assistant", `Hướng dẫn chung cho yêu cầu: ${content}`),
      questionIndex: 0,
      answerIndex: 1,
    });

    expect(prepared).toMatchObject({ eligible: true, redacted: true });
    expect(`${prepared.question} ${prepared.answer}`).not.toMatch(
      /nguyễn văn a|(?<![\p{L}\p{N}_])mai(?![\p{L}\p{N}_])|Lisa (?:cua toi|học viên của tôi)/iu,
    );
  });

  it("accepts a public, non-personal Knowledge Entry across every text field", () => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Progressive overload là gì?",
        answer: "Tăng tải dần theo khả năng phục hồi và kỹ thuật của người tập.",
        variants: ["How does progressive overload work?"],
        tags: ["progressive overload", "strength"],
        sources: [
          {
            title: "Synthetic strength guidance",
            publisher: "Synthetic Coaching Institute",
            url: "https://example.org/strength-guidance",
          },
        ],
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    "ACSM",
    "BJSM",
    "NSCA",
    "Nike",
    "American College of Sports Medicine",
    "British Journal of Sports Medicine",
    "National Strength and Conditioning Association",
    "International Society of Sports Nutrition",
    "Harvard Health Publishing",
    "Journal of Strength and Conditioning Research",
    "Nike Training Club",
  ])("does not mistake an authoritative source organization for private data: %s", (publisher) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "How should adults progress resistance training?",
        answer: "Use gradual progression and adjust volume to recovery.",
        tags: ["resistance training"],
        sources: [{ title: "General resistance training guidance", publisher }],
      }),
    ).toEqual({ valid: true });
  });

  it("allows source metadata about the public person bound by the question", () => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Ronaldo thường tập gì?",
        answer: "Giáo án của Ronaldo thay đổi theo giai đoạn thi đấu.",
        sources: [
          {
            title: "Cristiano Ronaldo Masterclass",
            publisher: "CR7 Fitness",
            url: "https://www.nike.com/vn/fitness/ronaldo-masterclass",
          },
        ],
      }),
    ).toEqual({ valid: true });
  });

  it("allows a public figure's workout URL when bound by the question", () => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Ronaldo thường tập gì?",
        answer: "Ronaldo kết hợp bài chân, core và vận động bùng nổ.",
        sources: [{
          title: "Cristiano Ronaldo Masterclass",
          publisher: "Nike Training Club",
          url: "https://www.nike.com/fitness/people/ronaldo-workout-plan",
        }],
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    "https://example.org/people/ronaldo-smith-workout-plan",
    "https://example.org/persons/ronaldo-zoraqx-profile",
  ])("does not extend a public alias to a different person in a source URL: %s", (url) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "Ronaldo thường tập gì?",
        answer: "Ronaldo kết hợp bài chân, core và vận động bùng nổ.",
        sources: [{
          title: "Public workout profile",
          publisher: "Synthetic Journal",
          url,
        }],
      }),
    ).toEqual({
      valid: false,
      reason: "ambiguous_person_identity",
    });
  });

  it.each([
    "https://example.org/private/resistance-training",
    "https://example.org/private",
    "https://example.org/patients/training",
    "https://example.org/patients",
    "https://example.org/clients/guidance",
    "https://example.org/clients/",
    "https://example.org/users/fitness",
    "https://example.org/users?record=alice",
  ])("rejects every generic slug under an explicit private record container: %s", (url) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "How should adults progress resistance training?",
        answer: "Use gradual progression and adjust volume to recovery.",
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url,
        }],
      }),
    ).toEqual({
      valid: false,
      reason: "ambiguous_person_identity",
    });
  });

  it.each([
    "https://example.org/articles/strength-training-for-patients-with-hiv?ref=journal",
    "https://example.org/articles/resistance-training?session_type=online&author=ACSM",
  ])("allows public evidence URL without a personal record or credential: %s", (url) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "How should adults progress resistance training?",
        answer: "Use gradual progression and adjust volume to recovery.",
        sources: [{ title: "General resistance training guidance", publisher: "Synthetic Journal", url }],
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    "exercise has benefits for people with lupus",
    "training has benefits for people with lupus",
  ])("allows a general health article title without a named patient: %s", (title) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "What is progressive overload?",
        answer: "Increase resistance gradually.",
        sources: [{ title, publisher: "Synthetic Journal", url: "https://example.org/studies/general-health" }],
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    [
      "matchedQuestion containing a distinct private health assertion",
      { matchedQuestion: "john smith has lupus" },
      "sensitive_personal_health",
    ],
    [
      "matchedQuestion containing a lowercase private diagnosis",
      { matchedQuestion: "zoraqx quux was diagnosed with lupus" },
      "sensitive_personal_health",
    ],
    [
      "answer containing a lowercase private diagnosis",
      { answer: "zoraqx quux was diagnosed with lupus" },
      "sensitive_personal_health",
    ],
    [
      "variant containing a lowercase private diagnosis",
      { variants: ["zoraqx quux was diagnosed with lupus"] },
      "sensitive_personal_health",
    ],
    [
      "source title containing a lowercase private diagnosis",
      { sources: [{
        title: "zoraqx quux was diagnosed with lupus",
        publisher: "Synthetic Journal",
      }] },
      "sensitive_personal_health",
    ],
    [
      "matchedQuestion containing a direct identifier",
      {
        question: "What is progressive overload?",
        answer: "Increase resistance gradually.",
        matchedQuestion: "private.member@example.org",
      },
      "direct_identifier",
    ],
    [
      "lowercase source title naming a person with a condition",
      { sources: [{ title: "john smith has lupus", publisher: "Synthetic Journal" }] },
      "sensitive_personal_health",
    ],
    [
      "single lowercase name in source health assertion",
      { sources: [{ title: "jane has lupus", publisher: "Synthetic Journal" }] },
      "sensitive_personal_health",
    ],
    [
      "lowercase name and date of birth in source title",
      { sources: [{ title: "bob DOB 1990-01-01", publisher: "Synthetic Journal" }] },
      "sensitive_personal_health",
    ],
    [
      "private patient health-report URL slug",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/patients/john-smith-hiv-report",
        }],
      },
      "sensitive_personal_health",
    ],
    [
      "private path health-report URL slug",
      { sources: [{ title: "General guidance", url: "https://example.org/private/john-smith-hiv-report" }] },
      "sensitive_personal_health",
    ],
    [
      "private path named notes without a record suffix",
      { sources: [{ title: "General guidance", url: "https://example.org/private/zoraqx-quux-notes" }] },
      "ambiguous_person_identity",
    ],
    [
      "patient path named record without a suffix",
      { sources: [{ title: "General guidance", url: "https://example.org/patients/zoraqx-quux" }] },
      "ambiguous_person_identity",
    ],
    [
      "patient path containing an opaque private record identifier",
      { sources: [{ title: "General guidance", url: "https://example.org/patients/record-7f31" }] },
      "ambiguous_person_identity",
    ],
    [
      "case path health-report URL slug",
      { sources: [{ title: "General guidance", url: "https://example.org/cases/john-smith-hiv-report" }] },
      "sensitive_personal_health",
    ],
    [
      "people path private workout-plan URL slug",
      { sources: [{ title: "General guidance", url: "https://example.org/people/john-smith-workout-plan" }] },
      "ambiguous_person_identity",
    ],
    [
      "patient path diagnosis URL slug",
      { sources: [{ title: "General guidance", url: "https://example.org/patients/john-smith-diagnosis" }] },
      "sensitive_personal_health",
    ],
    [
      "unscoped personal health-report URL slug",
      { sources: [{ title: "General guidance", url: "https://example.org/articles/john-smith-hiv-report" }] },
      "sensitive_personal_health",
    ],
    [
      "percent-encoded private patient health-report URL slug",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/patients/john%2Dsmith%2Dhiv%2Dreport",
        }],
      },
      "sensitive_personal_health",
    ],
    [
      "source URL containing auth query parameter",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?auth=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing session query parameter",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?session=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing an encoded auth query key",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?%61uth=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing an empty session credential query parameter",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?SESSION=",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing a JSESSIONID credential",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?JSESSIONID=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing a PHPSESSID credential",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?PHPSESSID=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing an auth credential path",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/share/auth/SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing a session credential path",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/session/SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing an OAuth authorization code",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance?auth_code=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing a JSESSIONID path parameter",
      {
        sources: [{
          title: "General resistance training guidance",
          publisher: "Synthetic Journal",
          url: "https://example.org/guidance;jsessionid=SYNTHETIC_SECRET_MARKER",
        }],
      },
      "direct_identifier",
    ],
    [
      "source URL containing a phone identifier",
      {
        sources: [
          {
            title: "Synthetic clinical report",
            publisher: "Synthetic Journal",
            url: "https://example.org/nguyen-van-a-hiv-report?ref=0901234567",
          },
        ],
      },
      "direct_identifier",
    ],
    [
      "answer URL containing an access credential",
      {
        answer:
          "Read https://example.org/general-fitness?access_token=synthetic-token-123",
      },
      "direct_identifier",
    ],
    [
      "source title containing a named health record",
      {
        sources: [
          {
            title: "Nguyen Van A has lupus",
            publisher: "Synthetic Journal",
          },
        ],
      },
      "sensitive_personal_health",
    ],
    [
      "source title containing a private proper name",
      {
        sources: [
          {
            title: "Nguyen Van A workout plan",
            publisher: "Synthetic Journal",
          },
        ],
      },
      "ambiguous_person_identity",
    ],
    [
      "percent-encoded answer URL containing an access credential",
      {
        answer:
          "Read https://example.org/general-fitness?access%5Ftoken%3Dsynthetic-token-123",
      },
      "direct_identifier",
    ],
  ])("rejects whole-entry privacy risk in %s", (_label, override, reason) => {
    expect(
      validateKnowledgeEntryPrivacy({
        question: "How should adults progress resistance training?",
        answer: "Use gradual progression and adjust volume to recovery.",
        variants: [],
        tags: [],
        sources: [],
        ...override,
      }),
    ).toEqual({ valid: false, reason });
  });

  it.each([
    ["answer", { answer: `${"General guidance. ".repeat(45)}Client zoraqx quux has lupus.` }],
    ["tags", { tags: ["client zoraqx quux has lupus"] }],
    [
      "source title",
      { sources: [{ title: "Client zoraqx quux has lupus", publisher: "Synthetic Journal" }] },
    ],
    [
      "source publisher",
      { sources: [{ title: "Synthetic article", publisher: "Client zoraqx quux has lupus" }] },
    ],
  ])("rejects private health data hidden in Knowledge Entry %s", (_field, override) => {
    const result = validateKnowledgeEntryPrivacy({
      question: "How should a beginner train?",
      answer: "Use a gradual, general training progression.",
      variants: [],
      tags: [],
      sources: [],
      ...override,
    });

    expect(result.valid).toBe(false);
    expect(["sensitive_personal_health", "ambiguous_person_identity"]).toContain(
      result.reason,
    );
  });
});
