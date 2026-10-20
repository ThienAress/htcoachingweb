// Tiêu đề gọn cho các trang làm việc trong khu HLV: biểu tượng + tên trang bên trái, thao tác bên phải.
const WorkspacePageHeader = ({ icon: Icon, title, description, actions }) => (
  <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="flex items-center gap-2.5 font-display text-2xl font-black uppercase tracking-normal text-white sm:text-3xl">
        {Icon && (
          <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" />
        )}
        <span className="min-w-0">{title}</span>
      </h1>
      {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export default WorkspacePageHeader;
