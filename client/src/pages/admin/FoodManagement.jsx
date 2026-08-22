import { useState, useEffect } from "react";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import {
  Search,
  Plus,
  Edit,
  Trash,
  Apple,
  X,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getFoods,
  createFood,
  updateFood,
  deleteFood,
  createManyFoods,
  addFoodPriceObservation,
} from "../../services/food.service";
import { useDebounce } from "../../hooks/useDebounce";
import {
  FOOD_ADMIN_TEXT,
  getFoodSourceLabel,
} from "./foodAdminPresentation";

const createFoodForm = () => ({
  label: "",
  protein: "",
  carb: "",
  fat: "",
  calories: "",
  saturates: "",
  sugars: "",
  fibre: "",
  salt: "",
  nutritionBasis: "per_100g",
  sourceType: "manual_verified",
  sourceProvider: "HTCOACHING",
  sourceExternalId: "",
  sourceDatasetVersion: "",
  sourceLicense: "proprietary-internal",
  sourceAttribution: FOOD_ADMIN_TEXT.defaultAttribution,
  sourceUrl: "",
  sourceDate: new Date().toISOString().slice(0, 10),
  allergenReviewStatus: "unreviewed",
  allergenContains: [],
  allergenMayContain: [],
  allergenSpecificReviewed: false,
  allergenSpecificContains: [],
  allergenSourceType: "package_label",
  allergenSourceUrl: "",
  allergenReviewedAt: new Date().toISOString().slice(0, 10),
  priceSourceKey: "",
  pricePackGrams: "",
  priceRegularVnd: "",
  pricePromotionalVnd: "",
  priceSourceUrl: "",
  priceObservedAt: new Date().toISOString().slice(0, 10),
});

const ALLERGEN_OPTIONS = [
  ["milk", "Sữa"],
  ["egg", "Trứng"],
  ["fish", "Cá"],
  ["crustacean_shellfish", "Giáp xác"],
  ["tree_nut", "Hạt cây"],
  ["peanut", "Đậu phộng"],
  ["wheat", "Lúa mì"],
  ["soy", "Đậu nành"],
  ["sesame", "Mè"],
];

const SPECIFIC_FOOD_OPTIONS = [
  ["beef", "Bò"],
  ["chicken", "Gà"],
  ["pork", "Heo/lợn"],
  ["duck", "Vịt/gia cầm"],
  ["goat", "Dê"],
  ["lamb", "Cừu"],
];

const sourcePayload = (formData) => {
  if (formData.sourceType === "legacy_unknown") return undefined;
  const external = formData.sourceType === "usda_fdc";
  return {
    type: formData.sourceType,
    provider: formData.sourceProvider.trim(),
    externalId: formData.sourceExternalId.trim(),
    datasetVersion: formData.sourceDatasetVersion.trim(),
    license: formData.sourceLicense.trim(),
    attribution: formData.sourceAttribution.trim(),
    sourceUrl: formData.sourceUrl.trim(),
    ...(external
      ? { retrievedAt: new Date(formData.sourceDate).toISOString() }
      : { verifiedAt: new Date(formData.sourceDate).toISOString() }),
  };
};

const allergenPayload = (formData) =>
  formData.allergenReviewStatus === "unreviewed"
    ? {
        reviewStatus: "unreviewed",
        contains: [],
        mayContain: [],
        reviewedScopes: [],
        specificContains: [],
        sourceType: null,
        sourceUrl: "",
        reviewedAt: null,
      }
    : {
        reviewStatus: "reviewed",
        contains: formData.allergenContains,
        mayContain: formData.allergenMayContain,
        reviewedScopes: formData.allergenSpecificReviewed
          ? ["specific_foods"]
          : [],
        specificContains: formData.allergenSpecificReviewed
          ? formData.allergenSpecificContains
          : [],
        sourceType: formData.allergenSourceType,
        sourceUrl: formData.allergenSourceUrl.trim(),
        reviewedAt: new Date(formData.allergenReviewedAt).toISOString(),
      };

const pricePayload = (formData) => {
  if (!formData.priceSourceKey) return null;
  return {
    sourceKey: formData.priceSourceKey,
    packGrams: Number(formData.pricePackGrams),
    regularPriceVnd: Number(formData.priceRegularVnd),
    promotionalPriceVnd: formData.pricePromotionalVnd
      ? Number(formData.pricePromotionalVnd)
      : null,
    sourceUrl: formData.priceSourceUrl.trim(),
    observedAt: new Date(formData.priceObservedAt).toISOString(),
  };
};

const FoodManagement = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [formData, setFormData] = useState(createFoodForm);
  const [batchJson, setBatchJson] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const limit = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const {
    data: foodsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: adminQueryKeys.foods.list({
      page: currentPage,
      search: debouncedSearchTerm,
    }),
    queryFn: () =>
      getFoods(currentPage, limit, debouncedSearchTerm).then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const foods = foodsData?.data || [];
  const pagination = foodsData?.pagination || { total: 0, totalPages: 0 };

  const createMutation = useMutation({
    mutationFn: async ({ food, price }) => {
      const response = await createFood(food);
      if (price) await addFoodPriceObservation(response.data.data._id, price);
      return response;
    },
    onSuccess: () => {
      toast.success("Thêm thực phẩm thành công");
      invalidateByKey(queryClient, adminQueryKeys.foods.all());
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi thêm"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, price }) => {
      const response = await updateFood(id, data);
      if (price) await addFoodPriceObservation(id, price);
      return response;
    },
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      invalidateByKey(queryClient, adminQueryKeys.foods.all());
      closeModal();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: () => {
      toast.success("Xóa thực phẩm thành công");
      invalidateByKey(queryClient, adminQueryKeys.foods.all());
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const batchMutation = useMutation({
    mutationFn: createManyFoods,
    onSuccess: (res) => {
      setBatchResult(res.data.data);
      toast.success(res.data.message);
      invalidateByKey(queryClient, adminQueryKeys.foods.all());
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi nhập dữ liệu"),
  });

  const openCreateModal = () => {
    setEditingFood(null);
    setFormData(createFoodForm());
    setShowModal(true);
  };

  const openEditModal = (food) => {
    setEditingFood(food);
    setFormData({
      label: food.label,
      protein: food.protein,
      carb: food.carb,
      fat: food.fat,
      calories: food.calories || "",
      saturates: food.saturates ?? "",
      sugars: food.sugars ?? "",
      fibre: food.fibre ?? "",
      salt: food.salt ?? "",
      nutritionBasis: food.nutritionBasis || "per_100g",
      sourceType: food.source?.type || "legacy_unknown",
      sourceProvider: food.source?.provider || "",
      sourceExternalId: food.source?.externalId || "",
      sourceDatasetVersion: food.source?.datasetVersion || "",
      sourceLicense: food.source?.license || "",
      sourceAttribution: food.source?.attribution || "",
      sourceUrl: food.source?.sourceUrl || "",
      sourceDate: (
        food.source?.retrievedAt ||
        food.source?.verifiedAt ||
        new Date().toISOString()
      ).slice(0, 10),
      allergenReviewStatus:
        food.allergenProfile?.reviewStatus || "unreviewed",
      allergenContains: food.allergenProfile?.contains || [],
      allergenMayContain: food.allergenProfile?.mayContain || [],
      allergenSpecificReviewed:
        food.allergenProfile?.reviewedScopes?.includes("specific_foods") || false,
      allergenSpecificContains:
        food.allergenProfile?.specificContains || [],
      allergenSourceType:
        food.allergenProfile?.sourceType || "package_label",
      allergenSourceUrl: food.allergenProfile?.sourceUrl || "",
      allergenReviewedAt: (
        food.allergenProfile?.reviewedAt || new Date().toISOString()
      ).slice(0, 10),
      priceSourceKey: "",
      pricePackGrams: "",
      priceRegularVnd: "",
      pricePromotionalVnd: "",
      priceSourceUrl: "",
      priceObservedAt: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFood(null);
    setFormData(createFoodForm());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      label: formData.label.trim(),
      protein: parseFloat(formData.protein),
      carb: parseFloat(formData.carb),
      fat: parseFloat(formData.fat),
      calories: formData.calories ? parseFloat(formData.calories) : undefined,
      saturates: formData.saturates === "" ? undefined : parseFloat(formData.saturates),
      sugars: formData.sugars === "" ? undefined : parseFloat(formData.sugars),
      fibre: formData.fibre === "" ? undefined : parseFloat(formData.fibre),
      salt: formData.salt === "" ? undefined : parseFloat(formData.salt),
      nutritionBasis: formData.nutritionBasis,
      source: sourcePayload(formData),
      allergenProfile: allergenPayload(formData),
    };
    const price = pricePayload(formData);
    if (editingFood) {
      updateMutation.mutate({ id: editingFood._id, data, price });
    } else {
      createMutation.mutate({ food: data, price });
    }
  };

  const handleDelete = (id, label) => {
    if (window.confirm(`Xóa thực phẩm "${label}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleBatchSubmit = () => {
    try {
      let foods = JSON.parse(batchJson);
      if (!Array.isArray(foods)) throw new Error("Phải là mảng");
      foods.forEach((item, idx) => {
        if (
          !item.label ||
          item.protein === undefined ||
          item.carb === undefined ||
          item.fat === undefined
        ) {
          throw new Error(
            `Mục ${idx + 1} thiếu trường bắt buộc (label, protein, carb, fat)`,
          );
        }
        if (!item.source || !item.source.type) {
          throw new Error(`Mục ${idx + 1} thiếu nguồn dữ liệu dinh dưỡng`);
        }
      });
      batchMutation.mutate(foods);
    } catch (err) {
      toast.error("JSON không hợp lệ: " + err.message);
    }
  };

  const closeBatchModal = () => {
    setShowBatchModal(false);
    setBatchJson("");
    setBatchResult(null);
  };

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu: {error?.message}
        <button
          onClick={() => refetch()}
          className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
      <div className="space-y-4 md:space-y-6 h-full">
        <ToastContainer position="top-right" autoClose={3000} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-fluid-xl font-bold text-slate-800 flex items-center gap-2">
              <Apple className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
              QUẢN LÝ THỰC PHẨM
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Danh sách thực phẩm dùng để tính dinh dưỡng và gợi ý thực đơn
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-fluid-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thực phẩm</span>
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-fluid-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập hàng loạt</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên thực phẩm..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-fluid-sm"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Tên thực phẩm
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Đạm (g)
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Tinh bột (g)
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Chất béo (g)
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Năng lượng (kcal)
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Dị ứng
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Giá TP.HCM
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {foods.map((food) => (
                  <tr
                    key={food._id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">
                      {food.label}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {food.protein}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {food.carb}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {food.fat}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {food.calories}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        food.allergenProfile?.reviewStatus === "reviewed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {food.allergenProfile?.reviewStatus === "reviewed"
                          ? "Đã duyệt"
                          : "Chưa duyệt"}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {food.marketPrice?.coverageStatus === "sufficient"
                        ? `${food.marketPrice.typicalVndPer100g.toLocaleString("vi-VN")}đ/100g`
                        : "Chưa có nguồn giá"}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(food)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(food._id, food.label)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Xóa"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {foods.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                    >
                      Không tìm thấy thực phẩm nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Trang {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overscroll-contain overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                <h2 className="text-fluid-lg font-bold text-slate-800 flex items-center gap-2 uppercase">
                  <Apple className="w-5 h-5 text-indigo-600" />
                  {editingFood ? "Cập nhật thực phẩm" : "Thêm thực phẩm mới"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tên thực phẩm *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Đạm (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.protein}
                      onChange={(e) =>
                        setFormData({ ...formData, protein: e.target.value })
                      }
                      required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tinh bột (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.carb}
                      onChange={(e) =>
                        setFormData({ ...formData, carb: e.target.value })
                      }
                      required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Chất béo (g) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.fat}
                      onChange={(e) =>
                        setFormData({ ...formData, fat: e.target.value })
                      }
                      required
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Năng lượng (kcal)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formData.calories}
                      onChange={(e) =>
                        setFormData({ ...formData, calories: e.target.value })
                      }
                      placeholder="Để trống để tự tính"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">
                    Dinh dưỡng bổ sung (g/100g)
                  </legend>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ["saturates", "Chất béo bão hòa"],
                      ["sugars", "Đường"],
                      ["fibre", "Chất xơ"],
                      ["salt", "Muối"],
                    ].map(([key, label]) => (
                      <label key={key} className="text-sm font-medium text-slate-700">
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData[key]}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          placeholder="Không bắt buộc"
                          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">
                    {FOOD_ADMIN_TEXT.provenanceLegend}
                  </legend>
                  {formData.sourceType === "legacy_unknown" && (
                    <p className="text-xs text-amber-700">
                      {FOOD_ADMIN_TEXT.legacyWarning}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      Loại nguồn
                      <select
                        value={formData.sourceType}
                        onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <option
                          value="legacy_unknown"
                          disabled={!editingFood}
                        >
                          {getFoodSourceLabel("legacy_unknown")}
                        </option>
                        <option value="manual_verified">
                          {getFoodSourceLabel("manual_verified")}
                        </option>
                        <option value="nutrition_label">
                          {getFoodSourceLabel("nutrition_label")}
                        </option>
                        <option value="usda_fdc">
                          {getFoodSourceLabel("usda_fdc")}
                        </option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      {FOOD_ADMIN_TEXT.provider}
                      <input
                        value={formData.sourceProvider}
                        onChange={(e) => setFormData({ ...formData, sourceProvider: e.target.value })}
                        required={formData.sourceType !== "legacy_unknown"}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      {FOOD_ADMIN_TEXT.datasetVersion}
                      <input
                        value={formData.sourceDatasetVersion}
                        onChange={(e) => setFormData({ ...formData, sourceDatasetVersion: e.target.value })}
                        required={formData.sourceType !== "legacy_unknown"}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      {FOOD_ADMIN_TEXT.license}
                      <input
                        value={formData.sourceLicense}
                        onChange={(e) => setFormData({ ...formData, sourceLicense: e.target.value })}
                        required={formData.sourceType !== "legacy_unknown"}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700 sm:col-span-2">
                      {FOOD_ADMIN_TEXT.attribution}
                      <input
                        value={formData.sourceAttribution}
                        onChange={(e) => setFormData({ ...formData, sourceAttribution: e.target.value })}
                        required={formData.sourceType !== "legacy_unknown"}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      {FOOD_ADMIN_TEXT.externalId}
                      <input
                        value={formData.sourceExternalId}
                        onChange={(e) => setFormData({ ...formData, sourceExternalId: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Ngày xác minh/truy xuất
                      <input
                        type="date"
                        value={formData.sourceDate}
                        onChange={(e) => setFormData({ ...formData, sourceDate: e.target.value })}
                        required={formData.sourceType !== "legacy_unknown"}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700 sm:col-span-2">
                      {FOOD_ADMIN_TEXT.sourceUrl}
                      <input
                        type="url"
                        value={formData.sourceUrl}
                        onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">
                    Kiểm duyệt dị ứng
                  </legend>
                  <label className="block text-sm text-slate-700">
                    Trạng thái
                    <select
                      name="allergenReviewStatus"
                      value={formData.allergenReviewStatus}
                      onChange={(e) => setFormData({
                        ...formData,
                        allergenReviewStatus: e.target.value,
                      })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <option value="unreviewed">Chưa kiểm duyệt</option>
                      <option value="reviewed">Đã kiểm duyệt theo nhãn/nguồn</option>
                    </select>
                  </label>
                  {formData.allergenReviewStatus === "reviewed" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["allergenContains", "Có chứa"],
                        ["allergenMayContain", "Có thể chứa"],
                      ].map(([field, label]) => (
                        <label key={field} className="text-sm text-slate-700">
                          {label}
                          <select
                            name={field}
                            multiple
                            value={formData[field]}
                            onChange={(e) => setFormData({
                              ...formData,
                              [field]: [...e.target.selectedOptions].map(
                                (option) => option.value,
                              ),
                            })}
                            className="mt-1 min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                          >
                            {ALLERGEN_OPTIONS.map(([key, optionLabel]) => (
                              <option key={key} value={key}>{optionLabel}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                      <div className="space-y-2 border-t border-slate-200 pt-3 sm:col-span-2">
                        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            name="allergenSpecificReviewed"
                            checked={formData.allergenSpecificReviewed}
                            onChange={(e) => setFormData({
                              ...formData,
                              allergenSpecificReviewed: e.target.checked,
                              allergenSpecificContains: e.target.checked
                                ? formData.allergenSpecificContains
                                : [],
                            })}
                            className="size-4 accent-emerald-600"
                          />
                          Đã kiểm duyệt nhóm thực phẩm cụ thể
                        </label>
                        <p className="text-xs leading-5 text-slate-500">
                          Chỉ bật sau khi đã xác định thực phẩm có thuộc bò, gà,
                          heo/lợn hoặc nhóm thịt tương ứng. Nếu không bật, Meal
                          Plan sẽ loại Food này theo hướng fail-closed khi khách
                          khai báo nhóm cụ thể.
                        </p>
                        {formData.allergenSpecificReviewed && (
                          <label className="block text-sm text-slate-700">
                            Có chứa nhóm thực phẩm cụ thể
                            <select
                              name="allergenSpecificContains"
                              multiple
                              value={formData.allergenSpecificContains}
                              onChange={(e) => setFormData({
                                ...formData,
                                allergenSpecificContains: [
                                  ...e.target.selectedOptions,
                                ].map((option) => option.value),
                              })}
                              className="mt-1 min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                            >
                              {SPECIFIC_FOOD_OPTIONS.map(([key, optionLabel]) => (
                                <option key={key} value={key}>{optionLabel}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      <label className="text-sm text-slate-700">
                        Loại nguồn
                        <select
                          name="allergenSourceType"
                          value={formData.allergenSourceType}
                          onChange={(e) => setFormData({
                            ...formData,
                            allergenSourceType: e.target.value,
                          })}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                        >
                          <option value="package_label">Nhãn bao bì</option>
                          <option value="manufacturer">Nhà sản xuất</option>
                          <option value="official_database">CSDL chính thức</option>
                        </select>
                      </label>
                      <label className="text-sm text-slate-700">
                        Ngày kiểm duyệt
                        <input
                          name="allergenReviewedAt"
                          type="date"
                          value={formData.allergenReviewedAt}
                          onChange={(e) => setFormData({
                            ...formData,
                            allergenReviewedAt: e.target.value,
                          })}
                          required
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </label>
                      <label className="text-sm text-slate-700 sm:col-span-2">
                        URL nguồn/nhãn (nếu có)
                        <input
                          name="allergenSourceUrl"
                          type="url"
                          value={formData.allergenSourceUrl}
                          onChange={(e) => setFormData({
                            ...formData,
                            allergenSourceUrl: e.target.value,
                          })}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </label>
                    </div>
                  )}
                </fieldset>

                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-700">
                    {FOOD_ADMIN_TEXT.priceLegend}
                  </legend>
                  <p className="text-xs leading-5 text-slate-500">
                    Mỗi lần lưu sẽ thêm một lần ghi nhận giá. Chỉ cần một nguồn bán lẻ còn hiệu lực để hiển thị giá tham khảo.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      Nguồn giá
                      <select
                        name="priceSourceKey"
                        value={formData.priceSourceKey}
                        disabled={!editingFood}
                        onChange={(e) => setFormData({
                          ...formData,
                          priceSourceKey: e.target.value,
                        })}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">{FOOD_ADMIN_TEXT.noPriceObservation}</option>
                        <option value="bach_hoa_xanh">Bách Hóa Xanh</option>
                        <option value="winmart">WinMart</option>
                        <option value="coop_online">Co.op Online</option>
                      </select>
                      {!editingFood && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {FOOD_ADMIN_TEXT.priceSavedFirst}
                        </span>
                      )}
                    </label>
                    <label className="text-sm text-slate-700">
                      Khối lượng gói (g)
                      <input
                        name="pricePackGrams"
                        type="number"
                        min="1"
                        value={formData.pricePackGrams}
                        onChange={(e) => setFormData({ ...formData, pricePackGrams: e.target.value })}
                        required={Boolean(formData.priceSourceKey)}
                        disabled={!formData.priceSourceKey}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Giá thường (VND)
                      <input
                        name="priceRegularVnd"
                        type="number"
                        min="1"
                        step="100"
                        value={formData.priceRegularVnd}
                        onChange={(e) => setFormData({ ...formData, priceRegularVnd: e.target.value })}
                        required={Boolean(formData.priceSourceKey)}
                        disabled={!formData.priceSourceKey}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Giá khuyến mãi (VND)
                      <input
                        name="pricePromotionalVnd"
                        type="number"
                        min="1"
                        step="100"
                        value={formData.pricePromotionalVnd}
                        onChange={(e) => setFormData({ ...formData, pricePromotionalVnd: e.target.value })}
                        disabled={!formData.priceSourceKey}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Ngày quan sát
                      <input
                        name="priceObservedAt"
                        type="date"
                        value={formData.priceObservedAt}
                        onChange={(e) => setFormData({ ...formData, priceObservedAt: e.target.value })}
                        required={Boolean(formData.priceSourceKey)}
                        disabled={!formData.priceSourceKey}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                    <label className="text-sm text-slate-700 sm:col-span-2">
                      URL sản phẩm
                      <input
                        name="priceSourceUrl"
                        type="url"
                        value={formData.priceSourceUrl}
                        onChange={(e) => setFormData({ ...formData, priceSourceUrl: e.target.value })}
                        required={Boolean(formData.priceSourceKey)}
                        disabled={!formData.priceSourceKey}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                </fieldset>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      "Đang lưu..."
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Lưu
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBatchModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                <h2 className="text-fluid-lg font-bold text-slate-800 flex items-center gap-2 uppercase">
                  <Upload className="w-5 h-5 text-green-600" />
                  Nhập nhiều thực phẩm (JSON)
                </h2>
                <button
                  onClick={closeBatchModal}
                  className="p-1 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-4 md:p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Dán mảng JSON theo mẫu (có thể copy từ Excel/Google Sheet).
                  Năng lượng là tùy chọn, hệ thống sẽ tự tính nếu để trống.
                </p>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                  {`[{
  "label": "Ức gà", "protein": 31, "carb": 0, "fat": 3.6,
  "source": {
    "type": "manual_verified", "provider": "HTCOACHING",
    "datasetVersion": "manual-2026-08", "license": "proprietary-internal",
    "attribution": "HTCOACHING kiểm duyệt dinh dưỡng thủ công",
    "verifiedAt": "2026-08-04T00:00:00.000Z"
  }
}]`}
                </pre>
                <textarea
                  rows={12}
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder="Dán JSON array vào đây..."
                  className="w-full border border-slate-200 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-indigo-500"
                />
                {batchResult && (
                  <div className="bg-slate-100 p-3 rounded text-sm">
                    <p>✅ Thành công: {batchResult.success.length}</p>
                    <p>❌ Thất bại: {batchResult.failed.length}</p>
                    {batchResult.failed.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-red-600">
                          Xem chi tiết lỗi
                        </summary>
                        <pre className="text-xs mt-2 overflow-auto max-h-40">
                          {JSON.stringify(batchResult.failed, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 flex justify-end gap-3">
                <button
                  onClick={closeBatchModal}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  onClick={handleBatchSubmit}
                  disabled={batchMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {batchMutation.isPending ? "Đang xử lý..." : "Nhập dữ liệu"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </phantom-ui>
  );
};

export default FoodManagement;
