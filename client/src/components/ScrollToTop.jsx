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
          className="fixed bottom-[30px] right-[25px] z-[9999] border-none outline-none bg-gray-500 text-white cursor-pointer p-[20px_20px] 
          rounded-full text-xl shadow-md transition-all duration-300 border-(--color-primary) hover:bg-(--color-primary) hover:-translate-y-1"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
};

export default ScrollToTopButton;
