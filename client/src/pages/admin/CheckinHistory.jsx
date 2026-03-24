import { useEffect, useState } from "react";
import {
  Edit,
  Trash,
  Calendar,
  Dumbbell,
  FileText,
  X,
  Save,
  History,
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getCheckins,
  deleteCheckin,
  updateCheckin,
} from "../../services/checkin.service";

const CheckinHistory = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // State tìm kiếm
  const [searchName, setSearchName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCheckins = async () => {
    try {
      setLoading(true);

      const res = await getCheckins();
      setCheckins(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchCheckins();
  }, []);

  // DELETE
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa checkin này?")) return;

    try {
      setSaving(true);

      await deleteCheckin(id);
      await fetchCheckins();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  // OPEN MODAL
  const handleEdit = (c) => {
    setEditing(c);
    setShowModal(true);
  };

  // SAVE EDIT
  const handleSave = async () => {
    try {
      setSaving(true);

      await updateCheckin(editing._id, {
        time: editing.time,
        muscle: editing.muscle,
        note: editing.note,
      });

      setShowModal(false);
      await fetchCheckins();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  // LỌC DỮ LIỆU
  const filteredCheckins = checkins.filter((c) => {
    if (searchName && !c.name?.toLowerCase().includes(searchName.toLowerCase()))
      return false;
    if (selectedMonth && selectedYear && c.time) {
      let date;
      if (c.time.includes("-")) {
        date = new Date(c.time);
      } else if (c.time.includes("/")) {
        const parts = c.time.split("/");
        if (parts.length === 3)
          date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        date = new Date(c.time);
      }
      if (!isNaN(date.getTime())) {
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear().toString();
        if (month !== selectedMonth || year !== selectedYear) return false;
      }
    }
    return true;
  });

  // PHÂN TRANG
  const totalPages = Math.ceil(filteredCheckins.length / itemsPerPage);
  const paginatedCheckins = filteredCheckins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset trang khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, selectedMonth, selectedYear]);

  // Danh sách năm có sẵn
  const availableYears = [
    ...new Set(
      checkins
        .map((c) => {
          if (!c.time) return null;
          if (c.time.includes("-")) return c.time.split("-")[0];
          if (c.time.includes("/")) return c.time.split("/")[2];
          return null;
        })
        .filter((y) => y),
    ),
  ].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="space-y-4 p-4 animate-pulse">
        {/* Header */}
        <div className="h-6 bg-gray-300 rounded w-1/4"></div>

        {/* Filter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>

        {/* Table */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Lịch sử check-in
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các buổi tập đã check-in của khách hàng
          </p>
        </div>
        <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          Tổng: {filteredCheckins.length} / {checkins.length} lượt
        </div>
      </div>

      {/* Search Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
            >
              <option value="">Tháng</option>
              {Array.from({ length: 12 }, (_, i) =>
                String(i + 1).padStart(2, "0"),
              ).map((m) => (
                <option key={m} value={m}>
                  Tháng {parseInt(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
            >
              <option value="">Năm</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {(searchName || selectedMonth || selectedYear) && (
            <button
              onClick={() => {
                setSearchName("");
                setSelectedMonth("");
                setSelectedYear("");
              }}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Xóa bộ lọc"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  STT
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Tên
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Gói tập
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Ngày
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Nhóm cơ
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Ghi chú
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Còn lại
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCheckins.map((c, i) => (
                <tr
                  key={c._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {(currentPage - 1) * itemsPerPage + i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.package}</td>
                  <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(c.time).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour12: false,
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5 text-slate-400" />{" "}
                      {c.muscle}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                    {c.note || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {c.remainingSessions} buổi
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Sửa"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c._id)}
                        disabled={saving}
                        className={`${saving ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedCheckins.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Không có dữ liệu check-in phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                Sửa thông tin check-in
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Ngày check-in
                </label>
                <input
                  type="text"
                  value={editing.time}
                  onChange={(e) =>
                    setEditing({ ...editing, time: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> Nhóm cơ
                </label>
                <input
                  type="text"
                  value={editing.muscle}
                  onChange={(e) =>
                    setEditing({ ...editing, muscle: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Ghi chú
                </label>
                <textarea
                  value={editing.note}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinHistory;
