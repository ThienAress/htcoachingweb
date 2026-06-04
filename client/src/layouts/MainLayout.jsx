import { Outlet } from "react-router-dom";

import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
import ScrollRestoration from "../components/ScrollRestoration";

function MainLayout() {
  return (
    <>
      <ScrollRestoration />
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

export default MainLayout;

