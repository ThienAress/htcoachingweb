import React from "react";

const GlobalLoading = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
        </div>
        {/* Brand text */}
        <span className="text-primary font-display text-xl font-bold tracking-widest uppercase">
          HTCOACHING
        </span>
        <span className="text-gray-400 text-sm">Đang tải...</span>
      </div>
    </div>
  );
};

export default GlobalLoading;
