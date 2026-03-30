import React from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import ClassCard from "./ClassCard";
import class1 from "../../assets/images/classes/class1.jpg";
import class2 from "../../assets/images/classes/class2.jpg";
import class3 from "../../assets/images/classes/class3.jpg";

const Classes = () => {
  React.useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  const classes = [
    {
      image: class1,
      title: "Personal Training",
      desc: "Huấn luyện 1:1 giúp bạn theo sát tiến độ, tập đúng kỹ thuật và đạt mục tiêu nhanh hơn bao giờ hết.",
      benefits: [
        "Lộ trình cá nhân hóa",
        "Tập trung vào mục tiêu riêng của bạn",
        "An toàn - Hiệu quả tối ưu",
      ],
    },
    {
      image: class2,
      title: "Cardio & HIIT",
      desc: "Đốt cháy mỡ thừa hiệu quả, tăng nhịp tim và cải thiện sức bền chỉ trong vài phút mỗi buổi tập.",
      benefits: [
        "Bài tập ngắn - Hiệu quả vượt trội",
        "Cải thiện sức khỏe tim mạch",
        "Phù hợp với người bận rộn",
      ],
    },
    {
      image: class3,
      title: "Boxing",
      desc: "Tăng sức bền, cải thiện phản xạ và giải phóng căng thẳng với những bài tập đầy năng lượng.",
      benefits: [
        "Đốt mỡ, săn chắc toàn thân",
        "Nâng cao phản xạ và sự tự tin",
        "Giải phóng năng lượng tiêu cực",
      ],
    },
  ];

  return (
    <section id="classes" className="py-16 bg-gray-50">
      <div className="container">
        <h2
          className="font-display text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[4rem] leading-tight text-black text-center mb-4"
          data-aos="fade-down"
        >
          CHƯƠNG TRÌNH ĐÀO TẠO TRỰC TIẾP
        </h2>
        <p
          className="text-center text-(--color-gray) text-lg max-w-2xl mx-auto mb-12"
          data-aos="fade-down"
        >
          Cùng mình chinh phục mục tiêu thể chất với 3 bộ môn đặc trưng
        </p>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          data-aos="flip-down"
        >
          {classes.map((item, index) => (
            <ClassCard key={index} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Classes;
