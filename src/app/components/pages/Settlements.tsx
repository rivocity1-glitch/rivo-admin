import React, { useState, useEffect } from "react";
import {
  Search,
  IndianRupee,
  Store,
  Bike,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCcw,
  Calendar,
  DollarSign
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type SettlementType = "vendors" | "riders";
type DatabaseSettlementStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

interface VendorSettlement {
  id: string;
  vendorId: string;
  vendorName: string;
  period: string; // Satisfied safely using fallback strings or statement cycle references
  totalSales: number; // Remapped to amount to fit the standard grid view smoothly
  commission: number; // Remapped cleanly to static display or structural fallback zero
  amountDue: number; // Remapped to amount
  status: DatabaseSettlementStatus;
  date: string; // Maps to paid_at
  remarks: string;
}

interface RiderSettlement {
  id: string;
  riderId: string;
  riderName: string;
  totalTrips: number; // Maps to delivery_count
  earnings: number; // Maps to amount
  status: DatabaseSettlementStatus;
  date: string; // Maps to paid_at
  remarks: string;
}

export function Settlements() {
  const [activeTab, setActiveTab] = useState<SettlementType>("vendors");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vendorPayouts, setVendorPayouts] = useState<VendorSettlement[]>([]);
  const [riderPayouts, setRiderPayouts] = useState<RiderSettlement[]>([]);
  
  const [summary, setSummary] = useState({
    pendingVendorPayouts: 0,
    totalCommissionCollected: 0,
    pendingRiderPayouts: 0
  });

  const itemsPerPage = 10;

  // 🟢 Fetch Financial Records
  async function fetchSettlements() {
    try {
      setIsLoading(true);
      
      // 1. Pull Vendor Ledgers with implicit vendor relations join
      const { data: vData, error: vErr } = await supabase
        .from("vendor_settlements")
        .select(`
          *,
          vendors:vendor_id (
            shop_name
          )
        `)
        .order("created_at", { ascending: false });
        
      if (vErr) throw vErr;

      // 2. Pull Rider Ledgers with implicit rider relations join
      const { data: rData, error: rErr } = await supabase
        .from("rider_settlements")
        .select(`
          *,
          riders:rider_id (
            rider_name
          )
        `)
        .order("created_at", { ascending: false });

      if (rErr) throw rErr;

      // Map datasets cleanly to current UI model structures
      const mappedVendors: VendorSettlement[] = (vData || []).map((v: any) => ({
        id: v.id,
        vendorId: v.vendor_id,
        vendorName: v.vendors?.shop_name || "Unknown Store",
        period: v.created_at ? `Cycle: ${new Date(v.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "Statement Cycle",
        totalSales: v.amount || 0,
        commission: 0, // Outdated explicit table metadata fallback
        amountDue: v.amount || 0,
        status: v.status as DatabaseSettlementStatus,
        date: v.paid_at ? new Date(v.paid_at).toLocaleDateString("en-GB") : "—",
        remarks: v.remarks || ""
      }));

      const mappedRiders: RiderSettlement[] = (rData || []).map((r: any) => ({
        id: r.id,
        riderId: r.rider_id,
        riderName: r.riders?.rider_name || "Unknown Rider",
        totalTrips: r.delivery_count || 0,
        earnings: r.amount || 0,
        status: r.status as DatabaseSettlementStatus,
        date: r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-GB") : "—",
        remarks: r.remarks || ""
      }));

      setVendorPayouts(mappedVendors);
      setRiderPayouts(mappedRiders);

      // Compute aggregates summary values leveraging database metrics mappings
      const pendingV = mappedVendors.filter(v => v.status !== "paid").reduce((acc, current) => acc + current.amountDue, 0);
      const totalComm = 0; // Legacy metadata column aggregate fallback safely bound to 0
      const pendingR = mappedRiders.filter(r => r.status !== "paid").reduce((acc, current) => acc + current.earnings, 0);

      setSummary({
        pendingVendorPayouts: pendingV,
        totalCommissionCollected: totalComm,
        pendingRiderPayouts: pendingR
      });

    } catch (err) {
      console.error("Failed fetching financial ledgers data stream:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSettlements();
  }, []);

  // 🟢 Trigger Settlement Pay Cycle Action and append Ledger Entry
  async function handleExecutePayout(id: string, type: SettlementType) {
    const confirmation = window.confirm("Mark this ledger balance as fully paid and close transaction?");
    if (!confirmation) return;

    try {
      setIsSubmitting(true);
      const tableName = type === "vendors" ? "vendor_settlements" : "rider_settlements";
      const paidTimestamp = new Date().toISOString();
      
      // 1. Authorize settlement update query context state
      const { data: updatedRows, error: updateError } = await supabase
        .from(tableName)
        .update({ status: "paid", paid_at: paidTimestamp })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 2. Transact real-time financial ledger entry cleanly on target confirmation data metrics
      if (updatedRows) {
        const ledgerPayload = {
          entity_type: type === "vendors" ? "vendor" : "rider",
          entity_id: type === "vendors" ? updatedRows.vendor_id : updatedRows.rider_id,
          transaction_type: type === "vendors" ? "vendor_payout" : "rider_payout",
          amount: updatedRows.amount || 0,
          reference_id: updatedRows.id,
          remarks: updatedRows.remarks || `Settlement payout finalized on ${new Date(paidTimestamp).toLocaleDateString("en-GB")}`
        };

        const { error: ledgerError } = await supabase
          .from("financial_ledger")
          .insert([ledgerPayload]);

        if (ledgerError) {
          console.error("[CRITICAL] Financial ledger statement construction rejected:", ledgerError);
        }
      }

      await fetchSettlements();
    } catch (err) {
      console.error("Failed completing payout transaction cycle:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Maps UI component filter configurations back to structural DB properties cleanly
  const mapFilterStatus = (uiFilter: string): string => {
    if (uiFilter === "unpaid") return "pending";
    if (uiFilter === "settled") return "paid";
    return uiFilter;
  };

  const filteredVendors = vendorPayouts.filter(v => {
    const matchSearch = v.vendorName.toLowerCase().includes(search.toLowerCase());
    const dbTargetStatus = mapFilterStatus(statusFilter);
    const matchStatus = statusFilter === "all" || v.status === dbTargetStatus;
    return matchSearch && matchStatus;
  });

  const filteredRiders = riderPayouts.filter(r => {
    const matchSearch = r.riderName.toLowerCase().includes(search.toLowerCase());
    const dbTargetStatus = mapFilterStatus(statusFilter);
    const matchStatus = statusFilter === "all" || r.status === dbTargetStatus;
    return matchSearch && matchStatus;
  });

  const paginatedVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedRiders = filteredRiders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlements & Payouts"
        description="Oversee commission collections and authorize outstanding service payouts."
      />

      {/* Aggregate Overview Summaries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Unpaid Store Sales</p>
          <h3 className="text-2xl font-bold text-[#0F172A] mt-1">₹{summary.pendingVendorPayouts.toLocaleString()}</h3>
          <p className="text-xs text-[#94A3B8] mt-1.5">Awaiting payroll clearance</p>
        </div>
        <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#16A34A] uppercase tracking-wider">Platform Commissions Earned</p>
          <h3 className="text-2xl font-bold text-[#16A34A] mt-1">₹{summary.totalCommissionCollected.toLocaleString()}</h3>
          <p className="text-xs text-[#16A34A] font-medium mt-1.5">Collected from closed vendor jobs</p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Unpaid Rider Delivery Fees</p>
          <h3 className="text-2xl font-bold text-[#0F172A] mt-1">₹{summary.pendingRiderPayouts.toLocaleString()}</h3>
          <p className="text-xs text-[#94A3B8] mt-1.5">Fleet performance balance due</p>
        </div>
      </div>

      {/* Primary Tab Sorters Row elements */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab("vendors"); setStatusFilter("all"); setCurrentPage(1); }}
            className={cn("pb-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5", activeTab === "vendors" ? "border-[#22C55E] text-[#16A34A]" : "border-transparent text-[#64748B]")}
          >
            <Store className="w-4 h-4" /> Store Payouts Log
          </button>
          <button
            onClick={() => { setActiveTab("riders"); setStatusFilter("all"); setCurrentPage(1); }}
            className={cn("pb-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5", activeTab === "riders" ? "border-[#22C55E] text-[#16A34A]" : "border-transparent text-[#64748B]")}
          >
            <Bike className="w-4 h-4" /> Rider Earnings Log
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parameters..."
              className="h-8 pl-8 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-xs w-48 focus:outline-none focus:border-[#22C55E]"
            />
          </div>
          <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-white h-8 items-center">
            {["all", "unpaid", "settled"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={cn("h-6 px-2.5 rounded-md text-[11px] font-medium capitalize", statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B]")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Interface Grid view frames links context logic mapping structures */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10">
        {activeTab === "vendors" ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Store Details</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Statement Cycle Period</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Gross Volume</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rivo Commission Cut</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Net Payout Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Settlement Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-xs text-[#94A3B8]">Syncing store payout accounts parameters...</td></tr>
              ) : paginatedVendors.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-xs text-[#94A3B8]">No matching vendor payout entries located.</td></tr>
              ) : (
                paginatedVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-[#FAFAFA] text-sm text-[#334155]">
                    <td className="px-4 py-3.5 font-medium text-[#0F172A]">{v.vendorName}</td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] flex items-center gap-1 mt-1"><Calendar className="w-3 h-3 text-[#94A3B8]" /> {v.period}</td>
                    <td className="px-4 py-3.5 text-right font-mono">₹{v.totalSales.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-rose-600">-₹{v.commission.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-600 font-mono">₹{v.amountDue.toFixed(2)}</td>
                    <td className="px-4 py-3.5"><Badge variant={v.status === "paid" ? "success" : v.status === "processing" ? "info" : "warning"} label={v.status === "paid" ? "Settled" : v.status === "processing" ? "Processing" : "Awaiting Pay"} dot /></td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B]">{v.date}</td>
                    <td className="px-4 py-3.5 text-right">
                      {v.status !== "paid" && (
                        <Button variant="primary" size="sm" onClick={() => handleExecutePayout(v.id, "vendors")} disabled={isSubmitting}>Clear Payout</Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rider Companion</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Fulfills Jobs</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Accumulated Earnings</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Settlement Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-xs text-[#94A3B8]">Syncing fleet delivery earnings indexes...</td></tr>
              ) : paginatedRiders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-xs text-[#94A3B8]">No matching rider earnings rows located.</td></tr>
              ) : (
                paginatedRiders.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FAFAFA] text-sm text-[#334155]">
                    <td className="px-4 py-3.5 font-medium text-[#0F172A]">{r.riderName}</td>
                    <td className="px-4 py-3.5 text-center font-medium">{r.totalTrips} orders</td>
                    <td className="px-4 py-3.5 text-right font-bold font-mono text-emerald-600">₹{r.earnings.toFixed(2)}</td>
                    <td className="px-4 py-3.5"><Badge variant={r.status === "paid" ? "success" : r.status === "processing" ? "info" : "warning"} label={r.status === "paid" ? "Settled" : r.status === "processing" ? "Processing" : "Awaiting Pay"} dot /></td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B]">{r.date}</td>
                    <td className="px-4 py-3.5 text-right">
                      {r.status !== "paid" && (
                        <Button variant="primary" size="sm" onClick={() => handleExecutePayout(r.id, "riders")} disabled={isSubmitting}>Clear Payout</Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <Pagination 
          currentPage={currentPage} 
          totalPages={Math.ceil((activeTab === "vendors" ? filteredVendors.length : filteredRiders.length) / itemsPerPage)} 
          totalItems={activeTab === "vendors" ? filteredVendors.length : filteredRiders.length} 
          itemsPerPage={itemsPerPage} 
          onPageChange={setCurrentPage} 
        />
      </div>
    </div>
  );
}