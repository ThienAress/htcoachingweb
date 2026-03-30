const FeedbackCard = ({
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
      <div className="feedback-card rounded-xl overflow-hidden shadow-md transition-transform hover:scale-[1.02]">
        <div className="flex gap-3 sm:gap-4 p-4 sm:p-6 pb-0">
          <div className="flex-1 relative overflow-hidden rounded-lg group">
            <img
              src={beforeImg}
              alt="Before"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute bottom-3 left-3 bg-red-600 text-white text-xs sm:text-sm font-semibold py-1 px-3 rounded-full uppercase z-10">
              Before
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden rounded-lg group">
            <img
              src={afterImg}
              alt="After"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute bottom-3 left-3 bg-red-600 text-white text-xs sm:text-sm font-semibold py-1 px-3 rounded-full uppercase z-10">
              After
            </span>
          </div>
        </div>
        <div className="p-5 flex-grow flex flex-col justify-between text-white">
          <h4 className="text-xl font-medium mb-2">
            {name}, {age} tuổi
          </h4>
          <p className="text-base leading-relaxed mb-2">{message}</p>
          <div className="info-wrapper mt-4">
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
      </div>
    </div>
  );
};

export default FeedbackCard;
