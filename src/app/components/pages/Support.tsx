import React, { useState, useEffect } from "react";
import {
  Search,
  ChevronRight,
  HelpCircle,
  Clock,
  User,
  Store,
  Truck,
  AlertCircle,
  Wrench,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Trash2
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type UserType = "customer" | "vendor" | "rider";
type PriorityType = "high" | "medium" | "low";

interface SupportTicket {
  id: string;
  user_type: UserType;
  user_id: string; // Profiles ID (vendor_id, customer_id, or rider_id)
  vendor_id?: string;
  customer_id?: string;
  rider_id?: string;
  reference_id: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: PriorityType;
  issue_type: string | null;
  screenshot_url: string | null;
  date: string;
  raw_date: string;
}

const statusConfig: Record<TicketStatus, { variant: "neutral" | "warning" | "success"; label: string }> = {
  open: { variant: "warning", label: "Open" },
  in_progress: { variant: "neutral", label: "In Progress" },
  resolved: { variant: "success", label: "Resolved" },
  closed: { variant: "neutral", label: "Closed" },
};

const userTypeConfig: Record<UserType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  customer: { label: "Customer", icon: User, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  vendor: { label: "Vendor", icon: Store, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  rider: { label: "Rider", icon: Truck, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
};

const priorityConfig: Record<PriorityType, { variant: "error" | "warning" | "neutral"; label: string; customClasses?: string }> = {
  high: { variant: "error", label: "High", customClasses: "bg-red-100 text-red-700 border-red-200" },
  medium: { variant: "warning", label: "Medium" },
  low: { variant: "neutral", label: "Low", customClasses: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function Supports() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [counters, setCounters] = useState({
    openCount: 0,
    highPriorityCount: 0,
  });

  const itemsPerPage = 10;

  function getSuggestedFix(ticket: SupportTicket): string {
    const textContext = `${ticket.subject} ${ticket.message} ${ticket.issue_type || ""}`.toLowerCase();

    if (ticket.user_type === "vendor") {
      if (textContext.includes("payout") || textContext.includes("billing") || textContext.includes("bank")) {
        return "Verify vendor bank metadata, check clearing destination core string matching parameters, and cross-examine account_holder_name against registered business passbook.";
      }
      if (textContext.includes("inventory") || textContext.includes("sync") || textContext.includes("stock")) {
        return "Purge application state engine data caches for product_categories, re-index real-time availability variables, and verify vendor_profiles table sync boundaries.";
      }
    }

    if (ticket.user_type === "rider") {
      if (textContext.includes("location") || textContext.includes("gps") || textContext.includes("map")) {
        return "Initiate edge telemetry ping request, inspect tracking coordinate heartbeat logs, and reset tracking session states.";
      }
    }

    if (textContext.includes("payment") || textContext.includes("refund") || textContext.includes("transaction")) {
      return "Verify payment gateway webhook reference codes, trace order ledger rows, and authorize partial or full automated payload reversals if verified.";
    }
    return "Cross-examine user configuration metrics, review transactional records for matching data conflicts, or request supplementary system diagnostics from the user.";
  }

  async function autoDeleteOldClosedTickets() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffISO = cutoffDate.toISOString();

      await supabase
        .from("vendor_support_tickets")
        .delete()
        .eq("status", "closed")
        .lt("created_at", cutoffISO);

      await supabase
        .from("customer_support_tickets")
        .delete()
        .eq("status", "closed")
        .lt("created_at", cutoffISO);

      await supabase
        .from("rider_support_tickets")
        .delete()
        .eq("status", "closed")
        .lt("created_at", cutoffISO);

    } catch (err) {
      console.error("Silent background old closed support tickets cleanup failed:", err);
    }
  }

  async function fetchTickets() {
    try {
      setIsLoading(true);
      let allTickets: SupportTicket[] = [];

      // 1. FETCH CUSTOMER TICKETS
      try {
        const { data: customerTickets, error: customerTicketError } = await supabase
          .from("customer_support_tickets")
          .select("id, customer_id, title, description, status, priority, issue_type, screenshot_url, created_at");

        if (customerTickets && !customerTicketError) {
          const normalizedCustomerTickets = customerTickets.map((t) => ({
            id: t.id,
            user_type: "customer" as UserType,
            user_id: t.customer_id,
            customer_id: t.customer_id,
            reference_id: null,
            subject: t.title || "No Subject", 
            message: t.description || "No message provided", 
            status: (t.status || "open") as TicketStatus,
            priority: (t.priority || "medium") as PriorityType,
            issue_type: t.issue_type || null,
            screenshot_url: t.screenshot_url || null,
            raw_date: t.created_at,
            date: formatTicketDate(t.created_at),
          }));
          allTickets = [...allTickets, ...normalizedCustomerTickets];
        }
      } catch (err) {
        console.error("Customer tickets process loop exception caught:", err);
      }

      // 2. FETCH VENDOR TICKETS
      try {
        const { data: vendorTickets, error: vendorTicketError } = await supabase
          .from("vendor_support_tickets")
          .select("id, vendor_id, title, description, issue_type, screenshot_url, priority, status, created_at");

        if (vendorTickets && !vendorTicketError) {
          const normalizedVendorTickets = vendorTickets.map((ticket) => ({
            id: ticket.id,
            user_type: "vendor" as UserType,
            user_id: ticket.vendor_id,
            vendor_id: ticket.vendor_id,
            reference_id: null,
            subject: ticket.title || "No Subject",
            message: ticket.description || "No description provided",
            status: (ticket.status || "open") as TicketStatus,
            priority: (ticket.priority || "medium") as PriorityType,
            issue_type: ticket.issue_type || null,
            screenshot_url: ticket.screenshot_url || null,
            raw_date: ticket.created_at,
            date: formatTicketDate(ticket.created_at),
          }));
          allTickets = [...allTickets, ...normalizedVendorTickets];
        }
      } catch (err) {
        console.error("Vendor tickets process loop exception caught:", err);
      }

      // 3. FETCH RIDER TICKETS
      try {
        const { data: riderTickets, error: riderTicketError } = await supabase
          .from("rider_support_tickets")
          .select("id, rider_id, title, description, status, priority, issue_type, screenshot_url, created_at");

        if (riderTickets && !riderTicketError) {
          const normalizedRiderTickets = riderTickets.map((t) => ({
            id: t.id,
            user_type: "rider" as UserType,
            user_id: t.rider_id,
            rider_id: t.rider_id,
            reference_id: null,
            subject: t.title || "No Subject", 
            message: t.description || "No message provided", 
            status: (t.status || "open") as TicketStatus,
            priority: (t.priority || "medium") as PriorityType,
            issue_type: t.issue_type || null,
            screenshot_url: t.screenshot_url || null,
            raw_date: t.created_at,
            date: formatTicketDate(t.created_at),
          }));
          allTickets = [...allTickets, ...normalizedRiderTickets];
        }
      } catch (err) {
        console.error("Rider tickets process loop exception caught:", err);
      }

      allTickets.sort((a, b) => new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime());
      setTickets(allTickets);

      const openTickets = allTickets.filter((t) => t.status === "open").length;
      const highPriority = allTickets.filter((t) => t.priority === "high" && t.status !== "closed").length;
      setCounters({ openCount: openTickets, highPriorityCount: highPriority });

      if (selectedTicket) {
        const structuralRefresh = allTickets.find((t) => t.id === selectedTicket.id && t.user_type === selectedTicket.user_type);
        if (structuralRefresh) setSelectedTicket(structuralRefresh);
      }
    } catch (err) {
      console.error("Global system support desk fetching block failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function formatTicketDate(rawDate: string | null): string {
    if (!rawDate) return "—";
    return new Date(rawDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    autoDeleteOldClosedTickets();
    fetchTickets();
  }, []);

  async function handleTicketDeletion() {
    if (!selectedTicket) return;

    try {
      setIsSubmitting(true);
      let targetedTable = "customer_support_tickets";
      if (selectedTicket.user_type === "vendor") targetedTable = "vendor_support_tickets";
      if (selectedTicket.user_type === "rider") targetedTable = "rider_support_tickets";

      const { error } = await supabase
        .from(targetedTable)
        .delete()
        .eq("id", selectedTicket.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setSelectedTicket(null);
      
      setSuccessToast("Support ticket deleted successfully.");
      setTimeout(() => setSuccessToast(null), 4000);

      await fetchTickets();
    } catch (err) {
      console.error("Failed to delete support ticket via manual request hook:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTicketMutation(nextStatus: TicketStatus) {
    if (!selectedTicket) return;

    try {
      setIsSubmitting(true);
      let targetedTable = "customer_support_tickets";
      if (selectedTicket.user_type === "vendor") targetedTable = "vendor_support_tickets";
      if (selectedTicket.user_type === "rider") targetedTable = "rider_support_tickets";

      const { error } = await supabase
        .from(targetedTable)
        .update({ status: nextStatus })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Map notification messages cleanly
      let notificationMessage = "";
      if (nextStatus === "open") {
        notificationMessage = "Your support ticket has been reopened.";
      } else if (nextStatus === "in_progress") {
        notificationMessage = "Your support ticket is now being reviewed by the Rivo Support Team.";
      } else if (nextStatus === "resolved") {
        notificationMessage = "Your support ticket has been resolved.";
      } else if (nextStatus === "closed") {
        notificationMessage = "Your support ticket has been closed.";
      }

      // Directly resolve profile recipient ID
      const recipientId = selectedTicket.vendor_id || selectedTicket.customer_id || selectedTicket.rider_id || selectedTicket.user_id;
      const recipientType = selectedTicket.user_type;

      if (recipientId && recipientType) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            recipient_id: recipientId,
            recipient_type: recipientType,
            title: "Support Ticket Update",
            message: notificationMessage,
            is_read: false,
            created_at: new Date().toISOString()
          });

        if (notifError) {
          console.error("Notification creation failed:", notifError);
        } else {
          console.log(`Notification sent to ${recipientType} (${recipientId})`);
        }
      }

      await fetchTickets();
    } catch (err) {
      console.error("Mutation routine exception pipeline hook:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = tickets.filter((t) => {
    const displayId = `TKT-${t.id.slice(0, 8)}`;
    const matchSearch =
      displayId.toLowerCase().includes(search.toLowerCase()) ||
      t.user_id.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    
    const matchType = typeFilter === "all" || t.user_type === typeFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;

    return matchSearch && matchType && matchPriority && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Support Desk" 
        description="Unified hub to manage and resolve platform customer, vendor, and rider helpdesk ticket queues."
      />

      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Unassigned Tasks</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counters.openCount} Awaiting Fix</h3>
          </div>
          <div className="w-10 h-10 bg-amber-50 border border-amber-100 text-amber-500 rounded-lg flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">High Risk Alerts</p>
            <h3 className="text-2xl font-bold text-red-600 mt-1">{counters.highPriorityCount} Escalated</h3>
          </div>
          <div className="w-10 h-10 bg-red-50 border border-red-100 text-red-500 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Indexed Cases</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{tickets.length} System Records</h3>
          </div>
          <div className="w-10 h-10 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by ID, reference code, title..."
              className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex flex-col space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Origin Entity</span>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="h-8 px-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155] focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Channels</option>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="rider">Rider</option>
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Severity</span>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                className="h-8 px-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155] focus:outline-none focus:border-[#22C55E]"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#F1F5F9] pt-3 overflow-x-auto">
          <span className="text-xs font-semibold text-[#64748B] whitespace-nowrap mr-2">Status Group:</span>
          <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-slate-50 shrink-0">
            {["all", "open", "in_progress", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={cn(
                  "h-7 px-3 rounded-md text-xs font-medium capitalize transition-all",
                  statusFilter === s ? "bg-[#22C55E] text-white shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                )}
              >
                {s === "in_progress" ? "In Progress" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Ticket ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">User Origin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Account Reference UUID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Core Issue Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Logged At</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-xs text-[#94A3B8] font-medium tracking-wide">
                    Re-indexing combined records...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-xs text-[#94A3B8] font-medium">
                    No active support desk parameters matched.
                  </td>
                </tr>
              ) : (
                paginated.map((t) => {
                  const status = statusConfig[t.status] || { variant: "neutral", label: t.status };
                  const userType = userTypeConfig[t.user_type];
                  const priority = priorityConfig[t.priority] || { variant: "neutral", label: t.priority };
                  const UserTypeIcon = userType.icon;
                  const displayId = `TKT-${t.id.slice(0, 8)}`;

                  return (
                    <tr 
                      key={`${t.user_type}-${t.id}`} 
                      className="hover:bg-[#FAFAFA] text-sm text-[#334155] cursor-pointer transition-colors" 
                      onClick={() => {
                        setSelectedTicket(t);
                        setPreviewScreenshot(false);
                        setShowDeleteConfirm(false);
                      }}
                    >
                      <td className="px-4 py-3.5 font-mono font-medium text-[#0F172A]">#{displayId}</td>
                      <td className="px-4 py-3.5">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs font-bold rounded-md", userType.bg, userType.color)}>
                          <UserTypeIcon className="w-3 h-3 stroke-[2.5]" />
                          <span>{userType.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#64748B] max-w-[140px] truncate">
                        {t.user_id}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs font-medium text-[#475569] truncate">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#0F172A]">{t.subject}</span>
                          {t.issue_type && <span className="text-[10px] text-[#94A3B8] font-bold uppercase mt-0.5">{t.issue_type}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge 
                          variant={priority.variant} 
                          label={priority.label} 
                          className={priority.customClasses} 
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={status.variant} label={status.label} dot />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-3.5 text-right"><ChevronRight className="w-4 h-4 text-[#94A3B8] inline" /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPage} 
          totalPages={Math.ceil(filtered.length / itemsPerPage)}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Ticket Inspection Window Modal */}
      {selectedTicket && (
        <Modal 
          open={!!selectedTicket}
          onClose={() => { if (!isSubmitting) setSelectedTicket(null); }}
          title={`Ticket #TKT-${selectedTicket.id.slice(0, 8)}`}
          description={`Comprehensive query report context overview.`}
        >
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={cn("p-2 rounded-xl border flex flex-col items-center justify-center", userTypeConfig[selectedTicket.user_type].bg)}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] block mb-0.5">Entity Type</span>
                <span className={cn("text-xs font-black uppercase", userTypeConfig[selectedTicket.user_type].color)}>
                  {userTypeConfig[selectedTicket.user_type].label}
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] block mb-0.5">Priority</span>
                <Badge 
                  variant={priorityConfig[selectedTicket.priority]?.variant || "neutral"} 
                  label={priorityConfig[selectedTicket.priority]?.label || selectedTicket.priority} 
                  className={priorityConfig[selectedTicket.priority]?.customClasses}
                />
              </div>
              <div className="p-2 bg-slate-50 border border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B] block mb-0.5">Status</span>
                <Badge variant={statusConfig[selectedTicket.status].variant} label={statusConfig[selectedTicket.status].label} />
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-1">Subject</p>
                <h4 className="text-sm font-bold text-[#0F172A]">{selectedTicket.subject}</h4>
              </div>
              <div>
                <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-1">Message Context</p>
                <p className="text-xs text-[#475569] leading-relaxed bg-white border border-[#F1F5F9] p-3 rounded-lg font-medium whitespace-pre-wrap">
                  {selectedTicket.message}
                </p>
              </div>
            </div>

            {selectedTicket.screenshot_url && (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={() => setPreviewScreenshot(!previewScreenshot)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#334155] border-b border-[#E2E8F0] bg-white"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Media Attachment Preview</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#22C55E]">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewScreenshot ? "Collapse" : "Expand Link View"}</span>
                  </div>
                </button>
                {previewScreenshot && (
                  <div className="p-3 bg-slate-900 flex items-center justify-center max-h-64 overflow-hidden">
                    <img 
                      src={selectedTicket.screenshot_url}
                      alt="Ticket Attachment Trace" 
                      className="max-w-full max-h-60 object-contain rounded shadow-md"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-3 space-y-1.5">
              <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Wrench className="w-3.5 h-3.5" />
                <span>Suggested Operational Action</span>
              </h5>
              <p className="text-xs text-emerald-900 font-medium leading-relaxed bg-white border border-emerald-100 p-2 rounded-lg">
                {getSuggestedFix(selectedTicket)}
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl font-mono text-[11px] text-[#475569] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#94A3B8] font-bold uppercase text-[10px]">Account reference UUID</span>
                <span className="text-[#0F172A] break-all text-right max-w-[65%]">{selectedTicket.user_id}</span>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-xs font-bold text-red-800">Delete this support ticket?</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="h-8 text-xs flex-1 border-red-200 hover:bg-red-100 text-red-800 font-semibold"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    className="h-8 text-xs flex-1 bg-red-600 hover:bg-red-700 border-0 text-white font-bold"
                    onClick={handleTicketDeletion}
                    disabled={isSubmitting}
                  >
                    Delete Permanent
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-2">
              {!showDeleteConfirm && (
                <Button
                  variant="outline"
                  className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  title="Remove ticket record permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Ticket</span>
                </Button>
              )}

              {selectedTicket.status === "open" && (
                <Button 
                  variant="primary" 
                  className="flex-1 text-xs h-9" 
                  onClick={() => handleTicketMutation("in_progress")}
                  disabled={isSubmitting || showDeleteConfirm}
                >
                  Claim & Start Progress
                </Button>
              )}
              {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
                <Button 
                  variant="primary" 
                  className="flex-1 text-xs h-9 text-white bg-[#22C55E] hover:bg-[#16A34A] border-0 flex items-center justify-center gap-1" 
                  onClick={() => handleTicketMutation("resolved")}
                  disabled={isSubmitting || showDeleteConfirm}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </Button>
              )}
              {selectedTicket.status === "resolved" && (
                <Button 
                  variant="secondary" 
                  className="flex-1 text-xs h-9 flex items-center justify-center gap-1" 
                  onClick={() => handleTicketMutation("closed")}
                  disabled={isSubmitting || showDeleteConfirm}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Archive & Close Ticket</span>
                </Button>
              )}
              <Button variant="outline" className="h-9 text-xs" onClick={() => setSelectedTicket(null)}>Close Inspection</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}