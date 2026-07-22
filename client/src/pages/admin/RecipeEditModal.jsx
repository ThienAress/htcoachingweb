import { useState, useRef, useEffect } from "react";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  createRecipe,
  updateRecipe,
  uploadRecipeThumbnail,
} from "../../services/recipe.service";

const ingredientLines = (ingredients = []) =>
  ingredients
    .map((ingredient) =>
      [ingredient.measure, ingredient.name].filter(Boolean).join(" | "),
    )
    .join("\n");

const parseIngredients = (value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [measure, ...nameParts] = line.split("|");
      if (nameParts.length === 0) {
        return { name: measure.trim(), measure: "" };
      }
      return {
        measure: measure.trim(),
        name: nameParts.join("|").trim(),
      };
    });

const RecipeEditModal = ({ recipe, onClose }) => {
  const isCreate = !recipe?._id;
  const [formData, setFormData] = useState({
    name: recipe?.name || "",
    nameEn: recipe?.nameEn || "",
    slug: recipe?.slug || "",
    category: recipe?.category || "",
    area: recipe?.area || "",
    prepTime: recipe?.prepTime || "",
    tags: (recipe?.tags || []).join(", "),
    ingredients: ingredientLines(recipe?.ingredients),
    instructions: (recipe?.instructions || []).join("\n"),
    youtubeUrl: recipe?.youtubeUrl || "",
    sourceUrl: recipe?.sourceUrl || "",
    source: recipe?.source || "manual",
    isPublished: recipe?.isPublished ?? false,
  });
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(recipe?.thumbnail || "");
  const fileInputRef = useRef(null);
  
  const queryClient = useQueryClient();

  // Mutation cho thông tin chữ
  const saveMutation = useMutation({
    mutationFn: (data) =>
      isCreate ? createRecipe(data) : updateRecipe(recipe._id, data),
  });

  // Mutation cho ảnh
  const uploadMutation = useMutation({
    mutationFn: ({ recipeId, file }) => {
      const fd = new FormData();
      fd.append("image", file);
      return uploadRecipeThumbnail(recipeId, fd);
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
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Ảnh phải có định dạng JPEG, PNG hoặc WebP");
        return;
      }
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
    const { checked, name, type, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Update text info
      const payload = {
        ...formData,
        slug: formData.slug.trim() || undefined,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        ingredients: parseIngredients(formData.ingredients),
        instructions: formData.instructions
          .split("\n")
          .map((step) => step.trim())
          .filter(Boolean),
      };
      const savedRecipe = await saveMutation.mutateAsync(payload);
      const recipeId = savedRecipe.data._id;

      // 2. Upload image if selected
      if (selectedImage) {
        await uploadMutation.mutateAsync({ recipeId, file: selectedImage });
      }

      toast.success(
        isCreate
          ? "Tạo công thức thành công!"
          : "Cập nhật công thức thành công!",
      );
      queryClient.invalidateQueries({ queryKey: ["adminRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi xảy ra khi cập nhật");
    }
  };

  const isSaving = saveMutation.isPending || uploadMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={!isSaving ? onClose : undefined} 
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {isCreate ? "Tạo công thức" : "Cập nhật món ăn"}
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
                    accept="image/jpeg,image/png,image/webp"
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tên tiếng Anh
                </label>
                <input
                  type="text"
                  name="nameEn"
                  value={formData.nameEn}
                  onChange={handleChange}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Slug
                </label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  maxLength={180}
                  placeholder="Tự tạo từ tên nếu để trống"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="protein, giảm cân, bữa sáng"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Video YouTube
                </label>
                <input
                  type="url"
                  name="youtubeUrl"
                  value={formData.youtubeUrl}
                  onChange={handleChange}
                  maxLength={2048}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nguồn tham khảo
                </label>
                <input
                  type="url"
                  name="sourceUrl"
                  value={formData.sourceUrl}
                  onChange={handleChange}
                  maxLength={2048}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nguồn dữ liệu
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                >
                  <option value="manual">Thủ công</option>
                  <option value="ai">AI</option>
                  <option value="mealdb">MealDB</option>
                </select>
              </div>
              <label className="flex items-center gap-3 self-end min-h-10 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="isPublished"
                  checked={formData.isPublished}
                  onChange={handleChange}
                  className="w-4 h-4 accent-primary"
                />
                Công khai công thức
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nguyên liệu
                </label>
                <textarea
                  name="ingredients"
                  value={formData.ingredients}
                  onChange={handleChange}
                  rows={10}
                  placeholder={"200g | Ức gà\n1 muỗng | Dầu olive"}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Các bước thực hiện
                </label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={10}
                  placeholder={"Sơ chế nguyên liệu\nƯớp trong 15 phút\nÁp chảo đến khi chín"}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y"
                />
              </div>
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
            {isCreate ? "Tạo công thức" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeEditModal;
