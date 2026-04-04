import React from "react";
import Logo from "../../assets/images/logo/logo.svg";

const HeaderMinimal = () => {
  return (
    <header className="h-[100px] w-full bg-[linear-gradient(45deg,#f39c12,#1a1a1a)] flex justify-center items-center shadow-md z-[999]">
      <div className="flex justify-center items-center h-full">
        <a href="/">
          <img
            src={Logo}
            alt="LogoMinimal"
            className="h-[60px] w-auto object-contain"
          />
        </a>
      </div>
    </header>
  );
};

export default HeaderMinimal;
