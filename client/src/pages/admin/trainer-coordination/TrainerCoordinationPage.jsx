import { useState } from "react";
import { ArrowRightLeft, ClipboardList } from "lucide-react";

import RecentOrdersPanel from "./components/RecentOrdersPanel";
import TrainerTransferPanel from "./components/TrainerTransferPanel";

const TABS = [
  { key: "orders", label: "Đơn mới — 30 ngày", icon: ClipboardList },
  { key: "transfer", label: "Chuyển HLV", icon: ArrowRightLeft },
];

const TrainerCoordinationPage = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const startTransfer = (assignment) => {
    setSelectedAssignment(assignment);
    setActiveTab("transfer");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="max-w-3xl">
        <p className="mb-2 text-sm font-semibold text-cyan-700">Vận hành khách hàng</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Điều phối HLV
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Theo dõi đơn mới và chuyển quyền quản lý khách hàng với bước xem trước bắt buộc.
        </p>
      </header>

      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
        role="tablist"
        aria-label="Nội dung điều phối HLV"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`trainer-coordination-${key}`}
            onClick={() => setActiveTab(key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 ${
              activeTab === key
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:bg-slate-200 hover:text-slate-950"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <section
        id="trainer-coordination-orders"
        role="tabpanel"
        hidden={activeTab !== "orders"}
      >
        {activeTab === "orders" && <RecentOrdersPanel onStartTransfer={startTransfer} />}
      </section>
      <section
        id="trainer-coordination-transfer"
        role="tabpanel"
        hidden={activeTab !== "transfer"}
      >
        {activeTab === "transfer" && (
          <TrainerTransferPanel initialAssignment={selectedAssignment} />
        )}
      </section>
    </div>
  );
};

export default TrainerCoordinationPage;
