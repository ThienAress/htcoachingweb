import React from "react";
import { Loader2, Sparkles } from "lucide-react";

const MealButton = ({
  onGenerate,
  isGenerating,
  disabled,
  label = "Gợi ý thực đơn mẫu",
}) => {
  return (
    <div className="text-center my-6">
      <button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        className={`w-full sm:w-auto min-w-[200px] px-6 sm:px-8 py-3 rounded-full font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
          disabled || isGenerating
            ? "bg-gray-600 cursor-not-allowed shadow-none"
            : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" /> {label}
          </span>
        )}
      </button>
    </div>
  );
};

export default MealButton;
