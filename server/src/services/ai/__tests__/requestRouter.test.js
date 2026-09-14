import { describe, expect, it } from "vitest";

import {
  buildStandaloneRetrievalQuery,
  buildRequestRoutingBlock,
  getAllowedToolNamesForRoute,
  getUrgentSafetyResponse,
  routeAiRequest,
} from "../requestRouter.js";

describe("AI request evidence router", () => {
  it("rebuilds a short fitness follow-up into a standalone retrieval query", () => {
    const query = buildStandaloneRetrievalQuery("Còn bài nào khác?", [
      { role: "user", content: "Tôi muốn tìm bài tập ngực với tạ đơn." },
      { role: "assistant", content: "Bạn có thể thử dumbbell bench press." },
    ]);

    expect({ query, decision: routeAiRequest(query) }).toMatchObject({
      query: "Tôi muốn tìm bài tập ngực với tạ đơn.\nCòn bài nào khác?",
      decision: {
        domain: "fitness",
        evidence: "internal_kb",
        preferredTool: "search_exercises",
      },
    });
  });

  it("inherits private-health risk for a contextual follow-up without externalizing it", () => {
    const message = "Còn bài nào khác?";
    const contextualQuery = buildStandaloneRetrievalQuery(message, [
      {
        role: "user",
        content: "Tôi bị PCOS và muốn tìm bài tập phù hợp.",
      },
    ]);
    const decision = routeAiRequest(message, { contextualQuery });

    expect({ contextualQuery, decision, tools: getAllowedToolNamesForRoute(decision) })
      .toMatchObject({
        contextualQuery: expect.stringContaining("Tôi bị PCOS"),
        decision: {
          risk: "high_stakes",
          evidence: "model_prior",
          knowledgeBaseEligible: false,
          webSearchRequired: false,
          preferredTool: null,
          maxWebSearchCalls: 0,
        },
        tools: [],
      });
  });

  it("does not attach unrelated history to a standalone request", () => {
    expect(
      buildStandaloneRetrievalQuery("Lisa là ai?", [
        { role: "user", content: "Cách squat đúng?" },
      ]),
    ).toBe("Lisa là ai?");
  });

  it("bounds a standalone follow-up to the retrieval contract while keeping the current turn", () => {
    const current = "Còn bài nào khác?";
    const query = buildStandaloneRetrievalQuery(current, [
      { role: "user", content: `Bài tập ngực ${"rất dài ".repeat(100)}` },
    ]);

    expect(query.length).toBeLessThanOrEqual(500);
    expect(query.endsWith(current)).toBe(true);
  });

  it("preserves a long current turn through the router privacy boundary", () => {
    const current = `Ngoài ra, creatine nên dùng thế nào? ${"giải thích thêm ".repeat(60)}`;
    const query = buildStandaloneRetrievalQuery(current);

    expect({
      preserved: query === current.trim(),
      withinRouterBound: query.length <= 2000,
      decision: routeAiRequest(query),
    }).toMatchObject({
      preserved: true,
      withinRouterBound: true,
      decision: {
        domain: "fitness",
        evidence: "internal_kb",
        knowledgeBaseEligible: true,
      },
    });
  });

  it("preserves a medical emergency after character 500 and disables retrieval", () => {
    const emergency = "Tôi đang đau ngực và khó thở.";
    const current = `${"Thông tin nền an toàn. ".repeat(40)}${emergency}`;
    const query = buildStandaloneRetrievalQuery(current);
    const decision = routeAiRequest(query);

    expect({
      keptEmergency: query.endsWith(emergency),
      withinRouterBound: query.length <= 2000,
      decision,
      allowedTools: getAllowedToolNamesForRoute(decision),
    }).toMatchObject({
      keptEmergency: true,
      withinRouterBound: true,
      decision: {
        risk: "high_stakes",
        urgency: "medical_emergency",
        evidence: "model_prior",
        knowledgeBaseEligible: false,
        webSearchRequired: false,
        preferredTool: null,
        maxWebSearchCalls: 0,
      },
      allowedTools: [],
    });
  });

  it.each([
    ["Tôi đang đau ngực và khó thở.", "medical_emergency"],
    ["I plan to overdose tonight.", "self_harm"],
  ])(
    "scans a valid long current turn through its safety tail: %s",
    (safetyTail, urgency) => {
      const current = `${"x".repeat(8000 - safetyTail.length - 1)} ${safetyTail}`;
      const retrievalQuery = buildStandaloneRetrievalQuery(current);
      const decision = routeAiRequest(current, { contextualQuery: retrievalQuery });

      expect({
        inputLength: current.length,
        retrievalLength: retrievalQuery.length,
        decision,
        allowedTools: getAllowedToolNamesForRoute(decision),
      }).toMatchObject({
        inputLength: 8000,
        retrievalLength: 2000,
        decision: {
          risk: "high_stakes",
          urgency,
          evidence: "model_prior",
          knowledgeBaseEligible: false,
          webSearchRequired: false,
          preferredTool: null,
          maxWebSearchCalls: 0,
        },
        allowedTools: [],
      });
    },
  );

  it("routes a common general identity question to a direct short answer", () => {
    expect(routeAiRequest("Lisa là ai?")).toMatchObject({
      domain: "general",
      freshness: "stable",
      evidence: "model_prior",
      risk: "low",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
      maxWebSearchCalls: 0,
    });
  });

  it("requires web evidence for a public person's claimed workout routine", () => {
    expect(routeAiRequest("Ronaldo thường tập những bài gì trong phòng gym?")).toMatchObject({
      domain: "fitness",
      freshness: "stable",
      evidence: "web_required",
      risk: "low",
      knowledgeBaseEligible: false,
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
    });
  });

  it("requires web evidence for an unknown lowercase public-person routine", () => {
    expect(routeAiRequest("david goggins thường tập gì?")).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
    });
  });

  it("marks an unseen lowercase person claim for evidence-bound privacy handling", () => {
    expect(routeAiRequest("zoraqx quux thường tập gì?")).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      reasonCodes: expect.arrayContaining(["public_person_claim"]),
    });
  });

  it.each([
    "Ronaldo bao nhiêu tuổi?",
    "Ronaldo hiện bao nhiêu tuổi?",
    "Ronaldo chơi cho CLB nào?",
    "Taylor Swift đang lưu diễn ở đâu?",
  ])("requires current evidence for an implicitly changing public-person fact: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      freshness: "time_sensitive",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
      reasonCodes: expect.arrayContaining(["public_person_claim"]),
    });
  });

  it("treats an unqualified weather question as inherently time-sensitive", () => {
    expect(routeAiRequest("Thời tiết Sài Gòn thế nào?")).toMatchObject({
      freshness: "time_sensitive",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
      reasonCodes: expect.arrayContaining(["time_sensitive"]),
    });
  });

  it.each([
    "Ai là tổng thống Mỹ?",
    "Who is the president of the United States?",
    "CEO của OpenAI là ai?",
    "Giá Bitcoin bao nhiêu?",
    "Tỉ giá USD VND bao nhiêu?",
    "Ai thắng Oscar 2025?",
    "Manchester United đang đứng thứ mấy?",
  ])("requires fresh web evidence for implicitly volatile facts: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "general",
      freshness: "time_sensitive",
      evidence: "web_required",
      knowledgeBaseEligible: false,
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
      reasonCodes: expect.arrayContaining(["time_sensitive"]),
    });
  });

  it.each([
    "Ai là tổng thống đầu tiên của Mỹ?",
    "Giá Bitcoin năm 2017 là bao nhiêu?",
  ])("keeps explicitly historical general facts on the stable path: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "general",
      freshness: "stable",
      evidence: "model_prior",
      webSearchRequired: false,
    });
  });

  it.each([
    "Ronaldo tập gì?",
    "Bạn cho tôi hỏi Ronaldo thường tập gì?",
    "bạn cho mình hỏi ronaldo thường tập gì?",
    "Bạn có biết những bài tập phổ biến mà Ronaldo thường tập khi ở phòng tập không?",
    "Bạn biết Ronaldo thường tập bài gì trong phòng gym?",
    "Ronaldo yêu thích bài tập nào?",
    "Bài tập yêu thích của Ronaldo là gì?",
  ])("recognizes concise and polite public-person workout claims: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      risk: "low",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
    });
  });

  it.each([
    "Squat thường tập mấy hiệp?",
    "Người mới thường tập những bài gì?",
    "Một người mới thường tập gì?",
    "Vai thường tập gì?",
    "Ngực thường tập gì?",
    "Chân thường tập gì?",
    "Cơ bụng thường tập gì?",
    "PPL thường tập gì?",
    "HLV thường tập gì?",
    "Tập chân thường tập bài gì?",
  ])("does not mistake a generic fitness subject for a public person: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      webSearchRequired: false,
      risk: "low",
    });
  });

  it.each([
    "How should I train legs?",
    "How should a beginner train legs?",
    "How to gain muscle?",
    "How to lose fat?",
    "Progressive overload là gì?",
    "RPE dùng thế nào?",
    "Bulk or cut?",
    "Can I train every day?",
    "How long should I rest between sets?",
    "DOMS là gì?",
    "Cách tăng cân lành mạnh?",
    "Cách giảm cân khi tập gym?",
    "Siết cơ như thế nào?",
    "Có nên tập tới thất bại?",
    "Nghỉ giữa hiệp bao lâu?",
    "Full body hay chia buổi?",
    "Cách tăng mức tạ?",
  ])("keeps common fitness language on the specialized path: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
    });
  });

  it.each([
    "Hypertrophy là gì?",
    "Khi nào nên deload?",
    "Mesocycle nên kéo dài bao lâu?",
    "Superset khác drop set thế nào?",
    "AMRAP dùng khi nào?",
    "Cách kiểm tra 1RM an toàn?",
    "VO2 max có ý nghĩa gì khi tập luyện?",
    "Calisthenics phù hợp với người mới không?",
    "Powerlifting khác bodybuilding thế nào?",
    "Cách tính macros để tăng cơ?",
    "Tempo reps là gì?",
    "Periodization giúp ích gì cho giáo án?",
    "Muscle soreness kéo dài bao lâu?",
    "Mobility là gì?",
  ])("routes specialist fitness vocabulary through internal evidence: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
    });
  });

  it.each([
    "Macroscope dùng để làm gì?",
    "Excel macros và VBA là gì?",
    "Social mobility là gì?",
    "Historical periodization divides eras thế nào?",
  ])("does not route specialist substrings or explicit non-fitness contexts as fitness: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "general",
      evidence: "model_prior",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
    });
  });

  it.each([
    "Ronaldo có tập bench press không?",
    "Ronaldo hay tập squat không?",
    "Ronaldo tập mấy hiệp squat?",
    "Bài deadlift của Ronaldo như thế nào?",
    "Ronaldo tập gym bao nhiêu buổi một tuần?",
    "Ronaldo có dùng creatine không?",
    "Ronaldo ăn bao nhiêu protein?",
    "Ronaldo ngủ mấy tiếng?",
  ])("requires web evidence for broader public-person habits: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
    });
  });

  it.each([
    "Cristiano Ronaldo DOB is 1985-02-05, verify it",
    "When was Cristiano Ronaldo born?",
    "Cầu thủ Cristiano Ronaldo DOB 1985-02-05",
  ])("requires web evidence for a caller-vetted public-person DOB: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "general",
      evidence: "web_required",
      risk: "low",
      knowledgeBaseEligible: false,
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
      reasonCodes: expect.arrayContaining(["public_person_claim"]),
    });
  });

  it.each([
    "My friend Lisa Brown was born when?",
    "Lisa Brown is my friend, when was she born?",
  ])(
    "requires evidence but marks a private-person DOB lookup for external blocking: %s",
    (message) => {
      expect(routeAiRequest(message)).toMatchObject({
        domain: "general",
        evidence: "web_required",
        risk: "low",
        knowledgeBaseEligible: false,
        webSearchRequired: true,
        preferredTool: "search_knowledge",
        maxWebSearchCalls: 1,
        reasonCodes: expect.arrayContaining(["private_person_dob_lookup"]),
      });
    },
  );

  it.each([
    "Lisa học viên của tôi DOB 01/02/1990",
    "My friend Ronaldo DOB is 1985-02-05",
    "Ronaldo DOB is 1985-02-05 and bob DOB is 1990-01-01, verify both",
    "Ronaldo was born in Portugal; DOB: 01/02/1990",
    "Ronaldo DOB is 1985-02-05; bob has epilepsy",
    "Ronaldo DOB is 1985-02-05; bob takes prednisone",
    "Ronaldo DOB is 1985-02-05; HbA1c 9%",
    "Ronaldo DOB is 1985-02-05; migraine",
  ])("never treats a private-person DOB as a public lookup: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      evidence: "model_prior",
      risk: "high_stakes",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
      maxWebSearchCalls: 0,
    });
  });

  it("scans the full safety window before exempting a public DOB", () => {
    const message = `Ronaldo DOB is 1985-02-05 ${"fitness ".repeat(300)} I have migraine`;

    expect(routeAiRequest(message)).toMatchObject({
      evidence: "model_prior",
      risk: "high_stakes",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
      maxWebSearchCalls: 0,
    });
  });

  it.each([
    "Lat pulldown thường tập mấy hiệp?",
    "Romanian deadlift thường tập vào ngày nào?",
    "Bulgarian split squat thường tập mấy hiệp?",
    "Cable fly thường tập bao nhiêu lần?",
  ])("routes exercise-name programming questions to canonical exercise evidence: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      webSearchRequired: false,
      preferredTool: "search_exercises",
      risk: "low",
    });
  });

  it.each([
    "Lisa ở đâu?",
    "chan thuong tap gi?",
    "Tôi hỏi Lisa ở đâu?",
    "Em muốn biết tin gần đây về Ronaldo",
  ])("does not confuse location or unaccented routine wording with pain: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({ risk: "low" });
  });

  it.each([
    "Tôi bị HIV, nên tập gì?",
    "Tôi bị đau đầu gối, nên tập gì?",
    "I have diabetes, what exercise should I do?",
    "toi bi dau dau goi, nen tap gi?",
    "toi bi chan thuong khi squat, nen lam gi?",
    "Tôi bị viêm khớp dạng thấp, nên tập gì?",
    "Tôi bị thoát vị đĩa đệm, nên tập gì?",
    "Tôi vừa mổ dây chằng, nên tập gì?",
    "Tôi bị loãng xương, nên tập gì?",
  ])("keeps personal medical fitness questions inside safety-bounded fitness: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      risk: "high_stakes",
    });
  });

  it.each([
    "Tôi bị HIV, nghiên cứu mới nhất nói nên tập gì?",
    "Tôi đang mang thai, cho tôi nguồn bài tập an toàn.",
    "I have multiple sclerosis, latest exercise advice",
    "I have eczema, what is the latest workout guidance?",
    "I take levothyroxine, current exercise recommendations",
    "my friend has lupus, latest fitness advice",
    "I have Crohn disease, latest exercise research",
    "My doctor put me on levothyroxine, latest exercise advice",
    "I am allergic to latex, latest workout advice",
  ])("never externalizes high-stakes fitness questions for freshness or citations: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "model_prior",
      risk: "high_stakes",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      maxWebSearchCalls: 0,
    });
  });

  it.each([
    "I have narcolepsy, what changed recently?",
    "My friend has Hashimotos, what changed recently?",
    "I am on methotrexate, latest research?",
    "I'm on methotrexate, latest research?",
    "My friend is on methotrexate, latest research?",
  ])("never externalizes general questions containing private clinical disclosure: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      risk: "high_stakes",
      evidence: "model_prior",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      maxWebSearchCalls: 0,
    });
  });

  it.each([
    "Đau đầu gối tập gì?",
    "HIV tập gì?",
    "Tiểu đường thường tập gì?",
    "Hen suyễn tập gì?",
    "Bà bầu nên tập gì?",
  ])("does not mistake a medical condition for a public person or service package: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "model_prior",
      risk: "high_stakes",
      webSearchRequired: false,
    });
  });

  it.each([
    ["Tôi đang đau ngực và khó thở, phải làm sao?", "medical_emergency"],
    ["toi dang dau nguc va kho tho, phai lam sao?", "medical_emergency"],
    [
      "Tôi vừa ngất xỉu, méo miệng và yếu một bên người.",
      "medical_emergency",
    ],
    [
      "I just fainted and one side of my face is drooping.",
      "medical_emergency",
    ],
    [
      "Sau buổi tập tôi đang đau ngực và khó thở.",
      "medical_emergency",
    ],
    ["Người bên cạnh tôi đang đau ngực.", "medical_emergency"],
    ["Một người vừa ngất xỉu trước mặt tôi.", "medical_emergency"],
    ["Tôi muốn tự tử ngay bây giờ.", "self_harm"],
    ["Tôi muốn tự tử, hãy hỗ trợ một người như tôi.", "self_harm"],
    ["Tôi sẽ tự sát tối nay.", "self_harm"],
    [
      "Tôi không muốn sống; suicide prevention không còn giúp được tôi.",
      "self_harm",
    ],
    ["How can I kill myself?", "self_harm"],
    ["I am going to hurt myself.", "self_harm"],
    ["I am going to end my life tonight.", "self_harm"],
    ["Bạn tôi muốn tự tử ngay bây giờ.", "self_harm"],
    ["My friend wants to die.", "self_harm"],
    ["Tôi từng đau vai; giờ đau ngực.", "medical_emergency"],
    ["Tôi không thở được.", "medical_emergency"],
    ["Tôi sắp ngất.", "medical_emergency"],
    ["Tôi đang lên cơn hen.", "medical_emergency"],
    ["I do not want to live anymore", "self_harm"],
    ["I plan to overdose tonight", "self_harm"],
    ["My mother is having a heart attack", "medical_emergency"],
    ["Tôi đang co giật", "medical_emergency"],
    ["I feel dizzy and am about to faint", "medical_emergency"],
  ])("routes an urgent safety disclosure without retrieval or tools: %s", (message, urgency) => {
    expect(routeAiRequest(message)).toMatchObject({
      risk: "high_stakes",
      evidence: "model_prior",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
      maxWebSearchCalls: 0,
      urgency,
    });
  });

  it.each([
    "Đau cơ ngực sau bench press nên giãn thế nào?",
    "Dấu hiệu đột quỵ là gì?",
    "Tôi từng ngất xỉu năm 2020, giờ có tập lại được không?",
    "Làm sao hỗ trợ một người có ý nghĩ tự tử?",
    "Nghiên cứu phòng ngừa tự tử mới nhất?",
    "Tự tử là gì?",
    "Ronaldo nói gì về tự tử?",
    "Tỷ lệ tự tử hiện nay?",
    "Tôi không muốn tự tử.",
    "Tôi chưa bao giờ muốn tự tử.",
    "Dấu hiệu một người muốn tự tử?",
    "Bộ phim này nói về tự tử.",
    "How common is suicide?",
    "How do I improve my freestyle stroke?",
    "Bài hát ‘Đau ngực’ của ai?",
  ])("does not trigger a current crisis response for informational or unrelated text: %s", (message) => {
    expect(routeAiRequest(message).urgency).toBeNull();
  });

  it("does not mistake a generic symptom question for a public person", () => {
    expect(routeAiRequest("Triệu chứng đau ngực là gì?")).toMatchObject({
      risk: "high_stakes",
      urgency: null,
      evidence: "model_prior",
      webSearchRequired: false,
      maxWebSearchCalls: 0,
    });
  });

  it.each([
    "Ronaldo vừa ngất xỉu à?",
    "Cristiano Ronaldo bị chấn thương gì?",
  ])("requires fresh web evidence for a public person's health claim: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      urgency: null,
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
    });
  });

  it.each([
    "Bố tôi bị chấn thương gì?",
    "Học viên Nguyễn Văn A vừa ngất xỉu.",
    "Mẹ tôi đang đau ngực và khó thở.",
  ])("never routes a private person's health disclosure to web search: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      risk: "high_stakes",
      webSearchRequired: false,
      maxWebSearchCalls: 0,
    });
  });

  it.each([
    "khách hàng mai đang dùng metformin",
    "học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
    "học viên Lan được kê Ozempic, nên tập cardio thế nào?",
    "client Jane uses warfarin and wants a workout",
    "client Jane is on warfarin and wants a workout",
    "client Jane was given lithium and wants exercise advice",
    "khách hàng An đang tiêm semaglutide, tìm nghiên cứu mới nhất",
    "client jane is receiving chemotherapy",
    "học viên nam HbA1c 9%",
    "học viên An có VO2max 28 ml/kg/min",
    "học viên Lan: VO2max 28 ml/kg/min, nên tập gì?",
    "khách hàng An có creatinine 2.1 mg/dL",
    "kết quả creatinine của khách hàng An là 2.1 mg/dL",
    "client Jane has SpO2 88% and wants cardio advice",
    "SpO2 của client Jane là 88%, latest research nói gì?",
    "BMI của tôi là 31",
    "Tôi sốt 39 độ sau khi tập cardio",
    "My A1C is high after training",
    "Mình đang xài Ozempic",
    "I am diabetic and need a workout",
    "My kid has fever and needs a workout",
    "Con tôi sốt sau giờ học và cần bài tập nhẹ",
  ])("keeps private clinical records away from every external retrieval tool: %s", (message) => {
    const decision = routeAiRequest(message);

    expect(decision).toMatchObject({
      evidence: "model_prior",
      risk: "high_stakes",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual([]);
  });

  it.each([
    "Do kids often get a fever?",
    "Trẻ em bị sốt có phổ biến không?",
    "Tôi có dầu olive để nấu ăn",
    "Tôi có đầu óc sáng tạo",
    "Tôi có bệnh viện gần nhà",
  ])("keeps informational and Vietnamese homograph cases out of private-health routing: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      risk: "low",
      urgency: null,
    });
  });

  it("keeps a real-person injury claim on the web-evidence path", () => {
    expect(routeAiRequest("Ronaldo đau gối tập gì?")).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      risk: "high_stakes",
      webSearchRequired: true,
    });
  });

  it("requires evidence for a real person's injury claim", () => {
    expect(routeAiRequest("Ronaldo bị chấn thương gì?")).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      risk: "high_stakes",
      webSearchRequired: true,
    });
  });

  it.each([
    "HTCOACHING có gói tập nào?",
    "co goi tap nao?",
    "đăng ký gói tập",
  ])("still recognizes an explicit HT service package request: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "ht_service",
      evidence: "internal_kb",
    });
  });

  it("routes exercise technique to internal fitness evidence", () => {
    const decision = routeAiRequest("Cách squat đúng kỹ thuật là gì?");
    expect(decision).toMatchObject({
      domain: "fitness",
      freshness: "stable",
      evidence: "internal_kb",
      risk: "low",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
      preferredTool: "search_exercises",
      maxWebSearchCalls: 0,
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual(["search_exercises"]);
  });

  it.each([
    "Nghiên cứu mới nhất về kỹ thuật squat",
    "Cho tôi nguồn về cách squat đúng kỹ thuật",
    "Latest research on deadlift technique",
    "Nghiên cứu mới nhất về TDEE",
    "Cho tôi nguồn về meal plan tăng cơ",
    "Nghiên cứu mới nhất về thực đơn giảm mỡ",
    "Bài viết mới nhất về protein",
  ])(
    "lets an explicit freshness or source request override generic content tools: %s",
    (message) => {
      const decision = routeAiRequest(message);

      expect(decision).toMatchObject({
        domain: "fitness",
        evidence: "web_required",
        risk: "low",
        knowledgeBaseEligible: false,
        webSearchRequired: true,
        preferredTool: "search_knowledge",
        maxWebSearchCalls: 1,
      });
      expect(getAllowedToolNamesForRoute(decision)).toEqual([
        "search_knowledge",
      ]);
    },
  );

  it("keeps private current schedule requests on the canonical internal tool", () => {
    expect(routeAiRequest("Lịch tập tuần này của tôi")).toMatchObject({
      domain: "fitness",
      freshness: "time_sensitive",
      evidence: "internal_kb",
      webSearchRequired: false,
      preferredTool: "get_training_schedule",
    });
  });

  it.each([
    ["Tính TDEE của tôi theo số đo hiện tại", "calculate_tdee"],
    ["Gợi ý thực đơn hôm nay cho tôi", "suggest_meal"],
    ["Lịch tập tuần này của tôi", "get_training_schedule"],
    ["Số dư ví hiện tại của tôi", "check_wallet"],
  ])(
    "keeps an explicit personal action on its canonical internal tool: %s",
    (message, preferredTool) => {
      expect(routeAiRequest(message)).toMatchObject({
        evidence: "internal_kb",
        risk: "low",
        webSearchRequired: false,
        preferredTool,
        maxWebSearchCalls: 0,
      });
    },
  );

  it("allows the bounded TDEE-to-meal tool sequence for an explicit compound action", () => {
    const decision = routeAiRequest("Tính TDEE rồi gợi ý thực đơn cho tôi");

    expect({
      preferredTool: decision.preferredTool,
      reasonCodes: decision.reasonCodes,
      runtimeToolNames: getAllowedToolNamesForRoute(decision),
    }).toEqual({
      preferredTool: "calculate_tdee",
      reasonCodes: ["compound_tdee_meal"],
      runtimeToolNames: ["calculate_tdee", "suggest_meal"],
    });
  });

  it("does not widen tool access when TDEE and meal are only informational topics", () => {
    const decision = routeAiRequest(
      "TDEE và thực đơn khác nhau như thế nào?",
    );

    expect(getAllowedToolNamesForRoute(decision)).toEqual(["calculate_tdee"]);
  });

  it("does not open the compound tool sequence for a high-stakes request", () => {
    const decision = routeAiRequest(
      "Tôi bị tiểu đường, tính TDEE rồi gợi ý thực đơn cho tôi",
    );

    expect({
      risk: decision.risk,
      preferredTool: decision.preferredTool,
      runtimeToolNames: getAllowedToolNamesForRoute(decision),
    }).toEqual({
      risk: "high_stakes",
      preferredTool: null,
      runtimeToolNames: [],
    });
  });

  it("only allows a sensitive account tool when the request explicitly selects it", () => {
    const walletDecision = routeAiRequest("Số dư ví của tôi còn bao nhiêu?");

    expect(walletDecision).toMatchObject({
      evidence: "internal_kb",
      preferredTool: "check_wallet",
    });
    expect(getAllowedToolNamesForRoute(walletDecision)).toEqual(["check_wallet"]);
    expect(
      getAllowedToolNamesForRoute(routeAiRequest("Cách squat đúng?")),
    ).not.toContain("check_wallet");
  });

  it.each([
    "Cách tập hít đất đúng kỹ thuật?",
    "Kỹ thuật hip thrust đúng?",
    "Tập lưng như nào?",
    "Tập đầu gối thế nào?",
  ])("recognizes natural exercise-technique wording: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      preferredTool: "search_exercises",
      risk: "low",
    });
  });

  it("does not confuse concentration wording with an exercise technique", () => {
    expect(routeAiRequest("Cách tập trung học hiệu quả?")).toMatchObject({
      domain: "general",
      evidence: "model_prior",
    });
  });

  it("keeps a meal-plan follow-up inside the fitness tool domain", () => {
    expect(routeAiRequest("Làm lại thực đơn với 4 meal cho tôi")).toMatchObject({
      domain: "fitness",
      evidence: "internal_kb",
      risk: "low",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
      maxWebSearchCalls: 0,
    });
  });

  it("requires current evidence for a time-sensitive general question", () => {
    expect(routeAiRequest("Hiện tại Lisa thuộc công ty nào?")).toMatchObject({
      domain: "general",
      freshness: "time_sensitive",
      evidence: "web_required",
      knowledgeBaseEligible: false,
      webSearchRequired: true,
      maxWebSearchCalls: 1,
    });
  });

  it.each([
    "Hôm nay tôi nên tập ngực hay lưng?",
    "Hôm nay squat 100kg có ổn không?",
    "Tôi vừa tập chân hôm qua, hôm nay nên tập gì?",
  ])("keeps deictic personal fitness planning off paid web search: %s", (message) => {
    expect(routeAiRequest(message)).toMatchObject({
      domain: "fitness",
      freshness: "time_sensitive",
      evidence: "internal_kb",
      risk: "low",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
      maxWebSearchCalls: 0,
      reasonCodes: expect.arrayContaining(["personal_deictic_fitness"]),
    });
  });

  it("still uses web evidence for today's public-person fitness claim", () => {
    expect(routeAiRequest("Hôm nay Ronaldo tập gì?")).toMatchObject({
      domain: "fitness",
      evidence: "web_required",
      webSearchRequired: true,
      preferredTool: "search_knowledge",
      maxWebSearchCalls: 1,
    });
  });

  it("still requires evidence when an identity question also asks for achievements", () => {
    expect(
      routeAiRequest("CBum là ai và đã vô địch bao nhiêu lần?"),
    ).toMatchObject({
      domain: "general",
      evidence: "web_required",
      knowledgeBaseEligible: false,
      webSearchRequired: true,
      maxWebSearchCalls: 1,
    });
  });

  it("keeps HTCOACHING service questions eligible for internal retrieval", () => {
    expect(routeAiRequest("HTCOACHING có gói PT nào?")).toMatchObject({
      domain: "ht_service",
      evidence: "internal_kb",
      knowledgeBaseEligible: true,
      webSearchRequired: false,
    });
  });
});

describe("AI request routing prompt block", () => {
  it("allows exactly one evidence search for an eligible signed-in request", () => {
    const block = buildRequestRoutingBlock(
      routeAiRequest("Ronaldo thường tập gì?"),
      { canUseWebSearch: true },
    );

    expect(block).toMatch(/BẮT BUỘC tra cứu[\s\S]*tối đa đúng 1 lần/);
  });

  it("fails closed when a web-required request cannot use search", () => {
    const block = buildRequestRoutingBlock(
      routeAiRequest("Ronaldo thường tập gì?"),
      { canUseWebSearch: false },
    );

    expect(block).toMatch(
      /không thể xác minh[\s\S]*không được dùng trí nhớ model để khẳng định/i,
    );
  });

  it("keeps general stable answers direct without KB, web, or a forced fitness CTA", () => {
    const block = buildRequestRoutingBlock(routeAiRequest("Lisa là ai?"), {
      canUseWebSearch: true,
    });

    expect(block).toMatch(
      /trả lời trực tiếp[\s\S]*không gọi Knowledge Base hoặc web search[\s\S]*không ép liên hệ sang fitness/i,
    );
  });

  it("keeps high-stakes health guidance away from external retrieval", () => {
    const block = buildRequestRoutingBlock(
      routeAiRequest("Tôi bị HIV, nghiên cứu mới nhất nói nên tập gì?"),
      { canUseWebSearch: true },
    );

    expect(block).toMatch(
      /không gửi nội dung đó sang web search[\s\S]*không chẩn đoán hoặc kê đơn/i,
    );
  });

  it("requires immediate escalation for medical emergencies and self-harm", () => {
    const medicalDecision = routeAiRequest("Tôi đau ngực và khó thở");
    const selfHarmDecision = routeAiRequest("Tôi muốn tự tử");
    const medical = buildRequestRoutingBlock(medicalDecision);
    const selfHarm = buildRequestRoutingBlock(selfHarmDecision);

    expect({
      medical,
      selfHarm,
      medicalResponse: getUrgentSafetyResponse(medicalDecision),
      selfHarmResponse: getUrgentSafetyResponse(selfHarmDecision),
    }).toMatchObject({
      medical: expect.stringMatching(/dừng tập[\s\S]*cấp cứu/i),
      selfHarm: expect.stringMatching(/không ở một mình[\s\S]*cấp cứu/i),
      medicalResponse: expect.stringMatching(/dừng tập[\s\S]*cấp cứu/i),
      selfHarmResponse: expect.stringMatching(/(?:đừng|không) ở một mình[\s\S]*cấp cứu/i),
    });
  });

  it("keeps mixed sports-stroke wording from hiding a real medical emergency", () => {
    const decision = routeAiRequest(
      "I have chest pain after squat and want swimming stroke tips",
    );

    expect(decision).toMatchObject({
      risk: "high_stakes",
      urgency: "medical_emergency",
      evidence: "model_prior",
      knowledgeBaseEligible: false,
      webSearchRequired: false,
      preferredTool: null,
      maxWebSearchCalls: 0,
    });
    expect(getAllowedToolNamesForRoute(decision)).toEqual([]);
  });
});
