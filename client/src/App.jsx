import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";

import { AuthProvider } from "./context/AuthContext";
import { setNavigate } from "./utils/navigation";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import TrainerLayout from "./layouts/TrainerLayout";
import AdminRoute from "./routes/AdminRoute";
import GlobalLoading from "./components/GlobalLoading";

// Lazy-loaded pages (Code Splitting)
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const LoginSuccess = lazy(() => import("./pages/LoginSuccess"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

const Orders = lazy(() => import("./pages/admin/Orders"));
const Checkin = lazy(() => import("./pages/admin/Checkin"));
const CheckinHistory = lazy(() => import("./pages/admin/CheckinHistory"));
const MyHistory = lazy(() => import("./pages/MyHistory"));
const TrainerDashboard = lazy(() => import("./pages/trainer/Dashboard"));

const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const ContactMessages = lazy(() => import("./pages/admin/ContactMessages"));
const FoodManagement = lazy(() => import("./pages/admin/FoodManagement"));
const BookingManagement = lazy(() => import("./pages/admin/BookingManagement"));
const ExerciseManagement = lazy(() => import("./pages/admin/ExerciseManagement"));
const ExerciseSuggestionsManagement = lazy(() => import("./pages/admin/ExerciseSuggestionsManagement"));
const CustomerStoryManagement = lazy(() => import("./pages/admin/CustomerStoryManagement"));
const TrainerManagement = lazy(() => import("./pages/admin/TrainerManagement"));
const TrainerProfileEditor = lazy(() => import("./pages/admin/TrainerProfileEditor"));
const SiteSettings = lazy(() => import("./pages/admin/SiteSettings"));
const DepositManagement = lazy(() => import("./pages/admin/DepositManagement"));
const F1AiRuleManagement = lazy(() => import("./pages/admin/F1AiRuleManagement"));
const TrainerSubscriberManagement = lazy(() => import("./pages/admin/TrainerSubscriberManagement"));
const TrainerCheckinHistory = lazy(() => import("./pages/trainer/TrainerCheckinHistory"));
const TrainingSchedule = lazy(() => import("./pages/trainer/TrainingSchedule"));
const TdeeCalculator = lazy(() => import("./pages/TdeeCalculator/TdeeCalculator"));
const MealPlan = lazy(() => import("./pages/MealPlan/MealPlan"));
const RegisterPage = lazy(() => import("./pages/RegisterPage/RegisterPage"));
const Club = lazy(() => import("./pages/Club"));
const ExercisesPage = lazy(() => import("./pages/ExercisesPage/ExercisesPage"));
const F1Customers = lazy(() => import("./pages/F1CustomersPage/F1Customers"));
const CustomerStories = lazy(() => import("./pages/CustomerStories"));
const CustomerStoryDetail = lazy(() => import("./pages/CustomerStoryDetail"));
const TrainerProfile = lazy(() => import("./pages/TrainerProfile"));
const MyWallet = lazy(() => import("./pages/wallet/MyWallet"));
const OnlineCoaching = lazy(() => import("./pages/customer/OnlineCoaching"));
const TrainerCoaching = lazy(() => import("./pages/trainer/TrainerCoaching"));
const AccountPage = lazy(() => import("./pages/account/AccountPage"));

import "./index.css";
import "./App.css";

// ================= APP CONTENT =================
function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return (
    <>
      <Suspense fallback={<GlobalLoading />}>
        <Routes>
        {/* USER ROUTES */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/ket-qua-khach-hang" element={<CustomerStories />} />
          <Route
            path="/ket-qua-khach-hang/:slug"
            element={<CustomerStoryDetail />}
          />
          <Route
            path="/huan-luyen-vien/:slug"
            element={<TrainerProfile />}
          />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/login-success" element={<LoginSuccess />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/my-history" element={<MyHistory />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/club" element={<Club />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/f1-customers" element={<F1Customers />} />
        <Route path="/wallet" element={<MyWallet />} />
        <Route path="/training-schedule" element={<TrainingSchedule />} />
        <Route path="/online-coaching" element={<OnlineCoaching />} />
        <Route path="/account" element={<AccountPage />} />

        {/* TDEE Calculator */}
        <Route path="/tdee-calculator" element={<TdeeCalculator />} />

        {/* Suggested Mealplan */}
        <Route path="/mealplan" element={<MealPlan />} />

        {/* TRAINER LOGIN — ẩn: trainer giờ login bằng Google bình thường */}

        {/* Standalone Trainer Coaching route with Header/Footer inside */}
        <Route
          path="/trainer/coaching"
          element={
            <AdminRoute>
              <TrainerCoaching />
            </AdminRoute>
          }
        />

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
          {/* Ẩn: trainer giờ dựa trên subscription, không tạo thủ công */}

          <Route path="trainer-subscribers" element={<TrainerSubscriberManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="contact-messages" element={<ContactMessages />} />
          <Route path="foods" element={<FoodManagement />} />
          <Route path="bookings" element={<BookingManagement />} />
          <Route path="exercises" element={<ExerciseManagement />} />
          <Route path="f1-ai-rules" element={<F1AiRuleManagement />} />
          <Route path="trainers" element={<TrainerManagement />} />
          <Route path="trainers/:id/profile" element={<TrainerProfileEditor />} />
          <Route path="customer-stories" element={<CustomerStoryManagement />} />
          <Route path="site-settings" element={<SiteSettings />} />
          <Route path="deposits" element={<DepositManagement />} />
          <Route
            path="exercise-suggestions"
            element={<ExerciseSuggestionsManagement />}
          />
        </Route>
      </Routes>
      </Suspense>
      <ToastContainer position="top-right" autoClose={2500} />
    </>
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
