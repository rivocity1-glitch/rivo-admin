import React, { useState } from "react";
import {
  Search,
  Download,
  CheckCircle,
  Eye,
  IndianRupee,
  Calendar,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../../lib/utils";

type SettlementStatus = "pending" | "paid";

interface Settlement {
  id: string;
  vendor: string;
  period: string;
  orders: number;
  gross: number;
  commission: number;
  net: number;
  status: SettlementStatus;
  dueDate: string;
}

const settlements: Settlement[] = [
  {
    id: "STL-0041",
    vendor: "Green Basket",
    period: "01–15 Jun 2025",
    orders: 284,
    gross: 82600,
    commission: 9912,
    net: 72688,
    status: "pending",
    dueDate: "20 Jun 2025",
  },
  {
    id: "STL-0040",
    vendor: "Quick Mart",
    period: "01–15 Jun 2025",
    orders: 412,
    gross: 134200,
    commission: 10736,
    net: 123464,
    status: "pending",
    dueDate: "20 Jun 2025",
  },
  {
    id: "STL-0039",
    vendor: "Dairy Direct",
    period: "01–15 Jun 2025",
    orders: 193,
    gross: 51800,
    commission: 5698,
    net: 46102,
    status: "paid",
    dueDate: "20 Jun 2025",
  },
  {
    id: "STL-0038",
    vendor: "Daily Grains",
    period: "16–31 May 2025",
    orders: 167,
    gross: 44100,
    commission: 4410,
    net: 39690,
    status: "paid",
    dueDate: "05 Jun 2025",
  },
  {
    id: "STL-0037",
    vendor: "Green Basket",
    period: "16–31 May 2025",
    orders: 260,
    gross: 77400,
    commission: 9288,
    net: 68112,
    status: "paid",
    dueDate: "05 Jun 2025",
  },
];

export function Settlements() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [settlementList, setSettlementList] = useState<Settlement[]>(settlements);
  const [viewDetail, setViewDetail] = useState<Settlement | null>(null);
  const itemsPerPage = 10;

  const filtered = settlementList.filter((s) => {
    const matchSearch =
      s.vendor.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function markPaid(id: string) {
    setSettlementList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "paid" } : s))
    );
  }

  const totalPending = settlementList
    .filter((s) => s.status === "pending")
    .reduce((acc, s) => acc + s.net, 0);

  return (
    <div>
      <PageHeader
        title="Settlements"
        description={`₹${totalPending.toLocaleString()} pending payout`}
        actions={
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Pending Settlements",
            value: settlementList.filter((s) => s.status === "pending").length,
            amount: `₹${totalPending.toLocaleString()}`,
            color: "text-amber-600",
            bg: "bg-amber-50 border-amber-200",
          },
          {
            label: "Paid This Month",
            value: settlementList.filter((s) => s.status === "paid").length,
            amount: `₹${settlementList.filter((s) => s.status === "paid").reduce((a, s) => a + s.net, 0).toLocaleString()}`,
            color: "text-green-600",
            bg: "bg-green-50 border-green-200",
          },
          {
            label: "Total Commission",
            value: "This period",
            amount: `₹${settlementList.reduce((a, s) => a + s.commission, 0).toLocaleString()}`,
            color: "text-blue-600",
            bg: "bg-blue-50 border-blue-200",
          },
        ].map((card) => (
          <div key={card.label} className={`border rounded-xl p-4 ${card.bg}`}>
            <p className="text-xs text-[#64748B] mb-1">{card.label}</p>
            <p className={`text-xl font-semibold ${card.color}`}>{card.amount}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{typeof card.value === "number" ? `${card.value} settlements` : card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or ID..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "pending", "paid"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium capitalize transition-all",
                statusFilter === s
                  ? "bg-[#22C55E] text-white"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Settlement ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Period</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Orders</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Gross</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Commission</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Net Payout</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((stl) => (
              <tr key={stl.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="px-4 py-3.5">
                  <span className="text-sm font-mono font-medium text-[#0F172A]">{stl.id}</span>
                </td>
                <td className="px-4 py-3.5 text-sm font-medium text-[#0F172A]">{stl.vendor}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
                    <Calendar className="w-3.5 h-3.5" />{stl.period}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-[#0F172A]">{stl.orders}</td>
                <td className="px-4 py-3.5 text-right text-sm text-[#0F172A]">₹{stl.gross.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right text-sm text-red-500">−₹{stl.commission.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold text-[#16A34A]">₹{stl.net.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3.5">
                  <Badge
                    variant={stl.status === "paid" ? "success" : "warning"}
                    label={stl.status === "paid" ? "Paid" : "Pending"}
                    dot
                  />
                </td>
                <td className="px-4 py-3.5">
                  <Dropdown
                    align="right"
                    trigger={
                      <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    }
                    items={[
                      {
                        label: "View Settlement",
                        icon: <Eye className="w-3.5 h-3.5" />,
                        onClick: () => setViewDetail(stl),
                      },
                      ...(stl.status === "pending"
                        ? [{
                            label: "Mark as Paid",
                            icon: <CheckCircle className="w-3.5 h-3.5" />,
                            onClick: () => markPaid(stl.id),
                          }]
                        : []),
                      {
                        label: "Export PDF",
                        icon: <Download className="w-3.5 h-3.5" />,
                        onClick: () => {},
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filtered.length / itemsPerPage)}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Settlement Detail Modal */}
      {viewDetail && (
        <Modal
          open={!!viewDetail}
          onClose={() => setViewDetail(null)}
          title={`Settlement ${viewDetail.id}`}
          description={`${viewDetail.vendor} • ${viewDetail.period}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewDetail(null)}>Close</Button>
              {viewDetail.status === "pending" && (
                <Button
                  variant="primary"
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  onClick={() => { markPaid(viewDetail.id); setViewDetail(null); }}
                >
                  Mark as Paid
                </Button>
              )}
              <Button variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
                Export PDF
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Vendor", value: viewDetail.vendor },
                { label: "Period", value: viewDetail.period },
                { label: "Total Orders", value: String(viewDetail.orders) },
                { label: "Due Date", value: viewDetail.dueDate },
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                  <p className="text-xs text-[#64748B] mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Payout Breakdown</p>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {[
                  { label: "Gross Revenue", value: `₹${viewDetail.gross.toLocaleString()}`, color: "text-[#0F172A]" },
                  { label: `Commission (${Math.round((viewDetail.commission / viewDetail.gross) * 100)}%)`, value: `−₹${viewDetail.commission.toLocaleString()}`, color: "text-red-500" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[#64748B]">{row.label}</span>
                    <span className={`text-sm font-medium ${row.color}`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 bg-[#F0FDF4]">
                  <span className="text-sm font-semibold text-[#0F172A]">Net Payout</span>
                  <span className="text-sm font-semibold text-[#16A34A]">₹{viewDetail.net.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
