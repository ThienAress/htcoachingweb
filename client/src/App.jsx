import { BrowserRouter, Routes, Route } from "react-router-dom";

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

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* USER ROUTES */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/login-success" element={<LoginSuccess />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/my-history" element={<MyHistory />} />

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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
