import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity, CheckSquare, Send, Dumbbell, Search, X as XIcon
} from "lucide-react";
import { toast } from "react-toastify";
import SEO from "../../components/SEO";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import { useAuth } from "../../context/AuthContext";
import { getWorkoutPlans, getMyWorkoutPlans, getWorkoutPlanById, updateWorkoutPlan } from "../../services/workoutPlan.service";
import { getExercises } from "../../services/exercise.service";

const EMPTY_EXERCISE = {
  name: "", sets: "", reps: "", tempo: "", duration: "", coachingTips: "", maxWeight: "",
  setsAssessment: "", repsAssessment: "", tempoAssessment: "", failReason: ""
};

const inputClass = "w-full px-2 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors";

// ===== EXERCISE AUTOCOMPLETE =====
const ExerciseNameInput = ({ value, onChange, readOnly, isLocked }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = async (text) => {
    if (readOnly || isLocked) return;
    onChange(text);
    if (text.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await getExercises(1, 10, text);
      setSuggestions(res.data || []);
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
  };

  return (
    <div className="relative h-full">
      <input
        type="text"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="Tên bài tập..."
        className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
        readOnly={readOnly || isLocked}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
          {suggestions.map((ex) => (
            <button
              key={ex._id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 truncate"
              onMouseDown={() => { onChange(ex.name); setShowSuggestions(false); }}
            >
              {ex.name} <span className="text-xs text-gray-500">({ex.muscleGroup})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ===== EXERCISE BROWSER MODAL =====
const ExerciseBrowserModal = ({ isOpen, onClose }) => {
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");

  const muscleGroups = ["Ngực", "Lưng", "Vai", "Tay trước", "Tay sau", "Chân", "Bụng", "Mông", "Cardio"];

  useEffect(() => {
    if (!isOpen) return;
    fetchExercises();
  }, [isOpen, search, selectedGroup]);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const res = await getExercises(1, 50, search, selectedGroup);
      setExercises(res.data || []);
    } catch { setExercises([]); }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl border border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" /> Danh sách bài tập
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bài tập..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGroup("")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${!selectedGroup ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              Tất cả
            </button>
            {muscleGroups.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g === selectedGroup ? "" : g)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${selectedGroup === g ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Đang tải...</div>
          ) : exercises.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Không tìm thấy bài tập nào</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {exercises.map((ex) => (
                <div key={ex._id} className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-primary/30 transition-colors">
                  {ex.image && (
                    <img src={ex.image} alt={ex.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ex.name}</p>
                    <p className="text-xs text-gray-500">{ex.muscleGroup}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== ASSESSMENT CELL =====
const AssessmentCell = ({ value, assessmentValue, onChangeAssessment, isLocked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isPass = assessmentValue === "pass";
  const isFail = assessmentValue === "fail";

  return (
    <div className="relative h-full flex flex-col justify-center">
      <button
        type="button"
        disabled={isLocked}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-full text-left px-2 py-1.5 border rounded text-sm transition-colors outline-none flex items-center justify-between
          ${isPass ? 'bg-green-500/10 border-green-500/50 text-green-400'
            : isFail ? 'bg-red-500/10 border-red-500/50 text-red-400'
              : 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'}
          ${isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
      >
        <span className="font-medium truncate">{value || "-"}</span>
        {isPass && <span className="ml-2 text-[11px] uppercase tracking-wide shrink-0">Đạt</span>}
        {isFail && <span className="ml-2 text-[11px] uppercase tracking-wide shrink-0">Không đạt</span>}
      </button>

      {isOpen && !isLocked && (
        <>
          <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div className="absolute top-full left-0 mt-1 w-36 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-[60] flex flex-col overflow-hidden">
            <button type="button" onClick={() => { onChangeAssessment("pass"); setIsOpen(false); }} className="px-3 py-2 text-left text-sm hover:bg-gray-700 text-green-400 transition-colors">✅ Đạt</button>
            <button type="button" onClick={() => { onChangeAssessment("fail"); setIsOpen(false); }} className="px-3 py-2 text-left text-sm hover:bg-gray-700 text-red-400 transition-colors">❌ Không đạt</button>
            <button type="button" onClick={() => { onChangeAssessment(""); setIsOpen(false); }} className="px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-400 transition-colors border-t border-gray-700">Bỏ chọn</button>
          </div>
        </>
      )}
    </div>
  );
};

// ===== EXERCISE TABLE =====
const ExerciseTable = ({ exercises, onChange, mode, isLocked }) => {
  const isAssessment = mode === "assessment";

  const updateExercise = (idx, field, val) => {
    const updated = [...exercises];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };

  const handleStrictNumber = (idx, field, value) => {
    let val = value.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) val = val.substring(0, val.length - 1);
    while (val.startsWith('0') || val.startsWith('.')) val = val.substring(1);
    updateExercise(idx, field, val);
  };

  const handleFlexibleInput = (idx, field, value) => {
    let val = value;
    if (val.startsWith('-')) val = val.substring(1);
    if (val.startsWith('0')) val = val.substring(1);
    updateExercise(idx, field, val);
  };

  const addExercise = () => onChange([...exercises, { ...EMPTY_EXERCISE }]);

  const removeExercise = (idx) => {
    onChange(exercises.filter((_, i) => i !== idx));
  };

  const hasData = (field) => exercises.some((ex) => ex[field]);
  const showTempo = true; // Luôn hiện
  const showDuration = !isAssessment && (hasData("duration") || true);
  const showCoaching = !isAssessment && (hasData("coachingTips") || true);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-primary border-b border-gray-700">
            <th className="text-left py-2 px-1 min-w-[200px]">{i18n.language === "vi" ? "Bài tập" : "Exercises"}</th>
            <th className="text-left py-2 px-1 w-24">{t("coaching.sets")}</th>
            <th className="text-left py-2 px-1 w-24">{t("coaching.reps")}</th>
            {showTempo && <th className="text-left py-2 px-1 w-24">{t("coaching.tempo")}</th>}
            {!isAssessment && showDuration && <th className="text-left py-2 px-1 w-24">{i18n.language === "vi" ? "Thời gian" : "Duration"}</th>}
            {!isAssessment && showCoaching && <th className="text-left py-2 px-1 min-w-[200px]">{t("coaching.tips")}</th>}
            {isAssessment && <th className="text-left py-2 px-1 w-24">{i18n.language === "vi" ? "Tạ lớn nhất" : "Max Weight"}</th>}
            {isAssessment && <th className="text-left py-2 px-1 min-w-[150px]">{i18n.language === "vi" ? "Lý do không đạt" : "Failure Reason"}</th>}
            {!isAssessment && !isLocked && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {exercises.map((ex, idx) => (
            <tr key={idx} className="border-b border-gray-700/50 hover:bg-white/[0.02]">
              <td className="py-1.5 px-1 align-top">
                <ExerciseNameInput value={ex.name} onChange={(v) => updateExercise(idx, "name", v)} readOnly={isAssessment} isLocked={isLocked} />
              </td>
              <td className="py-1.5 px-1 align-top">
                {!isAssessment ? (
                  <input type="text" value={ex.sets} onChange={(e) => handleFlexibleInput(idx, "sets", e.target.value)} placeholder="3" className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`} readOnly={isLocked} />
                ) : (
                  <AssessmentCell value={ex.sets} assessmentValue={ex.setsAssessment} onChangeAssessment={(v) => updateExercise(idx, "setsAssessment", v)} isLocked={isLocked} />
                )}
              </td>
              <td className="py-1.5 px-1 align-top">
                {!isAssessment ? (
                  <input type="text" value={ex.reps} onChange={(e) => handleFlexibleInput(idx, "reps", e.target.value)} placeholder="10-12" className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`} readOnly={isLocked} />
                ) : (
                  <AssessmentCell value={ex.reps} assessmentValue={ex.repsAssessment} onChangeAssessment={(v) => updateExercise(idx, "repsAssessment", v)} isLocked={isLocked} />
                )}
              </td>

              {showTempo && (
                <td className="py-1.5 px-1 align-top">
                  {!isAssessment ? (
                    <input type="text" value={ex.tempo} onChange={(e) => handleFlexibleInput(idx, "tempo", e.target.value)} placeholder="2-0-2" className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`} readOnly={isLocked} />
                  ) : (
                    <AssessmentCell value={ex.tempo} assessmentValue={ex.tempoAssessment} onChangeAssessment={(v) => updateExercise(idx, "tempoAssessment", v)} isLocked={isLocked} />
                  )}
                </td>
              )}

              {!isAssessment && showDuration && (
                <td className="py-1.5 px-1 align-top">
                  <input type="text" value={ex.duration} onChange={(e) => handleFlexibleInput(idx, "duration", e.target.value)} placeholder="30s" className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`} readOnly={isLocked} />
                </td>
              )}
              {!isAssessment && showCoaching && (
                <td className="py-1.5 px-1 align-top">
                  <input type="text" value={ex.coachingTips} onChange={(e) => updateExercise(idx, "coachingTips", e.target.value)} className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`} readOnly={isLocked} />
                </td>
              )}

              {isAssessment && (
                <td className="py-1.5 px-1 align-top">
                  <input
                    type="text"
                    value={ex.maxWeight}
                    onChange={(e) => handleStrictNumber(idx, "maxWeight", e.target.value)}
                    placeholder="VD: 50"
                    className={`${inputClass} h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                    readOnly={isLocked}
                  />
                </td>
              )}

              {isAssessment && (() => {
                const needsReason = ex.setsAssessment === "fail" || ex.repsAssessment === "fail" || ex.tempoAssessment === "fail";
                const isReasonMissing = needsReason && !ex.failReason?.trim();
                return (
                  <td className="py-1.5 px-1 align-top">
                    <textarea
                      rows={2}
                      value={ex.failReason}
                      onChange={(e) => updateExercise(idx, "failReason", e.target.value)}
                      placeholder={needsReason ? (i18n.language === "vi" ? "Bắt buộc nhập lý do..." : "Reason required...") : (i18n.language === "vi" ? "Ghi chú thêm..." : "Additional notes...")}
                      className={`${inputClass} resize-none h-full ${isLocked ? 'opacity-70 cursor-not-allowed' : ''} ${!isLocked && isReasonMissing ? 'border-red-500 ring-1 ring-red-500/50' : ''}`}
                      readOnly={isLocked}
                    />
                  </td>
                );
              })()}

              {!isAssessment && !isLocked && (
                <td className="py-1.5 px-1 text-center align-top pt-3">
                  <button type="button" onClick={() => removeExercise(idx)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!isAssessment && !isLocked && (
        <button type="button" onClick={addExercise} className="flex items-center gap-1 mt-2 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20">
          <Plus className="w-3.5 h-3.5" /> {i18n.language === "vi" ? "Thêm bài tập" : "Add Exercise"}
        </button>
      )}
    </div>
  );
};

// ===== SECTION COMPONENT =====
const SectionBlock = ({ section, onUpdate, onRemove, isOpen, onToggle, mode, isLocked }) => {
  const updateField = (field, val) => onUpdate({ ...section, [field]: val });

  return (
    <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl overflow-hidden mb-4 shadow-sm">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 cursor-pointer hover:bg-gray-800 transition-colors" onClick={onToggle}>
        <GripVertical className="w-4 h-4 text-gray-600" />
        <span className="text-xl">{section.icon || "📋"}</span>
        <input
          type="text"
          value={section.name}
          onChange={(e) => updateField("name", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          readOnly={mode === "assessment" || isLocked}
          className={`flex-1 bg-transparent text-white font-bold text-fluid-sm focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 uppercase tracking-wide ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
        />
        {mode === "training" && !isLocked && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-900/50 rounded-md transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 ml-2" /> : <ChevronDown className="w-5 h-5 text-gray-400 ml-2" />}
      </div>

      {/* Section Body */}
      {isOpen && (
        <div className="p-4 bg-gray-900/30">
          {mode === "training" && !isLocked && (
            <div className="flex items-center gap-2 mb-4 bg-gray-800/50 p-2 rounded-lg inline-flex">
              <span className="text-xs text-gray-400 mr-1">Icon:</span>
              {["🔥", "🏋️", "🍑", "🧘", "💪", "⚡", "🎯", "📋"].map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => updateField("icon", ic)}
                  className={`text-lg p-1.5 rounded-md transition-all ${section.icon === ic ? "bg-primary/20 ring-1 ring-primary shadow-sm" : "hover:bg-gray-700/80 grayscale hover:grayscale-0"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          )}
          <ExerciseTable
            exercises={section.exercises || []}
            onChange={(exs) => updateField("exercises", exs)}
            mode={mode}
            isLocked={isLocked}
          />
        </div>
      )}
    </div>
  );
};

// ===== MAIN COMPONENT =====
const WorkoutPlanDetail = () => {
  const { t, i18n } = useTranslation("coaching");
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isUserOnly = user?.role === "user";
  const [activeTab, setActiveTab] = useState("training"); // "training" or "assessment"

  const { data: planData, isLoading } = useQuery({
    queryKey: ["workout-plan", id],
    queryFn: () => getWorkoutPlanById(id).then((res) => res.data.data),
  });

  const [form, setForm] = useState(null);
  const [openSections, setOpenSections] = useState(new Set([0, 1, 2, 3, 4, 5]));
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showExerciseBrowser, setShowExerciseBrowser] = useState(false);

  // Navigation for dates
  const [targetDate, setTargetDate] = useState(null);
  const [showCreateMissingModal, setShowCreateMissingModal] = useState(false);

  useEffect(() => {
    if (planData) {
      setForm({
        ...planData,
        planDate: new Date(planData.planDate).toISOString().split("T")[0]
      });
      setTargetDate(new Date(planData.planDate).toISOString().split("T")[0]);
    }
  }, [planData]);

  // Handle navigate to a specific date for this client
  const navigateToDate = async (dateStr) => {
    if (!form) return;
    try {
      let matchedPlan = null;

      if (isUserOnly) {
        // User: gọi API riêng, lọc theo ngày ở client
        const res = await getMyWorkoutPlans();
        const allPlans = res.data.data || [];
        matchedPlan = allPlans.find(
          (p) => new Date(p.planDate).toISOString().split("T")[0] === dateStr
        );
      } else {
        // Trainer/Admin: gọi API có filter server-side
        const res = await getWorkoutPlans({ clientEmail: form.clientEmail, startDate: dateStr, endDate: dateStr });
        const plans = res.data.data;
        if (plans.length > 0) matchedPlan = plans[0];
      }

      if (matchedPlan) {
        navigate(`/workout-plans/${matchedPlan._id}`);
      } else {
        setTargetDate(dateStr);
        if (isUserOnly) {
          toast.info(t("plans.toasts.no_plan_date"));
        } else {
          setShowCreateMissingModal(true);
        }
      }
    } catch (err) {
      toast.error(t("plans.toasts.error_date_change"));
    }
  };

  const handleDateChange = (days) => {
    if (!form) return;
    const d = new Date(form.planDate);
    d.setDate(d.getDate() + days);
    navigateToDate(d.toISOString().split("T")[0]);
  };

  const updateMut = useMutation({
    mutationFn: (data) => updateWorkoutPlan(id, data),
    onSuccess: () => {
      toast.success(t("plans.toasts.save_success"));
      queryClient.invalidateQueries({ queryKey: ["workout-plan", id] });
      setShowConfirmModal(false);
      setShowCompleteModal(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || t("plans.toasts.save_failed")),
  });

  const handleSave = () => {
    if (!form) return;
    updateMut.mutate(form);
  };

  const handleSendPlan = () => {
    if (!form) return;
    updateMut.mutate({ ...form, status: "published" });
  };

  const handleCompletePlan = () => {
    if (!form) return;

    for (const section of form.sections) {
      for (const ex of section.exercises) {
        if ((ex.setsAssessment === "fail" || ex.repsAssessment === "fail" || ex.tempoAssessment === "fail") && !ex.failReason?.trim()) {
          toast.error(`Bài tập "${ex.name || 'Không tên'}" bị đánh giá Không đạt. Vui lòng nhập Lý do không đạt!`);
          setShowCompleteModal(false);
          return;
        }
      }
    }

    updateMut.mutate({ ...form, status: "completed" });
  };

  const updateSection = (idx, updated) => {
    setForm(f => {
      const s = [...f.sections];
      s[idx] = updated;
      return { ...f, sections: s };
    });
  };

  const addSection = () => {
    setForm(f => ({
      ...f,
      sections: [...f.sections, { name: "NEW SECTION", icon: "📋", sortOrder: f.sections.length, exercises: [{ ...EMPTY_EXERCISE }] }]
    }));
    setOpenSections(prev => new Set([...prev, form.sections.length]));
  };

  const removeSection = (idx) => {
    if (form.sections.length <= 1) return toast.info("Cần ít nhất 1 section");
    setForm(f => ({
      ...f,
      sections: f.sections.filter((_, i) => i !== idx)
    }));
  };

  const toggleSection = (idx) => {
    setOpenSections(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  };

  if (isLoading || !form) {
    return (
      <div className="min-h-screen bg-gray-900 pt-28 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isDraft = form.status === "draft";
  const isPublished = form.status === "published";
  const isCompleted = form.status === "completed";

  const isTrainingLocked = isUserOnly || !isDraft; // User luôn bị khóa, trainer khóa khi đã gửi
  const isAssessmentLocked = isUserOnly || isCompleted; // User luôn bị khóa, trainer khóa khi đã hoàn thành

  return (
    <>
      <SEO title={`${t("plans.detail_title")}: ${form.title}`} noindex />
      <Header />

      <main className="min-h-screen bg-gray-950 text-white pt-24 pb-20">
        {/* Header Bar */}
        <div className="bg-gray-900 border-b border-gray-800 sticky top-20 z-40 shadow-sm">
          <div className="container-custom py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate("/workout-plans")} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  readOnly={isTrainingLocked}
                  className={`bg-transparent text-xl font-bold focus:outline-none focus:border-b border-primary text-white w-full max-w-sm ${isTrainingLocked ? 'opacity-80 cursor-not-allowed' : ''}`}
                />
                <div className="text-sm text-gray-400 mt-1">
                  {form.clientName}
                  {isPublished && <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{t("plans.status_published")}</span>}
                  {isCompleted && <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{t("plans.status_completed")}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Navigation */}
              <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 p-1">
                <button onClick={() => handleDateChange(-1)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm text-center px-4 font-medium min-w-[120px]">
                  {formatDate(form.planDate, i18n.language === "vi" ? "vi-VN" : "en-US")}
                </div>
                <button onClick={() => handleDateChange(1)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Status Action Buttons — chỉ trainer/admin */}
              {!isUserOnly && isDraft && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {i18n.language === "vi" ? "Lưu nháp" : "Save Draft"}
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-2 bg-primary hover:bg-orange-500 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> {i18n.language === "vi" ? "Gửi giáo án" : "Send Plan"}
                  </button>
                </>
              )}

              {!isUserOnly && isPublished && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {i18n.language === "vi" ? "Lưu đánh giá" : "Save Assessment"}
                  </button>
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    disabled={updateMut.isPending}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                  >
                    <CheckSquare className="w-4 h-4" /> {i18n.language === "vi" ? "Gửi đánh giá (Hoàn thành)" : "Submit Assessment (Complete)"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="container-custom mt-6">
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-800 mb-6">
            <button
              onClick={() => setActiveTab("training")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === "training"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
            >
              <Activity className="w-4 h-4" /> {t("plans.detail_title")}
            </button>
            <button
              onClick={() => setActiveTab("assessment")}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === "assessment"
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
            >
              <CheckSquare className="w-4 h-4" /> {i18n.language === "vi" ? "ĐÁNH GIÁ SAU TẬP" : "POST-WORKOUT ASSESSMENT"}
            </button>
            {activeTab === "training" && !isTrainingLocked && (
              <button
                onClick={() => setShowExerciseBrowser(true)}
                className="flex items-center gap-1.5 px-4 py-2 ml-auto text-xs uppercase font-semibold text-gray-400 hover:text-primary border border-gray-700 hover:border-primary/50 rounded-lg transition-colors bg-gray-800/50 hover:bg-primary/5"
              >
                <Dumbbell className="w-3.5 h-3.5" /> {i18n.language === "vi" ? "XEM DANH SÁCH BÀI TẬP" : "BROWSE EXERCISES"}
              </button>
            )}
          </div>

          {/* Exercise Browser Modal */}
          <ExerciseBrowserModal isOpen={showExerciseBrowser} onClose={() => setShowExerciseBrowser(false)} />

          {/* Sections List */}
          <div className="space-y-4">
            {form.sections?.map((section, idx) => (
              <SectionBlock
                key={idx}
                section={section}
                onUpdate={(updated) => updateSection(idx, updated)}
                onRemove={() => removeSection(idx)}
                isOpen={openSections.has(idx)}
                onToggle={() => toggleSection(idx)}
                mode={activeTab}
                isLocked={activeTab === "training" ? isTrainingLocked : isAssessmentLocked}
              />
            ))}
          </div>

          {activeTab === "training" && !isTrainingLocked && (
            <button
              onClick={addSection}
              className="mt-6 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-700 hover:border-primary/50 text-gray-400 hover:text-primary rounded-xl transition-all font-medium bg-gray-800/20 hover:bg-primary/5"
            >
              <Plus className="w-5 h-5" /> {i18n.language === "vi" ? "THÊM SECTION MỚI" : "ADD NEW SECTION"}
            </button>
          )}

          {/* Overall Assessment */}
          {activeTab === "assessment" && (
            <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 uppercase">
                <span className="text-2xl">⭐</span> {i18n.language === "vi" ? "Đánh giá tổng thể buổi tập" : "Overall Workout Assessment"}
              </h3>
              <div className="flex gap-4">
                {["ĐẠT YÊU CẦU", "CẦN CẢI THIỆN", "XUẤT SẮC"].map(status => {
                  const statusLabel = i18n.language === "vi" ? status : {
                    "ĐẠT YÊU CẦU": "PASSED",
                    "CẦN CẢI THIỆN": "NEED IMPROVEMENT",
                    "XUẤT SẮC": "EXCELLENT"
                  }[status];
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        if (isAssessmentLocked) return;
                        setForm(f => ({ ...f, overallAssessment: f.overallAssessment === status ? "" : status }));
                      }}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-all ${form.overallAssessment === status
                          ? "bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/20"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                        } ${isAssessmentLocked ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {statusLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Confirm Send Plan Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800 p-6 text-center">
            <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{i18n.language === "vi" ? "Gửi giáo án cho khách hàng?" : "Send workout plan to client?"}</h3>
            <p className="text-gray-400 mb-6 text-sm">
              {i18n.language === "vi"
                ? "Giáo án này sẽ được gửi trực tiếp đến khách hàng để bắt đầu buổi tập. Khi đã gửi, tab Giáo án tập luyện sẽ bị khóa và bạn không thể sửa bài tập nữa."
                : "This plan will be sent directly to the client. Once sent, the Workout Plan tab will be locked and you cannot edit exercises anymore."}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowConfirmModal(false)} className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium">
                {t("coaching.confirm_modal.cancel")}
              </button>
              <button onClick={handleSendPlan} disabled={updateMut.isPending} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium shadow-lg shadow-blue-500/30">
                {updateMut.isPending ? (i18n.language === "vi" ? "Đang xử lý..." : "Processing...") : (i18n.language === "vi" ? "Đồng ý gửi" : "Agree and Send")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Complete Assessment Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800 p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{i18n.language === "vi" ? "Hoàn thành & Gửi đánh giá?" : "Complete & Send Assessment?"}</h3>
            <p className="text-gray-400 mb-6 text-sm">
              {i18n.language === "vi"
                ? "Kết quả đánh giá sẽ được lưu lại và gửi cho khách hàng xem. Toàn bộ giáo án sẽ bị khóa và không thể chỉnh sửa thêm nữa."
                : "The assessment result will be saved and sent to the client. The entire workout plan will be locked and cannot be edited anymore."}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowCompleteModal(false)} className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium">
                {t("coaching.confirm_modal.cancel")}
              </button>
              <button onClick={handleCompletePlan} disabled={updateMut.isPending} className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-colors font-medium shadow-lg shadow-green-500/30">
                {updateMut.isPending ? (i18n.language === "vi" ? "Đang xử lý..." : "Processing...") : (i18n.language === "vi" ? "Đồng ý hoàn thành" : "Agree and Complete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Missing Plan Modal */}
      {showCreateMissingModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-800 p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">{i18n.language === "vi" ? "Chưa có giáo án" : "No Workout Plan"}</h3>
            <p className="text-gray-400 mb-6">
              {i18n.language === "vi"
                ? `Khách hàng ${form.clientName} chưa có giáo án nào vào ngày ${targetDate}. Bạn có muốn tạo giáo án mới cho ngày này không?`
                : `Client ${form.clientName} does not have any workout plans on ${targetDate}. Do you want to create a new one?`}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowCreateMissingModal(false)} className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium">
                {i18n.language === "vi" ? "Đóng" : "Close"}
              </button>
              <button
                onClick={() => {
                  setShowCreateMissingModal(false);
                  navigate(`/workout-plans?create=true&client=${form.clientId}&date=${targetDate}`);
                }}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-orange-500 text-white transition-colors font-medium"
              >
                {i18n.language === "vi" ? "Tạo giáo án mới" : "Create New Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WorkoutPlanDetail;
