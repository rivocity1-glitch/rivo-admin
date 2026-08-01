import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  ImageIcon,
  PackageCheck,
  Package,
  RotateCcw,
  Calendar,
  User,
  ShoppingBag,
  Store,
  Filter,
  X,
  ChevronRight,
  ShieldAlert,
  DollarSign,
  ArrowRight,
  Maximize2
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export type IssueType =
  | "Missing Item"
  | "Wrong Item"
  | "Damaged"
  | "Expired"
  | "Poor Quality"
  | "Replacement Requested"
  | "Refund Requested"
  | "Tampered Package"
  | "Other";

export type ClaimStatus =
  | "Pending"
  | "Vendor Review"
  | "Admin Review"
  | "Approved"
  | "Replacement Sent"
  | "Refunded"
  | "Rejected"
  | "Closed";

export type RefundType = "Full Refund" | "Partial Refund" | "Store Credit" | "Replacement Only" | "None";
export type RefundMethod = "Original Payment Method" | "Rivo Wallet" | "UPI Direct" | "Replacement Order" | "N/A";

export interface RefundItem {
  id: string;
  refund_id: string;
  product_name: string;
  quantity: number;
  refund_amount: number;
  issue_type: IssueType;
}

export interface ClaimEvidence {
  id: string;
  refund_id: string;
  image_url: string;
  caption?: string;
  created_at?: string;
}

export interface OrderIssue {
  id: string;
  refund_id?: string;
  issue_type: IssueType;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  created_at: string;
  resolved_at?: string;
}

export interface ClaimRecord {
  id: string;
  claim_id: string; // E.g., CLM-8492
  refund_display_id: string;
  order_id: string;
  customer_name: string;
  customer_email?: string;
  vendor_name: string;
  vendor_id?: string;
  issue_type: IssueType;
  refund_type: RefundType;
  refund_method: RefundMethod;
  requested_amount: number;
  approved_amount: number;
  status: ClaimStatus;
  customer_description: string;
  admin_notes?: string;
  vendor_notes?: string;
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  rejected_reason?: string;
  expires_at?: string;
  replacement_order_id?: string;
  is_partial_refund: boolean;
  created_at: string;
  vendor_reviewed_at?: string;
  admin_reviewed_at?: string;
  refund_processed_at?: string;
  closed_at?: string;
  
  // Joined or nested data
  refund_items?: RefundItem[];
  order_issues?: OrderIssue[];
  claim_evidence?: ClaimEvidence[];
}

type ModalType =
  | "view_claim"
  | "view_evidence"
  | "view_products"
  | "view_timeline"
  | "approve_refund"
  | "approve_replacement"
  | "partial_refund"
  | "reject_claim"
  | null;

// ----------------------------------------------------------------------
// Component: Refunds (Claims Management Dashboard)
// ----------------------------------------------------------------------

export function Refunds() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Search & Filters state
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>("all");
  const [refundTypeFilter, setRefundTypeFilter] = useState<string>("all");
  const [refundMethodFilter, setRefundMethodFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [amountRange, setAmountRange] = useState<{ min: string; max: string }>({ min: "", max: "" });

  // Modal active states
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);

  // Form Inputs for Actions
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [replacementOrderIdInput, setReplacementOrderIdInput] = useState<string>("");

  // --------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------

  async function fetchClaims() {
    try {
      setIsLoading(true);

      // Join refunds with refund_items, order_issues, and claim_evidence
      const { data, error } = await supabase
        .from("refunds")
        .select(`
          *,
          refund_items (*),
          order_issues (*),
          claim_evidence (*)
        `)
        .order("requested_at", { ascending: false });

      if (error) {
        // Fallback gracefully if some tables or aliases differ in initial schema
        console.warn("Joined fetch fallback triggered:", error.message);
        const { data: simpleData, error: simpleError } = await supabase
          .from("refunds")
          .select("*")
          .order("created_at", { ascending: false });

        if (simpleError) throw simpleError;
        setClaims(mapRawRefunds(simpleData || []));
      } else {
        setClaims(mapRawRefunds(data || []));
      }
    } catch (err) {
      console.error("Error fetching claims dataset:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function mapRawRefunds(data: any[]): ClaimRecord[] {
    return data.map((row) => ({
      id: row.id,
      claim_id: row.claim_id || row.refund_display_id || `CLM-${row.id.toString().slice(0, 6)}`,
      refund_display_id: row.refund_display_id || "REF-0000",
      order_id: row.order_id || row.order_display_id || "ORD-0000",
      customer_name: row.customer_name || row.customerName || "Guest Customer",
      customer_email: row.customer_email || "",
      vendor_name: row.vendor_name || row.vendorName || "Rivo Main Merchant",
      vendor_id: row.vendor_id || "",
      issue_type: (row.issue_type as IssueType) || "Other",
      refund_type: (row.refund_type as RefundType) || (row.is_partial_refund ? "Partial Refund" : "Full Refund"),
      refund_method: (row.refund_method as RefundMethod) || "Original Payment Method",
      requested_amount: Number(row.requested_amount || row.amount || 0),
      approved_amount: Number(row.approved_amount || 0),
      status: normalizeStatus(row.status),
      customer_description: row.customer_description || row.reason || "No customer explanation provided.",
      admin_notes: row.admin_notes || "",
      vendor_notes: row.vendor_notes || "",
      requested_at: row.requested_at || row.created_at || new Date().toISOString(),
      approved_at: row.approved_at || row.processed_at,
      approved_by: row.approved_by || "Admin",
      rejected_reason: row.rejected_reason || "",
      expires_at: row.expires_at,
      replacement_order_id: row.replacement_order_id,
      is_partial_refund: Boolean(row.is_partial_refund),
      created_at: row.created_at || new Date().toISOString(),
      vendor_reviewed_at: row.vendor_reviewed_at,
      admin_reviewed_at: row.admin_reviewed_at,
      refund_processed_at: row.refund_processed_at || (row.status === "approved" ? row.processed_at : undefined),
      closed_at: row.closed_at,
      refund_items: row.refund_items || [],
      order_issues: row.order_issues || [],
      claim_evidence: row.claim_evidence || []
    }));
  }

  function normalizeStatus(rawStatus?: string): ClaimStatus {
    if (!rawStatus) return "Pending";
    const lower = rawStatus.toLowerCase();
    if (lower === "pending") return "Pending";
    if (lower === "vendor_review" || lower === "vendor review") return "Vendor Review";
    if (lower === "admin_review" || lower === "admin review") return "Admin Review";
    if (lower === "approved") return "Approved";
    if (lower === "replacement_sent" || lower === "replacement sent") return "Replacement Sent";
    if (lower === "refunded") return "Refunded";
    if (lower === "rejected") return "Rejected";
    if (lower === "closed") return "Closed";
    return "Pending";
  }

  useEffect(() => {
    fetchClaims();
  }, []);

  // --------------------------------------------------------------------
  // Summary Cards Calculations
  // --------------------------------------------------------------------

  const summaryMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    let pendingClaims = 0;
    let approvedToday = 0;
    let rejectedToday = 0;
    let totalRefunded = 0;
    let totalReplacements = 0;
    let totalResolutionHours = 0;
    let resolvedCount = 0;

    claims.forEach((c) => {
      if (c.status === "Pending" || c.status === "Vendor Review" || c.status === "Admin Review") {
        pendingClaims++;
      }

      const isApprovedDate = c.approved_at && c.approved_at.slice(0, 10) === todayStr;
      if (c.status === "Approved" || c.status === "Refunded" || c.status === "Replacement Sent") {
        if (isApprovedDate) approvedToday++;
        totalRefunded += c.approved_amount;
      }

      if (c.status === "Rejected" && c.approved_at && c.approved_at.slice(0, 10) === todayStr) {
        rejectedToday++;
      }

      if (c.issue_type === "Replacement Requested" || c.refund_type === "Replacement Only" || c.replacement_order_id) {
        totalReplacements++;
      }

      // Calculate resolution speed if resolved
      if ((c.approved_at || c.closed_at) && c.requested_at) {
        const start = new Date(c.requested_at).getTime();
        const end = new Date(c.approved_at || c.closed_at!).getTime();
        if (end > start) {
          totalResolutionHours += (end - start) / (1000 * 60 * 60);
          resolvedCount++;
        }
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? (totalResolutionHours / resolvedCount).toFixed(1) : "1.2";

    return {
      pendingClaims,
      approvedToday,
      rejectedToday,
      totalRefunded,
      totalReplacements,
      avgResolutionTime: `${avgResolutionTime} hrs`
    };
  }, [claims]);

  // Unique vendors for filter list
  const uniqueVendors = useMemo(() => {
    return Array.from(new Set(claims.map((c) => c.vendor_name))).filter(Boolean);
  }, [claims]);

  // --------------------------------------------------------------------
  // Filter & Search Logic
  // --------------------------------------------------------------------

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      // Freeform text search
      const query = search.toLowerCase().trim();
      if (query) {
        const matchesClaimId = c.claim_id.toLowerCase().includes(query);
        const matchesRefundId = c.refund_display_id.toLowerCase().includes(query);
        const matchesOrderId = c.order_id.toLowerCase().includes(query);
        const matchesCustomer = c.customer_name.toLowerCase().includes(query);
        const matchesVendor = c.vendor_name.toLowerCase().includes(query);
        const matchesProduct = c.refund_items?.some((i) => i.product_name.toLowerCase().includes(query));

        if (!matchesClaimId && !matchesRefundId && !matchesOrderId && !matchesCustomer && !matchesVendor && !matchesProduct) {
          return false;
        }
      }

      // Dropdown filters
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (issueTypeFilter !== "all" && c.issue_type.toLowerCase() !== issueTypeFilter.toLowerCase()) return false;
      if (refundTypeFilter !== "all" && c.refund_type.toLowerCase() !== refundTypeFilter.toLowerCase()) return false;
      if (refundMethodFilter !== "all" && c.refund_method.toLowerCase() !== refundMethodFilter.toLowerCase()) return false;
      if (vendorFilter !== "all" && c.vendor_name.toLowerCase() !== vendorFilter.toLowerCase()) return false;
      if (customerFilter && !c.customer_name.toLowerCase().includes(customerFilter.toLowerCase())) return false;

      // Date filtering
      if (dateRange.start) {
        if (new Date(c.requested_at) < new Date(dateRange.start)) return false;
      }
      if (dateRange.end) {
        if (new Date(c.requested_at) > new Date(dateRange.end + "T23:59:59")) return false;
      }

      // Amount filtering
      if (amountRange.min && c.requested_amount < Number(amountRange.min)) return false;
      if (amountRange.max && c.requested_amount > Number(amountRange.max)) return false;

      return true;
    });
  }, [
    claims,
    search,
    statusFilter,
    issueTypeFilter,
    refundTypeFilter,
    refundMethodFilter,
    vendorFilter,
    customerFilter,
    dateRange,
    amountRange
  ]);

  const paginatedClaims = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClaims.slice(start, start + itemsPerPage);
  }, [filteredClaims, currentPage]);

  // --------------------------------------------------------------------
  // Helper Helpers: Badges, Age, Timeline
  // --------------------------------------------------------------------

  function getClaimAge(dateString: string): string {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function renderIssueTypeBadge(issue: IssueType) {
    const config: Record<IssueType, { bg: string; text: string; border: string }> = {
      "Missing Item": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
      "Wrong Item": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
      Damaged: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
      Expired: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
      "Poor Quality": { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200" },
      "Replacement Requested": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      "Refund Requested": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
      "Tampered Package": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
      Other: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" }
    };

    const style = config[issue] || config["Other"];
    return (
      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", style.bg, style.text, style.border)}>
        {issue}
      </span>
    );
  }

  function renderStatusBadge(status: ClaimStatus) {
    const config: Record<ClaimStatus, { bg: string; text: string; border: string; dot: string }> = {
      Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
      "Vendor Review": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
      "Admin Review": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
      Approved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
      "Replacement Sent": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
      Refunded: { bg: "bg-green-50", text: "text-green-800", border: "border-green-300", dot: "bg-green-600" },
      Rejected: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
      Closed: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" }
    };

    const style = config[status] || config["Pending"];
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", style.bg, style.text, style.border)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
        {status}
      </span>
    );
  }

  // --------------------------------------------------------------------
  // Action Modals & Processing
  // --------------------------------------------------------------------

  function openActionModal(claim: ClaimRecord, type: ModalType) {
    setSelectedClaim(claim);
    setActiveModal(type);

    // Initialize state forms
    if (type === "approve_refund") {
      setActionAmount(claim.requested_amount);
      setActionNotes("");
    } else if (type === "partial_refund") {
      setActionAmount(Math.round(claim.requested_amount * 0.5));
      setActionNotes("");
    } else if (type === "approve_replacement") {
      setReplacementOrderIdInput(`RPL-${Math.floor(100000 + Math.random() * 900000)}`);
      setActionNotes("");
    } else if (type === "reject_claim") {
      setRejectionReason("");
    }
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedClaim(null);
    setSelectedEvidenceUrl(null);
  }

  async function handleStatusTransition(nextStatus: ClaimStatus, extraPayload: Record<string, any> = {}) {
    if (!selectedClaim) return;

    try {
      setIsSubmitting(true);
      const updateData: Record<string, any> = {
        status: nextStatus,
        admin_notes: actionNotes || selectedClaim.admin_notes,
        ...extraPayload
      };

      if (nextStatus === "Approved" || nextStatus === "Refunded" || nextStatus === "Replacement Sent") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = "Admin";
      } else if (nextStatus === "Rejected") {
        updateData.approved_at = new Date().toISOString();
        updateData.rejected_reason = rejectionReason;
      }

      const { error } = await supabase.from("refunds").update(updateData).eq("id", selectedClaim.id);

      if (error) throw error;

      await fetchClaims();
      closeModal();
    } catch (err: any) {
      console.error("Failed to execute claim status action:", err);
      alert(`Action failed: ${err.message || "Database update issue."}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Claims Management"
        description="Monitor, evaluate, and resolve customer refund, replacement, and order issue claims across vendors."
      />

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Pending Claims</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#0F172A]">{summaryMetrics.pendingClaims}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Approved Today</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#16A34A]">{summaryMetrics.approvedToday}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Rejected Today</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#DC2626]">{summaryMetrics.rejectedToday}</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Refunded</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xl font-extrabold text-[#16A34A]">₹{summaryMetrics.totalRefunded.toLocaleString()}</span>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Replacements</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#2563EB]">{summaryMetrics.totalReplacements}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Avg Resolution</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#0F172A]">{summaryMetrics.avgResolutionTime}</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <RefreshCcw className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-sm">
        {/* Row 1: Search and Primary Quick Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Claim ID, Refund ID, Order ID, Customer, Vendor, Product..."
              className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:bg-white transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A]">
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider shrink-0">Status:</span>
            <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-[#F8FAFC]">
              {["all", "Pending", "Vendor Review", "Admin Review", "Approved", "Refunded", "Rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-medium capitalize whitespace-nowrap transition",
                    statusFilter === s ? "bg-[#22C55E] text-white font-semibold shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Deep Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-[#F1F5F9]">
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">Issue Type</label>
            <select
              value={issueTypeFilter}
              onChange={(e) => {
                setIssueTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Issues</option>
              <option value="Missing Item">Missing Item</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Damaged">Damaged</option>
              <option value="Expired">Expired</option>
              <option value="Poor Quality">Poor Quality</option>
              <option value="Replacement Requested">Replacement Requested</option>
              <option value="Refund Requested">Refund Requested</option>
              <option value="Tampered Package">Tampered Package</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">Refund Type</label>
            <select
              value={refundTypeFilter}
              onChange={(e) => {
                setRefundTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Refund Types</option>
              <option value="Full Refund">Full Refund</option>
              <option value="Partial Refund">Partial Refund</option>
              <option value="Store Credit">Store Credit</option>
              <option value="Replacement Only">Replacement Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">Refund Method</label>
            <select
              value={refundMethodFilter}
              onChange={(e) => {
                setRefundMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Methods</option>
              <option value="Original Payment Method">Original Payment</option>
              <option value="Rivo Wallet">Rivo Wallet</option>
              <option value="UPI Direct">UPI Direct</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Vendors</option>
              {uniqueVendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full h-8 px-2 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
            />
          </div>
        </div>
      </div>

      {/* Main Claims Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Claim / Refund ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Order ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Issue Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Refund Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right">Req. Amount</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right">Appr. Amount</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Age</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-sm text-[#94A3B8]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCcw className="w-6 h-6 animate-spin text-[#22C55E]" />
                      <span>Loading claims from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedClaims.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-sm text-[#94A3B8]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-[#CBD5E1]" />
                      <p className="font-medium text-[#0F172A]">No claims match your filters</p>
                      <p className="text-xs">Try resetting search filters or keywords.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-[#FAFAFA] text-xs text-[#334155] transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">
                      <div>#{claim.claim_id}</div>
                      <div className="text-[10px] text-[#94A3B8] font-normal">#{claim.refund_display_id}</div>
                    </td>

                    <td className="px-4 py-3 font-mono font-medium text-[#64748B]">#{claim.order_id}</td>

                    <td className="px-4 py-3 font-medium text-[#0F172A]">
                      <div className="max-w-[120px] truncate" title={claim.customer_name}>
                        {claim.customer_name}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[#64748B]">
                      <div className="max-w-[120px] truncate" title={claim.vendor_name}>
                        {claim.vendor_name}
                      </div>
                    </td>

                    <td className="px-4 py-3">{renderIssueTypeBadge(claim.issue_type)}</td>

                    <td className="px-4 py-3 font-medium text-[#475569]">{claim.refund_type}</td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-[#0F172A]">₹{claim.requested_amount.toFixed(2)}</td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-[#16A34A]">
                      {claim.approved_amount > 0 ? `₹${claim.approved_amount.toFixed(2)}` : "—"}
                    </td>

                    <td className="px-4 py-3 text-[#64748B] max-w-[110px] truncate" title={claim.refund_method}>
                      {claim.refund_method}
                    </td>

                    <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{getClaimAge(claim.requested_at)}</td>

                    <td className="px-4 py-3">{renderStatusBadge(claim.status)}</td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openActionModal(claim, "view_claim")}
                          className="h-7 px-2 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>

                        {/* Dropdown / Quick Action Group */}
                        <div className="relative inline-block text-left group">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]">
                            Actions
                          </Button>

                          <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-48 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 py-1 text-left">
                            <button
                              onClick={() => openActionModal(claim, "view_evidence")}
                              className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-2"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                              View Evidence ({claim.claim_evidence?.length || 0})
                            </button>

                            <button
                              onClick={() => openActionModal(claim, "view_products")}
                              className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-2"
                            >
                              <Package className="w-3.5 h-3.5 text-amber-500" />
                              View Products ({claim.refund_items?.length || 0})
                            </button>

                            <button
                              onClick={() => openActionModal(claim, "view_timeline")}
                              className="w-full px-3 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] flex items-center gap-2 border-b border-[#F1F5F9]"
                            >
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              View Timeline
                            </button>

                            {/* Decision Actions (Only available for unresolved claims) */}
                            {claim.status !== "Approved" && claim.status !== "Refunded" && claim.status !== "Rejected" && claim.status !== "Closed" && (
                              <>
                                <button
                                  onClick={() => openActionModal(claim, "approve_refund")}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-medium"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Approve Refund
                                </button>

                                <button
                                  onClick={() => openActionModal(claim, "approve_replacement")}
                                  className="w-full px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 flex items-center gap-2 font-medium"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                                  Approve Replacement
                                </button>

                                <button
                                  onClick={() => openActionModal(claim, "partial_refund")}
                                  className="w-full px-3 py-1.5 text-xs text-yellow-700 hover:bg-yellow-50 flex items-center gap-2 font-medium"
                                >
                                  <DollarSign className="w-3.5 h-3.5 text-yellow-600" />
                                  Partial Refund
                                </button>

                                <button
                                  onClick={() => openActionModal(claim, "reject_claim")}
                                  className="w-full px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-medium border-t border-[#F1F5F9]"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  Reject Claim
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredClaims.length / itemsPerPage) || 1}
          totalItems={filteredClaims.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* =================================-------------------------------- */}
      {/* MODAL DIALOGS                                                     */}
      {/* =================================-------------------------------- */}

      {/* 1. CLAIM DETAILS MODAL */}
      {activeModal === "view_claim" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#E2E8F0]">
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#22C55E] flex items-center justify-center font-bold">
                  CLM
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A]">Claim #{selectedClaim.claim_id}</h3>
                  <p className="text-xs text-[#64748B]">Refund Ref: #{selectedClaim.refund_display_id} | Order: #{selectedClaim.order_id}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top Overview Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] block">Status</span>
                  {renderStatusBadge(selectedClaim.status)}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] block">Issue Type</span>
                  {renderIssueTypeBadge(selectedClaim.issue_type)}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] block">Requested Amount</span>
                  <span className="text-base font-bold text-[#0F172A]">₹{selectedClaim.requested_amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] block">Approved Amount</span>
                  <span className="text-base font-bold text-emerald-600">
                    {selectedClaim.approved_amount > 0 ? `₹${selectedClaim.approved_amount.toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>

              {/* Information Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Customer */}
                <div className="p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center gap-2 mb-2 text-[#0F172A] font-semibold text-sm">
                    <User className="w-4 h-4 text-emerald-600" /> Customer Information
                  </div>
                  <p className="text-sm font-medium text-[#0F172A]">{selectedClaim.customer_name}</p>
                  <p className="text-xs text-[#64748B]">{selectedClaim.customer_email || "No email attached"}</p>
                </div>

                {/* Vendor */}
                <div className="p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center gap-2 mb-2 text-[#0F172A] font-semibold text-sm">
                    <Store className="w-4 h-4 text-blue-600" /> Vendor Information
                  </div>
                  <p className="text-sm font-medium text-[#0F172A]">{selectedClaim.vendor_name}</p>
                  <p className="text-xs text-[#64748B]">Vendor ID: {selectedClaim.vendor_id || "VND-MAIN"}</p>
                </div>

                {/* Refund Config */}
                <div className="p-4 rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center gap-2 mb-2 text-[#0F172A] font-semibold text-sm">
                    <ShoppingBag className="w-4 h-4 text-purple-600" /> Claim Parameters
                  </div>
                  <p className="text-xs text-[#64748B]"><strong className="text-[#0F172A]">Method:</strong> {selectedClaim.refund_method}</p>
                  <p className="text-xs text-[#64748B]"><strong className="text-[#0F172A]">Type:</strong> {selectedClaim.refund_type}</p>
                </div>
              </div>

              {/* Customer Description */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Customer Reported Issue</h4>
                <p className="text-xs text-amber-950 leading-relaxed">{selectedClaim.customer_description}</p>
              </div>

              {/* Vendor & Admin Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#E2E8F0]">
                  <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Vendor Notes</h4>
                  <p className="text-xs text-[#334155]">{selectedClaim.vendor_notes || "No vendor notes added yet."}</p>
                </div>
                <div className="p-4 rounded-xl border border-[#E2E8F0]">
                  <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Admin Audit Notes</h4>
                  <p className="text-xs text-[#334155]">{selectedClaim.admin_notes || "No admin notes recorded."}</p>
                </div>
              </div>

              {/* Product Items Table */}
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" /> Refunded Products ({selectedClaim.refund_items?.length || 0})
                </h4>
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <tr>
                        <th className="p-3 font-semibold text-[#64748B]">Product Name</th>
                        <th className="p-3 font-semibold text-[#64748B]">Quantity</th>
                        <th className="p-3 font-semibold text-[#64748B]">Issue Type</th>
                        <th className="p-3 font-semibold text-[#64748B] text-right">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {selectedClaim.refund_items && selectedClaim.refund_items.length > 0 ? (
                        selectedClaim.refund_items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td className="p-3 font-medium text-[#0F172A]">{item.product_name}</td>
                            <td className="p-3 text-[#64748B]">{item.quantity}</td>
                            <td className="p-3">{renderIssueTypeBadge(item.issue_type || selectedClaim.issue_type)}</td>
                            <td className="p-3 text-right font-mono font-bold text-[#16A34A]">₹{Number(item.refund_amount).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-[#94A3B8]">No individual product breakdowns attached to claim.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Evidence Section */}
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-600" /> Uploaded Claim Evidence ({selectedClaim.claim_evidence?.length || 0})
                </h4>
                {selectedClaim.claim_evidence && selectedClaim.claim_evidence.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {selectedClaim.claim_evidence.map((img, idx) => (
                      <div
                        key={img.id || idx}
                        onClick={() => setSelectedEvidenceUrl(img.image_url)}
                        className="group relative aspect-square rounded-lg border border-[#E2E8F0] overflow-hidden bg-slate-100 cursor-pointer hover:border-[#22C55E] transition"
                      >
                        <img src={img.image_url} alt="Evidence photo" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#94A3B8] italic">No evidence photos uploaded for this claim.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EVIDENCE GALLERY MODAL */}
      {activeModal === "view_evidence" && selectedClaim && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" /> Claim Evidence Photos - #{selectedClaim.claim_id}
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedClaim.claim_evidence && selectedClaim.claim_evidence.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
                {selectedClaim.claim_evidence.map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    onClick={() => setSelectedEvidenceUrl(ev.image_url)}
                    className="group border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer hover:border-[#22C55E] transition bg-slate-50"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img src={ev.image_url} alt="Claim evidence photo" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    {ev.caption && <p className="p-2 text-[11px] text-[#64748B] truncate">{ev.caption}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-[#94A3B8] text-sm">No photo evidence uploaded for this claim.</div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Lightbox */}
      {selectedEvidenceUrl && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedEvidenceUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={selectedEvidenceUrl} alt="Evidence expanded preview" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl" />
            <button
              onClick={() => setSelectedEvidenceUrl(null)}
              className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. PRODUCTS MODAL */}
      {activeModal === "view_products" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" /> Claimed Products Breakdown
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="p-3 font-semibold text-[#64748B]">Product</th>
                    <th className="p-3 font-semibold text-[#64748B]">Qty</th>
                    <th className="p-3 font-semibold text-[#64748B]">Issue</th>
                    <th className="p-3 font-semibold text-[#64748B] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {selectedClaim.refund_items && selectedClaim.refund_items.length > 0 ? (
                    selectedClaim.refund_items.map((prod) => (
                      <tr key={prod.id}>
                        <td className="p-3 font-medium text-[#0F172A]">{prod.product_name}</td>
                        <td className="p-3 text-[#64748B]">{prod.quantity}</td>
                        <td className="p-3">{renderIssueTypeBadge(prod.issue_type || selectedClaim.issue_type)}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#16A34A]">₹{Number(prod.refund_amount).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[#94A3B8]">No individual line items registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TIMELINE MODAL */}
      {activeModal === "view_timeline" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" /> Claim Audit History & Timeline
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-2 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E2E8F0]">
              {/* Event 1 */}
              <div className="relative">
                <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <p className="text-xs font-bold text-[#0F172A]">Claim Created</p>
                <p className="text-[11px] text-[#64748B]">{new Date(selectedClaim.requested_at).toLocaleString("en-GB")}</p>
                <p className="text-xs text-[#475569] mt-0.5">Submitted by customer with reason: {selectedClaim.issue_type}</p>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <span className={cn("absolute -left-6 top-1 w-3 h-3 rounded-full ring-4", selectedClaim.vendor_reviewed_at ? "bg-indigo-500 ring-indigo-100" : "bg-slate-300 ring-slate-100")} />
                <p className="text-xs font-bold text-[#0F172A]">Vendor Reviewed</p>
                <p className="text-[11px] text-[#64748B]">{selectedClaim.vendor_reviewed_at ? new Date(selectedClaim.vendor_reviewed_at).toLocaleString("en-GB") : "Pending Review"}</p>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <span className={cn("absolute -left-6 top-1 w-3 h-3 rounded-full ring-4", selectedClaim.approved_at ? "bg-[#22C55E] ring-green-100" : selectedClaim.status === "Rejected" ? "bg-rose-500 ring-rose-100" : "bg-slate-300 ring-slate-100")} />
                <p className="text-xs font-bold text-[#0F172A]">{selectedClaim.status === "Rejected" ? "Claim Rejected" : "Admin Decision / Approval"}</p>
                <p className="text-[11px] text-[#64748B]">{selectedClaim.approved_at ? new Date(selectedClaim.approved_at).toLocaleString("en-GB") : "Awaiting Decision"}</p>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <span className={cn("absolute -left-6 top-1 w-3 h-3 rounded-full ring-4", selectedClaim.status === "Closed" || selectedClaim.status === "Refunded" ? "bg-purple-500 ring-purple-100" : "bg-slate-300 ring-slate-100")} />
                <p className="text-xs font-bold text-[#0F172A]">Refund / Replacement Dispatched</p>
                <p className="text-[11px] text-[#64748B]">{selectedClaim.closed_at || selectedClaim.refund_processed_at ? new Date(selectedClaim.closed_at || selectedClaim.refund_processed_at!).toLocaleString("en-GB") : "In Progress"}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ACTION MODAL: APPROVE REFUND */}
      {activeModal === "approve_refund" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Approve Full Refund
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#64748B] mb-1">Approved Amount (₹)</label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#64748B] mb-1">Admin Audit Notes</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Reasoning for approval..."
                  rows={3}
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() =>
                  handleStatusTransition("Approved", {
                    approved_amount: actionAmount,
                    refund_type: "Full Refund"
                  })
                }
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Confirm Full Refund"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ACTION MODAL: APPROVE REPLACEMENT */}
      {activeModal === "approve_replacement" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2 text-blue-700">
                <RotateCcw className="w-5 h-5 text-blue-600" /> Approve Replacement Order
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#64748B] mb-1">Generated Replacement Order ID</label>
                <input
                  type="text"
                  value={replacementOrderIdInput}
                  onChange={(e) => setReplacementOrderIdInput(e.target.value)}
                  className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-sm font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#64748B] mb-1">Admin Order Dispatched Notes</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Notes for fulfillment center..."
                  rows={3}
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() =>
                  handleStatusTransition("Replacement Sent", {
                    replacement_order_id: replacementOrderIdInput,
                    refund_type: "Replacement Only"
                  })
                }
                disabled={isSubmitting}
              >
                {isSubmitting ? "Dispatching..." : "Dispatch Replacement"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ACTION MODAL: PARTIAL REFUND */}
      {activeModal === "partial_refund" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2 text-yellow-700">
                <DollarSign className="w-5 h-5 text-yellow-600" /> Issue Partial Refund
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg text-amber-800">
                Requested Original Amount: <strong>₹{selectedClaim.requested_amount.toFixed(2)}</strong>
              </div>

              <div>
                <label className="block font-medium text-[#64748B] mb-1">Approved Partial Amount (₹)</label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#64748B] mb-1">Reason for Partial Adjustment</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Explain why only a partial amount was granted..."
                  rows={3}
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() =>
                  handleStatusTransition("Approved", {
                    approved_amount: actionAmount,
                    is_partial_refund: true,
                    refund_type: "Partial Refund"
                  })
                }
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Approve Partial Amount"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. ACTION MODAL: REJECT CLAIM */}
      {activeModal === "reject_claim" && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-rose-700 text-lg flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Reject Claim
              </h3>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#64748B] mb-1">Rejection Reason (Required)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide explicit reasons why this claim was rejected..."
                  rows={4}
                  className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button variant="outline" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
              <Button
                variant="outline"
                className="bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
                onClick={() => handleStatusTransition("Rejected")}
                disabled={isSubmitting || !rejectionReason.trim()}
              >
                {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
