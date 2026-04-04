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

const Home = () => {
  return (
    <>
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
    </>
  );
};

export default Home;
