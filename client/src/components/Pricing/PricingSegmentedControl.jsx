const CONTROL_LAYOUTS = {
  2: {
    grid: "grid-cols-2",
    indicatorWidth: "w-[calc((100%-0.25rem)/2)]",
    positions: ["pricing-segment-position-0", "pricing-segment-position-1"],
  },
  3: {
    grid: "grid-cols-3",
    indicatorWidth: "w-[calc((100%-0.25rem)/3)]",
    positions: [
      "pricing-segment-position-0",
      "pricing-segment-position-1",
      "pricing-segment-position-2",
    ],
  },
};

export default function PricingSegmentedControl({
  ariaLabel,
  className = "",
  onChange,
  options,
  value,
}) {
  const layout = CONTROL_LAYOUTS[options.length];

  if (!layout) {
    throw new Error("PricingSegmentedControl supports two or three options.");
  }

  const activeIndex = options.findIndex((option) => option.value === value);
  const indicatorPosition = layout.positions[Math.max(activeIndex, 0)];

  return (
    <div
      aria-label={ariaLabel}
      className={`relative isolate grid h-12 rounded-full bg-[#222] p-0.5 shadow-lg ${layout.grid} ${className}`}
      role="group"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full bg-primary shadow-md shadow-black/20 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${layout.indicatorWidth} ${indicatorPosition} ${
          activeIndex === -1 ? "opacity-0" : "opacity-100"
        }`}
      />

      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            aria-pressed={isActive}
            className={`relative z-10 min-h-11 min-w-0 whitespace-nowrap rounded-full px-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none sm:px-4 sm:text-base ${
              isActive ? "text-white" : "text-gray-400 hover:text-white"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
