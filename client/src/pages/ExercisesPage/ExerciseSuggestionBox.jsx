import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";

const ExerciseSuggestionBox = () => {
  const { t } = useTranslation("exercises");
  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!suggestion.trim()) {
      toast.warning(t("toast_suggestion_empty"));
      return;
    }
    setSending(true);
    try {
      await api.post("/exercise-suggestions", { suggestion });
      toast.success(t("toast_suggestion_success"));
      setSuggestion("");
    } catch (err) {
      toast.error(err.response?.data?.message || t("toast_suggestion_error"));
    }
    setSending(false);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-white">{t("suggestion.title")}</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <textarea
          rows={2}
          placeholder={t("suggestion.placeholder")}
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          disabled={sending}
          className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-4 py-1.5 bg-primary hover:bg-primary-dark rounded-full text-white font-semibold shadow-md shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-1.5 transition text-sm"
        >
          <Send size={14} /> {sending ? t("suggestion.sending") : t("suggestion.send_short")}
        </button>
      </div>
    </div>
  );
};

export default ExerciseSuggestionBox;
