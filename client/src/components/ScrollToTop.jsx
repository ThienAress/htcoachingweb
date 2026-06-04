import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const scrollPosition =
        window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;
      const footer = document.querySelector("footer");
      if (!footer) return;
      const footerPosition = footer.offsetTop;

      if (scrollPosition + viewportHeight >= footerPosition - 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", checkScroll);
    const timeout = setTimeout(() => checkScroll(), 300);

    return () => {
      window.removeEventListener("scroll", checkScroll);
      clearTimeout(timeout);
    };
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={handleClick}
          title="Lên đầu trang"
          className="fixed bottom-[20px] sm:bottom-[30px] right-[14px] sm:right-[24px] z-[9998] border-none outline-none bg-gray-500/80 hover:bg-primary text-white cursor-pointer p-[10px] sm:p-[15px] 
          rounded-full shadow-md transition-all duration-300 backdrop-blur-sm hover:-translate-y-1 flex items-center justify-center"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
};

export default ScrollToTopButton;
