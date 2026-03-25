import { useState, useEffect } from "react";
import { Search, Trash2, User } from "lucide-react";
import { toast } from "react-toastify";
import { getUsers, deleteUser } from "../../services/user.service";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getUsers();
      setUsers(res.data.data || []);
    } catch (err) {
      console.error("FETCH USERS ERROR:", err);
      toast.error(
        err.response?.data?.message || "Lỗi tải danh sách người dùng",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa người dùng "${name}"?`)) return;
    try {
      await deleteUser(id);
      toast.success("Xóa người dùng thành công");
      fetchUsers(); // refresh danh sách
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi xóa người dùng");
    }
  };

  // Lọc theo tên hoặc email
  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3 md:w-1/4"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">
          Quản lý người dùng
        </h2>
      </div>
      <p className="text-sm text-slate-500">
        Danh sách khách hàng đã đăng nhập qua Google.
      </p>

      {/* Thanh tìm kiếm */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
        />
      </div>

      {/* Bảng với cuộn ngang khi cần */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[140px]">
                  Tên
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[180px]">
                  Email
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user._id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700 break-words">
                    {user.name}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600 break-words">
                    {user.email}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <button
                      onClick={() => handleDelete(user._id, user.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    {searchTerm
                      ? "Không tìm thấy người dùng nào."
                      : "Chưa có người dùng nào."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
