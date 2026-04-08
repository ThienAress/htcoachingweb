import React, { useEffect, useState, useRef, useCallback } from "react";
import { Search, X, Dumbbell, AlertTriangle } from "lucide-react";

export default function ExerciseListModal({
  open,
  onClose,
  exercises,
  allExercises,
  setFilteredExercises,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [searchType, setSearchType] = useState("name");
  const [searchValue, setSearchValue] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      checkIsMobile();
      window.addEventListener("resize", checkIsMobile);
      setSearchValue("");
      setSearchType("name");
    }
    return () => window.removeEventListener("resize", checkIsMobile);
  }, [open]);

  const checkIsMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const performSearch = useCallback(
    (value) => {
      if (!value) {
        setFilteredExercises(allExercises);
        return;
      }
      if (searchType === "name") {
        setFilteredExercises(
          allExercises.filter((ex) =>
            ex.name.toLowerCase().includes(value.toLowerCase()),
          ),
        );
      } else {
        setFilteredExercises(
          allExercises.filter(
            (ex) =>
              ex.muscleGroup &&
              ex.muscleGroup.toLowerCase().includes(value.toLowerCase()),
          ),
        );
      }
    },
    [allExercises, searchType, setFilteredExercises],
  );

  useEffect(() => {
    const handler = setTimeout(() => performSearch(searchValue), 300);
    return () => clearTimeout(handler);
  }, [searchValue, performSearch]);

  useEffect(() => {
    performSearch(searchValue);
  }, [searchType]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className={`bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-700 ${
          isMobile
            ? "w-full h-full max-h-full"
            : "w-full max-w-4xl max-h-[80vh]"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            DANH SÁCH BÀI TẬP
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {/* Search controls */}
          <div
            className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-3 mb-6`}
          >
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="border border-gray-600 rounded-xl px-4 py-2.5 bg-gray-700 text-white focus:ring-2 focus:ring-primary"
            >
              <option value="name">Tên bài tập</option>
              <option value="muscle">Nhóm cơ</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Tìm theo ${searchType === "name" ? "tên bài tập" : "nhóm cơ"}`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800/50 rounded-xl border border-gray-700">
              <thead className="bg-gray-700/60">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-300">
                    Tên bài tập
                  </th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-300">
                    Nhóm cơ chính
                  </th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-300">
                    Mô tả tóm tắt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {exercises.map((ex) => (
                  <tr key={ex._id} className="hover:bg-gray-700/30 transition">
                    <td className="p-3 text-sm text-white">{ex.name}</td>
                    <td className="p-3 text-sm">
                      {ex.muscleGroup ? (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {ex.muscleGroup}
                        </span>
                      ) : (
                        <span className="text-gray-400">Chưa có</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-gray-300">
                      {ex.description || (
                        <span className="text-gray-500">Không có mô tả</span>
                      )}
                    </td>
                  </tr>
                ))}
                {exercises.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Không tìm thấy bài tập
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
