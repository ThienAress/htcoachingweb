import { useEffect, useRef } from "react";
import gsap from "gsap";

const UpdatingText = ({ className = "", text = "Đang cập nhật" }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    let ctx = gsap.context(() => {
      const chars = el.querySelectorAll(".u-char");
      const dots = el.querySelectorAll(".u-dot");
      gsap.set(chars, { opacity: 0, y: 3 });
      gsap.set(dots, { opacity: 0 });
      gsap.to(chars, { opacity: 1, y: 0, duration: 0.03, stagger: 0.03, ease: "power2.out" });
      const dotTl = gsap.timeline({ repeat: -1, delay: 0.25 });
      dotTl
        .to(dots[0], { opacity: 1, duration: 0.2 })
        .to(dots[1], { opacity: 1, duration: 0.2 })
        .to(dots[2], { opacity: 1, duration: 0.2 })
        .to({}, { duration: 0.4 })
        .to(dots, { opacity: 0, duration: 0.2 });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <span ref={ref} className={`inline-flex items-baseline italic opacity-70 ${className}`}>
      {text.split("").map((c, i) => (
        <span key={i} className="u-char inline-block" style={{ whiteSpace: c === " " ? "pre" : undefined }}>{c}</span>
      ))}
      <span className="u-dot inline-block">.</span>
      <span className="u-dot inline-block">.</span>
      <span className="u-dot inline-block">.</span>
    </span>
  );
};

export default UpdatingText;
