import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";

import { AuthProvider } from "./context/AuthContext";
import { setNavigate } from "./utils/navigation";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import TrainerLayout from "./layouts/TrainerLayout";

import Home from "./pages/Home";
import Login from "./pages/Login";
import LoginSuccess from "./pages/LoginSuccess";
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./routes/AdminRoute";

import Orders from "./pages/admin/Orders";
import Checkin from "./pages/admin/Checkin";
import CheckinHistory from "./pages/admin/CheckinHistory";
import MyHistory from "./pages/MyHistory";
import TrainerDashboard from "./pages/trainer/Dashboard";
import CreateTrainer from "./pages/admin/CreateTrainer";
import TrainerLogin from "./pages/auth/TrainerLogin";
import TrainerManagement from "./pages/admin/TrainerManagement";
import UserManagement from "./pages/admin/UserManagement";
import ContactMessages from "./pages/admin/ContactMessages";
import FoodManagement from "./pages/admin/FoodManagement";
import TrainerCheckinHistory from "./pages/trainer/TrainerCheckinHistory";
import TdeeCalculator from "./pages/TdeeCalculator/TdeeCalculator";
import MealPlan from "./pages/MealPlan/MealPlan";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import BookingManagement from "./pages/admin/BookingManagement";

import "./index.css";
import "./App.css";

// ================= APP CONTENT =================
function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return (
    <Routes>
      {/* USER ROUTES */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/login-success" element={<LoginSuccess />} />
      <Route path="/checkin" element={<Checkin />} />
      <Route path="/my-history" element={<MyHistory />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* TDEE Calculator */}
      <Route path="/tdee-calculator" element={<TdeeCalculator />} />

      {/* Suggested Mealplan */}
      <Route path="/mealplan" element={<MealPlan />} />

      {/* TRAINER LOGIN */}
      <Route path="/trainer-login" element={<TrainerLogin />} />

      {/* TRAINER PANEL */}
      <Route
        path="/trainer"
        element={
          <AdminRoute>
            <TrainerLayout />
          </AdminRoute>
        }
      >
        <Route index element={<TrainerDashboard />} />
        <Route path="checkin-history" element={<TrainerCheckinHistory />} />
      </Route>

      {/* ADMIN LOGIN */}
      <Route path="/admin-login" element={<AdminLogin />} />

      {/* ADMIN PANEL */}
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
        <Route path="create-trainer" element={<CreateTrainer />} />
        <Route path="trainers" element={<TrainerManagement />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="contact-messages" element={<ContactMessages />} />
        <Route path="foods" element={<FoodManagement />} />
        <Route path="bookings" element={<BookingManagement />} />
      </Route>
    </Routes>
  );
}

// ================= ROOT APP =================
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
