import { gsap } from "gsap";

// The overlay resolves prefers-reduced-motion before this controller mounts.

export const SCULPT_PREVIEW_TIMING = Object.freeze({
  cycleSeconds: 5,
  repeat: -1,
  impactAt: 2,
  revealAt: 2.05,
  coverAt: 3.55,
  resetAt: 4.46,
});

const INTERNAL_CYCLE_SECONDS = 6.5;
const INTERNAL_TIMELINE_SCALE = INTERNAL_CYCLE_SECONDS / SCULPT_PREVIEW_TIMING.cycleSeconds;
const toTimelineSeconds = (seconds) => seconds * INTERNAL_TIMELINE_SCALE;

export const SCULPT_PREVIEW_SEQUENCE = Object.freeze([
  Object.freeze({ id: "idle", at: 0 }),
  Object.freeze({ id: "anticipation", at: 0.75 }),
  Object.freeze({ id: "hammer-swing", at: 1.45 }),
  Object.freeze({ id: "impact", at: SCULPT_PREVIEW_TIMING.impactAt }),
  Object.freeze({ id: "shell-crack", at: 2.2 }),
  Object.freeze({ id: "shell-breakup", at: 2.8 }),
  Object.freeze({ id: "muscle-reveal", at: 3.1 }),
  Object.freeze({ id: "debris-expansion", at: 3.3 }),
  Object.freeze({ id: "transition-cover", at: SCULPT_PREVIEW_TIMING.coverAt }),
]);

const noop = () => {};

export const createSculptPreviewTimeline = ({
  root,
  onStateChange = noop,
} = {}) => {
  if (!root) return null;

  let timeline;
  const context = gsap.context(() => {
    const select = gsap.utils.selector(root);
    const body = select('[data-sculpt-layer="main-body"]');
    const hammerSwingTool = select('[data-sculpt-effect="hammer-swing-tool"]');
    const shell = select('[data-sculpt-effect="stone-shell-focus"]');
    const flash = select('[data-sculpt-effect="impact-flash"]');
    const crackPaths = select('[data-sculpt-effect="crack-network"] path');
    const shockwaveRing = select('[data-sculpt-effect="shockwave-ring"]');
    const halo = select('[data-sculpt-layer="halo"] > span');
    const debris = select('[data-sculpt-effect="floating-debris"] > span');
    const dustPlumes = select('[data-sculpt-dust-plume="true"]');
    const dustWisps = select('[data-sculpt-dust-wisp="true"]');
    const dustGrit = select('[data-sculpt-dust-grit="true"]');
    const cover = select('[data-sculpt-effect="transition-cover"]');
    const coverBackdrop = select('[data-sculpt-cover-backdrop="true"]');
    const coverDust = select('[data-sculpt-cover-dust="true"]');
    const coverFragments = select('[data-sculpt-cover-fragment="true"]');

    // ── Initial state ────────────────────────────────────────────────────────
    gsap.set(flash, { opacity: 0, scale: 0.35 });
    gsap.set(crackPaths, { strokeDasharray: 280, strokeDashoffset: 280 });
    gsap.set(shockwaveRing, { scale: 0.08, opacity: 0 });
    gsap.set(debris, { scale: 0.35, x: 0, y: 0 });
    gsap.set(hammerSwingTool, { opacity: 0, rotation: 0, svgOrigin: "1082 218" });
    gsap.set(dustPlumes, { opacity: 0, scale: 0.3, x: 0, y: 0 });
    gsap.set(dustWisps, { opacity: 0, scaleX: 0.35, x: 0, y: 0 });
    gsap.set(dustGrit, { opacity: 0, scale: 0.3, x: 0, y: 0 });
    gsap.set(coverBackdrop, { opacity: 0 });
    gsap.set(coverDust, { opacity: 0, scale: 0.35 });
    gsap.set(coverFragments, { opacity: 0, scale: 0.18 });

    timeline = gsap.timeline({
      repeat: SCULPT_PREVIEW_TIMING.repeat,
      defaults: { overwrite: "auto" },
    });

    // Silent carrier locks the authored timeline before time scaling.
    timeline.to(
      { progress: 0 },
      {
        progress: 1,
        duration: INTERNAL_CYCLE_SECONDS,
        ease: "none",
      },
      0,
    );

    SCULPT_PREVIEW_SEQUENCE.forEach(({ id, at }) => {
      timeline.call(() => onStateChange(id), null, toTimelineSeconds(at));
    });

    const I = toTimelineSeconds(SCULPT_PREVIEW_TIMING.impactAt);

    timeline
      // ── HAMMER APPEAR + WINDUP (1.5s) ─────────────────────────────────────
      // Tool fades in, then cocks back slightly for perceived weight.
      .fromTo(
        hammerSwingTool,
        { opacity: 0, rotation: 0, x: 0, svgOrigin: "1082 218" },
        { opacity: 1, duration: 0.12, ease: "power2.out", svgOrigin: "1082 218" },
        1.5,
      )
      .to(
        hammerSwingTool,
        { rotation: 14, duration: 0.22, ease: "power2.out", svgOrigin: "1082 218" },
        1.52,
      )

      // ── HAMMER MAIN SWING (1.7s → impact) ─────────────────────────────────
      // power4.in gives the fast-accelerating feel of a real hammer arc.
      .to(
        hammerSwingTool,
        {
          rotation: -92,
          x: -12,
          duration: 0.62,
          ease: "power4.in",
          svgOrigin: "1082 218",
        },
        1.7,
      )
      // Body rises and counter-rotates as energy transfers to the swing.
      .to(
        body,
        {
          rotate: -0.45,
          yPercent: -0.9,
          scaleY: 1.006,
          scaleX: 0.997,
          duration: 0.6,
          ease: "power3.in",
          transformOrigin: "50% 65%",
        },
        1.7,
      )
      // Hammer settles at the contact point.
      .to(
        hammerSwingTool,
        { rotation: -86, duration: 0.1, ease: "power3.out", svgOrigin: "1082 218" },
        I,
      )
      .to(hammerSwingTool, { opacity: 0, duration: 0.2, ease: "power2.out" }, I + 0.16)

      // ── IMPACT (2.4s) ──────────────────────────────────────────────────────
      // Flash — 3 phases: sharp burst → sustained glow → fade out.
      .fromTo(
        flash,
        { opacity: 0, scale: 0.35 },
        { opacity: 1, scale: 2.2, duration: 0.09, ease: "power4.out" },
        I,
      )
      .to(flash, { opacity: 0.72, scale: 1.4, duration: 0.22, ease: "power2.out" }, I + 0.09)
      .to(flash, { opacity: 0, scale: 0.55, duration: 0.32, ease: "power2.in" }, I + 0.31)

      // Shockwave ring radiates outward from the contact point.
      .fromTo(
        shockwaveRing,
        { scale: 0.08, opacity: 0.85 },
        { scale: 9.5, opacity: 0, duration: 0.65, ease: "power2.out" },
        I,
      )

      // Halo pulses on impact then settles back.
      .fromTo(
        halo,
        { scale: 0.9 },
        { scale: 1.14, duration: 0.38, ease: "power3.out", transformOrigin: "50% 50%" },
        I,
      )
      .to(halo, { scale: 1.02, duration: 0.42, ease: "power2.inOut" }, I + 0.42)

      // Body shake — sharp, fast, felt.
      .to(
        body,
        { x: 6, duration: 0.04, repeat: 6, yoyo: true, ease: "power1.inOut" },
        I,
      )
      // Elastic rebound — body springs back with natural oscillation.
      .to(
        body,
        {
          yPercent: 0,
          rotate: 0,
          scaleY: 1,
          scaleX: 1,
          x: 0,
          duration: 0.7,
          ease: "power3.out",
          transformOrigin: "50% 65%",
        },
        I + 0.08,
      )

      // ── SHELL CRACK (2.6s) ─────────────────────────────────────────────────
      // Cracks propagate outward with staggered drawing.
      .to(
        crackPaths,
        { strokeDashoffset: 0, duration: 0.52, stagger: 0.065, ease: "power3.out" },
        I + 0.2,
      )
      // Shell begins shifting under internal pressure.
      .to(
        shell,
        {
          xPercent: 1.8,
          yPercent: 0.9,
          rotate: 1.2,
          scale: 1.015,
          duration: 0.58,
          ease: "power3.out",
          transformOrigin: "51% 58%",
        },
        2.62,
      )

      // ── SHELL BREAKUP (3.0s) ───────────────────────────────────────────────
      // Shell separates more dramatically and fades as it breaks apart.
      .to(
        shell,
        {
          xPercent: 3.5,
          yPercent: 1.8,
          rotate: 2.5,
          scale: 1.03,
          duration: 0.55,
          ease: "power2.out",
          transformOrigin: "51% 58%",
        },
        3.05,
      )
      .to(shell, { opacity: 0.1, duration: 0.68, ease: "power2.out" }, 3.12)

      // ── DEBRIS EXPLOSION (3.0s → 4.3s) ────────────────────────────────────
      // 8 stone fragments fly outward with staggered launches.
      .to(
        debris,
        {
          scale: 1,
          x: (index) => [48, -38, 62, -55, 28, -72, 76, -34][index] ?? 0,
          y: (index) => [36, -52, -42, 48, -68, 28, 22, -58][index] ?? 0,
          rotate: (index) => [24, -20, 36, -28, 18, 42, -32, 16][index] ?? 0,
          duration: 0.88,
          stagger: 0.048,
          ease: "power3.out",
        },
        3.0,
      )
      .to(
        debris,
        { opacity: 0, scale: 0.68, duration: 0.32, stagger: 0.02, ease: "power2.in" },
        4.3,
      )

      // ── DUST PLUMES (5 clouds, 2.4s → 3.4s) ──────────────────────────────
      .fromTo(
        dustPlumes,
        { opacity: 0, scale: 0.45, x: 0, y: 0 },
        {
          opacity: (index) => [0.82, 0.68, 0.55, 0.72, 0.62][index] ?? 0.55,
          scale: (index) => [1.55, 1.32, 1.18, 1.42, 1.25][index] ?? 1.2,
          x: (index) => [-8, 6, -11, 9, -4][index] ?? 0,
          y: (index) => [-5, -3, 3, -7, 4][index] ?? 0,
          rotate: (index) => [-9, 12, -16, 7, 18][index] ?? 0,
          duration: 0.82,
          stagger: 0.055,
          ease: "power2.out",
        },
        I,
      )
      .to(
        dustPlumes,
        { opacity: 0, scale: 1.95, y: "-=32", duration: 0.85, ease: "power2.out" },
        3.42,
      )

      // ── DUST WISPS (8 streaks, 2.55s → 3.5s) ─────────────────────────────
      .fromTo(
        dustWisps,
        { opacity: 0, scaleX: 0.38, x: 0, y: 0 },
        {
          opacity: (index) => [0.14, 0.1, 0.13, 0.08, 0.1, 0.09, 0.12, 0.07][index] ?? 0.09,
          scaleX: (index) => [1.1, 1.04, 1.12, 1.06, 1.08, 1.02, 1.1, 1.05][index] ?? 1.05,
          x: (index) => [-4.5, -2.8, 4, -5, 4.5, -3, 5.5, -2][index] ?? 0,
          y: (index) => [-2.5, -3.5, -2, 2, 2.2, -4, -1.5, 3][index] ?? 0,
          rotate: (index) => [-13, -25, 11, 20, 16, -30, 8, 22][index] ?? 0,
          duration: 1.05,
          stagger: 0.03,
          ease: "power3.out",
        },
        I + 0.15,
      )
      .to(
        dustWisps,
        { opacity: 0, scaleX: 2.1, y: "-=20", duration: 0.72, ease: "power2.out" },
        3.5,
      )

      // ── DUST GRIT (16 particles, 2.4s → 3.0s) ────────────────────────────
      .fromTo(
        dustGrit,
        { opacity: 0, scale: 0.28, x: 0, y: 0 },
        {
          opacity: (index) => [0.78, 0.6, 0.7, 0.52, 0.65, 0.58, 0.72, 0.5, 0.62, 0.68, 0.55, 0.72, 0.48, 0.65, 0.58, 0.7][index % 16],
          scale: (index) => [1.15, 0.78, 1.32, 0.9, 1.05, 0.82, 1.22, 0.75, 1.1, 0.95, 1.28, 0.72, 1.18, 0.88, 1.08, 0.85][index % 16],
          x: (index) => [-58, -38, 24, 52, 78, -84, 92, -50, 42, -96, 66, -28, 88, -72, 30, -44][index] ?? 0,
          y: (index) => [-42, -68, -58, -34, -10, 10, 18, 38, 50, 30, -82, -74, -48, 24, 62, -22][index] ?? 0,
          rotate: (index) => [-42, 28, 68, -52, 38, -18, 58, -34, 26, -62, 44, -24, 72, 16, -48, 36][index % 16],
          duration: 0.48,
          stagger: 0.015,
          ease: "power4.out",
        },
        I,
      )
      .to(
        dustGrit,
        { opacity: 0, y: "+=40", duration: 0.65, ease: "power1.in" },
        3.02,
      )

      // ── TRANSITION COVER (4.6s) ────────────────────────────────────────────
      // Large dust clouds billow up from below to fill frame.
      .set(cover, { opacity: 1 }, toTimelineSeconds(SCULPT_PREVIEW_TIMING.coverAt))
      .fromTo(
        coverDust,
        {
          opacity: 0,
          scale: 0.55,
          xPercent: (index) => [-72, 68, -22][index] ?? 0,
          yPercent: (index) => [32, 28, 46][index] ?? 0,
          rotate: (index) => [-10, 9, -6][index] ?? 0,
        },
        {
          opacity: (index) => [0.85, 0.78, 0.65][index] ?? 0.72,
          xPercent: (index) => [12, -10, 6][index] ?? 0,
          yPercent: (index) => [-8, -12, -18][index] ?? 0,
          scale: (index) => [2.1, 1.95, 1.78][index] ?? 1.9,
          rotate: (index) => [5, -7, 3][index] ?? 0,
          duration: 0.82,
          stagger: 0.05,
          ease: "power3.inOut",
        },
        toTimelineSeconds(SCULPT_PREVIEW_TIMING.coverAt),
      )
      // Fragments launch outward in all directions — cinematic wipe.
      .fromTo(
        coverFragments,
        { opacity: 0, scale: 0.18, x: 0, y: 0, rotate: 0 },
        {
          opacity: (index) => [0.82, 0.68, 0.76, 0.62, 0.74, 0.58, 0.78, 0.65, 0.7, 0.6][index % 10],
          scale: (index) => [1.65, 1.38, 1.82, 1.52, 1.28, 1.72, 1.42, 1.58, 1.35, 1.48][index] ?? 1.5,
          x: (index) => [-280, 240, -200, 310, -340, 360, 42, -150, 220, -260][index] ?? 0,
          y: (index) => [-200, -260, 240, 210, -90, 12, 320, -180, 140, 280][index] ?? 0,
          rotate: (index) => [-30, 38, 22, -44, 48, -22, 32, -36, 26, -28][index] ?? 0,
          duration: 0.72,
          stagger: 0.022,
          ease: "power4.in",
        },
        toTimelineSeconds(SCULPT_PREVIEW_TIMING.coverAt) + 0.04,
      )
      .to(
        coverFragments,
        { opacity: 0, filter: "blur(8px)", duration: 0.32, ease: "power2.out" },
        5.12,
      )
      .to(coverBackdrop, { opacity: 0.98, duration: 0.32, ease: "power2.in" }, 5.12)

      // ── RESET (5.8s) ───────────────────────────────────────────────────────
      .set(
        [body, hammerSwingTool, halo, debris, dustPlumes, dustWisps, dustGrit, coverDust, coverFragments],
        { clearProps: "transform,filter,opacity" },
        toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt),
      )
      .set(shell, { clearProps: "transform,opacity" }, toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt))
      .set(flash, { opacity: 0, scale: 0.35 }, toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt))
      .set(crackPaths, { strokeDashoffset: 280 }, toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt))
      .set(shockwaveRing, { scale: 0.08, opacity: 0 }, toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt))
      .set(
        [hammerSwingTool, dustPlumes, dustWisps, dustGrit, coverDust, coverFragments],
        { opacity: 0 },
        toTimelineSeconds(SCULPT_PREVIEW_TIMING.resetAt),
      )
      .to(cover, { opacity: 0, duration: 0.45, ease: "power2.out" }, 5.85)
      .call(() => onStateChange("idle"), null, 6.42)
      .set(coverBackdrop, { opacity: 0 }, 6.49);
    timeline.timeScale(INTERNAL_TIMELINE_SCALE);
  }, root);

  return {
    pause: () => timeline?.pause(),
    resume: () => timeline?.resume(),
    restart: () => timeline?.restart(true),
    kill: () => {
      timeline?.kill();
      context.revert();
    },
  };
};
