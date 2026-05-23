import { Link } from "react-router-dom";

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
  return (
    <div className="swiper-slide">
      <Link
        to={`/ket-qua-khach-hang/${slug}`}
        className="feedback-card group block overflow-hidden rounded-xl shadow-md transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label={`Xem hành trình thay đổi của ${name}`}
      >
        <div className="relative flex gap-3 sm:gap-4 p-4 sm:p-6 pb-0">
          <div className="flex-1 relative overflow-hidden rounded-lg">
            <img
              src={beforeImg}
              alt={`${name} before`}
              loading="lazy"
              className="aspect-[4/5] w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute bottom-3 left-3 bg-primary text-white text-xs sm:text-sm font-semibold py-1 px-3 rounded-full uppercase z-10">
              Before
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden rounded-lg">
            <img
              src={afterImg}
              alt={`${name} after`}
              loading="lazy"
              className="aspect-[4/5] w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute bottom-3 left-3 bg-primary text-white text-xs sm:text-sm font-semibold py-1 px-3 rounded-full uppercase z-10">
              After
            </span>
          </div>

          <span className="absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/70 bg-black/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:bg-primary group-hover:border-primary sm:px-5 sm:py-2.5 sm:text-sm">
            Xem chi tiết
          </span>
        </div>

        <div className="p-5 flex-grow flex flex-col justify-between text-white">
          <h4 className="text-xl font-medium mb-2">
            {name}, {age} tuổi
          </h4>
          <p className="text-base leading-relaxed mb-2">{message}</p>
          <div className="info-wrapper mt-4 text-left">
            <div className="info-left">{job}</div>
            <div className="info-right">
              <span>
                Kết quả: <strong>{result}</strong>
              </span>
              <span>
                Thời gian: <strong>{duration}</strong>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default FeedbackCard;
