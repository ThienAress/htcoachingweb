import React, { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import HeaderMinimal from "../sections/Header/HeaderMinimal";
import FooterMinimal from "../sections/Footer/FooterMinimal";
import Contact from "../sections/Contact";
import ChatIcons from "../components/ChatIcons";
import ScrollToTop from "../components/ScrollToTop";
import class1 from "../assets/images/classes/class1.jpg";
import class2 from "../assets/images/classes/class2.jpg";
import class3 from "../assets/images/classes/class3.jpg";
import AOS from "aos";
import "aos/dist/aos.css";

// Danh sách các hiệu ứng AOS (zoom + 4 hướng)
AOS.init();
const aosAnimations = ["flip-left", "flip-up", "flip-down", "flip-right"];

const clubs = [
  {
    name: "WAYSTATION TRƯƠNG VĂN HẢI",
    address: "6 Trương Văn Hải, Tăng Nhơn Phú B, Quận 9, Hồ Chí Minh",
    image: class1,
  },
  {
    name: "WAYSTATION DÂN CHỦ",
    address: "56F Dân Chủ, Bình Thọ, Thủ Đức, Hồ Chí Minh",
    image: class2,
  },
  {
    name: "WAYSTATION HIỆP BÌNH",
    address: "135 Hiệp Bình, Hiệp Bình Chánh, Thủ Đức, Hồ Chí Minh",
    image: class3,
  },
  {
    name: "WAYSTATION QL13",
    address: "361 Quốc Lộ 13, Hiệp Bình Phước, Thủ Đức, Hồ Chí Minh",
    image: class1,
  },
  {
    name: "Chung Cư Flora Novia",
    address: "1452 Phạm Văn Đồng, Linh Tây, Thủ Đức, Hồ Chí Minh",
    image: class2,
  },
  {
    name: "WAYSTATION HIỆP BÌNH",
    address: "135 Hiệp Bình, Hiệp Bình Chánh, Thủ Đức, Hồ Chí Minh",
    image: class3,
  },
  {
    name: "WAYSTATION QL13",
    address: "361 Quốc Lộ 13, Hiệp Bình Phước, Thủ Đức, Hồ Chí Minh",
    image: class1,
  },
  {
    name: "Chung Cư Flora Novia",
    address: "1452 Phạm Văn Đồng, Linh Tây, Thủ Đức, Hồ Chí Minh",
    image: class2,
  },
  {
    name: "WAYSTATION HIỆP BÌNH",
    address: "135 Hiệp Bình, Hiệp Bình Chánh, Thủ Đức, Hồ Chí Minh",
    image: class3,
  },
  {
    name: "WAYSTATION QL13",
    address: "361 Quốc Lộ 13, Hiệp Bình Phước, Thủ Đức, Hồ Chí Minh",
    image: class1,
  },
  {
    name: "Chung Cư Flora Novia",
    address: "1452 Phạm Văn Đồng, Linh Tây, Thủ Đức, Hồ Chí Minh",
    image: class2,
  },
];

const extractDistricts = (clubs) => {
  const regex = /Quận\s*\d+|Thủ Đức|Phú Nhuận|Tân Bình|Gò Vấp|Bình Thạnh/i;
  const found = clubs
    .map((club) => {
      const match = club.address.match(regex);
      return match ? match[0] : null;
    })
    .filter(Boolean);
  return ["Tất cả", ...Array.from(new Set(found))];
};

const Club = () => {
  const [selectedDistrict, setSelectedDistrict] = useState("Tất cả");
  const [districts, setDistricts] = useState(["Tất cả"]);

  useEffect(() => {
    const result = extractDistricts(clubs);
    setDistricts(result);
  }, []);

  const filteredClubs =
    selectedDistrict === "Tất cả"
      ? clubs
      : clubs.filter((club) => club.address.includes(selectedDistrict));

  return (
    <>
      <HeaderMinimal />
      <section className="py-12 md:py-16 px-5 bg-gray-100">
        <div className="container mx-auto">
          <h2
            className="font-display text-center text-(--color-dark) mb-5 font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
            data-aos="fade-up"
          >
            CÂU LẠC BỘ HIỆN MÌNH ĐANG DẠY
          </h2>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 my-6 font-medium text-base">
            <label htmlFor="district-filter" className="text-gray-700">
              Lọc theo quận:
            </label>
            <select
              id="district-filter"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 transition"
            >
              {districts.map((d, index) => (
                <option key={index} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club, index) => {
              // Chọn animation luân phiên theo index
              const animation = aosAnimations[index % aosAnimations.length];
              return (
                <div
                  key={index}
                  data-aos={animation}
                  data-aos-delay={index * 100} // delay nhẹ cho từng card
                  data-aos-duration="800"
                  className="bg-white shadow-md overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lg rounded-lg"
                >
                  <img
                    src={club.image}
                    alt={club.name}
                    className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover transition duration-300"
                  />
                  <div className="p-5">
                    <h3 className="text-xl text-red-600 font-bold mb-3 uppercase">
                      {club.name}
                    </h3>
                    <p className="flex items-center gap-2 text-gray-800 text-sm">
                      <MapPin size={16} className="text-red-600" />
                      {club.address}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <Contact />
      <FooterMinimal />
      <ChatIcons />
      <ScrollToTop />
    </>
  );
};

export default Club;
