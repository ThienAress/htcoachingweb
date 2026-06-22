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

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "HTCOACHING",
    "url": "https://htcoachingweb.io.vn",
    "logo": "https://htcoachingweb.io.vn/logo.png",
    "description": "Chương trình luyện tập cá nhân hóa cùng HLV chuyên nghiệp tại HTCOACHING. Boxing, Gym & cardio giúp tăng cơ giảm mỡ hiệu quả. Đăng ký tập ngay hôm nay!",
    "sameAs": [
      "https://www.facebook.com/thienvo123456"
    ]
  };

  return (
    <main>
      <SEO 
        title="Trang chủ"
        canonical="/" 
        jsonLd={organizationSchema}
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
