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
      <Hero />
      <About />
      <Trainers />
      <Feedback />
      <Classes />
      <Tools />
      <Pricing />
      <Contact />
      <ScrollToTop />
      <ChatIcons />
    </main>
  );
};

export default Home;
