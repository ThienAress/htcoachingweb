import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import UpdatingText from "../../components/UpdatingText";


const ImageOrPlaceholder = ({ src, alt, label }) => {
  if (src) {
    return (
      <div className="flex-1 relative overflow-hidden rounded-lg">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="aspect-[3/4] w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute bottom-2 left-2 bg-primary text-white text-[10px] sm:text-xs font-semibold py-0.5 px-2 rounded-full uppercase z-10">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden rounded-lg">
      <div className="aspect-[3/4] w-full bg-neutral-100 flex flex-col items-center justify-center gap-1">
        <div className="w-full h-full flex items-center justify-center min-h-[120px]">
          <UpdatingText className="text-[10px]" />
        </div>
      </div>
      <span className="absolute bottom-2 left-2 bg-primary text-white text-[10px] sm:text-xs font-semibold py-0.5 px-2 rounded-full uppercase z-10">
        {label}
      </span>
    </div>
  );
};

const FeedbackCard = ({
  slug,
  beforeImg,
  afterImg,
  name,
  age,
  job,
  result,
  duration,
  message,
}) => {
  const firstBefore = Array.isArray(beforeImg) ? beforeImg[0] : beforeImg;
  const firstAfter = Array.isArray(afterImg) ? afterImg[0] : afterImg;

  return (
    <Link
      to={`/ket-qua-khach-hang/${slug}`}
      className="feedback-card group block overflow-hidden rounded-xl shadow-md transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full"
      aria-label={`Xem hành trình thay đổi của ${name}`}
    >
      <div className="relative flex gap-2 sm:gap-3 p-2 sm:p-3 pb-0">
        <ImageOrPlaceholder src={firstBefore} alt={`${name} before`} label="Before" />
        <ImageOrPlaceholder src={firstAfter} alt={`${name} after`} label="After" />

        <span className="absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/70 bg-black/75 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:bg-primary group-hover:border-primary sm:px-3 sm:py-1.5 sm:text-[10px]">
          Xem chi tiết
        </span>
      </div>

      <div className="p-5 flex-grow flex flex-col justify-between text-white">
        <h4 className="text-xl font-medium mb-2">
          {name}{age ? `, ${age} tuổi` : ""}
        </h4>
        <p className="text-base leading-relaxed mb-2">{message || <UpdatingText className="text-white/60" />}</p>
        <div className="info-wrapper mt-4 text-left">
          <div className="info-left">{job || <UpdatingText className="text-gray-500" />}</div>
          <div className="info-right">
            <span>
              Kết quả: <strong>{result || <UpdatingText className="text-white/70" />}</strong>
            </span>
            <span>
              Thời gian: <strong>{duration || <UpdatingText className="text-white/70" />}</strong>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default FeedbackCard;
