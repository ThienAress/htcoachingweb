import { useEffect, useRef, useState } from "react";

import { shouldShowConversationNavigator } from "./conversationNavigatorRuntime";

const getActiveQuestionKey = (items, scrollContainer, getTarget) => {
  if (!items.length || !scrollContainer) return null;

  const containerRect = scrollContainer.getBoundingClientRect();
  const activationLine = containerRect.top + Math.min(120, scrollContainer.clientHeight * 0.25);
  let activeKey = items[0].key;

  for (const item of items) {
    const target = getTarget(item.key);
    if (!target) continue;
    if (target.getBoundingClientRect().top > activationLine) break;
    activeKey = item.key;
  }

  return activeKey;
};

export default function ConversationNavigator({
  items,
  scrollContainerRef,
  contentRef,
  getTarget,
  onNavigate,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeKey, setActiveKey] = useState(items[0]?.key ?? null);
  const itemsRef = useRef(items);
  const syncRef = useRef(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    if (!scrollContainer || !content) return undefined;

    let animationFrame = null;
    const sync = () => {
      const currentItems = itemsRef.current;
      setIsVisible(shouldShowConversationNavigator({
        clientHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        questionCount: currentItems.length,
      }));
      setActiveKey(getActiveQuestionKey(currentItems, scrollContainer, getTarget));
    };
    const scheduleSync = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        sync();
      });
    };
    syncRef.current = sync;

    sync();
    scrollContainer.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(scheduleSync)
      : null;
    resizeObserver?.observe(scrollContainer);
    resizeObserver?.observe(content);

    return () => {
      scrollContainer.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      resizeObserver?.disconnect();
      syncRef.current = null;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [contentRef, getTarget, scrollContainerRef]);

  useEffect(() => {
    itemsRef.current = items;
    syncRef.current?.();
  }, [items]);

  if (!isVisible) return null;

  const handleNavigate = (key) => {
    setActiveKey(key);
    onNavigate(key);
  };

  return (
    <nav
      aria-label="Điều hướng câu hỏi trong cuộc trò chuyện"
      className="group absolute right-1.5 top-1/2 z-20 hidden -translate-y-1/2 lg:flex"
    >
      <div className="flex flex-col items-end gap-0.5 rounded-full border border-gray-200/80 bg-white/90 px-1.5 py-2 shadow-sm dark:border-white/10 dark:bg-[#1e1f22]/90">
        {items.map((item, index) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item.key)}
              aria-label={`Đi tới câu hỏi ${index + 1}: ${item.label}`}
              aria-current={isActive ? "location" : undefined}
              className="flex h-3 w-7 items-center justify-end rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              <span
                aria-hidden="true"
                className={`h-0.5 rounded-full transition-[width,background-color] duration-150 motion-reduce:transition-none ${
                  isActive
                    ? "w-6 bg-gray-900 dark:bg-gray-100"
                    : "w-4 bg-gray-400 group-hover:bg-gray-500 dark:bg-gray-600 dark:group-hover:bg-gray-400"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="absolute right-full top-1/2 w-80 -translate-y-1/2 translate-x-2 pr-3 opacity-0 pointer-events-none transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none group-hover:translate-x-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#1e1f22]">
          <p className="border-b border-gray-100 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/8 dark:text-gray-400">
            Câu hỏi trong cuộc trò chuyện
          </p>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
            {items.map((item, index) => {
              const isActive = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleNavigate(item.key)}
                  aria-current={isActive ? "location" : undefined}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/8"
                  }`}
                >
                  <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-gray-400 dark:text-gray-500">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
