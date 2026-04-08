import React, { useRef } from "react";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ParallaxCard = ({ children, className = "" }) => {
  const wrapperRef = useRef(null);
  const cardRef = useRef(null);
  const glareRef = useRef(null);
  const rafRef = useRef(null);

  const setLayerTransform = (rotateX, rotateY) => {
    if (!cardRef.current) return;
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.depth || 0);
      const moveX = rotateY * (depth / 60);
      const moveY = -rotateX * (depth / 60);
      layer.style.transform = `translate3d(${moveX}px, ${moveY}px, ${depth}px)`;
    });
  };

  const resetCard = () => {
    if (!cardRef.current || !glareRef.current) return;
    cardRef.current.style.transition =
      "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";
    cardRef.current.style.transform =
      "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      layer.style.transition = "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";
      const depth = Number(layer.dataset.depth || 0);
      layer.style.transform = `translate3d(0px, 0px, ${depth}px)`;
    });
    glareRef.current.style.opacity = "0";
    glareRef.current.style.background =
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16), transparent 42%)";
  };

  const handleMouseEnter = () => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (!cardRef.current) return;
    cardRef.current.style.transition = "transform 180ms ease-out";
    const layers = cardRef.current.querySelectorAll("[data-depth]");
    layers.forEach((layer) => {
      layer.style.transition = "transform 180ms ease-out";
    });
  };

  const handleMouseMove = (e) => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (!wrapperRef.current || !cardRef.current || !glareRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;
    const rotateY = clamp((px - 0.5) * 18, -9, 9);
    const rotateX = clamp((0.5 - py) * 18, -9, 9);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      cardRef.current.style.transition = "transform 60ms linear";
      cardRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      setLayerTransform(rotateX, rotateY);
      glareRef.current.style.opacity = "1";
      glareRef.current.style.background = `
        radial-gradient(
          circle at ${px * 100}% ${py * 100}%,
          rgba(255,255,255,0.22),
          rgba(255,255,255,0.08) 18%,
          transparent 42%
        )
      `;
    });
  };

  const handleMouseLeave = () => {
    cancelAnimationFrame(rafRef.current);
    resetCard();
  };

  return (
    <div
      ref={wrapperRef}
      className="w-full"
      style={{ perspective: "1200px" }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className={`relative h-full will-change-transform ${className}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300"
        />
        <div
          className="relative z-10 h-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ParallaxCard;
