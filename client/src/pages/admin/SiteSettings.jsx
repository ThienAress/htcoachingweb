import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { UploadCloud, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import {
  getSiteSettings,
  uploadSettingImage,
  removeSettingImage,
} from "../../services/siteSetting.service";

const SettingSection = ({ title, fieldName, images, isMultiple, maxCount, onUpload, onRemove, isLoading, onPreview }) => {
  const [selectedFiles, setSelectedFiles] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (isMultiple && images.length + files.length > maxCount) {
      toast.error(`Chỉ được phép tối đa ${maxCount} ảnh cho phần này.`);
      return;
    }

    setSelectedFiles(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handleUpload = async () => {
    if (!selectedFiles) return;
    const formData = new FormData();
    if (isMultiple) {
      selectedFiles.forEach((file) => formData.append("images", file));
    } else {
      formData.append("image", selectedFiles[0]);
    }
    
    await onUpload({ fieldName, formData });
    setSelectedFiles(null);
    setPreviewUrls([]);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <ImageIcon size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      </div>
      
      {/* Current Images */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {images.map((url, idx) => (
          <div key={idx} className="relative group aspect-video md:aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <img 
              src={url} 
              alt="Cấu hình" 
              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => onPreview && onPreview(url)}
            />
            <button
              onClick={() => onRemove({ fieldName, imageUrl: url })}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title="Xóa ảnh này"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Upload Area */}
      {(!images.length || isMultiple) && (
        <div className="flex items-center gap-4">
          <input
            type="file"
            multiple={isMultiple}
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={!selectedFiles || isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            Tải lên
          </button>
        </div>
      )}

      {/* Preview */}
      {previewUrls.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {previewUrls.map((url, idx) => (
            <div key={idx} className="relative group">
              <img 
                src={url} 
                alt="Preview" 
                className="h-16 w-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => onPreview && onPreview(url)}
                title="Nhấn để xem lớn"
              />
              <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">Mới</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SiteSettings = () => {
  const queryClient = useQueryClient();

  const { data: settingsResponse, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const res = await getSiteSettings();
      return res.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ fieldName, formData }) => uploadSettingImage(fieldName, formData),
    onSuccess: () => {
      toast.success("Tải ảnh lên thành công!");
      queryClient.invalidateQueries(["site-settings"]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Lỗi khi tải ảnh lên");
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ fieldName, imageUrl }) => removeSettingImage(fieldName, imageUrl),
    onSuccess: () => {
      toast.success("Đã xóa ảnh!");
      queryClient.invalidateQueries(["site-settings"]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Lỗi khi xóa ảnh");
    },
  });

  const [previewImage, setPreviewImage] = useState(null);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>;
  }

  const settings = settingsResponse?.data || {
    heroImages: [],
    aboutImages: [],
    trainerImage: "",
    classesImages: [],
    toolsImage: "",
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

      <SettingSection
        title="Hero Section (Slider Banner)"
        fieldName="hero"
        images={settings.heroImages}
        isMultiple={true}
        maxCount={5}
        onUpload={uploadMutation.mutate}
        onRemove={removeMutation.mutate}
        isLoading={uploadMutation.isPending}
        onPreview={setPreviewImage}
      />

      <SettingSection
        title="About Section (Slider Giới thiệu)"
        fieldName="about"
        images={settings.aboutImages}
        isMultiple={true}
        maxCount={5}
        onUpload={uploadMutation.mutate}
        onRemove={removeMutation.mutate}
        isLoading={uploadMutation.isPending}
        onPreview={setPreviewImage}
      />

      <SettingSection
        title="Trainer Section (Ảnh Huấn luyện viên)"
        fieldName="trainer"
        images={settings.trainerImage ? [settings.trainerImage] : []}
        isMultiple={false}
        onUpload={uploadMutation.mutate}
        onRemove={removeMutation.mutate}
        isLoading={uploadMutation.isPending}
        onPreview={setPreviewImage}
      />

      <SettingSection
        title="Classes Section (Ảnh các khóa học)"
        fieldName="classes"
        images={settings.classesImages}
        isMultiple={true}
        maxCount={5}
        onUpload={uploadMutation.mutate}
        onRemove={removeMutation.mutate}
        isLoading={uploadMutation.isPending}
        onPreview={setPreviewImage}
      />

      <SettingSection
        title="Tools Section (Nền Công cụ TDEE)"
        fieldName="tools"
        images={settings.toolsImage ? [settings.toolsImage] : []}
        isMultiple={false}
        onUpload={uploadMutation.mutate}
        onRemove={removeMutation.mutate}
        isLoading={uploadMutation.isPending}
        onPreview={setPreviewImage}
      />

      {/* Fullscreen Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={previewImage} 
            alt="Preview Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button 
            className="absolute top-6 right-6 text-white hover:text-red-400 bg-black/50 p-2 rounded-full"
            onClick={() => setPreviewImage(null)}
          >
            Đóng (X)
          </button>
        </div>
      )}
    </div>
  );
};

export default SiteSettings;
