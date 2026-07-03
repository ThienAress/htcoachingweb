import { Users, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function TrainerInfoCard({ data }) {
  if (!data?.trainers?.length) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2 w-full">
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Huấn luyện viên</span>
      </div>

      <div className="space-y-2">
        {data.trainers.map((trainer, i) => (
          <div key={i} className="flex items-center gap-3 bg-black/20 rounded-lg p-2.5">
            {trainer.image ? (
              <img
                src={trainer.image}
                alt={trainer.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Users size={16} className="text-emerald-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {trainer.name}
                {trainer.isHeadCoach && (
                  <span className="ml-1 text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                    Head Coach
                  </span>
                )}
              </p>
              {trainer.title && (
                <p className="text-[11px] text-gray-400 truncate">{trainer.title}</p>
              )}
              {trainer.specialties?.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {trainer.specialties.slice(0, 3).map((s, j) => (
                    <span key={j} className="text-[9px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {trainer.slug && (
              <Link
                to={`/huan-luyen-vien/${trainer.slug}`}
                className="text-emerald-400 hover:text-emerald-300 shrink-0"
                title="Xem profile"
              >
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
