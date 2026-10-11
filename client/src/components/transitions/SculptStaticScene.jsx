import SculptFigure from "./SculptFigure";
import approvedPhaseOneScene from "../../assets/images/transitions/self-sculpting-phase1-approved.webp";
import { DustField, TransitionCover } from "./SculptAtmospherics";
import {
  getSculptAnimationState,
  isSculptLayerActive,
} from "./sculptAnimationStates";

const SceneLayer = ({ active, children, className = "", id, source }) => (
  <div
    className={`pointer-events-none absolute inset-0 ${className}`}
    data-sculpt-active={active ? "true" : "false"}
    data-sculpt-layer={id}
    data-sculpt-layer-source={source}
    aria-hidden="true"
  >
    {children}
  </div>
);

const TargetImage = ({ active, className, effect }) => (
  <SculptFigure
    effect={effect}
    className={`${active ? "opacity-55" : "opacity-0"} ${className}`}
  />
);

const MotionAnchor = ({ effect }) => (
  <span
    className="pointer-events-none absolute inset-0"
    data-sculpt-effect={effect}
    data-sculpt-motion-anchor="true"
    aria-hidden="true"
  />
);

const HammerMotion = ({ hideRestPose }) => (
  <svg
    className="absolute inset-0 h-full w-full scale-[0.9] origin-center overflow-visible"
    viewBox="0 0 1672 941"
    preserveAspectRatio="xMidYMid slice"
    data-sculpt-hammer-rig="true"
    aria-hidden="true"
  >
    <defs>
      <filter id="hammer-mask-feather" x="-24%" y="-24%" width="148%" height="148%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id="hammer-clean-plate-feather" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <radialGradient
        id="hammer-clean-plate"
        gradientUnits="userSpaceOnUse"
        cx="820"
        cy="210"
        r="390"
      >
        <stop offset="0" stopColor="#234766" />
        <stop offset="0.42" stopColor="#153653" />
        <stop offset="0.72" stopColor="#0a213d" />
        <stop offset="1" stopColor="#041027" />
      </radialGradient>
      <mask id="hammer-motion-mask" maskUnits="userSpaceOnUse" x="850" y="-24" width="290" height="300">
        <path
          d="M874 -12 L986 -12 L1005 54 L994 83 L1025 101 L1059 145 L1098 196 L1111 233 L1094 258 L1068 253 L1045 219 L1026 181 L1000 142 L967 120 L940 103 L891 88 Z"
          fill="white"
          filter="url(#hammer-mask-feather)"
        />
      </mask>
      <mask id="hammer-clean-plate-mask" maskUnits="userSpaceOnUse" x="840" y="-32" width="310" height="320">
        <path
          d="M868 -18 L992 -18 L1013 58 L1001 86 L1031 103 L1065 146 L1104 196 L1118 232 L1102 252 L1081 245 L1055 211 L1034 174 L1008 136 L973 113 L938 99 L884 84 Z"
          fill="white"
          filter="url(#hammer-clean-plate-feather)"
        />
      </mask>
    </defs>
    <rect
      x="840"
      y="-32"
      width="310"
      height="320"
      fill="url(#hammer-clean-plate)"
      mask="url(#hammer-clean-plate-mask)"
      opacity={hideRestPose ? "1" : "0"}
      data-sculpt-effect="hammer-rest-occluder"
      data-sculpt-clean-plate="forearm-only"
    />
    <g
      opacity="0"
      data-sculpt-effect="hammer-swing-tool"
      data-sculpt-soft-mask="true"
      data-sculpt-hammer-joint="elbow"
    >
      <image
        href={approvedPhaseOneScene}
        width="1672"
        height="941"
        preserveAspectRatio="xMidYMid slice"
        mask="url(#hammer-motion-mask)"
      />
    </g>
  </svg>
);

const DebrisField = ({ expanded }) => (
  <div
    className={expanded ? "opacity-100" : "opacity-0"}
    data-sculpt-effect="floating-debris"
  >
    <span className="absolute left-[19%] top-[61%] h-4 w-5 rotate-12 bg-gradient-to-br from-stone-300 via-stone-500 to-stone-800 shadow-md [clip-path:polygon(18%_0,100%_24%,74%_100%,0_68%)]" />
    <span className="absolute left-[27%] top-[38%] h-3 w-4 -rotate-12 bg-gradient-to-br from-stone-200 via-stone-500 to-stone-900 shadow-sm [clip-path:polygon(50%_0,100%_72%,20%_100%,0_30%)]" />
    <span className="absolute right-[23%] top-[46%] h-4 w-5 rotate-45 bg-gradient-to-br from-stone-300 via-stone-600 to-stone-900 shadow-md [clip-path:polygon(10%_16%,82%_0,100%_78%,36%_100%)]" />
    <span className="absolute right-[16%] top-[65%] h-5 w-4 -rotate-6 bg-gradient-to-br from-stone-400 via-stone-600 to-stone-950 shadow-md [clip-path:polygon(45%_0,100%_34%,76%_100%,0_72%,8%_18%)]" />
    <span className="absolute bottom-[12%] left-[30%] h-6 w-7 rotate-6 bg-gradient-to-br from-stone-300 via-stone-600 to-stone-950 shadow-lg [clip-path:polygon(8%_24%,66%_0,100%_58%,72%_100%,0_82%)]" />
    <span className="absolute left-[22%] top-[45%] h-2 w-3 -rotate-8 bg-gradient-to-br from-stone-300 via-stone-500 to-stone-800 shadow-sm [clip-path:polygon(50%_0,100%_62%,20%_100%,0_30%)]" />
    <span className="absolute right-[30%] top-[72%] h-2 w-2 rotate-24 bg-gradient-to-br from-stone-200 via-stone-600 to-stone-900 shadow-sm [clip-path:polygon(46%_0,100%_36%,72%_100%,0_68%)]" />
    <span className="absolute left-[48%] top-[26%] h-3 w-2 -rotate-18 bg-gradient-to-br from-stone-300 via-stone-600 to-stone-950 shadow-md [clip-path:polygon(28%_0,100%_20%,82%_100%,0_74%)]" />
  </div>
);

const SculptStaticScene = ({
  activeState = "idle",
  sceneRef,
  timelineEnabled = false,
}) => {
  const state = getSculptAnimationState(activeState);
  const isActive = (layerId) => isSculptLayerActive(state.id, layerId);
  const impactVisible = ["impact", "shell-crack"].includes(state.id);
  const breakupVisible = [
    "shell-breakup",
    "debris-expansion",
    "transition-cover",
  ].includes(state.id);
  const revealVisible = ["shell-crack", "shell-breakup", "muscle-reveal"].includes(state.id);
  const dustVisible = [
    "impact",
    "shell-crack",
    "shell-breakup",
    "debris-expansion",
  ].includes(state.id);

  return (
    <div
      ref={sceneRef}
      className="relative isolate h-full w-full overflow-hidden bg-[#020B24]"
      data-sculpt-phase={timelineEnabled ? "animation" : "animation-state-preparation"}
      data-sculpt-state={state.id}
      data-sculpt-timeline={timelineEnabled ? "enabled" : "off"}
    >
      <SceneLayer id="background-base" source="procedural" active={isActive("background-base")} className="bg-[#020B24]" />
      <SceneLayer
        id="spotlight"
        source="procedural"
        active={isActive("spotlight")}
        className={revealVisible
          ? "bg-[radial-gradient(circle_at_51%_42%,rgba(243,178,106,0.3)_0%,rgba(23,58,114,0.64)_30%,transparent_70%)]"
          : "bg-[radial-gradient(circle_at_54%_40%,rgba(23,58,114,0.62)_0%,rgba(6,20,58,0.2)_42%,transparent_72%)]"}
      />
      <SceneLayer id="vignette" source="procedural" active={isActive("vignette")} className="z-40 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(1,6,26,0.5)_78%,rgba(1,6,26,0.9)_100%)]" />
      <SceneLayer id="haze" source="procedural" active={isActive("haze")} className="z-10 bg-[radial-gradient(ellipse_at_52%_54%,rgba(185,165,142,0.09)_0%,transparent_55%)]" />
      <SceneLayer id="halo" source="procedural" active={isActive("halo")} className="z-10 flex items-center justify-center">
        <span className={`block aspect-square rounded-full border ${impactVisible ? "h-[min(82vh,82vw)] border-orange-200/55 shadow-[0_0_120px_rgba(255,158,69,0.38)]" : "h-[min(76vh,76vw)] border-slate-300/10 shadow-[0_0_110px_rgba(23,58,114,0.22)]"}`} />
      </SceneLayer>
      <SceneLayer id="main-body" source="approved-composite" active={isActive("main-body")} className="z-20">
        <SculptFigure className="scale-[0.9] origin-center" />
      </SceneLayer>
      <SceneLayer id="inner-muscular-body" source="approved-composite-mask" active={isActive("inner-muscular-body")} className="z-30">
        <TargetImage active={revealVisible} effect="inner-reveal" className="scale-[0.9] origin-center brightness-125 contrast-125 drop-shadow-[0_0_22px_rgba(243,178,106,0.62)] [mask-image:radial-gradient(ellipse_28%_44%_at_50%_39%,black_28%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_28%_44%_at_50%_39%,black_28%,transparent_75%)]" />
      </SceneLayer>
      <SceneLayer id="outer-stone-shell" source="approved-composite-mask" active={isActive("outer-stone-shell")} className="z-30">
        <TargetImage active={isActive("outer-stone-shell")} effect="stone-shell-focus" className="scale-[0.9] origin-center brightness-110 sepia-[0.2] [mask-image:radial-gradient(ellipse_30%_45%_at_50%_71%,black_32%,transparent_76%)] [-webkit-mask-image:radial-gradient(ellipse_30%_45%_at_50%_71%,black_32%,transparent_76%)]" />
      </SceneLayer>
      <SceneLayer id="hammer-arm" source="approved-composite-mask" active={isActive("hammer-arm")} className="z-30">
        <MotionAnchor effect="hammer-arm-focus" />
      </SceneLayer>
      <SceneLayer id="hammer" source="approved-composite-mask" active={isActive("hammer")} className="z-30">
        <MotionAnchor effect="hammer-focus" />
        <HammerMotion hideRestPose={["hammer-swing", "impact"].includes(state.id)} />
      </SceneLayer>
      <SceneLayer id="chisel-arm" source="approved-composite-mask" active={isActive("chisel-arm")} className="z-30">
        <MotionAnchor effect="chisel-arm-focus" />
      </SceneLayer>
      <SceneLayer id="chisel" source="approved-composite-mask" active={isActive("chisel")} className="z-30">
        <MotionAnchor effect="chisel-focus" />
      </SceneLayer>
      <SceneLayer id="cracks" source="procedural-vector" active={isActive("cracks")} className="z-30">
        <span
          className="pointer-events-none absolute left-1/2 top-[48%] aspect-square w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/60 opacity-0"
          data-sculpt-effect="shockwave-ring"
          aria-hidden="true"
        />
        <span className={state.id === "impact" ? "absolute left-[48%] top-[48%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92)_0%,rgba(255,158,69,0.62)_16%,transparent_68%)] opacity-100" : "absolute left-[48%] top-[48%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 opacity-0"} data-sculpt-effect="impact-flash" />
        <svg className={impactVisible ? "absolute inset-0 h-full w-full opacity-100" : "absolute inset-0 h-full w-full opacity-0"} viewBox="0 0 100 100" preserveAspectRatio="none" data-sculpt-effect="crack-network" aria-hidden="true">
          <g fill="none" stroke="rgba(243,178,106,0.86)" strokeWidth="1.6">
            <path vectorEffect="non-scaling-stroke" d="M48 48 L44 56 L46 63 L40 72 L42 86" />
            <path vectorEffect="non-scaling-stroke" d="M45 57 L37 61 L34 70" />
            <path vectorEffect="non-scaling-stroke" d="M46 64 L53 70 L54 82" />
            <path vectorEffect="non-scaling-stroke" d="M48 49 L54 55 L59 64" />
            <path vectorEffect="non-scaling-stroke" d="M42 62 L58 58 L66 64" />
            <path vectorEffect="non-scaling-stroke" d="M54 56 L62 48 L68 40 L74 34" />
          </g>
        </svg>
      </SceneLayer>
      <SceneLayer id="floating-debris" source="procedural-fragments" active={isActive("floating-debris")} className="z-30">
        <DebrisField expanded={breakupVisible} />
      </SceneLayer>
      <SceneLayer id="dust-particles" source="procedural" active={isActive("dust-particles")} className="z-30">
        <DustField visible={dustVisible} />
      </SceneLayer>
      <SceneLayer id="foreground-rubble" source="approved-composite-mask" active={isActive("foreground-rubble")} className="z-30">
        <TargetImage active={isActive("foreground-rubble")} effect="foreground-rubble-focus" className="scale-[0.9] origin-center brightness-90 [clip-path:polygon(0_82%,100%_78%,100%_100%,0_100%)]" />
        <TransitionCover visible={state.id === "transition-cover"} />
      </SceneLayer>
    </div>
  );
};

export default SculptStaticScene;
