import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ==================== FONT TIẾNG VIỆT ====================
import NotoSansRegular from "../../assets/fonts/NotoSans-Regular.ttf";
import NotoSansBold from "../../assets/fonts/NotoSans-Bold.ttf";

Font.register({
  family: "Noto Sans",
  fonts: [
    { src: NotoSansRegular, fontWeight: "normal" },
    { src: NotoSansBold, fontWeight: "bold" },
  ],
});

const FONT_FAMILY = "Noto Sans";

// ==================== DARK LUXURY THEME ====================
const COLORS = {
  bg: "#FFFFFF",
  panel: "#131417",
  panel2: "#1A1C20",
  line: "#2A2D33",
  lineSoft: "#23262B",
  gold: "#C8A96B",
  goldDark: "#9E7D44",
  goldSoft: "#F1E2BE",
  white: "#F9FAFB",
  text: "#E5E7EB",
  muted: "#9CA3AF",
  muted2: "#6B7280",
  black: "#000000",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 42,
    paddingHorizontal: 28,
    backgroundColor: COLORS.bg,
    fontFamily: FONT_FAMILY,
    color: COLORS.text,
  },

  // ===== Header =====
  header: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  brandBadge: {
    backgroundColor: COLORS.gold,
    color: COLORS.black,
    fontSize: 8,
    fontWeight: "bold",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    letterSpacing: 0.8,
  },
  premiumBadge: {
    borderWidth: 1,
    borderColor: COLORS.goldDark,
    color: COLORS.goldSoft,
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  titleAccent: {
    color: COLORS.gold,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 14,
    lineHeight: 1.45,
  },
  metaRow: {
    flexDirection: "row",
  },
  metaCard: {
    flex: 1,
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  metaCardLast: {
    marginRight: 0,
  },
  metaLabel: {
    fontSize: 7.5,
    color: COLORS.muted2,
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: "bold",
  },

  // ===== Workout group =====
  workoutGroup: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    backgroundColor: COLORS.panel,
    padding: 14,
  },
  groupHero: {
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  groupTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  workoutDayBadge: {
    backgroundColor: COLORS.gold,
    color: COLORS.black,
    fontSize: 8,
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  groupDate: {
    fontSize: 9,
    color: COLORS.muted,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 3,
  },
  groupSubtitle: {
    fontSize: 9,
    color: COLORS.muted,
    lineHeight: 1.4,
  },

  // ===== Section =====
  sectionWrap: {
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionBar: {
    width: 4,
    height: 14,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    marginRight: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  sectionTag: {
    marginLeft: 8,
    fontSize: 7.5,
    color: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: COLORS.goldDark,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 20,
  },

  // ===== Table =====
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  headerCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.black,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lineSoft,
  },
  rowEven: {
    backgroundColor: COLORS.panel,
  },
  rowOdd: {
    backgroundColor: "#16181C",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    fontSize: 8.5,
    color: COLORS.text,
    paddingHorizontal: 4,
    lineHeight: 1.35,
  },
  cellCenter: {
    textAlign: "center",
  },

  exerciseCellWrap: {
    flexDirection: "row",
  },
  exerciseIndex: {
    width: 16,
    fontSize: 7,
    color: COLORS.gold,
    marginTop: 1,
    marginRight: 4,
  },
  exerciseName: {
    fontSize: 8.7,
    color: COLORS.white,
    fontWeight: "bold",
    marginBottom: 2,
  },
  tipText: {
    fontSize: 7.5,
    color: COLORS.muted,
    lineHeight: 1.35,
  },

  // ===== Empty state =====
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    color: COLORS.gold,
    fontWeight: "bold",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 10,
    color: COLORS.muted,
  },

  // ===== Footer =====
  footer: {
    position: "absolute",
    bottom: 20,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: COLORS.muted2,
  },
  pageNumber: {
    fontSize: 8,
    color: COLORS.muted2,
  },

  // ===== Columns =====
  colEx: { flex: 3.2 },
  colSets: { flex: 0.75 },
  colReps: { flex: 0.8 },
  colTempo: { flex: 0.95 },
  colDuration: { flex: 1.0 },
  colTips: { flex: 2.2 },
});

const getSectionLabel = (sectionId) => {
  if (sectionId === "warmUp") return "Warm Up";
  if (sectionId === "cooldown") return "Cooldown";
  return "Main Workout";
};

const getTableConfig = (sectionId) => {
  if (sectionId === "warmUp" || sectionId === "cooldown") {
    return {
      columns: ["Exercises", "Sets", "Duration", "Coaching Tips"],
      widths: ["colEx", "colSets", "colDuration", "colTips"],
      renderRow: (ex) => [
        ex.name || "",
        ex.sets || "",
        ex.duration || "",
        ex.tips || "",
      ],
    };
  }

  return {
    columns: [
      "Exercises",
      "Sets",
      "Reps",
      "Tempo",
      "Duration",
      "Coaching Tips",
    ],
    widths: [
      "colEx",
      "colSets",
      "colReps",
      "colTempo",
      "colDuration",
      "colTips",
    ],
    renderRow: (ex) => [
      ex.name || "",
      ex.sets || "",
      ex.reps || "",
      ex.tempo || "",
      ex.duration || "",
      ex.tips || "",
    ],
  };
};

const renderExerciseCell = (value, rowIdx) => (
  <View style={styles.exerciseCellWrap}>
    <Text style={styles.exerciseIndex}>
      {String(rowIdx + 1).padStart(2, "0")}
    </Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.exerciseName}>{value || "-"}</Text>
    </View>
  </View>
);

const renderTipCell = (value) => (
  <Text style={styles.tipText}>{value || "-"}</Text>
);

const WorkoutPlanPDF = ({ planData, date }) => {
  if (!planData || !Array.isArray(planData) || planData.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>HT COACHING</Text>
            <Text style={styles.emptyText}>Không có dữ liệu lịch tập.</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {planData.map((group, groupIdx) => (
        <Page key={groupIdx} size="A4" style={styles.page}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.brandBadge}>HT COACHING</Text>
            </View>

            <Text style={styles.title}>
              Workout <Text style={styles.titleAccent}>Plan</Text>
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>NGÀY TẠO</Text>
                <Text style={styles.metaValue}>
                  {date || new Date().toLocaleDateString("vi-VN")}
                </Text>
              </View>

              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>NHÓM CƠ</Text>
                <Text style={styles.metaValue}>
                  {group.muscleGroup || "Nhóm cơ"}
                </Text>
              </View>

              <View style={[styles.metaCard, styles.metaCardLast]}>
                <Text style={styles.metaLabel}>NGÀY TẬP</Text>
                <Text style={styles.metaValue}>{group.date || "..."}</Text>
              </View>
            </View>
          </View>

          {/* GROUP */}
          <View style={styles.workoutGroup}>
            <View style={styles.groupHero}>
              <View style={styles.groupTopRow}>
                <Text style={styles.workoutDayBadge}>WORKOUT DAY</Text>
                <Text style={styles.groupDate}>
                  Session Date: {group.date || "..."}
                </Text>
              </View>

              <Text style={styles.groupTitle}>
                {group.muscleGroup || "Nhóm cơ"}
              </Text>
              <Text style={styles.groupSubtitle}>
                Kế hoạch tập luyện cá nhân hóa, rõ ràng, trực quan và dễ theo
                dõi trong từng buổi tập.
              </Text>
            </View>

            {group.sections?.map((section, sIdx) => {
              if (!section.data?.length) return null;

              const { columns, widths, renderRow } = getTableConfig(section.id);

              return (
                <View key={sIdx} wrap={false} style={styles.sectionWrap}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBar} />
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionTag}>
                      {getSectionLabel(section.id)}
                    </Text>
                  </View>

                  <View style={styles.table}>
                    {/* Header */}
                    <View style={styles.tableHeader}>
                      {columns.map((col, i) => (
                        <Text
                          key={i}
                          style={[
                            styles.headerCell,
                            styles[widths[i]],
                            i > 0 ? styles.cellCenter : null,
                          ]}
                        >
                          {col}
                        </Text>
                      ))}
                    </View>

                    {/* Rows */}
                    {section.data.map((ex, rowIdx) => {
                      const rowData = renderRow(ex);
                      const isLast = rowIdx === section.data.length - 1;

                      return (
                        <View
                          key={rowIdx}
                          style={[
                            styles.tableRow,
                            rowIdx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                            isLast ? styles.rowLast : null,
                          ]}
                        >
                          {rowData.map((value, i) => {
                            const widthKey = widths[i];
                            const isExercise = i === 0;
                            const isTip = widthKey === "colTips";
                            const shouldCenter = !isExercise && !isTip;

                            return (
                              <View key={i} style={[styles[widthKey]]}>
                                {isExercise ? (
                                  renderExerciseCell(value, rowIdx)
                                ) : isTip ? (
                                  renderTipCell(value)
                                ) : (
                                  <Text
                                    style={[
                                      styles.cell,
                                      shouldCenter ? styles.cellCenter : null,
                                    ]}
                                  >
                                    {value || "-"}
                                  </Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* FOOTER */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              HT Coaching • Luxury Performance System
            </Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) =>
                `Trang ${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default WorkoutPlanPDF;
