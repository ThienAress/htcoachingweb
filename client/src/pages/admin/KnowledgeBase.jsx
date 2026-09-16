import { useState, useCallback, useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  Brain, Plus, Search, Trash2, Edit3, MessageSquare,
  BarChart3, RefreshCw, ChevronDown, Eye, Star, X, Sparkles, GitMerge, AlertTriangle,
  ThumbsDown, ThumbsUp, CheckCircle2, Ban, Link2,
} from "lucide-react";
import {
  getKBEntries, createKBEntry, updateKBEntry, deleteKBEntry,
  getKBStats, getKBCategories, searchKB, aiSuggestKB, mergeKBVariant,
  getKBVariants, deleteKBVariant, regenerateKBEmbedding,
  getAllConversations, getFullConversation, createKBFromConversation, reviewAiFeedback,
} from "../../services/knowledgeBase.service";
import { useDebounce } from "../../hooks/useDebounce";
import {
  applyConversationFeedbackReview,
  buildKnowledgeSuggestionDraft,
  buildKnowledgeEntryPayload,
  clampKnowledgePage,
  createEmptyKnowledgeSource,
  createKnowledgeSearchRuntime,
  createLatestRequestRuntime,
  filterConversationPairs,
  getKnowledgeQueryViewState,
  getPairFeedback,
  getPairReviewStatus,
  getSuggestionSourcePair,
  KNOWLEDGE_SEARCH_MODES,
  toDateInputValue,
} from "./knowledgeBaseAdmin";

const emptyForm = (variants = []) => ({
  question: "",
  answer: "",
  category: "general",
  tags: "",
  variants,
  status: "draft",
  evidenceLevel: "legacy_unverified",
  freshnessClass: "stable",
  reviewDueAt: "",
  sources: [],
});

const CATEGORY_COLORS = {
  service: "bg-blue-100 text-blue-700",
  nutrition: "bg-green-100 text-green-700",
  training: "bg-orange-100 text-orange-700",
  athlete: "bg-purple-100 text-purple-700",
  equipment: "bg-yellow-100 text-yellow-700",
  supplement: "bg-pink-100 text-pink-700",
  health: "bg-red-100 text-red-700",
  hlv: "bg-indigo-100 text-indigo-700",
  platform: "bg-cyan-100 text-cyan-700",
  general: "bg-gray-100 text-gray-700",
};

const EVIDENCE_LEVELS = [
  { value: "legacy_unverified", label: "Chưa kiểm chứng" },
  { value: "editor_reviewed", label: "Biên tập viên đã duyệt" },
  { value: "source_backed", label: "Có nguồn đối chiếu" },
  { value: "canonical_internal", label: "Nguồn nội bộ chuẩn" },
];

const FRESHNESS_CLASSES = [
  { value: "stable", label: "Ổn định" },
  { value: "periodic", label: "Kiểm tra định kỳ" },
  { value: "time_sensitive", label: "Nhạy theo thời gian" },
];

const SOURCE_TYPES = [
  { value: "internal", label: "Nội bộ HTCOACHING" },
  { value: "official", label: "Nguồn chính thức" },
  { value: "research", label: "Nghiên cứu" },
  { value: "professional", label: "Tổ chức chuyên môn" },
  { value: "editorial", label: "Báo chí / biên tập" },
  { value: "conversation", label: "Hội thoại cần kiểm chứng" },
];

const EVIDENCE_TIERS = [
  { value: "canonical", label: "Chuẩn nội bộ" },
  { value: "primary", label: "Nguồn gốc / trực tiếp" },
  { value: "professional", label: "Nguồn chuyên môn" },
  { value: "secondary", label: "Nguồn thứ cấp" },
  { value: "conversation", label: "Từ hội thoại" },
  { value: "legacy_unknown", label: "Chưa xác định" },
];

const REVIEW_STATUS_LABELS = {
  pending: "Chờ xử lý",
  resolved: "Đã xử lý",
  dismissed: "Đã bỏ qua",
};

export default function KnowledgeBase() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("entries"); // entries | conversations | search
  const [entryPage, setEntryPage] = useState(1);
  const [conversationPage, setConversationPage] = useState(1);
  const [filter, setFilter] = useState({ category: "", status: "", search: "" });
  const [conversationFilter, setConversationFilter] = useState({
    feedback: "down",
    feedbackReviewStatus: "pending",
  });
  const debouncedSearch = useDebounce(filter.search, 300);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [sourcePair, setSourcePair] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);

  // Conversations
  const [selectedConv, setSelectedConv] = useState(null);
  const [convDetail, setConvDetail] = useState(null);
  const [reviewingMessageId, setReviewingMessageId] = useState(null);
  const [editRequestRuntime] = useState(createLatestRequestRuntime);
  const [conversationRequestRuntime] = useState(createLatestRequestRuntime);

  // Search test
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState("production");
  const [searchRuntime] = useState(() =>
    createKnowledgeSearchRuntime({
      search: searchKB,
      onStart: () => {
        setSearching(true);
        setSearchError("");
        setSearchResponse(null);
      },
      onSuccess: setSearchResponse,
      onError: () => {
        setSearchError("Không thể kiểm tra tìm kiếm. Vui lòng thử lại.");
        toast.error("Lỗi search");
      },
      onSettled: () => setSearching(false),
    }),
  );

  // AI Suggest
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestDays, setSuggestDays] = useState(7);
  const [suggestInfo, setSuggestInfo] = useState(null);

  const entriesQuery = useQuery({
    queryKey: [
      "admin",
      "knowledge-base",
      "entries",
      {
        page: entryPage,
        category: filter.category,
        status: filter.status,
        search: debouncedSearch,
      },
    ],
    queryFn: ({ signal }) =>
      getKBEntries(
        {
          page: entryPage,
          limit: 15,
          ...(filter.category && { category: filter.category }),
          ...(filter.status && { status: filter.status }),
          ...(debouncedSearch && { search: debouncedSearch }),
        },
        signal,
      ).then((response) => response.data),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "knowledge-base", "stats"],
    queryFn: ({ signal }) => getKBStats(signal).then((response) => response.data.data),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin", "knowledge-base", "categories"],
    queryFn: ({ signal }) =>
      getKBCategories(signal).then((response) => response.data.data),
    staleTime: 30 * 60 * 1000,
  });
  const conversationsQuery = useQuery({
    queryKey: [
      "admin",
      "knowledge-base",
      "conversations",
      conversationPage,
      conversationFilter.feedback,
      conversationFilter.feedbackReviewStatus,
    ],
    queryFn: ({ signal }) =>
      getAllConversations(
        {
          page: conversationPage,
          limit: 15,
          ...(conversationFilter.feedback && {
            feedback: conversationFilter.feedback,
          }),
          ...(conversationFilter.feedbackReviewStatus && {
            feedbackReviewStatus: conversationFilter.feedbackReviewStatus,
          }),
        },
        signal,
      ).then((response) => response.data),
    enabled: tab === "conversations",
    placeholderData: keepPreviousData,
  });

  const entries = entriesQuery.data?.data || [];
  const pagination = entriesQuery.data?.pagination || {
    page: entryPage,
    totalPages: 1,
    total: 0,
  };
  const stats = statsQuery.data || null;
  const categories = categoriesQuery.data || [];
  const conversations = conversationsQuery.data?.data || [];
  const convPagination = conversationsQuery.data?.pagination || {
    page: conversationPage,
    totalPages: 1,
  };
  const loading =
    tab === "conversations"
      ? conversationsQuery.isLoading
      : entriesQuery.isLoading;
  const entriesViewState = getKnowledgeQueryViewState({
    isLoading: entriesQuery.isLoading,
    isError: entriesQuery.isError,
    hasData: entries.length > 0,
  });
  const statsViewState = getKnowledgeQueryViewState({
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    hasData: Boolean(stats),
  });
  const visibleConversationPairs = filterConversationPairs(
    convDetail?.qaPairs,
    conversationFilter,
  );
  const currentSearchResponse =
    searchResponse?.query === searchQuery.trim() &&
    searchResponse?.mode === searchMode
      ? searchResponse
      : null;
  const searchResults = currentSearchResponse?.results || [];

  useEffect(
    () => () => {
      searchRuntime.cancel();
      editRequestRuntime.invalidate();
      conversationRequestRuntime.invalidate();
    },
    [conversationRequestRuntime, editRequestRuntime, searchRuntime],
  );

  useEffect(() => {
    if (entriesQuery.isFetching) return;
    const nextPage = clampKnowledgePage(entryPage, pagination.totalPages);
    if (nextPage !== entryPage) setEntryPage(nextPage);
  }, [entriesQuery.isFetching, entryPage, pagination.totalPages]);

  useEffect(() => {
    if (conversationsQuery.isFetching) return;
    const nextPage = clampKnowledgePage(
      conversationPage,
      convPagination.totalPages,
    );
    if (nextPage !== conversationPage) {
      conversationRequestRuntime.invalidate();
      setSelectedConv(null);
      setConvDetail(null);
      setConversationPage(nextPage);
    }
  }, [
    conversationRequestRuntime,
    conversationsQuery.isFetching,
    conversationPage,
    convPagination.totalPages,
  ]);

  const loadEntries = useCallback(
    (page = entryPage) => {
      if (page !== entryPage) setEntryPage(page);
      else entriesQuery.refetch();
    },
    [entriesQuery, entryPage],
  );
  const refreshKnowledge = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "knowledge-base", "entries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "knowledge-base", "stats"],
        }),
      ]),
    [queryClient],
  );

  // Duplicate warning
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { similar, pendingData }
  const [viewingVariantsEntry, setViewingVariantsEntry] = useState(null); // entry model
  const [variantsList, setVariantsList] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // CRUD
  const handleSave = async () => {
    if (saving) return;
    if (!form.question.trim() || !form.answer.trim()) {
      return toast.error("Câu hỏi và câu trả lời không được để trống");
    }
    setSaving(true);
    try {
      const data = buildKnowledgeEntryPayload(form);
      if (editingEntry) {
        const response = await updateKBEntry(editingEntry._id, data);
        if (response.data.warning) toast.warning(response.data.warning);
        toast.success("Đã cập nhật");
      } else {
        const res = sourcePair
          ? await createKBFromConversation({
              ...data,
              ...sourcePair,
            })
          : await createKBEntry(data);
        // Check duplicate warning
        if (res.data.duplicate) {
          setDuplicateWarning({
            similar: res.data.similar,
            pendingData: res.data.pendingData,
          });
          setShowModal(false);
          return; // Không đóng, hiện warning
        }
        if (res.data.warning) toast.warning(res.data.warning);
        toast.success("Đã tạo mới");
      }
      setShowModal(false);
      setEditingEntry(null);
      setSourcePair(null);
      setForm(emptyForm());
      await refreshKnowledge();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  // Force create (bỏ qua duplicate check)
  const handleForceCreate = async () => {
    if (!duplicateWarning?.pendingData || saving) return;
    setSaving(true);
    try {
      const payload = {
        ...duplicateWarning.pendingData,
        skipDuplicateCheck: true,
      };
      if (sourcePair) {
        await createKBFromConversation({
          ...payload,
          ...sourcePair,
        });
      } else {
        await createKBEntry(payload);
      }
      toast.success("Đã tạo mới (bỏ qua trùng)");
      setDuplicateWarning(null);
      setSourcePair(null);
      setForm(emptyForm());
      await refreshKnowledge();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  // Merge vào entry gốc
  const handleMerge = async (targetId) => {
    if (!duplicateWarning?.pendingData || saving) return;
    setSaving(true);
    try {
      await mergeKBVariant(targetId, {
        question: duplicateWarning.pendingData.question,
      });
      toast.success("Đã merge thành variant");
      setDuplicateWarning(null);
      setSourcePair(null);
      setForm(emptyForm());
      await refreshKnowledge();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi merge");
    } finally {
      setSaving(false);
    }
  };

  const loadVariants = async (entry) => {
    setViewingVariantsEntry(entry);
    setLoadingVariants(true);
    try {
      const res = await getKBVariants(entry._id);
      setVariantsList(res.data.data.variants || []);
    } catch {
      toast.error("Lỗi tải danh sách biến thể");
    }
    setLoadingVariants(false);
  };

  const handleDeleteVariant = async (variantId) => {
    if (!confirm("Bạn có chắc chắn muốn xóa biến thể này?")) return;
    try {
      await deleteKBVariant(viewingVariantsEntry._id, variantId);
      toast.success("Đã xóa biến thể");
      // Reload danh sách variant hiện tại
      const res = await getKBVariants(viewingVariantsEntry._id);
      setVariantsList(res.data.data.variants || []);
      // Reload entries ngoài bảng để update variant count
      await refreshKnowledge();
    } catch {
      toast.error("Lỗi xóa biến thể");
    }
  };

  const handleEdit = async (entry) => {
    const request = editRequestRuntime.begin();
    setEditingEntry(entry);
    let entryVariants = [];
    try {
      const res = await getKBVariants(entry._id, request.signal);
      entryVariants = (res.data?.data?.variants || []).map((v) => v.text);
    } catch {
      // Variants are optional when opening the edit form.
    }
    if (!editRequestRuntime.isCurrent(request)) return;
    editRequestRuntime.settle(request);
    setForm({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      tags: entry.tags?.join(", ") || "",
      variants: entryVariants.length > 0 ? entryVariants : [""],
      status: entry.status || "draft",
      evidenceLevel: entry.evidenceLevel || "legacy_unverified",
      freshnessClass: entry.freshnessClass || "stable",
      reviewDueAt: toDateInputValue(entry.reviewDueAt),
      sources: (entry.sources || []).map((source) => ({
        type: source.type || "official",
        title: source.title || "",
        publisher: source.publisher || "",
        url: source.url || "",
        evidenceTier: source.evidenceTier || "legacy_unknown",
        publishedAt: toDateInputValue(source.publishedAt),
        retrievedAt: toDateInputValue(source.retrievedAt),
      })),
    });
    setSourcePair(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa knowledge entry này?")) return;
    try {
      await deleteKBEntry(id);
      toast.success("Đã xóa");
      await refreshKnowledge();
    } catch { toast.error("Lỗi xóa"); }
  };

  const handleRegenerate = async (id) => {
    if (regeneratingId) return;
    setRegeneratingId(id);
    try {
      await regenerateKBEmbedding(id);
      toast.success("Đã tạo lại embedding");
      await refreshKnowledge();
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tạo lại embedding");
      await refreshKnowledge();
    } finally {
      setRegeneratingId(null);
    }
  };

  const viewConversation = async (id) => {
    const request = conversationRequestRuntime.begin();
    setSelectedConv(id);
    setConvDetail(null);
    try {
      const res = await getFullConversation(id, {
        ...(conversationFilter.feedback && {
          feedback: conversationFilter.feedback,
        }),
        ...(conversationFilter.feedbackReviewStatus && {
          feedbackReviewStatus: conversationFilter.feedbackReviewStatus,
        }),
      }, request.signal);
      if (!conversationRequestRuntime.isCurrent(request)) return;
      setConvDetail(res.data.data);
    } catch {
      if (!conversationRequestRuntime.isCurrent(request)) return;
      setSelectedConv(null);
      toast.error("Lỗi tải conversation");
    } finally {
      conversationRequestRuntime.settle(request);
    }
  };

  const addToKB = (pair) => {
    const boundSourcePair = getSuggestionSourcePair({
      ...pair,
      conversationId: selectedConv,
    });
    if (!boundSourcePair) {
      toast.error("Cặp Q&A chưa có định danh nguồn hợp lệ; hãy tải lại conversation");
      return;
    }
    editRequestRuntime.invalidate();
    setForm({
      question: pair.question,
      answer: pair.answer || "",
      category: "general",
      tags: "",
      variants: [""],
      status: "draft",
      evidenceLevel: "legacy_unverified",
      freshnessClass: "stable",
      reviewDueAt: "",
      sources: [],
    });
    setEditingEntry(null);
    setSourcePair(boundSourcePair);
    setShowModal(true);
  };

  // Search test
  const invalidateSearch = () => {
    searchRuntime.invalidate();
    setSearchResponse(null);
    setSearchError("");
  };

  const handleSearchQueryChange = (value) => {
    invalidateSearch();
    setSearchQuery(value);
  };

  const handleSearchModeChange = (mode) => {
    if (mode === searchMode) return;
    invalidateSearch();
    setSearchMode(mode);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    void searchRuntime.run({ query: searchQuery, mode: searchMode });
  };

  const handleFeedbackReview = async (pair, status) => {
    const messageId = pair.answerMessageId;
    if (!selectedConv || !messageId || reviewingMessageId) return;
    const reviewConversationId = selectedConv;
    setReviewingMessageId(messageId);
    try {
      const response = await reviewAiFeedback(
        reviewConversationId,
        messageId,
        status,
      );
      const savedReview = response.data?.data?.feedbackReview || { status };
      setConvDetail((current) =>
        applyConversationFeedbackReview(current, {
          conversationId: reviewConversationId,
          messageId,
          feedbackReview: savedReview,
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin", "knowledge-base", "conversations"],
      });
      toast.success(
        status === "resolved"
          ? "Đã đánh dấu phản hồi là đã xử lý"
          : "Đã bỏ qua phản hồi này",
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật phản hồi");
    } finally {
      setReviewingMessageId(null);
    }
  };

  const updateConversationFilter = (key, value) => {
    conversationRequestRuntime.invalidate();
    setConversationPage(1);
    setSelectedConv(null);
    setConvDetail(null);
    setConversationFilter((current) => ({ ...current, [key]: value }));
  };

  const updateKnowledgeSource = (index, key, value) => {
    setForm((current) => ({
      ...current,
      sources: (current.sources || []).map((source, sourceIndex) =>
        sourceIndex === index ? { ...source, [key]: value } : source,
      ),
    }));
  };

  const removeKnowledgeSource = (index) => {
    setForm((current) => ({
      ...current,
      sources: (current.sources || []).filter((_, sourceIndex) => sourceIndex !== index),
    }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kiến thức AI</h1>
            {statsViewState === "error" ? (
              <p className="text-sm text-red-600" role="alert">
                Không tải được thống kê.{" "}
                <button
                  type="button"
                  onClick={() => statsQuery.refetch()}
                  className="font-medium underline underline-offset-2 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  Thử lại
                </button>
              </p>
            ) : (
              <p className="text-sm text-slate-500" aria-live="polite">
                {statsViewState === "loading"
                  ? "Đang tải thống kê..."
                  : stats
                    ? `${stats.total} mục kiến thức`
                    : "Chưa có thống kê"}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            editRequestRuntime.invalidate();
            setEditingEntry(null);
            setForm(emptyForm([""]));
            setSourcePair(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {stats.byCategory.slice(0, 5).map((c) => (
            <div key={c.category} className="bg-white rounded-xl p-3 border border-slate-200">
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-xl font-bold text-slate-800">{c.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: "entries", label: "Kiến thức", icon: Brain },
          { key: "suggest", label: "AI Gợi ý", icon: Sparkles },
          { key: "conversations", label: "Cuộc trò chuyện", icon: MessageSquare },
          { key: "search", label: "Test Search", icon: Search },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              if (key !== "conversations") {
                conversationRequestRuntime.invalidate();
              }
              setTab(key);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Entries */}
      {tab === "entries" && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select
              value={filter.category}
              onChange={(e) => {
                setEntryPage(1);
                setFilter((p) => ({ ...p, category: e.target.value }));
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={filter.status}
              onChange={(e) => {
                setEntryPage(1);
                setFilter((p) => ({ ...p, status: e.target.value }));
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={filter.search}
              onChange={(e) => {
                setEntryPage(1);
                setFilter((p) => ({ ...p, search: e.target.value }));
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Câu hỏi</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Danh mục</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600 w-20">Truy xuất</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600 w-24">Trạng thái</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 line-clamp-1">{e.question}</p>
                        {e.variantCount > 0 && (
                          <span
                            onClick={() => loadVariants(e)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer shrink-0"
                            title="Click để xem các câu hỏi biến thể"
                          >
                            <GitMerge size={10} />
                            {e.variantCount} biến thể
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{e.answer}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS.general}`}>
                        {categories.find((c) => c.value === e.category)?.label || e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{e.usageCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        e.status === "published" ? "bg-green-100 text-green-700" :
                        e.status === "draft" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                      }`}>{e.status}</span>
                      <p className={`mt-1 text-[10px] ${
                        e.embeddingStatus === "ready" ? "text-emerald-600" :
                        e.embeddingStatus === "failed" ? "text-red-500" : "text-amber-600"
                      }`}>
                        vector: {e.embeddingStatus || "pending"}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {EVIDENCE_LEVELS.find((item) => item.value === e.evidenceLevel)?.label || "Chưa kiểm chứng"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {e.embeddingStatus !== "ready" && (
                          <button
                            disabled={regeneratingId === e._id}
                            onClick={() => handleRegenerate(e._id)}
                            className="p-1.5 hover:bg-emerald-50 rounded-md disabled:opacity-40"
                            title="Tạo lại embedding"
                          >
                            <RefreshCw
                              size={14}
                              className={`text-emerald-600 ${
                                regeneratingId === e._id ? "animate-spin" : ""
                              }`}
                            />
                          </button>
                        )}
                        <button onClick={() => handleEdit(e)} className="p-1.5 hover:bg-slate-100 rounded-md" title="Sửa">
                          <Edit3 size={14} className="text-slate-500" />
                        </button>
                        <button onClick={() => handleDelete(e._id)} className="p-1.5 hover:bg-red-50 rounded-md" title="Xóa">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entriesViewState === "loading" && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500" aria-live="polite">
                      Đang tải danh sách kiến thức...
                    </td>
                  </tr>
                )}
                {entriesViewState === "error" && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="text-sm text-red-600" role="alert">
                        <p>Không tải được danh sách kiến thức.</p>
                        <button
                          type="button"
                          onClick={() => entriesQuery.refetch()}
                          className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 font-medium hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        >
                          Thử lại
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {entriesViewState === "empty" && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Chưa có knowledge entry nào</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => loadEntries(i + 1)}
                  className={`w-8 h-8 rounded-md text-sm ${
                    pagination.page === i + 1 ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border hover:bg-slate-50"
                  }`}
                >{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: AI Suggest */}
      {tab === "suggest" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-700">AI Gợi ý từ cuộc trò chuyện</p>
              <p className="text-xs text-slate-400 mt-0.5">
                AI chỉ đề xuất ứng viên; Admin phải kiểm chứng nguồn trước khi xuất bản
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={suggestDays}
                onChange={(e) => setSuggestDays(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value={1}>1 ngày qua</option>
                <option value={3}>3 ngày qua</option>
                <option value={7}>7 ngày qua</option>
                <option value={14}>14 ngày qua</option>
                <option value={30}>30 ngày qua</option>
              </select>
              <button
                onClick={async () => {
                  setSuggesting(true);
                  setSuggestions([]);
                  setSuggestInfo(null);
                  try {
                    const res = await aiSuggestKB({ days: suggestDays });
                    setSuggestions(res.data.data);
                    setSuggestInfo({ total: res.data.totalScanned, message: res.data.message });
                  } catch { toast.error("Lỗi gọi AI gợi ý"); }
                  setSuggesting(false);
                }}
                disabled={suggesting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Sparkles size={14} className={suggesting ? "animate-spin" : ""} />
                {suggesting ? "Đang quét..." : "Quét & Gợi ý"}
              </button>
            </div>
          </div>

          {suggestInfo?.message && suggestions.length === 0 && !suggesting && (
            <p className="text-sm text-slate-400 text-center py-8">{suggestInfo.message}</p>
          )}

          {suggestInfo?.total > 0 && suggestions.length > 0 && (
            <p className="text-xs text-slate-400 mb-4">
              Đã quét {suggestInfo.total} Q&A → AI đề xuất {suggestions.length} ứng viên cần kiểm chứng
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200 group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-600">⭐ {s.score}/10</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.general}`}>
                      {categories.find((c) => c.value === s.category)?.label || s.category}
                    </span>
                    <span className="text-xs text-slate-400">— {s.reason}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mb-1">Q: {s.question}</p>
                  <p className="text-sm text-slate-600 line-clamp-3 mb-3">A: {s.answer}</p>
                  <button
                    onClick={() => {
                      const draft = buildKnowledgeSuggestionDraft(s);
                      if (!draft) {
                        toast.error(
                          "Gợi ý này thiếu thông tin nguồn. Hãy quét lại trước khi thêm vào Knowledge Base.",
                        );
                        return;
                      }
                      editRequestRuntime.invalidate();
                      setForm(draft.form);
                      setSourcePair(draft.sourcePair);
                      setEditingEntry(null);
                      setShowModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    <Plus size={12} /> Thêm vào KB
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Conversations */}
      {tab === "conversations" && (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs font-medium text-slate-600">
              Phản hồi câu trả lời
              <select
                value={conversationFilter.feedback}
                onChange={(event) => updateConversationFilter("feedback", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Tất cả phản hồi</option>
                <option value="down">Chưa tốt</option>
                <option value="up">Hữu ích</option>
              </select>
            </label>
            <label className="block flex-1 text-xs font-medium text-slate-600">
              Trạng thái xử lý
              <select
                value={conversationFilter.feedbackReviewStatus}
                onChange={(event) => updateConversationFilter("feedbackReviewStatus", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xử lý</option>
                <option value="resolved">Đã xử lý</option>
                <option value="dismissed">Đã bỏ qua</option>
              </select>
            </label>
            <p className="text-xs text-slate-500 sm:max-w-xs">
              Ưu tiên phản hồi chưa tốt để sửa câu trả lời hoặc bổ sung kiến thức có nguồn.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* List */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white md:col-span-1">
              <div className="border-b border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Cuộc trò chuyện cần xem</p>
              </div>
              <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
                {conversations.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => viewConversation(c._id)}
                    className={`w-full px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                      selectedConv === c._id ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">{c.title}</p>
                      {c.pendingFeedbackCount > 0 && (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          {c.pendingFeedbackCount} chờ xử lý
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{c.messageCount} tin nhắn</p>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    {conversationsQuery.isError ? (
                      <>
                        <p>Không thể tải hàng đợi phản hồi.</p>
                        <button
                          type="button"
                          onClick={() => conversationsQuery.refetch()}
                          className="mt-2 rounded-md px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          Thử lại
                        </button>
                      </>
                    ) : loading ? "Đang tải..." : "Không có cuộc trò chuyện phù hợp"}
                  </div>
                )}
              </div>
              {convPagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-2">
                  <button
                    type="button"
                    disabled={conversationPage <= 1}
                    onClick={() => {
                      conversationRequestRuntime.invalidate();
                      setSelectedConv(null);
                      setConvDetail(null);
                      setConversationPage((page) => Math.max(1, page - 1));
                    }}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <span className="text-xs text-slate-500">
                    {conversationPage}/{convPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={conversationPage >= convPagination.totalPages}
                    onClick={() => {
                      conversationRequestRuntime.invalidate();
                      setSelectedConv(null);
                      setConvDetail(null);
                      setConversationPage((page) =>
                        Math.min(convPagination.totalPages, page + 1),
                      );
                    }}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white md:col-span-2">
              {convDetail ? (
                <>
                  <div className="border-b border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">{convDetail.title}</p>
                    <p className="text-xs text-slate-500">
                      {visibleConversationPairs.length} cặp phù hợp bộ lọc
                    </p>
                  </div>
                  <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
                    {visibleConversationPairs.map((pair) => {
                      const feedback = getPairFeedback(pair);
                      const reviewStatus = getPairReviewStatus(pair);
                      const messageId = pair.answerMessageId || pair.answerIndex;
                      const isReviewing = reviewingMessageId === pair.answerMessageId;
                      return (
                        <div key={messageId} className="group p-4 transition-colors hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                {feedback === "down" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                    <ThumbsDown size={12} /> Chưa tốt
                                  </span>
                                )}
                                {feedback === "up" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    <ThumbsUp size={12} /> Hữu ích
                                  </span>
                                )}
                                {reviewStatus && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                    {REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus}
                                  </span>
                                )}
                              </div>
                              {pair.contentVisibility === "hidden_sensitive" ? (
                                <p className="text-sm text-amber-700">
                                  Nội dung nhạy cảm đã được ẩn; bạn vẫn có thể đóng feedback này.
                                </p>
                              ) : (
                                <p className="mb-1 text-sm font-medium text-indigo-700">Q: {pair.question}</p>
                              )}
                              {pair.answer && pair.contentVisibility !== "hidden_sensitive" && (
                                <p className="line-clamp-3 text-sm text-slate-600">A: {pair.answer}</p>
                              )}
                            </div>
                            {pair.answer && getSuggestionSourcePair(pair) && (
                              <button
                                onClick={() => addToKB(pair)}
                                className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 opacity-100 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                              >
                                <span className="flex items-center gap-1"><Star size={12} /> Thêm vào KB</span>
                              </button>
                            )}
                          </div>
                          {feedback === "down" && reviewStatus === "pending" && pair.answerMessageId && (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                              <button
                                type="button"
                                disabled={Boolean(reviewingMessageId)}
                                onClick={() => handleFeedbackReview(pair, "resolved")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} /> {isReviewing ? "Đang lưu..." : "Đánh dấu đã xử lý"}
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(reviewingMessageId)}
                                onClick={() => handleFeedbackReview(pair, "dismissed")}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Ban size={13} /> Bỏ qua
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {visibleConversationPairs.length === 0 && (
                      <p className="px-4 py-10 text-center text-sm text-slate-500">
                        Cuộc trò chuyện này không có cặp hỏi đáp phù hợp bộ lọc.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                  Chọn cuộc trò chuyện để xem chi tiết
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab: Search Test */}
      {tab === "search" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Kiểm tra tìm kiếm ngữ nghĩa</p>
              <p className="mt-1 text-xs text-slate-500">
                Chế độ production dùng đúng 3 kết quả và ngưỡng khớp 75% như HT Assistant.
              </p>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-slate-600">Chế độ kiểm tra</legend>
              <div className="flex rounded-lg bg-slate-100 p-1">
                {[
                  { value: "production", label: "Production" },
                  { value: "exploratory", label: "Khám phá" },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={searchMode === mode.value}
                    onClick={() => handleSearchModeChange(mode.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      searchMode === mode.value
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {searchMode === "exploratory" && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chế độ khám phá nới xuống 60% và lấy 5 kết quả; kết quả này không phản ánh hành vi production.
            </p>
          )}
          <div className="mb-6 flex gap-3">
            <input
              type="text"
              aria-label="Câu hỏi kiểm tra tìm kiếm"
              placeholder="Nhập câu hỏi để kiểm tra..."
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              aria-controls="knowledge-search-results"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Đang tìm..." : "Tìm kiếm"}
            </button>
          </div>
          <div id="knowledge-search-results" aria-busy={searching}>
            <p className="sr-only" role="status" aria-live="polite">
              {searching
                ? "Đang kiểm tra tìm kiếm"
                : currentSearchResponse
                  ? `Đã tìm thấy ${searchResults.length} kết quả`
                  : ""}
            </p>
            {searchError && !searching && (
              <div
                className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                <span>{searchError}</span>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Thử lại
                </button>
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((r, i) => (
                  <div key={r._id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-indigo-600">#{i + 1}</span>
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        {(r.similarity * 100).toFixed(1)}% match
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[r.category]}`}>{r.category}</span>
                      <span className="text-xs text-slate-500">
                        {EVIDENCE_LEVELS.find((item) => item.value === r.evidenceLevel)?.label || "Chưa kiểm chứng"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Q: {r.question}</p>
                    {r.matchedQuestion && r.matchedQuestion !== r.question && (
                      <p className="mb-1 text-xs text-indigo-600">Khớp qua biến thể: {r.matchedQuestion}</p>
                    )}
                    <p className="text-sm text-slate-600">A: {r.answer}</p>
                  </div>
                ))}
              </div>
            )}
            {currentSearchResponse && searchResults.length === 0 && !searching && (
              <p className="py-4 text-center text-sm text-slate-500">
                Không tìm thấy kết quả nào (ngưỡng ≥ {Math.round(KNOWLEDGE_SEARCH_MODES[currentSearchResponse.mode].threshold * 100)}%)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal Thêm/Sửa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-entry-dialog-title"
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl mx-4"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 id="knowledge-entry-dialog-title" className="text-lg font-bold text-slate-800">
                {editingEntry ? "Sửa mục kiến thức" : "Thêm mục kiến thức"}
              </h3>
              <button
                type="button"
                aria-label="Đóng hộp thoại kiến thức"
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-md"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Câu hỏi</label>
                <textarea
                  value={form.question}
                  onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="VD: Gói PT 1 kèm 1 giá bao nhiêu?"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Các biến thể câu hỏi (Đồng nghĩa)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((p) => ({
                        ...p,
                        variants: [...(p.variants || []), ""],
                      }));
                    }}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                  >
                    <Plus size={14} /> Thêm biến thể
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {(form.variants || []).map((variant, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={variant}
                        onChange={(e) => {
                          const updated = [...(form.variants || [])];
                          updated[index] = e.target.value;
                          setForm((p) => ({ ...p, variants: updated }));
                        }}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={`Biến thể ${index + 1} (VD: câu hỏi đồng nghĩa...)`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (form.variants || []).filter((_, i) => i !== index);
                          setForm((p) => ({ ...p, variants: updated }));
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Xóa biến thể"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  {(form.variants || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic">Chưa có biến thể nào. Hãy nhấn "+ Thêm biến thể" nếu có câu hỏi đồng nghĩa.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Câu trả lời</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Câu trả lời đã đối chiếu..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Danh mục</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="published">Đã xuất bản</option>
                    <option value="archived">Đã lưu trữ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tags (cách nhau bởi dấu phẩy)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="TDEE, giảm mỡ"
                  />
                </div>
              </div>

              <section className="border-t border-slate-200 pt-4" aria-labelledby="knowledge-evidence-heading">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 id="knowledge-evidence-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Link2 size={15} className="text-indigo-600" /> Bằng chứng và lịch kiểm tra
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Mục xuất bản cần nguồn phù hợp và sẽ được server ghi nhận người duyệt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        sources: [...(current.sources || []), createEmptyKnowledgeSource()],
                      }))
                    }
                    className="mt-2 inline-flex items-center gap-1 self-start rounded-md px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:mt-0"
                  >
                    <Plus size={13} /> Thêm nguồn
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="text-xs font-medium text-slate-600">
                    Mức bằng chứng
                    <select
                      value={form.evidenceLevel}
                      onChange={(event) => setForm((current) => ({ ...current, evidenceLevel: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {EVIDENCE_LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Độ mới của nội dung
                    <select
                      value={form.freshnessClass}
                      onChange={(event) => setForm((current) => ({ ...current, freshnessClass: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {FRESHNESS_CLASSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Ngày cần kiểm tra lại
                    <input
                      type="date"
                      value={form.reviewDueAt}
                      onChange={(event) => setForm((current) => ({ ...current, reviewDueAt: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  {(form.sources || []).map((source, index) => (
                    <fieldset key={index} className="rounded-xl border border-slate-200 p-3">
                      <legend className="px-1 text-xs font-semibold text-slate-600">Nguồn {index + 1}</legend>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                          Loại nguồn
                          <select
                            value={source.type}
                            onChange={(event) => updateKnowledgeSource(index, "type", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          >
                            {SOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Cấp độ nguồn
                          <select
                            value={source.evidenceTier}
                            onChange={(event) => updateKnowledgeSource(index, "evidenceTier", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          >
                            {EVIDENCE_TIERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Tiêu đề
                          <input
                            type="text"
                            value={source.title}
                            onChange={(event) => updateKnowledgeSource(index, "title", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="Tên tài liệu hoặc trang"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Đơn vị xuất bản
                          <input
                            type="text"
                            value={source.publisher}
                            onChange={(event) => updateKnowledgeSource(index, "publisher", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="Ví dụ: ACSM, WHO"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600 md:col-span-2">
                          URL nguồn HTTPS
                          <input
                            type="url"
                            value={source.url}
                            onChange={(event) => updateKnowledgeSource(index, "url", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Ngày xuất bản
                          <input
                            type="date"
                            value={source.publishedAt || ""}
                            onChange={(event) => updateKnowledgeSource(index, "publishedAt", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Ngày truy xuất
                          <input
                            type="date"
                            value={source.retrievedAt || ""}
                            onChange={(event) => updateKnowledgeSource(index, "retrievedAt", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeKnowledgeSource(index)}
                        className="mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <Trash2 size={12} /> Xóa nguồn
                      </button>
                    </fieldset>
                  ))}
                  {(form.sources || []).length === 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Chưa có nguồn. Bạn vẫn có thể lưu bản nháp, nhưng server sẽ từ chối xuất bản khi bằng chứng chưa đủ.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
              <button disabled={saving} onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Hủy</button>
              <button disabled={saving} onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Đang lưu..." : editingEntry ? "Cập nhật" : "Tạo mới"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh báo trùng lặp */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-amber-50 rounded-t-2xl">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle size={20} />
                <h3 className="text-lg font-bold">Phát hiện câu hỏi tương tự!</h3>
              </div>
              <button onClick={() => setDuplicateWarning(null)} className="p-1 hover:bg-amber-100 rounded-md">
                <X size={18} className="text-amber-700" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Hệ thống AI phát hiện câu hỏi bạn đang nhập có độ tương đồng cao với các câu hỏi đã có sẵn dưới đây:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mb-2">
                <span className="font-semibold text-slate-700">Câu hỏi của bạn:</span>
                <p className="text-slate-800 italic mt-1">"{duplicateWarning.pendingData.question}"</p>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Entries tương tự trong hệ thống</span>
                {duplicateWarning.similar.map((s) => (
                  <div key={s._id} className="border border-slate-200 rounded-xl p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {s.similarity}% giống
                        </span>
                        <span className="text-xs text-slate-400">
                          ({s.variantCount} biến thể)
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">Q: {s.question}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">A: {s.answer}</p>
                    </div>
                    <button
                      disabled={saving}
                      onClick={() => handleMerge(s._id)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 self-center transition-colors"
                    >
                      <GitMerge size={14} />
                      Gộp vào đây
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-3 p-5 border-t border-slate-200">
              <button
                disabled={saving}
                onClick={() => handleForceCreate()}
                className="px-4 py-2 text-sm text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Vẫn tạo mới (Tạo entry riêng)
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDuplicateWarning(null);
                    setShowModal(true); // Mở lại modal edit/create
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Quay lại chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem/Xóa biến thể câu hỏi */}
      {viewingVariantsEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2 text-indigo-600">
                <GitMerge size={20} />
                <h3 className="text-lg font-bold text-slate-800">Biến thể câu hỏi</h3>
              </div>
              <button onClick={() => setViewingVariantsEntry(null)} className="p-1 hover:bg-slate-100 rounded-md">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-sm">
                <span className="font-bold text-indigo-800 uppercase tracking-wider text-[10px]">Câu hỏi chính</span>
                <p className="text-slate-800 font-semibold mt-1">"{viewingVariantsEntry.question}"</p>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Các câu hỏi phụ / biến thể ({variantsList.length})
                </span>
                {loadingVariants ? (
                  <p className="text-sm text-slate-400 text-center py-4">Đang tải biến thể...</p>
                ) : variantsList.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4 italic">Chưa có câu hỏi phụ nào được gộp vào</p>
                ) : (
                  <div className="space-y-2">
                    {variantsList.map((v) => (
                      <div key={v._id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm group hover:border-slate-300 transition-colors">
                        <p className="text-slate-700 flex-1 min-w-0 font-medium">"{v.text}"</p>
                        <button
                          onClick={() => handleDeleteVariant(v._id)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors shrink-0"
                          title="Xóa biến thể này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setViewingVariantsEntry(null)}
                className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
