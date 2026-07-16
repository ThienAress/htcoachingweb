import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Facebook, Instagram, Youtube, Award, ShieldCheck } from "lucide-react";
import logo from "../../assets/images/logo/logo.svg";
import { useAuth } from "../../context/AuthContext";
import LoginModal from "../../pages/MealPlan/LoginModal";

const Footer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleMealPlanClick = (e) => {
    e.preventDefault();
    if (user) {
      navigate("/mealplan");
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <footer className="bg-[#1a1a1a] text-white pt-16 md:pt-20">
      <div className="container-custom">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 mb-12 md:mb-16">
          {/* About */}
          <div>
            <img
              src={logo}
              alt="Elite Fitness"
              className="h-20 md:h-24 mb-4 object-contain"
            />
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {t("footer.slogan")}
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/thienvo123456"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="Youtube"
              >
                <Youtube size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                aria-label="TikTok"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              {t("footer.quick_links")}
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <Link to="/" className="hover:text-primary hover:pl-1 transition-all">
                  {t("footer.home")}
                </Link>
              </li>
              <li>
                <Link to="/ket-qua-khach-hang" className="hover:text-primary hover:pl-1 transition-all">
                  {t("footer.customer_results")}
                </Link>
              </li>
              <li>
                <Link to="/exercises" className="hover:text-primary hover:pl-1 transition-all">
                  {t("footer.exercise_system")}
                </Link>
              </li>
              <li>
                <Link to="/tdee-calculator" className="hover:text-primary hover:pl-1 transition-all">
                  {t("footer.tdee")}
                </Link>
              </li>
              <li>
                <button onClick={handleMealPlanClick} className="hover:text-primary hover:pl-1 transition-all bg-transparent border-none text-gray-300 p-0 text-left font-inherit cursor-pointer inline-block">
                  {t("footer.meal_suggestion")}
                </button>
              </li>
              <li>
                <Link to="/club" className="hover:text-primary hover:pl-1 transition-all">
                  {t("footer.club")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Training Programs */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              {t("footer.training_programs")}
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Personal Training
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Cardio & HIIT
                </a>
              </li>
              <li>
                <a
                  href="#classes"
                  className="hover:text-primary hover:pl-1 transition-all"
                >
                  Boxing
                </a>
              </li>
            </ul>
          </div>

          {/* Cam kết chất lượng */}
          <div>
            <h3 className="text-lg font-semibold mb-4 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-12 after:h-0.5 after:bg-primary">
              {t("footer.quality_commitment")}
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-semibold text-sm">{t("footer.effectiveness_title")}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mt-0.5">
                    {t("footer.effectiveness_desc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-semibold text-sm">{t("footer.privacy_title")}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mt-0.5">
                    {t("footer.privacy_desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/20 py-4 text-center">
        <p className="text-gray text-sm">&copy; 2026 HTCOACHING</p>
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </footer>
  );
};

export default Footer;
