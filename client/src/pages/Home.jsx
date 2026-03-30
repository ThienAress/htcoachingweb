import Hero from "../sections/Hero";
import About from "../sections/About";
import Trainers from "../sections/Trainers";
import Feedback from "../sections/FeedBackSection/Feedback";
import Classes from "../sections/class/Classes";
import Tools from "../sections/Tools";
import Pricing from "../sections/Pricing";
import Contact from "../sections/Contact";

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
    </>
  );
};

export default Home;
