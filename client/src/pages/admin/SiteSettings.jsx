import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import { toast } from "react-toastify";
import {
  getSiteSettings,
  removeSettingItemImage,
  uploadSettingItemImage,
} from "../../services/siteSetting.service";
import {
  HOME_ABOUT_CATALOG,
  HOME_CLASS_CATALOG,
  HOME_HERO_AVATAR_CATALOG,
  HOME_HERO_CATALOG,
  HOME_TRAINER_CATALOG,
  HOME_TOOL_CATALOG,
} from "../../config/homeSectionCatalog";
import KeyedMediaSection from "../../components/admin/KeyedMediaSection";

const SiteSettings = () => {
  const queryClient = useQueryClient();

  const { data: settingsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: adminQueryKeys.siteSettings.all(),
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
  });

  const itemUploadMutation = useMutation({
    mutationFn: ({ section, itemKey, file }) => {
      const formData = new FormData();
      formData.append("image", file);
      return uploadSettingItemImage(section, itemKey, formData);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật đúng ảnh của mục đã chọn!");
      invalidateByKey(queryClient, adminQueryKeys.siteSettings.all());
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Không thể cập nhật ảnh. Vui lòng thử lại.");
    },
  });

  const itemRemoveMutation = useMutation({
    mutationFn: ({ section, itemKey, imageUrl }) => (
      removeSettingItemImage(section, itemKey, imageUrl)
    ),
    onSuccess: () => {
      toast.success("Đã xóa ảnh riêng và khôi phục ảnh mặc định!");
      invalidateByKey(queryClient, adminQueryKeys.siteSettings.all());
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Không thể xóa ảnh. Vui lòng thử lại.");
    },
  });

  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!previewImage) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewImage]);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="font-semibold text-red-700">Không thể tải cấu hình giao diện.</p>
        <p className="mt-2 text-sm text-slate-600">Kiểm tra kết nối rồi thử tải lại trang này.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const settings = settingsResponse?.data || {
    heroImages: [],
    heroImagesByKey: {},
    heroAvatars: [],
    heroAvatarsByKey: {},
    aboutImages: [],
    aboutImagesByKey: {},
    trainerImage: "",
    trainerImagesByKey: {},
    classesImages: [],
    classesImagesByKey: {},
    toolsImage: "",
    toolsImagesByKey: {},
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Giao diện</h1>
          <p className="text-slate-500 mt-1">
            Thay đổi hình ảnh hiển thị trên trang chủ. Ảnh sẽ tự động được nén và tối ưu hóa khi tải lên.
          </p>
        </div>
      </div>

      <KeyedMediaSection
        title="Hero Section (Slider Banner)"
        description="Quản lý riêng từng banner theo đúng vị trí hiển thị trong slider Hero. Banner 4 và 5 là tùy chọn."
        catalog={HOME_HERO_CATALOG}
        imagesByKey={settings.heroImagesByKey}
        legacyImages={settings.heroImages || []}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen
      />

      <KeyedMediaSection
        title="Hero Section (Avatar Học Viên Lột Xác)"
        description="Ba vị trí avatar học viên trong thẻ thành tích Hero, mỗi vị trí có ảnh riêng."
        catalog={HOME_HERO_AVATAR_CATALOG}
        imagesByKey={settings.heroAvatarsByKey}
        legacyImages={settings.heroAvatars || []}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen={false}
      />

      <KeyedMediaSection
        title="About Section (Slider Giới thiệu)"
        description="Quản lý riêng năm vị trí trong slider giới thiệu; vị trí 4 và 5 là tùy chọn."
        catalog={HOME_ABOUT_CATALOG}
        imagesByKey={settings.aboutImagesByKey}
        legacyImages={settings.aboutImages || []}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen={false}
      />

      <KeyedMediaSection
        title="Trainer Section (Ảnh Huấn luyện viên)"
        description="Ảnh này chỉ thay ảnh của huấn luyện viên nổi bật đầu tiên trên trang chủ."
        catalog={HOME_TRAINER_CATALOG}
        imagesByKey={settings.trainerImagesByKey}
        legacyImage={settings.trainerImage || ""}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen={false}
      />

      <KeyedMediaSection
        title="Classes Section (Ảnh từng khóa học)"
        description="Mỗi khóa học có một ảnh riêng. Tải ảnh ngay tại đúng tên khóa học để tránh nhầm Boxing, Cardio & HIIT hoặc Personal Training."
        catalog={HOME_CLASS_CATALOG}
        imagesByKey={settings.classesImagesByKey}
        legacyImages={settings.classesImages || []}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen={false}
      />

      <KeyedMediaSection
        title="Tools Section (Ảnh từng công cụ)"
        description="Danh sách này đồng bộ với các công cụ trên trang chủ. Mỗi ảnh chỉ áp dụng cho đúng công cụ được ghi tên bên dưới."
        catalog={HOME_TOOL_CATALOG}
        imagesByKey={settings.toolsImagesByKey}
        legacyImage={settings.toolsImage || ""}
        onUpload={itemUploadMutation.mutateAsync}
        onRemove={itemRemoveMutation.mutateAsync}
        onPreview={setPreviewImage}
        defaultOpen={false}
      />

      {/* Fullscreen Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem trước hình ảnh"
        >
          <img 
            src={previewImage} 
            alt="Preview Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
          <button 
            type="button"
            className="absolute right-6 top-6 min-h-11 rounded-full bg-zinc-900/80 px-4 py-2 text-white hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setPreviewImage(null)}
            aria-label="Đóng xem trước hình ảnh"
          >
            Đóng (X)
          </button>
        </div>
      )}
    </div>
  );
};

export default SiteSettings;
