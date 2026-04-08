import React, { useState, useEffect, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Flame,
  List,
  Info,
  FileText,
  Send,
  Dumbbell,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import useExercisesLogic from "../../hooks/useExercisesLogic";
import MuscleGroupSelector from "./MuscleGroupSelector";
import ExerciseSections from "./ExerciseSections";
import ExerciseListModal from "./ExerciseListModal";
import WorkoutPlanPDF from "./WorkoutPlanPDF";
import { workoutExplanations, workoutSections } from "./constants";
import HeaderMinimal from "../../sections/Header/HeaderMinimal";
import FooterMinimal from "../../sections/Footer/FooterMinimal";
import ChatIcons from "../../components/ChatIcons";
import Contact from "../../sections/Contact";
import { usePrompt } from "../../hooks/usePrompt";

const ExercisesPage = () => {
  const logic = useExercisesLogic();
  const hasWorkoutData = logic.workoutData && logic.workoutData.length > 0;
  const exportedFileRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasWorkoutData && !exportedFileRef.current) {
        event.preventDefault();
        event.returnValue =
          "Bạn chưa xuất file PDF, có thể mất dữ liệu khi load lại trang.";
        return event.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasWorkoutData]);

  usePrompt(
    hasWorkoutData && !exportedFileRef.current,
    "Bạn chưa xuất file PDF, có thể mất dữ liệu khi rời trang.",
  );

  const handleExportPDF = async () => {
    try {
      if (!logic.selectedMuscleGroups || !logic.workoutData) {
        toast.warning("Dữ liệu chưa sẵn sàng!");
        return;
      }
      if (!workoutSections || workoutSections.length === 0) {
        toast.error("Lỗi cấu trúc bài tập!");
        return;
      }

      const planData = logic.selectedMuscleGroups
        .map((groupId) => {
          const group = logic.getMuscleGroupById(groupId);
          const sections = workoutSections
            .map((section) => {
              const rows = logic.workoutData.filter(
                (ex) => ex.muscleGroup === groupId && ex.section === section.id,
              );
              if (rows.length === 0) return null;
              return {
                id: section.id,
                title: section.title,
                data: rows,
              };
            })
            .filter(Boolean);
          if (sections.length === 0) return null;
          return {
            muscleGroup: group ? group.name : groupId,
            date: new Date().toLocaleDateString("vi-VN"),
            sections,
          };
        })
        .filter(Boolean);

      if (planData.length === 0) {
        toast.warning("Bạn chưa tạo lịch tập nào!");
        return;
      }

      const blob = await pdf(
        <WorkoutPlanPDF
          planData={planData}
          date={new Date().toLocaleDateString("vi-VN")}
        />,
      ).toBlob();
      saveAs(blob, `Lich_Tap_${new Date().toISOString().slice(0, 10)}.pdf`);
      exportedFileRef.current = true;
      toast.success("Xuất PDF thành công!");
    } catch (error) {
      console.error("Lỗi xuất PDF:", error);
      toast.error("Có lỗi xảy ra khi xuất PDF.");
    }
  };

  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);
  const handleSendSuggestion = async () => {
    if (!suggestion.trim()) {
      toast.warning("Vui lòng nhập góp ý");
      return;
    }
    setSending(true);
    const success = await logic.sendExerciseSuggestion(suggestion);
    if (success) {
      toast.success("Cảm ơn bạn đã góp ý!");
      setSuggestion("");
    } else {
      toast.error("Gửi thất bại, thử lại sau.");
    }
    setSending(false);
  };

  return (
    <>
      <HeaderMinimal />
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-8">
        <div className="container-custom">
          {/* Header section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <Flame className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">
                HỆ THỐNG BÀI TẬP
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-normal">
              TẠO LỊCH TẬP <span className="text-primary">CÁ NHÂN HÓA</span>
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              Chọn nhóm cơ, thêm bài tập và xuất lịch tập PDF chuyên nghiệp
            </p>
          </div>

          {/* Card chính */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Dumbbell className="text-primary w-7 h-7" />
                <h2 className="text-2xl font-bold text-white">CHỌN NHÓM CƠ</h2>
              </div>
              <button
                onClick={() => logic.setShowExerciseList(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-full shadow-lg shadow-primary/30 transition"
              >
                <List size={18} /> Xem danh sách bài tập
              </button>
            </div>
            <MuscleGroupSelector
              muscleGroups={[...logic.muscleGroups, ...logic.customGroups]}
              selected={logic.selectedMuscleGroups}
              onToggle={logic.toggleMuscleGroup}
              showCustomGroupModal={logic.showCustomGroupModal}
              setShowCustomGroupModal={logic.setShowCustomGroupModal}
              tempSelectedGroups={logic.tempSelectedGroups}
              setTempSelectedGroups={logic.setTempSelectedGroups}
              handleCreateCustomGroup={logic.handleCreateCustomGroup}
            />
          </div>

          {/* Các nhóm cơ đã chọn */}
          {logic.selectedMuscleGroups.length > 0 && (
            <ExerciseSections
              selectedMuscleGroups={logic.selectedMuscleGroups}
              workoutData={logic.workoutData}
              handleAddExercise={logic.handleAddExercise}
              handleDeleteExercise={logic.handleDeleteExercise}
              handleExerciseChange={logic.handleExerciseChange}
              exerciseOptions={logic.exerciseOptions}
              toggleMuscleGroup={logic.toggleMuscleGroup}
              formatDate={logic.formatDate}
              isMobile={logic.isMobile}
              getMuscleGroupById={logic.getMuscleGroupById}
            />
          )}

          {/* Giải thích lịch tập */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mt-8">
              <div className="flex items-center gap-2 mb-5">
                <Info className="text-primary w-6 h-6" />
                <h3 className="text-xl font-bold text-white">
                  GIẢI THÍCH LỊCH TẬP
                </h3>
              </div>

              <div className="divide-y divide-gray-700/80">
                {workoutExplanations.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[260px_1fr] gap-x-6 py-4 items-start"
                  >
                    <div className="font-bold text-primary text-base leading-relaxed whitespace-nowrap">
                      {item.title}:
                    </div>

                    <div className="text-gray-300 text-base leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 mt-3 border-t border-gray-700 space-y-2">
                <p className="text-gray-200 italic text-base">
                  Chúc bạn luyện tập thật hiệu quả và đạt được mục tiêu thể hình
                  của mình!
                </p>

                <p className="text-yellow-400 text-base italic font-semibold">
                  Lưu ý: Dữ liệu sẽ bị xóa khi load lại trang. Bạn có thể tải
                  lịch tập về file PDF trước khi thoát trang nha!
                </p>
              </div>
            </div>
          )}
          {/* Modal danh sách bài tập */}
          <ExerciseListModal
            open={logic.showExerciseList}
            onClose={() => logic.setShowExerciseList(false)}
            exercises={logic.filteredExercises}
            allExercises={logic.exerciseOptions}
            setFilteredExercises={logic.setFilteredExercises}
          />

          {/* Nút xuất PDF */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="flex justify-start mt-8">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-full shadow-lg shadow-green-600/30 transition"
              >
                <FileText size={18} /> Tải lịch tập về PDF
              </button>
            </div>
          )}

          {/* Góp ý bài tập */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <textarea
                rows={2}
                placeholder="Bạn muốn mình thêm bài tập nào thì góp ý nha..."
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                disabled={sending}
                className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleSendSuggestion}
                disabled={sending}
                className="px-6 py-2 bg-primary hover:bg-primary-dark rounded-full text-white font-semibold shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                <Send size={16} /> {sending ? "Đang gửi..." : "Gửi góp ý"}
              </button>
            </div>
          )}
        </div>
      </div>
      <Contact />
      <ChatIcons />
      <FooterMinimal />
    </>
  );
};

export default ExercisesPage;
