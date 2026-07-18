import { useState, useRef, useEffect } from "react";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { updateRecipe, uploadRecipeThumbnail } from "../../services/recipe.service";

const RecipeEditModal = ({ recipe, onClose }) => {
  const [formData, setFormData] = useState({
    name: recipe?.name || "",
    category: recipe?.category || "",
    area: recipe?.area || "",
    prepTime: recipe?.prepTime || "",
  });
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(recipe?.thumbnail || "");
  const fileInputRef = useRef(null);
  
  const queryClient = useQueryClient();

  // Mutation cho thông tin chữ
  const updateMutation = useMutation({
    mutationFn: (data) => updateRecipe(recipe._id, data),
  });

  // Mutation cho ảnh
  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append("image", file);
      return uploadRecipeThumbnail(recipe._id, fd);
    },
  });

  // Cleanup blob URL để tránh memory leak
  useEffect(() => {
    return () => {
      if (previewImage && previewImage.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Kích thước ảnh không được vượt quá 5MB");
        return;
      }
      // Revoke URL cũ trước khi tạo mới
      if (previewImage && previewImage.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
      setSelectedImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Update text info
      await updateMutation.mutateAsync(formData);

      // 2. Upload image if selected
      if (selectedImage) {
        await uploadMutation.mutateAsync(selectedImage);
      }

      toast.success("Cập nhật công thức thành công!");
      queryClient.invalidateQueries({ queryKey: ["adminRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi xảy ra khi cập nhật");
    }
  };

  const isSaving = updateMutation.isPending || uploadMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={!isSaving ? onClose : undefined} 
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            Cập nhật món ăn
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="recipe-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Ảnh đại diện */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Ảnh đại diện</label>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div 
                  className="w-full sm:w-48 h-32 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-100 transition relative group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewImage ? (
                    <>
                      <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium">Đổi ảnh</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <ImageIcon size={32} className="mb-2" />
                      <span className="text-sm">Tải ảnh lên</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-3">
                    Ảnh sẽ được lưu tự động trên Cloudinary, tự resize chuẩn và tối ưu hóa dung lượng (Tối đa 5MB).
                  </p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Upload size={16} /> Chọn ảnh mới
                  </button>
                </div>
              </div>
            </div>

            {/* Thông tin cơ bản */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Tên món (Tiếng Việt)</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Phân loại (Category)</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Quốc gia (Area)</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Thời gian làm (Prep Time)</label>
                <input
                  type="text"
                  name="prepTime"
                  value={formData.prepTime}
                  onChange={handleChange}
                  placeholder="VD: 30 phút"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
            
            {/* Ghi chú thêm: Không cho phép sửa ingredients/instructions ở modal nhỏ này */}
            <div className="bg-orange-50 border border-orange-100 text-orange-800 text-sm p-4 rounded-xl">
              <strong>Lưu ý:</strong> Việc sửa chi tiết nguyên liệu (Ingredients) và các bước làm (Instructions) đang được phát triển ở một giao diện lớn hơn. Tại đây bạn chỉ có thể cập nhật ảnh và tên món ăn.
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-xl transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="recipe-form"
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl shadow-sm shadow-primary/25 transition flex items-center gap-2 disabled:opacity-70"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeEditModal;
