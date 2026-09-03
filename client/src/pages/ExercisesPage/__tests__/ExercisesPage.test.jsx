import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const translations = {
  badge: "HỆ THỐNG BÀI TẬP",
  "library.title": "THƯ VIỆN BÀI TẬP",
  "library.description": "Tìm bài tập và đọc hướng dẫn trước khi luyện tập.",
  "library.open_planner": "Tạo lịch tập PDF",
  "library.search_label": "Tìm bài tập",
  "library.search_placeholder": "Nhập tên bài tập hoặc nhóm cơ",
  "library.all_groups": "Tất cả",
  "library.result_count": "{{count}} bài tập",
  "library.view_detail": "Xem chi tiết",
  "library.loading": "Đang tải thư viện bài tập",
  "library.error_title": "Chưa thể tải thư viện bài tập",
  "library.error_description": "Kiểm tra kết nối và thử lại.",
  "library.retry": "Thử lại",
  "library.empty_title": "Không tìm thấy bài tập phù hợp",
  "library.empty_description": "Thử từ khóa hoặc nhóm cơ khác.",
  "library.clear_filters": "Xóa bộ lọc",
  "library.image_alt": "Hình minh họa {{name}}",
  "detail.close": "Đóng chi tiết bài tập",
  "detail.title": "Chi tiết bài tập",
  "detail.go_to_setup": "Đi đến hướng dẫn từng bước",
  "detail.admin_difficulty": "HTCOACHING đánh giá kỹ thuật",
  "detail.admin_difficulty_note": "Tách khỏi đánh giá người tập.",
  "detail.video_eyebrow": "Minh họa động tác",
  "detail.video_title": "Video bài tập",
  "detail.video_unsupported": "Không hỗ trợ video",
  "detail.setup_eyebrow": "Chuẩn bị đúng",
  "detail.setup_title": "Hướng dẫn setup từng bước",
  "detail.setup_description": "Thực hiện từ trên xuống.",
  "detail.setup_step_progress": "Đã xem đến bước {{current}} trên {{total}}",
  "detail.setup_step_label": "Bước {{current}}",
  "detail.setup_step_empty": "Đang cập nhật hướng dẫn bước này.",
  "detail.setup_empty": "Đang cập nhật hướng dẫn.",
  "detail.reviews.summary": "{{rating}}/5 · {{count}} đánh giá",
  "modal.col_muscle": "Nhóm cơ chính",
  "modal.col_desc": "Mô tả",
  "modal.no_image": "Chưa có hình ảnh",
  "modal.no_muscle": "Chưa có nhóm cơ",
  "modal.no_desc": "Chưa có mô tả",
  "difficulty.title": "Độ phức tạp kỹ thuật",
  "difficulty.not_rated": "Chưa đánh giá",
  "difficulty.filter_label": "Lọc theo độ phức tạp kỹ thuật",
  "difficulty.filter_all": "Tất cả độ phức tạp",
  "difficulty.filter_rating": "Mức {{rating}}/5",
  "difficulty.rating_label": "{{rating}} trên 5 sao về độ phức tạp kỹ thuật",
  "difficulty.tooltip": "Đánh giá kỹ thuật",
};

const t = (key, values = {}) => {
  const template = translations[key] || key;
  return Object.entries(values).reduce(
    (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
    template,
  );
};

const retryExercises = vi.fn();
let authUser = null;
const exercise = {
  _id: "exercise-1",
  name: "Goblet Squat",
  imageUrl: "https://cdn.example.com/goblet-squat.jpg",
  muscleGroup: "Chân",
  description: "Giữ ngực thẳng và hạ hông có kiểm soát.",
  technicalDifficultyRating: 3,
  videoUrl: "https://cdn.example.com/goblet-squat.mp4",
  instructions: [
    { title: "Chỉnh vị trí chân", description: "Đứng rộng bằng vai." },
    { title: "Giữ tạ trước ngực", description: "Giữ cổ tay trung lập." },
  ],
};

const logic = {
  muscleGroups: [],
  customGroups: [],
  exerciseOptions: [exercise],
  workoutData: [],
  selectedMuscleGroups: [],
  isExercisesLoading: false,
  isExercisesError: false,
  retryExercises,
  isMobile: false,
  toggleMuscleGroup: vi.fn(),
  handleAddExercise: vi.fn(),
  handleDeleteExercise: vi.fn(),
  handleExerciseChange: vi.fn(),
  formatDate: vi.fn(),
  showCustomGroupModal: false,
  setShowCustomGroupModal: vi.fn(),
  tempSelectedGroups: [],
  setTempSelectedGroups: vi.fn(),
  handleCreateCustomGroup: vi.fn(),
  getMuscleGroupById: vi.fn(),
  customGroupName: "",
  setCustomGroupName: vi.fn(),
  sendExerciseSuggestion: vi.fn(),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t,
    i18n: { language: "vi", resolvedLanguage: "vi" },
  }),
  Trans: ({ i18nKey }) => i18nKey,
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../components/ChatIcons", () => ({ default: () => null }));
vi.mock("../../../components/ScrollToTop", () => ({ default: () => null }));
vi.mock("../../../sections/Header/Header", () => ({ default: () => null }));
vi.mock("../../../sections/Footer/Footer", () => ({
  default: () => <footer data-exercises-footer="true" />,
}));
vi.mock("../../../sections/Contact", () => ({
  default: () => <section data-exercises-contact="true" />,
}));
vi.mock("../../../hooks/usePrompt", () => ({ usePrompt: vi.fn() }));
vi.mock("../../../hooks/useExercisesLogic", () => ({ default: () => logic }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock("../../../utils/customerDashboardTheme", () => ({
  resolveInitialCustomerDashboardTheme: () => "light",
}));
vi.mock("../../../utils/localDataTranslator", () => ({
  translateData: (data) => data,
}));

import { ExerciseDetailContent } from "../ExerciseDetailPage";
import ExerciseLibrary from "../ExerciseLibrary";
import ExercisesPage from "../ExercisesPage";
import { filterExerciseCatalog } from "../exerciseLibraryFilters";

describe("ExercisesPage library-first experience", () => {
  beforeEach(() => {
    authUser = null;
    retryExercises.mockClear();
  });

  it("renders the library by default with all four canonical fields and keeps planner secondary", () => {
    const html = renderToStaticMarkup(<ExercisesPage />);

    expect({
      library: html.includes('data-exercise-library="true"'),
      plannerNotMounted: !html.includes('data-workout-planner="true"'),
      plannerAction: html.includes('data-open-workout-planner="true"'),
      name: html.includes("Goblet Squat"),
      image: html.includes("https://cdn.example.com/goblet-squat.jpg"),
      muscleGroup: html.includes("Chân"),
      description: html.includes("Giữ ngực thẳng và hạ hông có kiểm soát."),
      technicalRatingHidden: !html.includes(
        "3 trên 5 sao về độ phức tạp kỹ thuật",
      ),
    }).toEqual({
      library: true,
      plannerNotMounted: true,
      plannerAction: true,
      name: true,
      image: true,
      muscleGroup: true,
      description: true,
      technicalRatingHidden: true,
    });
  });

  it("filters the catalog by search text, muscle group and existing difficulty rating", () => {
    const result = filterExerciseCatalog(
      [
        exercise,
        { ...exercise, _id: "exercise-2", name: "Push Up", muscleGroup: "Ngực", technicalDifficultyRating: null },
      ],
      { searchTerm: "squat", muscleGroup: "Chân", difficulty: "3" },
    );

    expect(result.map((item) => item._id)).toEqual(["exercise-1"]);
  });

  it("preserves the customer dashboard theme wrapper for signed-in students", () => {
    authUser = { _id: "student-1", role: "user" };

    const html = renderToStaticMarkup(<ExercisesPage />);

    expect(html).toContain('class="customer-dashboard customer-tool-surface"');
    expect(html).toContain('data-theme="light"');
  });

  it("does not render the contact section or site footer on the exercise tool", () => {
    const html = renderToStaticMarkup(<ExercisesPage />);

    expect(html).not.toMatch(/data-exercises-(contact|footer)="true"/);
  });

  it("renders an actionable error state and an empty state", () => {
    const errorHtml = renderToStaticMarkup(
      <ExerciseLibrary exercises={[]} isError onRetry={retryExercises} onOpenPlanner={vi.fn()} onSelectExercise={vi.fn()} />,
    );
    const emptyHtml = renderToStaticMarkup(
      <ExerciseLibrary exercises={[]} onRetry={retryExercises} onOpenPlanner={vi.fn()} onSelectExercise={vi.fn()} />,
    );

    expect({
      error: errorHtml.includes('data-exercise-error="true"'),
      retry: errorHtml.includes("Thử lại"),
      empty: emptyHtml.includes('data-exercise-empty="true"'),
    }).toEqual({ error: true, retry: true, empty: true });
  });

  it("renders priority exercise links inside the initial 24-card HTML", () => {
    const exercises = Array.from({ length: 30 }, (_, index) => ({
      ...exercise,
      _id: `exercise-${index + 1}`,
      name: `Exercise ${index + 1}`,
    }));

    const html = renderToStaticMarkup(
      <ExerciseLibrary
        exercises={exercises}
        priorityExerciseIds={["exercise-30", "exercise-29"]}
        onOpenPlanner={vi.fn()}
      />,
    );

    expect({
      firstPriority: html.includes(
        'href="/exercises/exercise-30/exercise-30/"',
      ),
      secondPriority: html.includes(
        'href="/exercises/exercise-29/exercise-29/"',
      ),
      displacedItem: html.includes(
        'href="/exercises/exercise-23/exercise-23/"',
      ),
    }).toEqual({
      firstPriority: true,
      secondPriority: true,
      displacedItem: false,
    });
  });

  it("renders the recipe-like hero and setup rail without previous or next controls", () => {
    const html = renderToStaticMarkup(
      <ExerciseDetailContent
        exercise={exercise}
        reviewSummary={{ total: 126, averageRating: 4.8 }}
        t={t}
      />,
    );

    expect({
      recipeHero: html.includes('data-exercise-detail-hero="recipe"'),
      name: html.includes("Goblet Squat"),
      image: html.includes("https://cdn.example.com/goblet-squat.jpg"),
      muscleGroup: html.includes("Chân"),
      muscleGroupPill: html.includes('data-exercise-detail-muscle="pill"'),
      muscleGroupIconHidden: !html.includes("lucide-dumbbell"),
      communityRating: html.includes("4.8/5 · 126 đánh giá"),
      description: html.includes("Giữ ngực thẳng và hạ hông có kiểm soát."),
      video: html.includes("https://cdn.example.com/goblet-squat.mp4"),
      firstStep: html.includes("Chỉnh vị trí chân"),
      secondStep: html.includes("Giữ tạ trước ngực"),
      setupRail: html.includes('data-exercise-setup-steps="rail"'),
      firstStepActive: html.includes('data-active-step="1"'),
      progressValue: html.includes(
        'aria-valuemin="1" aria-valuemax="2" aria-valuenow="1"',
      ),
      progressSegments:
        (html.match(/data-exercise-progress-segment=/g) || []).length,
      firstProgressSegment: html.includes(
        'data-exercise-progress-segment="1" data-complete="true"',
      ),
      secondProgressSegment: html.includes(
        'data-exercise-progress-segment="2" data-complete="false"',
      ),
      repeatedProgressText: html.includes(
        "Bước 1/2 · Chỉnh vị trí chân",
      ),
      difficultySegments:
        (html.match(/data-exercise-difficulty-segment=/g) || []).length,
      noPrevious: !html.includes("Bước trước"),
      noNext: !html.includes("Bước tiếp"),
    }).toEqual({
      recipeHero: true,
      name: true,
      image: true,
      muscleGroup: true,
      muscleGroupPill: true,
      muscleGroupIconHidden: true,
      communityRating: true,
      description: true,
      video: true,
      firstStep: true,
      secondStep: true,
      setupRail: true,
      firstStepActive: true,
      progressValue: true,
      progressSegments: 2,
      firstProgressSegment: true,
      secondProgressSegment: true,
      repeatedProgressText: false,
      difficultySegments: 5,
      noPrevious: true,
      noNext: true,
    });
  });
});
