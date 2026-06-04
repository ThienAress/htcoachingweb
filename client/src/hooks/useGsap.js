import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hook animate một element khi scroll tới.
 * @param {object} options - { from, trigger, start, markers }
 * from: gsap.from() props (default: { y: 30, opacity: 0 })
 * start: ScrollTrigger start (default: "top 85%")
 */
export const useGsapReveal = (options = {}) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const {
      from = { y: 30, opacity: 0 },
      duration = 0.8,
      delay = 0,
      ease = "power2.out",
      start = "top 85%",
    } = options;

    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
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

  useEffect(() => {
    if (!containerRef.current) return;

    const {
      from = { y: 50, opacity: 0 },
      duration = 0.7,
      stagger = 0.15,
      ease = "power2.out",
      start = "top 85%",
    } = options;

    const children = containerRef.current.querySelectorAll(childSelector);
    if (!children.length) return;

    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
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

  useEffect(() => {
    if (!triggerRef.current) return;

    const { start = "top 85%", ease = "power2.out" } = options;

    let mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
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
