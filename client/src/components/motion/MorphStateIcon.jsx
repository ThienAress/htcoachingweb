import { MorphIcon } from "morphicons/react";

const ICON_PATHS = Object.freeze({
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M18 6 6 18 M6 6l12 12",
});

const MorphStateIcon = ({
  state,
  size = 20,
  strokeWidth = 2,
  className,
}) => {
  const icon = ICON_PATHS[state];
  if (!icon) throw new Error(`Unsupported morph icon state: ${state}`);

  return (
    <MorphIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      spring="smooth"
      reducedMotion="user"
      aria-hidden="true"
      focusable="false"
      data-icon-state={state}
    />
  );
};

export default MorphStateIcon;
