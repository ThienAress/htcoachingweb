import { useId } from "react";
import { BODY_REGIONS } from "./bodyAssessment";

// One selectable shape per data region; internal contours are decorative only.
const regionPaths = {
  leftArm: "M68 72 Q48 69 42 88 Q37 103 42 118 Q32 128 29 149 L16 183 L7 198 Q3 203 7 205 L17 198 L10 220 Q10 225 14 223 L22 205 L17 229 Q20 233 23 227 L29 207 L25 229 Q29 232 32 224 L37 205 L34 222 Q38 225 41 215 L43 197 L36 183 L48 158 Q58 139 56 124 Q65 113 67 94 L77 82Z",
  rightArm: "M152 72 Q172 69 178 88 Q183 103 178 118 Q188 128 191 149 L204 183 L213 198 Q217 203 213 205 L203 198 L210 220 Q210 225 206 223 L198 205 L203 229 Q200 233 197 227 L191 207 L195 229 Q191 232 188 224 L183 205 L186 222 Q182 225 179 215 L177 197 L184 183 L172 158 Q162 139 164 124 Q155 113 153 94 L143 82Z",
  trunk: "M93 53 L98 47 L122 47 L127 53 L132 63 L153 73 Q141 84 153 105 L148 126 Q139 146 144 169 L147 185 L131 204 L110 221 L89 204 L73 185 L76 169 Q81 146 72 126 L67 105 Q79 84 67 73 L88 63Z",
  leftLeg: "M73 185 Q68 204 69 230 Q69 252 77 273 L80 282 Q71 300 77 325 L82 355 L80 374 L65 388 Q61 394 69 396 L87 393 L97 384 L98 368 L100 339 Q108 315 102 292 L99 280 L107 243 L110 221 L89 204Z",
  rightLeg: "M147 185 Q152 204 151 230 Q151 252 143 273 L140 282 Q149 300 143 325 L138 355 L140 374 L155 388 Q159 394 151 396 L133 393 L123 384 L122 368 L120 339 Q112 315 118 292 L121 280 L113 243 L110 221 L131 204Z",
};
const regionColors = {
  leftArm: ["fill-blue-400", "hover:fill-blue-400 focus-visible:fill-blue-400"],
  rightArm: ["fill-emerald-400", "hover:fill-emerald-400 focus-visible:fill-emerald-400"],
  trunk: ["fill-orange-400", "hover:fill-orange-400 focus-visible:fill-orange-400"],
  leftLeg: ["fill-amber-400", "hover:fill-amber-400 focus-visible:fill-amber-400"],
  rightLeg: ["fill-rose-400", "hover:fill-rose-400 focus-visible:fill-rose-400"],
};

export const BodySilhouette = ({ selectedRegion, onSelect, label }) => {
  const id = useId();
  return (
    <svg viewBox="0 0 220 405" className="mx-auto h-80 w-full max-w-60" role="group" aria-labelledby={id}>
      <title id={id}>{`${label}. Bên trái của hình biểu thị bên trái được ghi trên phiếu.`}</title>
      {BODY_REGIONS.map(([key, name]) => (
        <path key={key} d={regionPaths[key]} data-body-region={key}
          role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
          aria-label={name} aria-pressed={onSelect ? selectedRegion === key : undefined}
          onClick={() => onSelect?.(key)}
          onKeyDown={(event) => {
            if (onSelect && ["Enter", " "].includes(event.key)) { event.preventDefault(); onSelect(key); }
          }}
          strokeWidth="1.5"
          className={`${selectedRegion === key ? regionColors[key][0] : "fill-slate-400"} stroke-slate-200 transition-[fill] duration-150 motion-reduce:transition-none ${onSelect ? `cursor-pointer ${regionColors[key][1]} focus-visible:stroke-white focus:outline-none` : ""}`}
        />
      ))}
      <path d="M91 13 Q110 -1 129 13 Q136 25 132 38 Q137 38 133 49 L129 51 Q124 65 110 68 Q96 65 91 51 L87 49 Q83 38 88 38 Q84 25 91 13Z" className="pointer-events-none fill-slate-400 stroke-slate-200" strokeWidth="1.5" />
      <g className="pointer-events-none fill-none stroke-slate-200" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M94 59 L101 77 M126 59 L119 77 M74 83 Q92 72 109 88 Q100 113 79 106 L73 93 M146 83 Q128 72 111 88 Q120 113 141 106 L147 93 M110 88 V211" />
        <path d="M86 117 Q96 111 105 118 L104 131 Q94 137 86 129Z M134 117 Q124 111 115 118 L116 131 Q126 137 134 129Z M89 143 Q98 139 104 144 L104 157 Q96 162 89 156Z M131 143 Q122 139 116 144 L116 157 Q124 162 131 156Z M92 170 Q99 166 104 171 L105 184 M128 170 Q121 166 116 171 L115 184 M79 139 L87 166 L94 183 L107 209 M141 139 L133 166 L126 183 L113 209" />
        <path d="M46 84 Q55 77 65 81 L48 108 M44 116 Q36 137 34 150 Q46 147 51 129 M32 158 L22 183 M174 84 Q165 77 155 81 L172 108 M176 116 Q184 137 186 150 Q174 147 169 129 M188 158 L198 183" />
        <path d="M77 197 Q75 231 86 266 Q96 253 99 227 M143 197 Q145 231 134 266 Q124 253 121 227 M80 274 Q88 269 98 278 L91 290Z M140 274 Q132 269 122 278 L129 290Z M84 299 Q78 320 89 350 L93 319 M136 299 Q142 320 131 350 L127 319 M85 360 L88 378 L73 390 M135 360 L132 378 L147 390" />
      </g>
    </svg>
  );
};
