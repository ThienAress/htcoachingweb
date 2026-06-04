import React, { useState, useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import Footer from "../sections/Footer/Footer";
import Contact from "../sections/Contact";
import ChatIcons from "../components/ChatIcons";
import ScrollToTop from "../components/ScrollToTop";
import SEO from "../components/SEO";
import class1 from "../assets/images/classes/class1.jpg";
import class2 from "../assets/images/classes/class2.jpg";
import class3 from "../assets/images/classes/class3.jpg";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

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
  const titleRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const result = extractDistricts(clubs);
    setDistricts(result);
  }, []);

  // GSAP animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.from(titleRef.current, {
          y: -20,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
        });
      }

      // Animate club cards
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll(".club-card");
        if (cards.length) {
          gsap.fromTo(cards, 
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
              stagger: 0.08,
              ease: "power2.out",
              scrollTrigger: {
                trigger: gridRef.current,
                start: "top 90%",
                once: true,
              },
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, [selectedDistrict]);

  const filteredClubs =
    selectedDistrict === "Tất cả"
      ? clubs
      : clubs.filter((club) => club.address.includes(selectedDistrict));

  return (
    <>
      <SEO 
        title="Danh sách phòng tập - HTCOACHING" 
        description="Các câu lạc bộ, phòng tập Gym, Boxing hiện HTCOACHING đang huấn luyện tại Hồ Chí Minh."
        canonical="/club"
      />
      <main>
        <section className="py-12 md:py-16 px-5 bg-gray-100">
          <div className="container-custom">
            <h1 ref={titleRef} className="text-center mb-8 text-3xl font-bold uppercase">
              CÂU LẠC BỘ HIỆN MÌNH ĐANG DẠY
            </h1>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 my-6 font-medium text-base">
            <label htmlFor="district-filter" className="text-gray-700">
              Lọc theo quận:
            </label>
            <select
              id="district-filter"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary transition"
            >
              {districts.map((d, index) => (
                <option key={index} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club, index) => {
              return (
                <div
                  key={index}
                  className="club-card bg-white shadow-md overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lg rounded-lg"
                >
                  <img
                    src={club.image}
                    alt={club.name}
                    loading="lazy"
                    className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover transition duration-300"
                  />
                  <div className="p-5">
                    <h3 className="text-xl text-primary font-bold mb-3 uppercase">
                      {club.name}
                    </h3>
                    <p className="flex items-center gap-2 text-gray-800 text-sm">
                      <MapPin size={16} className="text-primary" />
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
      </main>
      <Footer />
      <ChatIcons />
      <ScrollToTop />
    </>
  );
};

export default Club;

