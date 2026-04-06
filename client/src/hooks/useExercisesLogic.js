import { useState, useEffect } from "react";
import api from "../utils/api";
import {
  muscleGroups,
  workoutSections,
} from "../pages/ExercisesPage/constants";

export default function useExercisesLogic() {
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [workoutData, setWorkoutData] = useState([]);
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState([]);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showCustomGroupModal, setShowCustomGroupModal] = useState(false);
  const [tempSelectedGroups, setTempSelectedGroups] = useState([]);
  const [customGroups, setCustomGroups] = useState([]);

  // Lấy danh sách bài tập từ backend
  useEffect(() => {
    api
      .get("/exercises?limit=500")
      .then((res) => {
        const exercisesArray = res.data.data || [];
        setExerciseOptions(exercisesArray);
        setFilteredExercises(exercisesArray);
      })
      .catch((err) => console.error("Lỗi lấy bài tập:", err));
  }, []);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleMuscleGroup = (groupId) => {
    if (groupId === "custom") {
      handleCustomGroupSelection();
      return;
    }
    setSelectedMuscleGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleCustomGroupSelection = () => {
    setTempSelectedGroups([...selectedMuscleGroups]);
    setShowCustomGroupModal(true);
  };

  const handleCreateCustomGroup = () => {
    if (tempSelectedGroups.length === 0) {
      alert("Vui lòng chọn ít nhất một nhóm cơ");
      return;
    }
    const customId = tempSelectedGroups.join("_");
    const groupName =
      tempSelectedGroups
        .map((id) => {
          const group = muscleGroups.find((g) => g.id === id);
          return group ? group.name.replace(" DAY", "") : id;
        })
        .join(" && ") + " DAY";
    const firstGroup = muscleGroups.find((g) => g.id === tempSelectedGroups[0]);
    const customColor = firstGroup ? firstGroup.color : "#13c2c2";
    const newCustomGroup = {
      id: customId,
      name: groupName,
      color: customColor,
    };
    setCustomGroups((prev) => [...prev, newCustomGroup]);
    setSelectedMuscleGroups((prev) => [...prev, customId]);
    setShowCustomGroupModal(false);
  };

  const getMuscleGroupById = (groupId) => {
    const defaultGroup = muscleGroups.find((g) => g.id === groupId);
    if (defaultGroup) return defaultGroup;
    const customGroup = customGroups.find((g) => g.id === groupId);
    if (customGroup) return customGroup;
    return { id: groupId, name: groupId, color: "#666666" };
  };

  const handleAddExercise = (sectionId, muscleGroupId) => {
    const newExercise = {
      _id: `new-${Date.now()}-${muscleGroupId}-${sectionId}`,
      section: sectionId,
      muscleGroup: muscleGroupId,
      name: "",
      sets: "",
      reps: "",
      tempo: "",
      duration: "",
      tips: "",
    };
    setWorkoutData((prev) => [...prev, newExercise]);
  };

  const handleDeleteExercise = (id) => {
    setWorkoutData((prev) => prev.filter((item) => item._id !== id));
  };

  const handleExerciseChange = (id, field, value) => {
    setWorkoutData((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // Hàm gửi góp ý
  const sendExerciseSuggestion = async (suggestion) => {
    try {
      await api.post("/exercise-suggestions", {
        name: suggestion,
        description: suggestion,
      });
      return true;
    } catch (error) {
      console.error("Gửi góp ý thất bại:", error);
      return false;
    }
  };

  const isMobile = windowWidth < 768;

  return {
    muscleGroups,
    workoutSections,
    exerciseOptions,
    workoutData,
    selectedMuscleGroups,
    showExerciseList,
    setShowExerciseList,
    filteredExercises,
    setFilteredExercises,
    isMobile,
    toggleMuscleGroup,
    handleAddExercise,
    handleDeleteExercise,
    handleExerciseChange,
    formatDate,
    showCustomGroupModal,
    setShowCustomGroupModal,
    tempSelectedGroups,
    setTempSelectedGroups,
    handleCreateCustomGroup,
    getMuscleGroupById,
    customGroups,
    sendExerciseSuggestion,
  };
}
