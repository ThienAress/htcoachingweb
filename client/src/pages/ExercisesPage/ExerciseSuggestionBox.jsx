import React, { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../utils/api";

const ExerciseSuggestionBox = () => {
  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!suggestion.trim()) {
      toast.warning("Vui lòng nhập góp ý");
      return;
    }
    setSending(true);
    try {
      await api.post("/exercise-suggestions", { suggestion });
      toast.success("Cảm ơn bạn đã góp ý!");
      setSuggestion("");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Gửi thất bại, thử lại sau.");
    }
    setSending(false);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-white">Góp ý bài tập</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <textarea
          rows={2}
          placeholder="Bạn muốn mình thêm bài tập nào thì góp ý nha..."
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
          <Send size={14} /> {sending ? "Đang gửi..." : "Gửi"}
        </button>
      </div>
    </div>
  );
};

export default ExerciseSuggestionBox;
