import React, { useState } from "react";
import {
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { Textarea } from "../ui/Input";
import { cn } from "../../../lib/utils";

type RefundStatus = "pending" | "approved" | "rejected" | "escalated";

interface Refund {
  id: string;
  orderId: string;
  customer: string;
  vendor: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  details: string;
}

const refunds: Refund[] = [
  {
    id: "REF-0094",
    orderId: "RIV-4809",
    customer: "Kiran Patel",
    vendor: "Green Basket",
    amount: 210,
    reason: "Wrong items delivered",
    status: "pending",
    requestedAt: "14 Jun 2025",
    details: "Customer received different brand of atta instead of ordered product.",
  },
  {
    id: "REF-0093",
    orderId: "RIV-4791",
    customer: "Ananya Sharma",
    vendor: "Quick Mart",
    amount: 480,
    reason: "Items expired / damaged",
    status: "pending",
    requestedAt: "13 Jun 2025",
    details: "Milk packets delivered were past expiry date. Customer has photos.",
  },
  {
    id: "REF-0092",
    orderId: "RIV-4783",
    customer: "Meera Iyer",
    vendor: "Daily Grains",
    amount: 1240,
    reason: "Order never arrived",
    status: "escalated",
    requestedAt: "12 Jun 2025",
    details: "Rider marked delivered but customer did not receive. OTP not verified.",
  },
  {
    id: "REF-0091",
    orderId: "RIV-4770",
    customer: "Lakshmi Venkat",
    vendor: "Dairy Direct",
    amount: 320,
    reason: "Partial delivery",
    status: "approved",
    requestedAt: "11 Jun 2025",
    details: "3 of 6 items were missing from the delivery bag.",
  },
  {
    id: "REF-0090",
    orderId: "RIV-4755",
    customer: "Rohan Desai",
    vendor: "Spice World",
    amount: 150,
    reason: "Changed mind",
    status: "rejected",
    requestedAt: "10 Jun 2025",
    details: "Customer wants to cancel after order was already prepared.",
  },
];

const statusConfig: Record<RefundStatus, { variant: any; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
  escalated: { variant: "purple", label: "Escalated" },
};

export function Refunds() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [refundList, setRefundList] = useState<Refund[]>(refunds);
  const [viewRefund, setViewRefund] = useState<Refund | null>(null);
  const [actionModal, setActionModal] = useState<{ refund: Refund; action: "approve" | "reject" | "escalate" } | null>(null);
  const [note, setNote] = useState("");
  const itemsPerPage = 10;

  const filtered = refundList.filter((r) => {
    const matchSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.orderId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function applyAction(id: string, status: RefundStatus) {
    setRefundList((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setActionModal(null);
    setNote("");
  }

  const pendingCount = refundList.filter((r) => r.status === "pending").length;
  const pendingAmount = refundList.filter((r) => r.status === "pending").reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Refunds"
        description={`${pendingCount} pending refunds · ₹${pendingAmount.toLocaleString()} queued`}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search refunds..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "pending", "approved", "rejected", "escalated"].map((s) => (
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
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Ref ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Order</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vendor</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Reason</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Requested</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((refund) => {
              const s = statusConfig[refund.status];
              return (
                <tr key={refund.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-mono font-medium text-[#0F172A]">{refund.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-mono text-[#64748B]">#{refund.orderId}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-[#0F172A]">{refund.customer}</td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{refund.vendor}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-semibold text-red-600">₹{refund.amount}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-[#64748B] max-w-[150px] truncate block">{refund.reason}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={s.variant} label={s.label} dot />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{refund.requestedAt}</td>
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
                          label: "View Details",
                          icon: <Eye className="w-3.5 h-3.5" />,
                          onClick: () => setViewRefund(refund),
                        },
                        ...(refund.status === "pending"
                          ? [
                              {
                                label: "Approve Refund",
                                icon: <CheckCircle className="w-3.5 h-3.5" />,
                                onClick: () => setActionModal({ refund, action: "approve" }),
                              },
                              {
                                label: "Reject Refund",
                                icon: <XCircle className="w-3.5 h-3.5" />,
                                onClick: () => setActionModal({ refund, action: "reject" }),
                                variant: "danger" as const,
                              },
                              {
                                label: "Escalate",
                                icon: <AlertTriangle className="w-3.5 h-3.5" />,
                                onClick: () => setActionModal({ refund, action: "escalate" }),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
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

      {/* View Details Modal */}
      {viewRefund && (
        <Modal
          open={!!viewRefund}
          onClose={() => setViewRefund(null)}
          title={`Refund ${viewRefund.id}`}
          description={`Order #${viewRefund.orderId} • ${viewRefund.requestedAt}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewRefund(null)}>Close</Button>
              {viewRefund.status === "pending" && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => { setViewRefund(null); setActionModal({ refund: viewRefund, action: "reject" }); }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => { setViewRefund(null); setActionModal({ refund: viewRefund, action: "approve" }); }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Customer", value: viewRefund.customer },
                { label: "Vendor", value: viewRefund.vendor },
                { label: "Amount", value: `₹${viewRefund.amount}` },
                { label: "Status", value: statusConfig[viewRefund.status].label },
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                  <p className="text-xs text-[#64748B] mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">Reason</p>
              <p className="text-sm text-[#0F172A]">{viewRefund.reason}</p>
              <p className="text-sm text-[#64748B] mt-1">{viewRefund.details}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Action Modal */}
      {actionModal && (
        <Modal
          open={!!actionModal}
          onClose={() => setActionModal(null)}
          title={
            actionModal.action === "approve"
              ? "Approve Refund"
              : actionModal.action === "reject"
              ? "Reject Refund"
              : "Escalate Refund"
          }
          description={`${actionModal.refund.id} · ₹${actionModal.refund.amount} · ${actionModal.refund.customer}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button
                variant={actionModal.action === "approve" ? "primary" : actionModal.action === "reject" ? "destructive" : "secondary"}
                onClick={() =>
                  applyAction(
                    actionModal.refund.id,
                    actionModal.action === "approve"
                      ? "approved"
                      : actionModal.action === "reject"
                      ? "rejected"
                      : "escalated"
                  )
                }
              >
                {actionModal.action === "approve" ? "Approve" : actionModal.action === "reject" ? "Reject" : "Escalate"}
              </Button>
            </>
          }
        >
          <Textarea
            label="Admin Note (optional)"
            placeholder="Add a note for this action..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </Modal>
      )}
    </div>
  );
}
