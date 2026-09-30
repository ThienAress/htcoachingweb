import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import SculptStaticScene from "../SculptStaticScene";
import SculptTransitionOverlay from "../SculptTransitionOverlay";
import { SCULPT_STATIC_LAYER_IDS } from "../sculptSceneLayers";

describe("SculptStaticScene layer contract", () => {
  test("render đủ các layer theo đúng thứ tự dành cho animation về sau", () => {
    const markup = renderToStaticMarkup(<SculptStaticScene />);
    const renderedLayerIds = Array.from(
      markup.matchAll(/data-sculpt-layer="([^"]+)"/g),
      (match) => match[1],
    );

    expect(renderedLayerIds).toEqual(SCULPT_STATIC_LAYER_IDS);
  });

  test("Phase 3 bật timeline targets trên approved asset", () => {
    const markup = renderToStaticMarkup(<SculptStaticScene timelineEnabled />);

    expect({
      animationPhase: markup.includes('data-sculpt-phase="animation"'),
      idleState: markup.includes('data-sculpt-state="idle"'),
      timelineEnabled: markup.includes('data-sculpt-timeline="enabled"'),
      approvedAsset: markup.includes('data-sculpt-source="approved-reference"'),
    }).toEqual({
      animationPhase: true,
      idleState: true,
      timelineEnabled: true,
      approvedAsset: true,
    });
  });

  test("render sẵn các visual target cần cho Phase 3", () => {
    const markup = renderToStaticMarkup(<SculptStaticScene activeState="idle" />);
    const effectIds = Array.from(
      markup.matchAll(/data-sculpt-effect="([^"]+)"/g),
      (match) => match[1],
    );

    expect(effectIds).toEqual([
      "inner-reveal",
      "stone-shell-focus",
      "hammer-arm-focus",
      "hammer-focus",
      "hammer-rest-occluder",
      "hammer-swing-tool",
      "chisel-arm-focus",
      "chisel-focus",
      "shockwave-ring",
      "impact-flash",
      "crack-network",
      "floating-debris",
      "dust-particles",
      "foreground-rubble-focus",
      "transition-cover",
    ]);
  });

  test("tool motion dùng anchor trong suốt, không nhân bản raster gây lộ mép vuông", () => {
    const markup = renderToStaticMarkup(
      <SculptStaticScene activeState="hammer-swing" timelineEnabled />,
    );
    const toolTargets = Array.from(
      markup.matchAll(
        /<(span|img)[^>]*data-sculpt-effect="(hammer-arm-focus|hammer-focus|chisel-arm-focus|chisel-focus)"[^>]*>/g,
      ),
      ([, tag, effect]) => ({ tag, effect }),
    );

    expect(toolTargets).toEqual([
      { tag: "span", effect: "hammer-arm-focus" },
      { tag: "span", effect: "hammer-focus" },
      { tag: "span", effect: "chisel-arm-focus" },
      { tag: "span", effect: "chisel-focus" },
    ]);
  });

  test("tay búa có raster chuyển động với mask mềm thay vì clip-path cạnh vuông", () => {
    const markup = renderToStaticMarkup(
      <SculptStaticScene activeState="hammer-swing" timelineEnabled />,
    );
    const hammerSwingTarget = markup.match(
      /<g[^>]*data-sculpt-effect="hammer-swing-tool"[^>]*>/,
    )?.[0];
    const restOccluder = markup.match(
      /<rect[^>]*data-sculpt-effect="hammer-rest-occluder"[^>]*>/,
    )?.[0];

    expect({
      hasSwingRaster: Boolean(hammerSwingTarget),
      usesSoftMask: hammerSwingTarget?.includes('data-sculpt-soft-mask="true"'),
      articulatesFromElbow: hammerSwingTarget?.includes('data-sculpt-hammer-joint="elbow"'),
      exposesHardClip: hammerSwingTarget?.includes("clip-path"),
      hidesRestPoseDuringSwing: restOccluder?.includes('opacity="1"'),
    }).toEqual({
      hasSwingRaster: true,
      usesSoftMask: true,
      articulatesFromElbow: true,
      exposesHardClip: false,
      hidesRestPoseDuringSwing: true,
    });
  });

  test("bụi vỡ đá có plume, wisp và grit đa tầng thay vì capsule phát sáng", () => {
    const markup = renderToStaticMarkup(
      <SculptStaticScene activeState="shell-breakup" timelineEnabled />,
    );

    expect({
      dustPlumes: (markup.match(/data-sculpt-dust-plume="true"/g) || []).length,
      dustWisps: (markup.match(/data-sculpt-dust-wisp="true"/g) || []).length,
      dustGrit: (markup.match(/data-sculpt-dust-grit="true"/g) || []).length,
      repeatedDotGrid: markup.includes("bg-[size:"),
      artificialScreenBlend: markup.includes("mix-blend-screen"),
      organicSilhouettes: (markup.match(/data-sculpt-dust-plume="true"/g) || []).length === 3,
    }).toEqual({
      dustPlumes: 3,
      dustWisps: 5,
      dustGrit: 10,
      repeatedDotGrid: false,
      artificialScreenBlend: false,
      organicSilhouettes: true,
    });
  });

  test("cover dùng bụi áp camera và đá tiền cảnh thay cho năm mảng kín khung", () => {
    const markup = renderToStaticMarkup(
      <SculptStaticScene activeState="transition-cover" timelineEnabled />,
    );

    expect({
      dustBanks: (markup.match(/data-sculpt-cover-dust="true"/g) || []).length,
      foregroundFragments: (markup.match(/data-sculpt-cover-fragment="true"/g) || []).length,
    }).toEqual({
      dustBanks: 3,
      foregroundFragments: 7,
    });
  });

  test("overlay mô tả đúng preview chuyển động 5 giây", () => {
    const markup = renderToStaticMarkup(
      <SculptTransitionOverlay motionEnabled onClose={() => {}} />,
    );

    expect({
      previewCopy: markup.includes("Bản xem thử chuyển động · Chu kỳ 5 giây"),
      timelineEnabled: markup.includes('data-sculpt-timeline="enabled"'),
    }).toEqual({ previewCopy: true, timelineEnabled: true });
  });

  test("reduced-motion giữ keyframe tĩnh và không bật timeline", () => {
    const markup = renderToStaticMarkup(
      <SculptTransitionOverlay motionEnabled={false} onClose={() => {}} />,
    );

    expect({
      staticCopy: markup.includes("Chuyển động đã tắt theo cài đặt thiết bị"),
      timelineOff: markup.includes('data-sculpt-timeline="off"'),
    }).toEqual({ staticCopy: true, timelineOff: true });
  });

  test("preview luôn có inspector và nút đóng, không có hành động chuyển trang", () => {
    const markup = renderToStaticMarkup(
      <SculptTransitionOverlay motionEnabled onClose={() => {}} />,
    );

    expect({
      inspectorVisible: markup.includes("data-sculpt-state-inspector"),
      closeAction: markup.includes("Đóng xem thử"),
      skipAction: markup.includes("Bỏ qua hiệu ứng"),
    }).toEqual({
      inspectorVisible: true,
      closeAction: true,
      skipAction: false,
    });
  });
});
