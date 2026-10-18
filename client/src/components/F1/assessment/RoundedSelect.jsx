// RoundedSelect.jsx — ô chọn bo góc thay cho <select> gốc của trình duyệt
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

const triggerClass =
  "flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm outline-none transition focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60";

// Khi trang tự truyền triggerClassName (giữ kiểu dáng ô chọn cũ) thì chỉ giữ phần bố cục chung.
const triggerLayoutClass =
  "flex w-full items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60";

const TONES = {
  light: {
    selectedText: "text-slate-800",
    placeholderText: "text-slate-400",
    chevron: "text-slate-400",
    list: "border-slate-200 bg-white shadow-lg",
    empty: "text-slate-500",
    option: "text-slate-700",
    optionActive: "bg-orange-50 text-orange-700",
    optionDisabled: "text-slate-300",
    check: "text-orange-600",
    group: "text-slate-400",
  },
  auto: {
    selectedText: "",
    placeholderText: "text-slate-400 dark:text-zinc-500",
    chevron: "text-slate-400 dark:text-zinc-500",
    list: "border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40",
    empty: "text-slate-500 dark:text-zinc-400",
    option: "text-slate-700 dark:text-zinc-200",
    optionActive: "bg-orange-50 text-orange-700 dark:bg-zinc-800 dark:text-orange-300",
    optionDisabled: "text-slate-300 dark:text-zinc-600",
    check: "text-orange-600 dark:text-orange-400",
    group: "text-slate-400 dark:text-zinc-500",
  },
  dark: {
    selectedText: "",
    placeholderText: "text-gray-400",
    chevron: "text-gray-400",
    list: "border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40",
    empty: "text-zinc-400",
    option: "text-zinc-200",
    optionActive: "bg-zinc-800 text-orange-300",
    optionDisabled: "text-zinc-600",
    check: "text-orange-400",
    group: "text-zinc-500",
  },
};

const LIST_MAX_HEIGHT = 256;
const LIST_GAP = 6;
const VIEWPORT_MARGIN = 8;

// Lớp xếp chồng của danh sách phải cao hơn hộp thoại chứa ô chọn (có hộp thoại dùng z-100 trở lên).
const stackLevelAbove = (element) => {
  let level = 60;
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const z = Number.parseInt(window.getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(z)) level = Math.max(level, z + 1);
  }
  return level;
};

// Danh sách hiện ở lớp ngoài cùng (portal) để không bị thẻ cha có overflow cắt mất.
const computeListStyle = (trigger) => {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - LIST_GAP - VIEWPORT_MARGIN;
  const above = rect.top - LIST_GAP - VIEWPORT_MARGIN;
  const openUp = below < 160 && above > below;
  const maxHeight = Math.max(Math.min(LIST_MAX_HEIGHT, openUp ? above : below), 96);
  return {
    position: "fixed",
    zIndex: stackLevelAbove(trigger),
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(openUp
      ? { bottom: window.innerHeight - rect.top + LIST_GAP }
      : { top: rect.bottom + LIST_GAP }),
  };
};

const RoundedSelect = ({
  value,
  onChange,
  options: allOptions = [],
  placeholder = "Chọn",
  label,
  disabled = false,
  emptyText = "Không có lựa chọn",
  id,
  tone = "light",
  triggerClassName,
  buttonProps,
}) => {
  const colors = TONES[tone] || TONES.light;
  // Mục ẩn (hidden) chỉ để hiển thị nhãn khi dữ liệu cũ đang chọn; không có trong danh sách.
  const options = useMemo(() => allOptions.filter((item) => !item.hidden), [allOptions]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listStyle, setListStyle] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selectedIndex = useMemo(
    () => options.findIndex((item) => item.value === value),
    [options, value],
  );
  const selected =
    selectedIndex >= 0
      ? options[selectedIndex]
      : allOptions.find((item) => item.value === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const inside =
        rootRef.current?.contains(event.target) ||
        listRef.current?.contains(event.target);
      if (!inside) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const trigger = rootRef.current;
    const update = () => setListStyle(computeListStyle(trigger));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange?.(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = options.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, last));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        {...buttonProps}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={
          triggerClassName
            ? `${triggerLayoutClass} ${triggerClassName}`
            : `${triggerClass} ${
                open ? "border-orange-400 ring-2 ring-orange-100" : "border-slate-200"
              }`
        }
      >
        <span
          className={`min-w-0 truncate ${
            selected ? colors.selectedText : colors.placeholderText
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 ${colors.chevron} transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && listStyle && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          style={listStyle}
          className={`overflow-y-auto overscroll-contain rounded-xl border p-1.5 ${colors.list}`}
        >
          {options.length === 0 && (
            <li className={`px-3 py-2 text-sm ${colors.empty}`}>{emptyText}</li>
          )}
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const showGroup = option.group && option.group !== options[index - 1]?.group;
            return (
              <Fragment key={option.value}>
                {showGroup && (
                  <li role="presentation" className={`px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide ${colors.group}`}>
                    {option.group}
                  </li>
                )}
              <li
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  option.disabled
                    ? `cursor-not-allowed ${colors.optionDisabled}`
                    : `cursor-pointer ${
                        index === activeIndex ? colors.optionActive : colors.option
                      }`
                } ${isSelected ? "font-semibold" : ""}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={15} className={`shrink-0 ${colors.check}`} />}
              </li>
              </Fragment>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
};

export default RoundedSelect;
