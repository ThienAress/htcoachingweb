export const PracticeCenterLoadingState = () => (
  <section
    className="rounded-2xl border border-slate-200 bg-white p-6"
    role="status"
  >
    <p className="sr-only">Đang tải Trung tâm thực hành...</p>
    <div className="h-6 w-52 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="h-52 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      <div className="h-52 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
    </div>
  </section>
);
