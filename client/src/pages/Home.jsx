import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSiteSettings } from "../services/siteSetting.service";
import Hero from "../sections/Hero";
import About from "../sections/About";
import Trainers from "../sections/Trainers";
import Feedback from "../sections/FeedBackSection/Feedback";
import Classes from "../sections/class/Classes";
import Tools from "../sections/Tools";
import Pricing from "../sections/Pricing";
import Contact from "../sections/Contact";
import ScrollToTop from "../components/ScrollToTop";
import ChatIcons from "../components/ChatIcons";
import SEO from "../components/SEO";

const Home = () => {
  const [heroAnimDone, setHeroAnimDone] = useState(false);
  const { data: settingsResponse } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = settingsResponse?.data || {};

  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "HTCOACHING",
        "url": "https://htcoachingweb.io.vn",
        "logo": "https://htcoachingweb.io.vn/og-image.png",
        "description": "Nền tảng huấn luyện cá nhân dành cho HLV freelance và học viên. Cung cấp công cụ tính TDEE, gợi ý meal plan, quản lý giáo án và theo dõi tiến độ tập luyện.",
        "sameAs": [
          "https://www.facebook.com/thienvo123456"
        ]
      },
      {
        "@type": "ProfessionalService",
        "name": "HTCOACHING - Huấn Luyện Viên Cá Nhân",
        "url": "https://htcoachingweb.io.vn",
        "description": "Dịch vụ huấn luyện cá nhân 1 kèm 1 (Personal Training): Gym, Boxing, Cardio. Hỗ trợ online coaching, tư vấn dinh dưỡng và theo dõi tiến độ qua nền tảng web.",
        "serviceType": ["Personal Training", "Online Coaching", "Tư vấn dinh dưỡng"],
        "areaServed": {
          "@type": "City",
          "name": "TP. Hồ Chí Minh"
        },
        "provider": {
          "@type": "Organization",
          "name": "HTCOACHING"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "HTCOACHING có những dịch vụ gì?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "HTCOACHING cung cấp dịch vụ huấn luyện cá nhân 1 kèm 1 (Personal Training) với các bộ môn: Gym, Boxing, Cardio, Yoga, Stretching. Ngoài ra còn có Online Coaching (huấn luyện từ xa) và tư vấn dinh dưỡng."
            }
          },
          {
            "@type": "Question",
            "name": "Tập PT 1 kèm 1 tại HTCOACHING có gì khác biệt?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Mỗi học viên được xây dựng giáo án riêng phù hợp mục tiêu (giảm mỡ, tăng cơ), có HLV theo sát từng buổi tập, tư vấn dinh dưỡng cá nhân hóa, và theo dõi tiến độ hàng tuần. Cam kết kết quả 100%."
            }
          },
          {
            "@type": "Question",
            "name": "Các gói tập tại HTCOACHING có thời hạn bao lâu?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "HTCOACHING có 4 gói tập: Trải nghiệm (4 tuần), Cơ bản (8 tuần), Nâng cao (16 tuần), và VIP (24 tuần). Mỗi gói đều bao gồm giáo án cá nhân hóa, tư vấn dinh dưỡng, và hỗ trợ phục hồi sau tập."
            }
          },
          {
            "@type": "Question",
            "name": "HTCOACHING có công cụ miễn phí nào không?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Có! HTCOACHING cung cấp miễn phí: Công cụ tính TDEE (lượng calo cần nạp mỗi ngày), Gợi ý thực đơn dinh dưỡng phù hợp mục tiêu, và Thư viện bài tập chi tiết với hướng dẫn từng bước."
            }
          }
        ]
      }
    ]
  };


  return (
    <main>
      <SEO 
        title="Trang chủ"
        description="HTCOACHING - Chương trình luyện tập cá nhân hóa cùng HLV chuyên nghiệp. Boxing, Gym & Cardio giúp tăng cơ giảm mỡ hiệu quả tại TP.HCM. Đăng ký tập ngay!"
        canonical="/" 
        jsonLd={homeSchema}
      />
      <Hero images={settings.heroImages} onAnimationComplete={() => setHeroAnimDone(true)} />
      <About images={settings.aboutImages} />
      <Trainers />
      <Feedback />
      <Classes images={settings.classesImages} />
      <Tools image={settings.toolsImage} />
      <Pricing isHeroAnimDone={heroAnimDone} />
      <Contact />
      <ScrollToTop />
      <ChatIcons />
    </main>
  );
};

export default Home;
