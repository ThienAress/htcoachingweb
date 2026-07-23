import {
  User,
  Camera,
  Loader2,
  X,
  ChevronRight,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function ProfileTab({
  user,
  editingField,
  setEditingField,
  editValues,
  setEditValues,
  updating,
  uploading,
  optimisticAvatar,
  handleSaveField,
  handleAvatarChange,
  getAvatarUrl,
  fileInputRef,
}) {
  const { t } = useTranslation("account");
  return (
    <div className="animate-tab-fade">
      {/* Section Header */}
      <div className="mb-6 pb-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white uppercase">{t("profile.title")}</h2>
        <p className="text-gray-400 text-fluid-xs mt-0.5">{t("sidebar.desc")}</p>
      </div>

      {/* Main F8 layout block */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-300">{t("profile.title")}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{t("profile.desc")}</p>
        </div>

        {/* List style block */}
        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl divide-y divide-white/10">

          {/* Row 1: Name Field */}
          <div>
            {editingField === "name" ? (
              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{t("profile.full_name")}</span>
                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <input
                  type="text"
                  value={editValues.name}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  placeholder={t("profile.placeholder_name")}
                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  autoFocus
                />
                <div className="flex justify-end gap-2 text-xs pt-1">
                  <button
                    onClick={() => setEditingField(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {t("profile.cancel")}
                  </button>
                  <button
                    onClick={() => handleSaveField("name")}
                    disabled={updating}
                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {updating && <Loader2 size={12} className="animate-spin" />}
                    <span>{t("profile.save")}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("name")}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
              >
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">{t("profile.full_name")}</span>
                  <span className="text-sm font-semibold text-white mt-1.5 block">{editValues.name || user.name || t("profile.not_updated")}</span>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Row 2: Email (Readonly) */}
          <div className="p-5 flex items-center justify-between opacity-80">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">{t("profile.email")}</span>
              <span className="text-sm font-semibold text-gray-400 mt-1.5 block">{user.email || "N/A"}</span>
            </div>
            <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-emerald-400 flex items-center gap-1">
              <CheckCircle size={10} /> {t("profile.verified")}
            </span>
          </div>

          {/* Row 3: Phone Field */}
          <div>
            {editingField === "phone" ? (
              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{t("profile.phone")}</span>
                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <input
                  type="tel"
                  value={editValues.phone}
                  onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                  placeholder={t("profile.placeholder_phone")}
                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  autoFocus
                />
                <div className="flex justify-end gap-2 text-xs pt-1">
                  <button
                    onClick={() => setEditingField(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {t("profile.cancel")}
                  </button>
                  <button
                    onClick={() => handleSaveField("phone")}
                    disabled={updating}
                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {updating && <Loader2 size={12} className="animate-spin" />}
                    <span>{t("profile.save")}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("phone")}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
              >
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">{t("profile.phone")}</span>
                  <span className="text-sm font-semibold text-white mt-1.5 block">{editValues.phone || user.phone || t("profile.not_updated")}</span>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Row 4: Address Field */}
          <div>
            {editingField === "address" ? (
              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{t("profile.address")}</span>
                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <input
                  type="text"
                  value={editValues.address}
                  onChange={(e) => setEditValues({ ...editValues, address: e.target.value })}
                  placeholder={t("profile.placeholder_address")}
                  className="w-full bg-black/50 border border-white/20 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  autoFocus
                />
                <div className="flex justify-end gap-2 text-xs pt-1">
                  <button
                    onClick={() => setEditingField(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    {t("profile.cancel")}
                  </button>
                  <button
                    onClick={() => handleSaveField("address")}
                    disabled={updating}
                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {updating && <Loader2 size={12} className="animate-spin" />}
                    <span>{t("profile.save")}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("address")}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
              >
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">{t("profile.address")}</span>
                  <span className="text-sm font-semibold text-white mt-1.5 block">{editValues.address || user.address || t("profile.not_updated")}</span>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Row 5: Avatar Field */}
          <div>
            {editingField === "avatar" ? (
              <div className="p-5 sm:p-6 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{t("profile.avatar_title")}</span>
                  <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-orange-500 bg-gray-900 shadow-lg">
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <Loader2 size={24} className="text-orange-500 animate-spin" />
                      </div>
                    )}
                    <img
                      src={optimisticAvatar || getAvatarUrl(user.avatar)}
                      alt="avatar"
                      className={`w-full h-full object-cover ${optimisticAvatar ? "opacity-70" : ""}`}
                    />
                  </div>
                  <div className="flex flex-col items-center sm:items-start gap-2.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera size={14} />
                      <span>{t("profile.upload_btn")}</span>
                    </button>
                    <span className="text-[10px] text-gray-500">{t("profile.avatar_desc")}</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("avatar")}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all outline-none"
              >
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">{t("profile.avatar_title")}</span>
                  <span className="text-xs text-gray-500 mt-1 block">{t("profile.avatar_help")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={optimisticAvatar || getAvatarUrl(user.avatar)}
                    alt="avatar pointer"
                    className="w-10 h-10 rounded-full object-cover border border-white/20 bg-gray-900"
                  />
                  <ChevronRight size={18} className="text-gray-500" />
                </div>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default ProfileTab;
