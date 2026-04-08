import React from "react";
import { Link } from "react-router-dom";
import toolImg from "../assets/images/hero/hero1.jpg";

const Tools = () => {
  return (
    <section className="py-10 md:py-[60px] px-4 md:px-5 flex justify-center">
      <div className="container">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            backgroundImage: `url(${toolImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        >
          <div className="bg-black/60 py-10 md:py-[60px] px-4 md:px-5 my-10 md:my-[60px] rounded-2xl text-center text-white ">
            <h2 className="text-primary">CÔNG CỤ MIỄN PHÍ</h2>
            <div className="bg-white/10 p-6 sm:p-8 md:p-10 rounded-2xl backdrop-blur-md shadow-lg transition-transform duration-300 hover:-translate-y-1 max-w-[800px] mx-auto">
              <div className="tool-content">
                <h3 className="text-center">
                  ĐO LƯỢNG MỨC TIÊU THỤ NĂNG LƯỢNG MỖI NGÀY (TDEE)
                </h3>
                <p className="text-sm sm:text-base text-[#dddddd] mb-5 md:mb-6 leading-relaxed">
                  Khám phá lượng calo cơ thể bạn đốt mỗi ngày để tối ưu hóa việc
                  tăng/giảm cân một cách khoa học.
                </p>
                {/* Thay <a> bằng Link */}
                <Link
                  to="/tdee-calculator"
                  className="btn  bg-primary text-white border-primary hover:bg-transparent hover:text-primary inline-block text-sm sm:text-base px-5 py-2 sm:px-6 sm:py-3"
                >
                  Khám phá ngay
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Tools;
