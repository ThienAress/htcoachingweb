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
      title: "PERSONAL TRAINING",
      desc: "Huấn luyện 1:1 giúp bạn theo sát tiến độ, tập đúng kỹ thuật và đạt mục tiêu nhanh hơn bao giờ hết.",
      benefits: [
        "Lộ trình cá nhân hóa",
        "Tập trung vào mục tiêu riêng của bạn",
        "An toàn - Hiệu quả tối ưu",
      ],
    },
    {
      image: class2,
      title: "CARDIO & HIIT",
      desc: "Đốt cháy mỡ thừa hiệu quả, tăng nhịp tim và cải thiện sức bền chỉ trong vài phút mỗi buổi tập.",
      benefits: [
        "Bài tập ngắn - Hiệu quả vượt trội",
        "Cải thiện sức khỏe tim mạch",
        "Phù hợp với người bận rộn",
      ],
    },
    {
      image: class3,
      title: "BOXING",
      desc: "Tăng sức bền, cải thiện phản xạ, giải phóng căng thẳng với những bài tập đầy năng lượng và linh hoạt.",
      benefits: [
        "Đốt mỡ, săn chắc toàn thân",
        "Nâng cao phản xạ và sự tự tin",
        "Giải phóng năng lượng tiêu cực",
      ],
    },
  ];

  return (
    <section id="classes" className="py-12 sm:py-16 bg-[#0f172b]">
      <div className="mx-auto w-full max-w-[1650px] px-4 sm:px-6 xl:px-8">
        <h2
          className="text-center text-primary text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
          data-aos="fade-down"
        >
          CHƯƠNG TRÌNH TẬP LUYỆN TRỰC TIẾP
        </h2>

        <p
          className="text-center text-gray text-base sm:text-lg max-w-2xl mx-auto mb-8 sm:mb-12 px-4"
          data-aos="fade-down"
        >
          Cùng mình chinh phục mục tiêu thể chất với 3 bộ môn đặc trưng
        </p>

        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 xl:gap-10"
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
