import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  ShoppingBag,
  ArrowRight
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type RefundStatus = "pending" | "processing" | "approved" | "rejected";

interface Refund {
  id: string;
  refund_display_id: string;
  orderDisplayId: string;
  customerName: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  date: string;
  processedDate: string;
}

export function Refunds() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [refundList, setRefundList] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [summary, setSummary] = useState({
    pendingCount: 0,
    totalRefundedAmount: 0
  });

  const itemsPerPage = 10;

  async function fetchRefunds() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("refunds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Refund[] = (data || []).map((row) => ({
        id: row.id,
        refund_display_id: row.refund_display_id || "REF-0000",
        orderDisplayId: row.order_display_id || "—",
        customerName: row.customer_name || "Unknown Customer",
        amount: row.amount || 0,
        reason: row.reason || "No reason specified",
        status: (row.status as RefundStatus) || "pending",
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "—",
        processedDate: row.processed_at ? new Date(row.processed_at).toLocaleDateString("en-GB") : "—"
      }));

      setRefundList(mapped);

      // Compute total aggregates
      const pending = mapped.filter(r => r.status === "pending" || r.status === "processing").length;
      const totalRefunded = mapped.filter(r => r.status === "approved").reduce((acc, curr) => acc + curr.amount, 0);

      setSummary({
        pendingCount: pending,
        totalRefundedAmount: totalRefunded
      });
    } catch (err) {
      console.error("Failed fetching ledger data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRefunds();
  }, []);

  async function handleUpdateStatus(id: string, nextStatus: RefundStatus) {
    const confirmation = window.confirm(`Are you sure you want to change this refund status to ${nextStatus}?`);
    if (!confirmation) return;

    try {
      setIsSubmitting(true);
      const payload: any = { status: nextStatus };
      if (nextStatus === "approved" || nextStatus === "rejected") {
        payload.processed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("refunds").update(payload).eq("id", id);
      if (error) throw error;

      await fetchRefunds();
    } catch (err) {
      console.error("Status modification failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = refundList.filter((r) => {
    const matchSearch =
      r.refund_display_id.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.orderDisplayId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader title="Refund Management" description="Process system cashbacks and evaluate client claim histories." />

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Awaiting Review</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{summary.pendingCount} requests</h3>
          </div>
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><AlertCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#16A34A] uppercase tracking-wider">Total Disbursed Capital</p>
            <h3 className="text-2xl font-bold text-[#16A34A] mt-1">₹{summary.totalRefundedAmount.toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><CheckCircle2 className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filters..."
            className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
          />
        </div>
        <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-white">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn("h-7 px-3 rounded-md text-xs font-medium capitalize", statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B]")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Data Layout */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Refund ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Order reference</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer Account</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Claim Cause Reason</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Value</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">Syncing audit histories...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">No matching items verified.</td></tr>
            ) : (
              paginated.map((r) => (
                <tr key={r.id} className="hover:bg-[#FAFAFA] text-sm text-[#334155]">
                  <td className="px-4 py-3.5 font-mono font-medium text-[#0F172A]">#{r.refund_display_id}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-[#64748B]">#{r.orderDisplayId}</td>
                  <td className="px-4 py-3.5 font-medium text-[#0F172A]">{r.customerName}</td>
                  <td className="px-4 py-3.5 text-xs text-[#64748B] max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-rose-600 font-mono">₹{r.amount.toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <Badge 
                      variant={r.status === "approved" ? "success" : r.status === "rejected" ? "error" : "warning"} 
                      label={r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Awaiting Review"} 
                      dot 
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                    {r.status === "pending" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(r.id, "rejected")} disabled={isSubmitting}>Reject</Button>
                        <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(r.id, "approved")} disabled={isSubmitting}>Approve</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>
    </div>
  );
}