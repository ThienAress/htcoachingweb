import "aos/dist/aos.css";
import {
  Dumbbell,
  Utensils,
  ChartLine,
  HeartPulse,
  ArrowRight,
} from "lucide-react";
import hero1 from "../assets/images/hero/hero1.jpg";

const Trainer = () => {
  return (
    <section
      id="trainers"
      className="max-w-5xl mx-auto my-12 bg-white rounded-2xl flex flex-wrap gap-10 p-8 shadow-lg"
    >
      <div className="container p-0!">
        <h2
          className="font-display title text-center"
          data-aos="fade-down"
          data-aos-duration="1500"
        >
          PERSONAL TRAINER
        </h2>
        {/* Ảnh trainer: tăng khoảng cách phía dưới trên mobile/tablet */}
        <div
          className="flex-1 min-w-full md:min-w-75 mt-2 mb-6 md:mb-0"
          data-aos="flip-down"
          data-aos-duration="1000"
        >
          <img
            src={hero1}
            alt="Trainer"
            className="w-full h-auto rounded-2xl object-cover"
          />
        </div>

        <div
          className="flex-2 min-w-full md:min-w-125 mt-8 md:mt-0"
          data-aos="fade-up"
          data-aos-duration="1500"
          data-aos-delay="100"
        >
          <h3 className="text-3xl sm:text-4xl font-extrabold mt-4 text-black">
            Hoàng Thiện (HTCOACHING)
          </h3>
          <h4 className="text-base sm:text-lg text-black font-semibold mt-2">
            Chuyên gia huấn luyện cá nhân | 4+ năm kinh nghiệm
          </h4>
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-5 mt-2">
            Mình sẽ giúp bạn xây dựng vóc dáng khoẻ mạnh và cải thiện thói quen
            sống thông qua phương pháp tập luyện
            <strong> khoa học, cá nhân hóa </strong> và dinh dưỡng{" "}
            <strong> tối ưu </strong>.
          </p>
          <div className="flex flex-col gap-5 mb-5">
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <Dumbbell size={22} color="#2a5be2" />
              <span className="font-semibold text-(--color-gray)">
                Huấn luyện 1-1 (Online/Offline)
              </span>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <Utensils size={22} color="#2a5be2" />
              <span className="font-semibold text-(--color-gray)">
                Meal plan cá nhân hóa
              </span>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <ChartLine size={22} color="#2a5be2" />
              <span className="font-semibold text-(--color-gray)">
                Theo dõi tiến độ định kỳ
              </span>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl transition-all hover:bg-blue-100 hover:-translate-y-1 hover:shadow-md cursor-pointer">
              <HeartPulse size={22} color="#2a5be2" />
              <span className="font-semibold text-(--color-gray)">
                Hỗ trợ phục hồi
              </span>
            </div>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold shadow-md hover:from-blue-700 hover:to-blue-600 hover:-translate-y-0.5 transition"
          >
            <ArrowRight size={18} />
            Liên hệ để nhận tư vấn miễn phí!
          </a>
        </div>
      </div>
    </section>
  );
};

export default Trainer;
