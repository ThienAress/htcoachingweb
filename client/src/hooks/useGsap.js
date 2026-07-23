import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Reduced-motion media query — dùng chung cho mọi GSAP animation
const MOTION_OK = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

/** Check xem user có bật reduced-motion không */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Hook animate một element khi scroll tới.
 * @param {object} options - { from, trigger, start, markers }
 * from: gsap.from() props (default: { y: 30, opacity: 0 })
 * start: ScrollTrigger start (default: "top 85%")
 */
export const useGsapReveal = (options = {}) => {
  const ref = useRef(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    if (!ref.current) return;

    const {
      from = { y: 30, opacity: 0 },
      duration = 0.8,
      delay = 0,
      ease = "power2.out",
      start = "top 85%",
    } = optionsRef.current;

    let mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.from(ref.current, {
        ...from,
        duration,
        delay,
        ease,
        scrollTrigger: {
          trigger: ref.current,
          start,
          once: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return ref;
};

/**
 * Hook animate nhiều children bên trong container với hiệu ứng stagger.
 * @param {string} childSelector - CSS selector cho children (vd: ".card")
 * @param {object} options
 */
export const useGsapStagger = (childSelector, options = {}) => {
  const containerRef = useRef(null);
  const childSelectorRef = useRef(childSelector);
  const optionsRef = useRef(options);

  useEffect(() => {
    if (!containerRef.current) return;

    const {
      from = { y: 50, opacity: 0 },
      duration = 0.7,
      stagger = 0.15,
      ease = "power2.out",
      start = "top 85%",
    } = optionsRef.current;

    const children = containerRef.current.querySelectorAll(childSelectorRef.current);
    if (!children.length) return;

    let mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.from(children, {
        ...from,
        duration,
        stagger,
        ease,
        scrollTrigger: {
          trigger: containerRef.current,
          start,
          once: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return containerRef;
};

/**
 * Hook tạo GSAP timeline với ScrollTrigger.
 * Trả về ref (gắn vào trigger element) + timeline ref.
 */
export const useGsapTimeline = (options = {}) => {
  const triggerRef = useRef(null);
  const tlRef = useRef(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    if (!triggerRef.current) return;

    const { start = "top 85%", ease = "power2.out" } = optionsRef.current;

    let mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      tlRef.current = gsap.timeline({
        scrollTrigger: {
          trigger: triggerRef.current,
          start,
          once: true,
        },
        defaults: { ease, duration: 0.7 },
      });
    });

    return () => mm.revert();
  }, []);

  return { triggerRef, tlRef };
};

export { gsap, ScrollTrigger };
