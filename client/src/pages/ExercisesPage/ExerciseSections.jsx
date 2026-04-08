import React from "react";
import { Plus, Trash2, X, Dumbbell, Activity } from "lucide-react";
import { workoutSections } from "./constants";

export default function ExerciseSections({
  selectedMuscleGroups,
  workoutData,
  handleAddExercise,
  handleDeleteExercise,
  handleExerciseChange,
  exerciseOptions,
  toggleMuscleGroup,
  formatDate,
  isMobile,
  getMuscleGroupById,
}) {
  const renderWorkoutSection = (section, muscleGroupId) => {
    const sectionExercises = workoutData.filter(
      (item) =>
        item.muscleGroup === muscleGroupId && item.section === section.id,
    );

    const renderInput = (record, field, placeholder) => (
      <input
        type="text"
        value={record[field] || ""}
        onChange={(e) =>
          handleExerciseChange(record._id, field, e.target.value)
        }
        className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-primary"
        placeholder={placeholder}
      />
    );

    const renderSelect = (record) => (
      <select
        value={record.name || ""}
        onChange={(e) =>
          handleExerciseChange(record._id, "name", e.target.value)
        }
        className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary"
      >
        <option value="">Chọn bài tập</option>
        {exerciseOptions.map((ex) => (
          <option key={ex._id} value={ex.name}>
            {ex.name}
          </option>
        ))}
      </select>
    );

    return (
      <div key={`${muscleGroupId}-${section.id}`} className="mb-8">
        {/* Header section - không xuống dòng */}
        <div
          className={`flex ${isMobile ? "flex-wrap" : "flex-row justify-between items-center"} gap-3 mb-3 p-3 rounded-xl bg-gray-800/50 backdrop-blur-sm border-l-4`}
          style={{
            borderLeftColor:
              getMuscleGroupById(muscleGroupId)?.color || "#ef4444",
          }}
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <Activity className="w-5 h-5 text-primary flex-shrink-0" />
            <h4 className="font-bold text-lg text-white whitespace-nowrap">
              {section.title}
            </h4>
          </div>
          <button
            onClick={() => handleAddExercise(section.id, muscleGroupId)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg shadow-primary/30 transition flex-shrink-0"
          >
            <Plus size={16} /> Thêm bài tập
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800/50 rounded-xl border border-gray-700">
            <thead className="bg-gray-700/60">
              <tr>
                {section.columns.map((col) => (
                  <th
                    key={col}
                    className="p-2 text-left text-sm font-semibold text-gray-300 border-b border-gray-600 whitespace-nowrap"
                  >
                    {col === "exercises"
                      ? "Bài tập"
                      : col.charAt(0).toUpperCase() + col.slice(1)}
                  </th>
                ))}
                <th className="p-2 text-center text-sm font-semibold text-gray-300 whitespace-nowrap">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sectionExercises.map((record) => (
                <tr key={record._id} className="hover:bg-gray-700/30">
                  {section.columns.map((col) => (
                    <td key={col} className="p-2 align-middle">
                      {col === "exercises" && renderSelect(record)}
                      {["sets", "reps", "tempo", "duration"].includes(col) &&
                        renderInput(
                          record,
                          col,
                          col === "sets"
                            ? "Số hiệp"
                            : col === "reps"
                              ? "Số cái"
                              : col === "tempo"
                                ? "Nhịp độ"
                                : "Thời gian",
                        )}
                      {col === "tips" &&
                        renderInput(record, "tips", "Hướng dẫn của Coach")}
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleDeleteExercise(record._id)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {sectionExercises.length === 0 && (
                <tr>
                  <td
                    colSpan={section.columns.length + 1}
                    className="p-4 text-center text-gray-400"
                  >
                    Chưa có bài tập nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {selectedMuscleGroups.map((groupId) => {
        const group = getMuscleGroupById(groupId);
        if (!group) return null;
        return (
          <div
            key={groupId}
            className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700 p-5 relative"
          >
            <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Dumbbell className="w-6 h-6 text-primary flex-shrink-0" />
                <h2
                  className="text-2xl font-bold whitespace-nowrap"
                  style={{ color: group.color }}
                >
                  {group.name}
                </h2>
                <span className="text-sm text-gray-400 font-normal whitespace-nowrap">
                  ({formatDate(new Date())})
                </span>
              </div>
              <button
                onClick={() => toggleMuscleGroup(groupId)}
                className="text-gray-400 hover:text-gray-200 transition"
              >
                <X size={20} />
              </button>
            </div>
            {workoutSections.map((section) =>
              renderWorkoutSection(section, groupId),
            )}
          </div>
        );
      })}
    </div>
  );
}
