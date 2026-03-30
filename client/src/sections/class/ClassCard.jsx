import React from "react";
import { CheckCircle, ArrowRight } from "lucide-react";

const ClassCard = ({ image, title, desc, benefits }) => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        />
      </div>
      <div className="p-6">
        <h3 className="text-2xl font-bold mb-3 text-gray-900">{title}</h3>
        <p className="text-(--color-gray) mb-4">{desc}</p>
        <ul className="space-y-2 mb-6">
          {benefits.map((b, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-(--color-back) "
            >
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <a
          href="#contact"
          className="btn w-full sm:w-auto border border-(--color-primary) text-(--color-primary) hover:bg-(--color-primary) hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          NHẬN TƯ VẤN MIỄN PHÍ
        </a>
      </div>
    </div>
  );
};

export default ClassCard;
