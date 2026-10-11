const gritShapes = [
  { className: "left-[47%] top-[47%] h-1.5 w-1", clip: "polygon(46% 0,100% 36%,72% 100%,0 68%)" },
  { className: "left-[45%] top-[49%] h-1 w-1.5", clip: "polygon(20% 0,100% 20%,70% 100%,0 74%)" },
  { className: "left-[50%] top-[46%] h-2 w-1.5", clip: "polygon(54% 0,100% 62%,24% 100%,0 30%)" },
  { className: "left-[43%] top-[52%] h-1 w-1", clip: "polygon(8% 18%,88% 0,100% 82%,30% 100%)" },
  { className: "left-[53%] top-[50%] h-1.5 w-2", clip: "polygon(0 24%,76% 0,100% 72%,30% 100%)" },
  { className: "left-[40%] top-[56%] h-2 w-1", clip: "polygon(46% 0,100% 40%,62% 100%,0 70%)" },
  { className: "left-[56%] top-[54%] h-1 w-1.5", clip: "polygon(12% 12%,100% 34%,70% 100%,0 62%)" },
  { className: "left-[46%] top-[59%] h-1.5 w-1", clip: "polygon(50% 0,100% 76%,14% 100%,0 28%)" },
  { className: "left-[51%] top-[61%] h-2 w-2", clip: "polygon(22% 0,100% 30%,66% 100%,0 72%)" },
  { className: "left-[37%] top-[60%] h-1 w-1.5", clip: "polygon(0 28%,70% 0,100% 76%,22% 100%)" },
  { className: "left-[34%] top-[43%] h-1.5 w-1", clip: "polygon(46% 0,100% 36%,72% 100%,0 68%)" },
  { className: "left-[62%] top-[48%] h-1 w-1.5", clip: "polygon(20% 0,100% 20%,70% 100%,0 74%)" },
  { className: "left-[38%] top-[64%] h-2 w-1.5", clip: "polygon(54% 0,100% 62%,24% 100%,0 30%)" },
  { className: "left-[57%] top-[62%] h-1 w-1", clip: "polygon(8% 18%,88% 0,100% 82%,30% 100%)" },
  { className: "left-[44%] top-[40%] h-1.5 w-2", clip: "polygon(0 24%,76% 0,100% 72%,30% 100%)" },
  { className: "left-[60%] top-[57%] h-2 w-1", clip: "polygon(46% 0,100% 40%,62% 100%,0 70%)" },
];

export const DustField = ({ visible }) => (
  <div
    className={visible ? "absolute inset-0 opacity-100" : "absolute inset-0 opacity-0"}
    data-sculpt-effect="dust-particles"
  >
    <svg
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="sculpt-dust-cloud" x="-35%" y="-55%" width="170%" height="210%">
          <feGaussianBlur stdDeviation="0.85" />
        </filter>
        <filter id="sculpt-dust-wisp" x="-25%" y="-80%" width="150%" height="260%">
          <feGaussianBlur stdDeviation="0.38" />
        </filter>
        <radialGradient id="sculpt-dust-warm" cx="48%" cy="46%" r="58%">
          <stop offset="0" stopColor="#d3c2a8" stopOpacity="0.76" />
          <stop offset="0.46" stopColor="#9a866d" stopOpacity="0.42" />
          <stop offset="1" stopColor="#55483b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sculpt-dust-cool" cx="44%" cy="52%" r="62%">
          <stop offset="0" stopColor="#b8ab98" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#766858" stopOpacity="0.34" />
          <stop offset="1" stopColor="#413a33" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sculpt-dust-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a9967c" stopOpacity="0" />
          <stop offset="0.42" stopColor="#c7b79f" stopOpacity="0.5" />
          <stop offset="1" stopColor="#706252" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d="M35 53 C34 48 37 43 42 43 C44 38 51 38 54 43 C61 43 64 49 61 54 C62 60 55 63 50 61 C46 65 39 62 39 58 C36 58 34 56 35 53 Z" fill="url(#sculpt-dust-warm)" filter="url(#sculpt-dust-cloud)" data-sculpt-dust-plume="true" />
      <path d="M43 52 C42 48 45 44 49 44 C52 40 58 42 59 47 C64 49 63 55 59 57 C57 61 50 60 48 57 C45 58 42 55 43 52 Z" fill="url(#sculpt-dust-cool)" filter="url(#sculpt-dust-cloud)" data-sculpt-dust-plume="true" />
      <path d="M34 56 C35 50 40 47 45 49 C49 46 55 49 55 54 C60 57 57 63 52 63 C48 67 42 64 41 61 C37 62 34 60 34 56 Z" fill="url(#sculpt-dust-cool)" filter="url(#sculpt-dust-cloud)" data-sculpt-dust-plume="true" />
      <path d="M26 58 C24 50 28 43 34 44 C35 38 43 38 46 44 C52 45 52 53 48 57 C47 62 39 63 37 59 C33 61 27 61 26 58 Z" fill="url(#sculpt-dust-cool)" filter="url(#sculpt-dust-cloud)" data-sculpt-dust-extra="plume" />
      <path d="M55 46 C57 40 63 37 67 39 C70 33 77 35 77 41 C82 44 80 52 74 52 C72 57 64 56 62 51 C58 52 54 50 55 46 Z" fill="url(#sculpt-dust-warm)" filter="url(#sculpt-dust-cloud)" data-sculpt-dust-extra="plume" />

      <path d="M45 49 C40 46 36 45 31 46" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="2.2" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-wisp="true" />
      <path d="M47 50 C42 43 38 40 34 38" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.7" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-wisp="true" />
      <path d="M50 49 C56 45 61 44 67 46" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="2" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-wisp="true" />
      <path d="M47 52 C41 56 37 59 32 62" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.5" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-wisp="true" />
      <path d="M51 52 C57 55 63 58 69 59" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.6" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-wisp="true" />
      <path d="M43 55 C37 53 32 52 27 54" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.4" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-extra="wisp" />
      <path d="M53 50 C59 48 64 46 69 44" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.8" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-extra="wisp" />
      <path d="M48 54 C44 60 42 66 44 72" fill="none" stroke="url(#sculpt-dust-streak)" strokeWidth="1.3" strokeLinecap="round" filter="url(#sculpt-dust-wisp)" data-sculpt-dust-extra="wisp" />
    </svg>

    {gritShapes.slice(0, 10).map(({ className, clip }, index) => (
      <span
        key={className}
        className={`absolute bg-stone-200/70 ${className}`}
        style={{ clipPath: clip }}
        data-sculpt-dust-grit="true"
        data-sculpt-grit-index={index}
      />
    ))}
  </div>
);

const coverFragments = [
  "left-[45%] top-[49%] h-10 w-14 [clip-path:polygon(18%_0,100%_26%,72%_100%,0_68%)]",
  "left-[52%] top-[46%] h-8 w-11 [clip-path:polygon(52%_0,100%_58%,34%_100%,0_26%)]",
  "left-[42%] top-[54%] h-12 w-10 [clip-path:polygon(28%_0,100%_20%,82%_100%,0_74%)]",
  "left-[57%] top-[56%] h-9 w-13 [clip-path:polygon(8%_18%,76%_0,100%_72%,34%_100%)]",
  "left-[38%] top-[44%] h-7 w-9 [clip-path:polygon(42%_0,100%_36%,68%_100%,0_70%)]",
  "left-[61%] top-[43%] h-6 w-10 [clip-path:polygon(16%_0,100%_28%,78%_100%,0_64%)]",
  "left-[49%] top-[61%] h-9 w-8 [clip-path:polygon(36%_0,100%_44%,58%_100%,0_72%)]",
  "left-[36%] top-[58%] h-8 w-11 [clip-path:polygon(22%_0,100%_32%,68%_100%,0_62%)]",
  "left-[55%] top-[38%] h-7 w-8 [clip-path:polygon(46%_0,100%_54%,28%_100%,0_38%)]",
  "left-[44%] top-[67%] h-11 w-9 [clip-path:polygon(12%_8%,82%_0,100%_78%,22%_100%)]",
];

export const TransitionCover = ({ visible }) => (
  <div
    className={visible ? "absolute inset-0 opacity-100" : "absolute inset-0 opacity-0"}
    data-sculpt-effect="transition-cover"
  >
    <span
      className="absolute inset-0 opacity-0 [background:radial-gradient(ellipse_at_48%_58%,rgba(82,70,58,0.5)_0%,rgba(24,25,31,0.88)_48%,rgba(2,7,19,0.98)_100%)]"
      data-sculpt-cover-backdrop="true"
    />

    <span
      className="absolute -bottom-[24%] -left-[18%] h-[74%] w-[68%] rounded-[42%_58%_46%_54%/64%_42%_58%_36%] bg-[radial-gradient(ellipse_at_58%_66%,rgba(184,161,133,0.78)_0%,rgba(111,96,80,0.52)_44%,rgba(37,37,42,0)_76%)] opacity-0 blur-3xl"
      data-sculpt-cover-dust="true"
    />
    <span
      className="absolute -bottom-[28%] -right-[16%] h-[78%] w-[70%] rounded-[55%_45%_62%_38%/48%_62%_38%_52%] bg-[radial-gradient(ellipse_at_42%_62%,rgba(168,148,124,0.72)_0%,rgba(96,84,71,0.5)_46%,rgba(31,31,36,0)_78%)] opacity-0 blur-3xl"
      data-sculpt-cover-dust="true"
    />
    <span
      className="absolute bottom-[-18%] left-[18%] h-[68%] w-[64%] rounded-[48%_52%_38%_62%/58%_44%_56%_42%] bg-[radial-gradient(ellipse_at_50%_58%,rgba(190,167,137,0.62)_0%,rgba(104,90,75,0.44)_43%,rgba(32,31,34,0)_80%)] opacity-0 blur-3xl"
      data-sculpt-cover-dust="true"
    />

    {coverFragments.slice(0, 7).map((className) => (
      <span
        key={className}
        className={`absolute opacity-0 bg-gradient-to-br from-stone-300 via-stone-600 to-stone-950 shadow-xl ${className}`}
        data-sculpt-cover-fragment="true"
      />
    ))}
  </div>
);
