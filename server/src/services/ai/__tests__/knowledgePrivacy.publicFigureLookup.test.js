import { describe, expect, it } from "vitest";

import {
  applyPublicFigureCanonicalNames,
  prepareExternalKnowledgeQuery,
  resolvePublicFigureLookup,
} from "../knowledgePrivacy.js";
import { findPublicFigures, PUBLIC_FIGURE_REGISTRY } from "../publicFigureRegistry.js";
import { routeAiRequest } from "../requestRouter.js";

const LEBRON_QUESTION =
  "bạn biết LeBron James không bro, thành tích của anh ấy vang dội như thế nào và anh ấy củng tập luyện rất kỷ luật để có được thân hình săn chắc đúng không";

describe("public figure registry", () => {
  it("covers Vietnamese athletes first and keeps the list around forty people", () => {
    const scopes = PUBLIC_FIGURE_REGISTRY.map((entry) => entry.scope);
    expect(scopes.slice(0, 18).every((scope) => scope === "vietnam")).toBe(true);
    expect(PUBLIC_FIGURE_REGISTRY.length).toBeGreaterThanOrEqual(40);
    expect(PUBLIC_FIGURE_REGISTRY.length).toBeLessThanOrEqual(50);
  });

  it("never lists a bare given name as an alias", () => {
    for (const entry of PUBLIC_FIGURE_REGISTRY) {
      for (const alias of entry.aliases) {
        expect(alias).not.toMatch(/^(?:Quang Hải|Văn Hậu|Tiến Linh|Văn Lâm|Hoàng Đức)$/u);
      }
    }
  });

  it.each([
    ["Hoàng Hải Đăng thành tích thế nào?", "Hoàng Hải Đăng", "Hoàng Hải Đăng"],
    ["Đăng Béo thường tập gì?", "Đăng Béo", "Hoàng Hải Đăng"],
    ["đăng béo tập như thế nào", "đăng béo", "Hoàng Hải Đăng"],
    ["dang beo tap nhu the nao", "dang beo", "Hoàng Hải Đăng"],
    ["Vũ Minh Hiếu có thành tích gì?", "Vũ Minh Hiếu", "Vũ Minh Hiếu"],
    ["CR7 tập gì mỗi ngày?", "CR7", "Cristiano Ronaldo"],
    ["cr7 an gi moi ngay", "cr7", "Cristiano Ronaldo"],
    ["King James tập luyện thế nào?", "King James", "LeBron James"],
    ["Black Mamba thành tích ra sao?", "Black Mamba", "Kobe Bryant"],
    ["kobe bryant tập luyện kỷ luật thế nào", "kobe bryant", "Kobe Bryant"],
    ["The Rock ăn gì mỗi ngày?", "The Rock", "Dwayne Johnson"],
    ["Ánh Viên tập bơi bao nhiêu giờ?", "Ánh Viên", "Nguyễn Thị Ánh Viên"],
  ])("recognises %s", (question, surface, canonical) => {
    expect(findPublicFigures(question)).toEqual([{ canonical, surface }]);
  });

  it("does not match inside other words or for ordinary private names", () => {
    expect(findPublicFigures("Tôi muốn cr7x hoặc therock123")).toEqual([]);
    expect(findPublicFigures("Nguyễn Văn A thường tập gì?")).toEqual([]);
    expect(findPublicFigures("Trần Thị B tập gym bao lâu rồi?")).toEqual([]);
  });
});

describe("public figure lookup gate", () => {
  it("binds the typed form and the canonical name and rewrites the query", () => {
    const lookup = resolvePublicFigureLookup("Đăng Béo thường tập gì để có thân hình đó?");
    expect(lookup.names).toEqual(["Đăng Béo", "Hoàng Hải Đăng"]);
    expect(
      applyPublicFigureCanonicalNames("Đăng Béo thường tập gì?", lookup.rewrites),
    ).toBe("Hoàng Hải Đăng thường tập gì?");
  });

  it("lets a registry figure through the external query gate and nobody else", () => {
    const lookup = resolvePublicFigureLookup(LEBRON_QUESTION);
    expect(lookup.names).toContain("LeBron James");
    expect(
      prepareExternalKnowledgeQuery(LEBRON_QUESTION, { allowedPublicPersonNames: lookup.names }),
    ).toMatchObject({ eligible: true });
    expect(prepareExternalKnowledgeQuery(LEBRON_QUESTION)).toMatchObject({
      eligible: false,
      reason: "ambiguous_person_identity",
    });
  });

  it.each([
    "Nguyễn Văn A thường tập gì?",
    "Trần Thị B tập gym bao lâu rồi?",
    "Lisa có tập gym không?",
  ])("binds nothing for a name outside the registry: %s", (question) => {
    expect(resolvePublicFigureLookup(question)).toEqual({ names: [], rewrites: [] });
  });

  it.each([
    "học viên Hoàng Hải Đăng bị tiểu đường, nên ăn gì?",
    "Hoàng Hải Đăng là khách hàng của tôi, lịch tập thế nào?",
    "bạn tôi Vũ Minh Hiếu tập gym thế nào?",
    "Cristiano Ronaldo đang điều trị ung thư, có nên tập không?",
    "Lionel Messi bị tiểu đường type 2 thì nên ăn gì?",
  ])("does not bind a registry name used as a private subject: %s", (question) => {
    expect(resolvePublicFigureLookup(question)).toEqual({ names: [], rewrites: [] });
  });

  it("makes the router treat a registry figure as a named person", () => {
    const decision = routeAiRequest("CR7 tập gì mỗi ngày?", {});
    expect(decision.webSearchRequired).toBe(true);
    expect(decision.reasonCodes).toContain("public_person_claim");
  });
});
