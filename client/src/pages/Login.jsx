import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import { Home, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/images/logo/logo.svg";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

const Login = () => {
  const handleGoogleLogin = () => {
    window.location.href = "https://htcoachingweb.netlify.app/api/auth/google";
  };

  const slides = [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
    "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Swiper Background */}
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        loop={true}
        className="absolute inset-0 w-full h-full z-0"
      >
        {slides.map((src, idx) => (
          <SwiperSlide key={idx}>
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${src})` }}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Modal */}
      <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
        <div className="bg-black/20 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          {/* Logo */}
          <img src={logo} alt="HT Coaching" className="h-16 mx-auto mb-6" />

          {/* Tiêu đề với font Bebas Neue */}
          <h2 className="text-4xl md:text-5xl font-black mb-2 tracking-wider">
            <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent font-bebas-neue">
              HTCOACHING
            </span>
          </h2>
          <div className="flex items-center justify-center gap-2 text-white/90 text-sm uppercase tracking-wider mb-4">
            <Flame size={16} className="text-orange-500" />
            <span className="font-bebas-neue text-lg tracking-wider">
              NO PAIN • NO GAIN
            </span>
            <Flame size={16} className="text-orange-500" />
          </div>

          {/* Slogan */}
          <p className="text-white/80 text-lg font-medium mb-8">
            Hãy đi đến giới hạn của bản thân cùng với mình
          </p>

          {/* Nút đăng nhập Google */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg transform hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng nhập bằng Google
          </button>

          {/* Link về trang chủ */}
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
            >
              <Home size={16} />
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
