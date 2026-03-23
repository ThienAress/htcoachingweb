import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

import Home from "./pages/Home";
import Login from "./pages/Login";

import LoginSuccess from "./pages/LoginSuccess";
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./routes/AdminRoute";

import Orders from "./pages/admin/Orders";
import Checkin from "./pages/admin/Checkin";
import CheckinHistory from "./pages/admin/CheckinHistory";
import MyHistory from "./pages/MyHistory";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ===== USER ROUTES ===== */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/login-success" element={<LoginSuccess />} />

        <Route path="/checkin" element={<Checkin />} />
        <Route path="/my-history" element={<MyHistory />} />

        {/* ===== ADMIN LOGIN ===== */}
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* ===== ADMIN ===== */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="orders" element={<Orders />} />
          <Route path="dashboard" element={<CheckinHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
