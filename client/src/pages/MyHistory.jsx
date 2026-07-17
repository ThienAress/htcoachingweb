import { useState } from "react";
import SEO from "../components/SEO";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Mail,
  Package,
  Calendar,
  Dumbbell,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { getMyCheckins } from "../services/checkin.service";

const MyHistory = () => {
  const { t, i18n } = useTranslation("account");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["myCheckins"],
    queryFn: () => getMyCheckins().then((res) => res.data.data),
  });

  const checkins = data?.checkins || [];
  const orders = data?.orders || [];
  const userData = data?.user;

  const totalPages = Math.ceil(checkins.length / itemsPerPage);
  const paginatedCheckins = checkins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        {t("profile.errors.fetch_failed")}: {error?.message}
        <button
          onClick={() => refetch()}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded"
        >
          {t("common.retry", { defaultValue: "Thử lại" })}
        </button>
      </div>
    );
  }

  if (!data || !checkins) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        {t("my_history.no_data", { defaultValue: "Không có dữ liệu hoặc xảy ra lỗi." })}
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
      <SEO title={t("my_history.title")} noindex />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-12 px-4 md:px-6">
        <div className="container-custom space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-2">
                <History className="text-primary w-6 h-6 animate-pulse" />
                <span className="font-semibold text-primary tracking-wide">
                  {t("my_history.title")}
                </span>
              </div>
              <h1 className="font-display text-fluid-4xl font-black uppercase text-white tracking-normal">
                {t("my_history.header")}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {t("my_history.desc")}
              </p>
            </div>
            <div className="text-sm text-gray-300 bg-gray-800/80 border border-gray-700 px-4 py-2 rounded-full backdrop-blur-sm shadow-inner flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>
                {t("my_history.total_checkin")}:{" "}
                <strong className="text-primary font-bold">
                  {checkins.length}
                </strong>
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary animate-pulse">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                    {t("my_history.info_title")}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4 border-t border-gray-800/80 pt-4">
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <User className="w-4 h-4 text-primary" />
                    <span>
                      {t("my_history.full_name")}: <strong className="text-white">{userData?.name}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>
                      {t("my_history.email")}: <strong className="text-white">{userData?.email}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Packages */}
          <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-800 overflow-visible shadow-xl p-6">
            <div className="flex items-center gap-3 mb-5 border-b border-gray-800 pb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-white uppercase tracking-wider">
                {t("my_history.package_title")}
              </h3>
            </div>
            {orders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((o) => (
                  <div
                    key={o._id}
                    className="bg-gray-800/50 border border-gray-700 hover:border-primary/50 transition-colors rounded-xl p-4 flex justify-between items-start"
                  >
                    <div>
                      <p className="font-bold text-lg text-white">{o.package}</p>
                      <div className="mt-3 space-y-2 text-sm text-gray-400">
                        <p className="flex items-center gap-2">
                          <span className="font-medium">{t("my_history.total_sessions")}:</span>
                          <strong className="text-white">
                            {o.totalSessions}
                          </strong>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-medium">{t("my_history.remaining_sessions")}:</span>
                          <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-0.5 rounded-full text-xs font-bold">
                            {o.sessions} {t("my_history.sessions_unit")}
                          </span>
                        </p>
                      </div>
                    </div>
                    <CheckCircle className="w-8 h-8 text-primary/40" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">{t("my_history.no_packages")}</p>
            )}
          </div>

          {/* History */}
          <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="px-6 py-5 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-white uppercase tracking-wider">
                  {t("my_history.checkin_history")}
                </h3>
              </div>
              <span className="text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full">
                {checkins.length} {t("my_history.sessions_unit")}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/40 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.stt")}
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.package")}
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.date")}
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.muscle")}
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.note")}
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                      {t("my_history.remaining_sessions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCheckins.length > 0 ? (
                    paginatedCheckins.map((c, i) => (
                      <tr
                        key={c._id}
                        className="border-t border-gray-850 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-4 text-gray-400 font-medium">
                          {(currentPage - 1) * itemsPerPage + i + 1}
                        </td>
                        <td className="px-4 py-4 font-semibold text-white">
                          {c.package}
                        </td>
                        <td className="px-4 py-4 text-gray-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          {new Date(c.time).toLocaleString(i18n.language === "vi" ? "vi-VN" : "en-US", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                        <td className="px-4 py-4 text-gray-300">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-medium text-white">
                            <Dumbbell className="w-3.5 h-3.5 text-primary" />{" "}
                            {c.muscle}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 max-w-xs truncate">
                          {c.note || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex justify-center px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                            {c.remainingSessions} {t("my_history.sessions_unit")}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-4 py-12 text-center text-gray-400"
                      >
                        {t("my_history.no_checkin")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 py-4 border-t border-gray-800 bg-gray-900/50">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-300">
                  {t("my_history.page_info", { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </phantom-ui>
  );
};

export default MyHistory;
