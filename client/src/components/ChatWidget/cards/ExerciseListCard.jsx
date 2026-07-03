import { Dumbbell, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function ExerciseListCard({ data }) {
  if (!data?.exercises?.length) return null;

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2 w-full">
      <div className="flex items-center gap-2 mb-1">
        <Dumbbell size={16} className="text-blue-400" />
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
          Bài tập — {data.searchedFor}
        </span>
      </div>

      <div className="space-y-1.5">
        {data.exercises.map((ex, i) => (
          <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
            <span className="text-xs font-bold text-blue-400 w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{ex.name}</p>
              {ex.description && (
                <p className="text-[11px] text-gray-400 truncate">{ex.description}</p>
              )}
            </div>
            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
              {ex.muscleGroup}
            </span>
          </div>
        ))}
      </div>

      <Link
        to="/exercises"
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
      >
        <ExternalLink size={12} />
        Xem thêm tại thư viện bài tập
      </Link>
    </div>
  );
}
