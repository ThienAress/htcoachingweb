import approvedPhaseOneScene from "../../assets/images/transitions/self-sculpting-phase1-approved.webp";

const SculptFigure = ({ className = "", effect }) => (
  <img
    src={approvedPhaseOneScene}
    alt=""
    aria-hidden="true"
    draggable="false"
    decoding="async"
    fetchPriority="high"
    data-sculpt-source="approved-reference"
    data-sculpt-effect={effect}
    className={`absolute inset-0 h-full w-full select-none object-cover object-center ${className}`}
  />
);

export default SculptFigure;
