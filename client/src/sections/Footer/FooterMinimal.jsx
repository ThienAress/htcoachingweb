import React from "react";
import { Facebook, Instagram, Youtube, Phone, Mail } from "lucide-react";

// Icon TikTok SVG thuần
const TikTokIcon = ({ size = 20 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const FooterMinimal = () => {
  return (
    <footer className="bg-(--color-secondary) text-white text-center py-10">
      <div className="container mx-auto px-4">
        <p className="text-xl md:text-2xl italic text-orange-500 font-semibold mb-5">
          "Không có body đỉnh trong vùng an toàn.
          <br /> Hoặc là thay đổi – hoặc là mãi như cũ."
        </p>

        <div className="flex justify-center gap-5 mb-5 flex-wrap">
          <a
            href="https://www.facebook.com/thienvo123456"
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:bg-(--color-primary)"
          >
            <Facebook size={20} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:bg-(--color-primary)"
          >
            <TikTokIcon size={20} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:bg-(--color-primary)"
          >
            <Youtube size={20} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 hover:bg-(--color-primary)"
          >
            <Instagram size={20} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default FooterMinimal;
