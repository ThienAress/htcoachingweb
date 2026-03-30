import { useState, useEffect } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle } from "lucide-react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    social: "",
    package: "",
  });

  const forbiddenKeywords = [
    "địt",
    "dit",
    "đụ",
    "du",
    "đụ má",
    "đụ mẹ",
    "đm",
    "dm",
    "dmm",
    "dcm",
    "cặc",
    "cak",
    "cac",
    "cạc",
    "lồn",
    "lon",
    "loz",
    "l",
    "buồi",
    "buoi",
    "bùi",
    "bui",
    "chim",
    "bướm",
    "buom",
    "bú",
    "bu",
    "bú lol",
    "bú l",
    "ăn cặc",
    "ăn l",
    "ăn buồi",
    "đéo",
    "deo",
    "đếch",
    "dek",
    "vl",
    "vkl",
    "cl",
    "vcl",
    "cc",
    "shit",
    "fuck",
    "fml",
    "diss",
    "bitch",
    "bóp vú",
    "nứng",
    "nứng lồn",
    "nứng vl",
    "chịch",
    "chich",
    "xoạc",
    "xoc",
    "rape",
    "hiếp",
    "hiếp dâm",
    "gạ tình",
    "gạ gẫm",
    "sex",
    "sexy",
    "69",
    "xxx",
    "jav",
    "phim sex",
    "phim jav",
    "trai gọi",
    "gái gọi",
    "gái mại dâm",
    "bán dâm",
    "đi khách",
    "bong",
    "casino",
    "bet",
    "ku",
    "cmd368",
    "w88",
    "fun88",
    "fifa",
    "letou",
    "cacuoc",
    "1xbet",
    "dafabet",
    "188bet",
    "m88",
    "baccarat",
    "xoso",
    "xổ số",
    "danh bai",
    "game bai",
    "rakhoi",
    "choi casino",
    "vn88",
    "bong88",
    "new88",
    "nhacaionline",
    "nhà cái",
    "fck",
    "f u",
    "dmml",
    "dmvl",
    "ml",
    "ccmm",
    "đkm",
    "bố mày",
    "mẹ mày",
    "con đĩ",
    "con chó",
    "thằng chó",
    "clgt",
    "clmm",
    "sv",
    "óc chó",
    "súc vật",
    "não chó",
  ];

  const [errors, setErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isSocialFocused, setIsSocialFocused] = useState(false);
  const [isHintHovered, setIsHintHovered] = useState(false);

  useEffect(() => {
    let timer, interval;
    if (showSuccess) {
      document.body.style.overflow = "hidden";
      setCountdown(5);
      interval = setInterval(() => setCountdown((prev) => prev - 1), 1000);
      timer = setTimeout(() => {
        setShowSuccess(false);
        document.body.style.overflow = "auto";
      }, 5000);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.body.style.overflow = "auto";
    };
  }, [showSuccess]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name || formData.name.trim().length < 8)
      newErrors.name = "Họ tên phải có ít nhất 8 ký tự";
    if (!formData.email.match(/^[\w.+-]+@gmail\.com$/))
      newErrors.email = "Email phải đúng định dạng @gmail.com";
    if (!formData.phone.match(/^\d{10}$/))
      newErrors.phone = "Số điện thoại phải đúng 10 số";
    if (!formData.social) {
      newErrors.social = "Vui lòng nhập Facebook/Zalo";
    } else if (formData.social.length > 50) {
      newErrors.social = "Tối đa 50 ký tự";
    } else if (
      /<|>|script|"|'|`|onerror|onload|alert|\(|\)/i.test(formData.social)
    ) {
      newErrors.social = "Thông tin không hợp lệ";
    } else if (
      forbiddenKeywords.some((kw) => formData.social.toLowerCase().includes(kw))
    ) {
      newErrors.social = "Thông tin chứa ngôn từ không phù hợp!";
    } else if (
      /bong|casino|bet|ku\d+|cmd368|w88|fun88|fifa|letou|cacuoc|1xbet|dafabet|188bet|m88|baccarat|xoso|xổ\s*số|danh\s*bai|game\s*bai/i.test(
        formData.social,
      )
    ) {
      newErrors.social = "Không chấp nhận link cá cược/bài bạc!";
    } else if (
      !/^https:\/\/(www\.facebook\.com\/[A-Za-z0-9.]+|zalo\.me\/\d{8,15})$/.test(
        formData.social,
      )
    ) {
      newErrors.social = "Chỉ cho phép link Facebook hoặc Zalo hợp lệ!";
    }
    if (!formData.package) newErrors.package = "Vui lòng chọn gói tập quan tâm";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormData({ name: "", email: "", phone: "", social: "", package: "" });
    setShowSuccess(true);
  };

  return (
    <section id="contact" className="bg-[#262626] text-gray-200 py-16">
      <div className="container">
        {showSuccess && (
          <div className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-md w-[90%] text-center shadow-xl animate-zoomIn">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                ✔ Gửi thông tin thành công!
              </h3>
              <p className="text-gray-600">
                Tư vấn viên sẽ liên hệ với bạn trong thời gian sớm nhất. <br />
                Popup sẽ tự động đóng sau:{" "}
                <strong className="text-red-500">{countdown} giây</strong>
              </p>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[4rem] leading-tight text-[#e53935]">
            Liên hệ với chúng tôi
          </h2>
          <p className="text-(--color-gray) text-lg">
            Để lại thông tin, chúng tôi sẽ liên hệ tư vấn miễn phí cho bạn
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <input
                type="text"
                placeholder="Họ và tên"
                className="w-full px-4 py-3 rounded-md border border-gray-700 bg-[#1a1a1a] text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all hover:scale-[1.01] "
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-3 rounded-md border border-gray-700 bg-[#1a1a1a] text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all hover:scale-[1.01] "
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <input
                type="tel"
                placeholder="Số điện thoại"
                maxLength="10"
                className="w-full px-4 py-3 rounded-md border border-gray-700 bg-[#1a1a1a] text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all hover:scale-[1.01] "
                value={formData.phone}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val))
                    setFormData({ ...formData, phone: val });
                }}
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Trang cá nhân FB or ZALO"
                className="w-full px-4 py-3 rounded-md border border-gray-700 bg-[#1a1a1a] text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all hover:scale-[1.01] "
                value={formData.social}
                onChange={(e) =>
                  setFormData({ ...formData, social: e.target.value })
                }
                onFocus={() => setIsSocialFocused(true)}
                onBlur={() => {
                  setTimeout(() => {
                    if (!isHintHovered) setIsSocialFocused(false);
                  }, 100);
                }}
              />
              {errors.social && (
                <p className="text-red-500 text-sm mt-1">{errors.social}</p>
              )}
              {(isSocialFocused || isHintHovered) && (
                <div
                  className="text-xs text-gray-400 mt-1"
                  onMouseEnter={() => setIsHintHovered(true)}
                  onMouseLeave={() => setIsHintHovered(false)}
                >
                  VD: Link Zalo:{" "}
                  <span className="text-blue-400">
                    https://zalo.me/SĐT, thay bằng SĐT thật của bạn vào
                  </span>
                </div>
              )}
            </div>

            <div>
              <select
                className="w-full px-4 py-3 rounded-md border border-gray-700 bg-[#1a1a1a] text-white  "
                value={formData.package}
                onChange={(e) =>
                  setFormData({ ...formData, package: e.target.value })
                }
              >
                <option value="" disabled>
                  Chọn gói tập quan tâm
                </option>
                <option value="Gói cơ bản">ONLINE</option>
                <option value="Gói nâng cao">1-1</option>
                <option value="Gói trial">TRIAL</option>
              </select>
              {errors.package && (
                <p className="text-red-500 text-sm mt-1">{errors.package}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-md bg-red-600 text-white font-bold uppercase tracking-wide hover:bg-red-700 transform hover:scale-105 transition-all shadow-lg hover:shadow-red-500/30"
            >
              Gửi thông tin
            </button>
          </form>

          <div className="space-y-5 text-gray-300">
            <div className="flex items-center gap-3">
              <MapPin className="text-[#e53935] w-6 h-6" />
              <p>Tùy vào phòng tập bạn chọn</p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="text-[#e53935] w-6 h-6" />
              <p>0934.215.227</p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="text-[#e53935] w-6 h-6" />
              <p>hoangthiengym99@gmail.com</p>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="text-[#e53935] w-6 h-6" />
              <p>Thứ 2 - Chủ nhật: 6:00 - 22:00</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
