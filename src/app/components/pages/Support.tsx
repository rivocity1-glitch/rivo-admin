import React, { useEffect, useMemo, useState } from "react";
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
  Trash2,
  Send,
  MessageSquare,
  RefreshCcw,
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
type SenderType = UserType | "admin";

interface SupportTicket {
  id: string;
  user_type: UserType;
  user_id: string;
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
  unread_for_admin: boolean;
  unread_for_user: boolean;
  last_message_at: string | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  message: string;
  attachment_url: string | null;
  is_internal: boolean;
  created_at: string;
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

const ticketTable = (type: UserType) => {
  if (type === "customer") return "customer_support_tickets";
  if (type === "vendor") return "vendor_support_tickets";
  return "rider_support_tickets";
};

function formatTicketDate(rawDate: string | null): string {
  if (!rawDate) return "—";
  return new Date(rawDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageDate(rawDate: string): string {
  return new Date(rawDate).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Supports() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [counters, setCounters] = useState({ openCount: 0, highPriorityCount: 0, unreadCount: 0 });
  const itemsPerPage = 10;

  const adminSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rivo_admin_session") || "null");
    } catch {
      return null;
    }
  }, []);

  function showSuccess(message: string) {
    setSuccessToast(message);
    setErrorToast(null);
    window.setTimeout(() => setSuccessToast(null), 3500);
  }

  function showError(message: string) {
    setErrorToast(message);
    setSuccessToast(null);
    window.setTimeout(() => setErrorToast(null), 5000);
  }

  function getSuggestedFix(ticket: SupportTicket): string {
    const textContext = `${ticket.subject} ${ticket.message} ${ticket.issue_type || ""}`.toLowerCase();
    if (ticket.user_type === "vendor") {
      if (textContext.includes("payout") || textContext.includes("billing") || textContext.includes("bank")) {
        return "Verify vendor payout metadata, bank details, and the settlement ledger before making a manual adjustment.";
      }
      if (textContext.includes("inventory") || textContext.includes("sync") || textContext.includes("stock")) {
        return "Verify product availability and vendor inventory synchronization before changing catalog records.";
      }
    }
    if (ticket.user_type === "rider" && (textContext.includes("location") || textContext.includes("gps") || textContext.includes("map"))) {
      return "Inspect the rider location heartbeat and tracking session before resetting location state.";
    }
    if (textContext.includes("payment") || textContext.includes("refund") || textContext.includes("transaction")) {
      return "Trace the payment reference and order ledger before approving a refund or financial adjustment.";
    }
    return "Review the related account and transaction records, then respond with the verified resolution or request additional diagnostics.";
  }

  async function autoDeleteOldClosedTickets() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffISO = cutoff.toISOString();
      await Promise.all([
        supabase.from("vendor_support_tickets").delete().eq("status", "closed").lt("created_at", cutoffISO),
        supabase.from("customer_support_tickets").delete().eq("status", "closed").lt("created_at", cutoffISO),
        supabase.from("rider_support_tickets").delete().eq("status", "closed").lt("created_at", cutoffISO),
      ]);
    } catch (error) {
      console.error("Closed support ticket cleanup failed:", error);
    }
  }

  async function fetchTickets() {
    try {
      setIsLoading(true);
      const allTickets: SupportTicket[] = [];

      const customer = await supabase
        .from("customer_support_tickets")
        .select("id, customer_id, title, description, status, priority, issue_type, screenshot_url, created_at, unread_for_admin, unread_for_customer, last_message_at");
      if (customer.error) console.error("Customer support fetch failed:", customer.error);
      (customer.data || []).forEach((t: any) => allTickets.push({
        id: t.id,
        user_type: "customer",
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
        unread_for_admin: Boolean(t.unread_for_admin),
        unread_for_user: Boolean(t.unread_for_customer),
        last_message_at: t.last_message_at || null,
      }));

      const vendor = await supabase
        .from("vendor_support_tickets")
        .select("id, vendor_id, title, description, status, priority, issue_type, screenshot_url, created_at, unread_for_admin, unread_for_vendor, last_message_at");
      if (vendor.error) console.error("Vendor support fetch failed:", vendor.error);
      (vendor.data || []).forEach((t: any) => allTickets.push({
        id: t.id,
        user_type: "vendor",
        user_id: t.vendor_id,
        vendor_id: t.vendor_id,
        reference_id: null,
        subject: t.title || "No Subject",
        message: t.description || "No message provided",
        status: (t.status || "open") as TicketStatus,
        priority: (t.priority || "medium") as PriorityType,
        issue_type: t.issue_type || null,
        screenshot_url: t.screenshot_url || null,
        raw_date: t.created_at,
        date: formatTicketDate(t.created_at),
        unread_for_admin: Boolean(t.unread_for_admin),
        unread_for_user: Boolean(t.unread_for_vendor),
        last_message_at: t.last_message_at || null,
      }));

      const rider = await supabase
        .from("rider_support_tickets")
        .select("id, rider_id, title, description, status, priority, issue_type, screenshot_url, created_at, unread_for_admin, unread_for_rider, last_message_at");
      if (rider.error) console.error("Rider support fetch failed:", rider.error);
      (rider.data || []).forEach((t: any) => allTickets.push({
        id: t.id,
        user_type: "rider",
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
        unread_for_admin: Boolean(t.unread_for_admin),
        unread_for_user: Boolean(t.unread_for_rider),
        last_message_at: t.last_message_at || null,
      }));

      allTickets.sort((a, b) => new Date(b.last_message_at || b.raw_date).getTime() - new Date(a.last_message_at || a.raw_date).getTime());
      setTickets(allTickets);
      setCounters({
        openCount: allTickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
        highPriorityCount: allTickets.filter((t) => t.priority === "high" && t.status !== "closed").length,
        unreadCount: allTickets.filter((t) => t.unread_for_admin).length,
      });

      if (selectedTicket) {
        const refreshed = allTickets.find((t) => t.id === selectedTicket.id && t.user_type === selectedTicket.user_type);
        if (refreshed) setSelectedTicket(refreshed);
      }
    } catch (error) {
      console.error("Support desk fetch failed:", error);
      showError("Unable to load support tickets.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversation(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setPreviewScreenshot(false);
    setShowDeleteConfirm(false);
    setReplyText("");
    setMessages([]);
    setIsMessagesLoading(true);

    try {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("id, ticket_id, sender_type, sender_id, message, attachment_url, is_internal, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);

      const table = ticketTable(ticket.user_type);
      const unreadColumn = "unread_for_admin";
      const { error: markReadError } = await supabase
        .from(table)
        .update({ [unreadColumn]: false })
        .eq("id", ticket.id);
      if (markReadError) console.error("Failed to mark support ticket read:", markReadError);

      setSelectedTicket({ ...ticket, unread_for_admin: false });
      setTickets((current) => current.map((item) => item.id === ticket.id && item.user_type === ticket.user_type ? { ...item, unread_for_admin: false } : item));
      setCounters((current) => ({ ...current, unreadCount: Math.max(0, current.unreadCount - (ticket.unread_for_admin ? 1 : 0)) }));
    } catch (error) {
      console.error("Support conversation fetch failed:", error);
      showError("Unable to load this conversation.");
    } finally {
      setIsMessagesLoading(false);
    }
  }

  async function handleReply() {
    if (!selectedTicket || !replyText.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const { data: inserted, error } = await supabase
        .from("support_ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: "admin",
          sender_id: adminSession?.id || null,
          message: replyText.trim(),
          attachment_url: null,
          is_internal: false,
          created_at: now,
        })
        .select("id, ticket_id, sender_type, sender_id, message, attachment_url, is_internal, created_at")
        .single();
      if (error) throw error;

      const table = ticketTable(selectedTicket.user_type);
      const { error: ticketError } = await supabase
        .from(table)
        .update({
          last_message_at: now,
          unread_for_admin: false,
          ...(selectedTicket.user_type === "customer" ? { unread_for_customer: true } : {}),
          ...(selectedTicket.user_type === "vendor" ? { unread_for_vendor: true } : {}),
          ...(selectedTicket.user_type === "rider" ? { unread_for_rider: true } : {}),
          status: selectedTicket.status === "open" ? "in_progress" : selectedTicket.status,
        })
        .eq("id", selectedTicket.id);
      if (ticketError) throw ticketError;

      const recipientId = selectedTicket.user_id;
      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: recipientId,
        recipient_type: selectedTicket.user_type,
        title: "Support Team Reply",
        message: replyText.trim().slice(0, 180),
        is_read: false,
        created_at: now,
      });
      if (notificationError) console.error("Support reply notification failed:", notificationError);

      setMessages((current) => [...current, inserted as SupportMessage]);
      setReplyText("");
      showSuccess("Reply sent successfully.");
      await fetchTickets();
    } catch (error: any) {
      console.error("Support reply failed:", error);
      showError(error?.message || "Unable to send reply.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTicketMutation(nextStatus: TicketStatus) {
    if (!selectedTicket || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const table = ticketTable(selectedTicket.user_type);
      const now = new Date().toISOString();
      const { error } = await supabase.from(table).update({
        status: nextStatus,
        ...(nextStatus === "closed" || nextStatus === "resolved" ? { unread_for_admin: false } : {}),
      }).eq("id", selectedTicket.id);
      if (error) throw error;

      const messages: Record<TicketStatus, string> = {
        open: "Your support ticket has been reopened.",
        in_progress: "Your support ticket is now being reviewed by the Rivo Support Team.",
        resolved: "Your support ticket has been resolved.",
        closed: "Your support ticket has been closed.",
      };
      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: selectedTicket.user_id,
        recipient_type: selectedTicket.user_type,
        title: "Support Ticket Update",
        message: messages[nextStatus],
        is_read: false,
        created_at: now,
      });
      if (notificationError) console.error("Status notification failed:", notificationError);

      showSuccess(`Ticket marked ${statusConfig[nextStatus].label.toLowerCase()}.`);
      await fetchTickets();
      const updated = tickets.find((t) => t.id === selectedTicket.id && t.user_type === selectedTicket.user_type);
      if (updated) setSelectedTicket({ ...updated, status: nextStatus });
    } catch (error: any) {
      console.error("Support status update failed:", error);
      showError(error?.message || "Unable to update ticket status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTicketDeletion() {
    if (!selectedTicket || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const table = ticketTable(selectedTicket.user_type);
      const { error: messageError } = await supabase.from("support_ticket_messages").delete().eq("ticket_id", selectedTicket.id);
      if (messageError) throw messageError;
      const { error } = await supabase.from(table).delete().eq("id", selectedTicket.id);
      if (error) throw error;
      setShowDeleteConfirm(false);
      setSelectedTicket(null);
      setMessages([]);
      showSuccess("Support ticket deleted successfully.");
      await fetchTickets();
    } catch (error: any) {
      console.error("Support ticket deletion failed:", error);
      showError(error?.message || "Unable to delete ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    autoDeleteOldClosedTickets();
    fetchTickets();
  }, []);

  const filtered = tickets.filter((ticket) => {
    const q = search.trim().toLowerCase();
    const displayId = `tkt-${ticket.id.slice(0, 8)}`;
    const matchSearch = !q || displayId.includes(q) || ticket.user_id.toLowerCase().includes(q) || ticket.subject.toLowerCase().includes(q) || (ticket.issue_type || "").toLowerCase().includes(q);
    const matchType = typeFilter === "all" || ticket.user_type === typeFilter;
    const matchPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchSearch && matchType && matchPriority && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader title="Support Desk" description="Unified support inbox for customer, vendor, and rider conversations." />

      {(successToast || errorToast) && (
        <div className={cn("fixed top-4 right-4 z-[60] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2", successToast ? "bg-emerald-600" : "bg-red-600")}>
          {successToast ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{successToast || errorToast}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Open Queue</p><h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counters.openCount}</h3></div>
          <div className="w-10 h-10 bg-amber-50 border border-amber-100 text-amber-500 rounded-lg flex items-center justify-center"><HelpCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Unread</p><h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counters.unreadCount}</h3></div>
          <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-500 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">High Priority</p><h3 className="text-2xl font-bold text-red-600 mt-1">{counters.highPriorityCount}</h3></div>
          <div className="w-10 h-10 bg-red-50 border border-red-100 text-red-500 rounded-lg flex items-center justify-center"><AlertCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Tickets</p><h3 className="text-2xl font-bold text-[#0F172A] mt-1">{tickets.length}</h3></div>
          <div className="w-10 h-10 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search ticket, account UUID, subject..." className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E]" />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }} className="h-8 px-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155]">
              <option value="all">All Channels</option><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="rider">Rider</option>
            </select>
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }} className="h-8 px-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155]">
              <option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <Button variant="outline" className="h-8 text-xs flex items-center gap-1.5" onClick={fetchTickets} disabled={isLoading}><RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /> Refresh</Button>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#F1F5F9] pt-3 overflow-x-auto">
          <span className="text-xs font-semibold text-[#64748B] whitespace-nowrap">Status:</span>
          <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-slate-50 shrink-0">
            {["all", "open", "in_progress", "resolved", "closed"].map((status) => (
              <button key={status} onClick={() => { setStatusFilter(status); setCurrentPage(1); }} className={cn("h-7 px-3 rounded-md text-xs font-medium capitalize", statusFilter === status ? "bg-[#22C55E] text-white shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>{status === "in_progress" ? "In Progress" : status}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Ticket</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Origin</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Account UUID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase">Last Activity</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? <tr><td colSpan={8} className="text-center py-16 text-xs text-[#94A3B8]">Loading support inbox...</td></tr> : paginated.length === 0 ? <tr><td colSpan={8} className="text-center py-16 text-xs text-[#94A3B8]">No support tickets matched.</td></tr> : paginated.map((ticket) => {
                const userType = userTypeConfig[ticket.user_type];
                const UserIcon = userType.icon;
                const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
                const status = statusConfig[ticket.status] || statusConfig.open;
                return <tr key={`${ticket.user_type}-${ticket.id}`} onClick={() => loadConversation(ticket)} className="hover:bg-[#FAFAFA] text-sm text-[#334155] cursor-pointer transition-colors">
                  <td className="px-4 py-3.5 font-mono font-medium text-[#0F172A]">TKT-{ticket.id.slice(0, 8)}</td>
                  <td className="px-4 py-3.5"><div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs font-bold rounded-md", userType.bg, userType.color)}><UserIcon className="w-3 h-3" />{userType.label}</div></td>
                  <td className="px-4 py-3.5 font-mono text-xs text-[#64748B] max-w-[150px] truncate">{ticket.user_id}</td>
                  <td className="px-4 py-3.5 max-w-xs"><div className="flex flex-col"><span className="font-semibold text-[#0F172A] truncate">{ticket.subject}</span>{ticket.issue_type && <span className="text-[10px] text-[#94A3B8] font-bold uppercase mt-0.5">{ticket.issue_type}</span>}{ticket.unread_for_admin && <span className="text-[10px] text-blue-600 font-bold mt-0.5">UNREAD</span>}</div></td>
                  <td className="px-4 py-3.5"><Badge variant={priority.variant} label={priority.label} className={priority.customClasses} /></td>
                  <td className="px-4 py-3.5"><Badge variant={status.variant} label={status.label} dot /></td>
                  <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{formatTicketDate(ticket.last_message_at || ticket.raw_date)}</td>
                  <td className="px-4 py-3.5 text-right"><ChevronRight className="w-4 h-4 text-[#94A3B8] inline" /></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={Math.max(1, Math.ceil(filtered.length / itemsPerPage))} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {selectedTicket && <Modal open={!!selectedTicket} onClose={() => { if (!isSubmitting) setSelectedTicket(null); }} title={`Ticket #TKT-${selectedTicket.id.slice(0, 8)}`} description={`${userTypeConfig[selectedTicket.user_type].label} support conversation`} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={cn("p-3 rounded-xl border", userTypeConfig[selectedTicket.user_type].bg)}><span className="text-[9px] font-bold uppercase text-[#64748B]">Entity</span><div className={cn("text-xs font-black uppercase mt-1", userTypeConfig[selectedTicket.user_type].color)}>{userTypeConfig[selectedTicket.user_type].label}</div></div>
            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl"><span className="text-[9px] font-bold uppercase text-[#64748B]">Priority</span><div className="mt-1"><Badge variant={priorityConfig[selectedTicket.priority]?.variant || "neutral"} label={priorityConfig[selectedTicket.priority]?.label || selectedTicket.priority} className={priorityConfig[selectedTicket.priority]?.customClasses} /></div></div>
            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl"><span className="text-[9px] font-bold uppercase text-[#64748B]">Status</span><div className="mt-1"><Badge variant={statusConfig[selectedTicket.status].variant} label={statusConfig[selectedTicket.status].label} /></div></div>
            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl"><span className="text-[9px] font-bold uppercase text-[#64748B]">Account</span><div className="mt-1 text-[10px] font-mono text-[#334155] truncate">{selectedTicket.user_id}</div></div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Original ticket</p><h4 className="text-sm font-bold text-[#0F172A] mt-1">{selectedTicket.subject}</h4></div><span className="text-[10px] text-[#94A3B8]">{formatTicketDate(selectedTicket.raw_date)}</span></div>
            <p className="text-xs text-[#475569] leading-relaxed bg-white border border-[#F1F5F9] p-3 rounded-lg font-medium whitespace-pre-wrap mt-3">{selectedTicket.message}</p>
          </div>

          {selectedTicket.screenshot_url && <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-slate-50">
            <button type="button" onClick={() => setPreviewScreenshot(!previewScreenshot)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#334155] bg-white border-b border-[#E2E8F0]"><span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-[#10B981]" />Attachment</span><span className="flex items-center gap-1 text-[#22C55E]"><Eye className="w-3.5 h-3.5" />{previewScreenshot ? "Collapse" : "Preview"}</span></button>
            {previewScreenshot && <div className="p-3 bg-slate-900 flex justify-center max-h-72 overflow-hidden"><img src={selectedTicket.screenshot_url} alt="Support attachment" className="max-w-full max-h-64 object-contain rounded" /></div>}
          </div>}

          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-[#E2E8F0] flex items-center justify-between"><div><h4 className="text-sm font-bold text-[#0F172A] flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#22C55E]" />Conversation</h4><p className="text-[10px] text-[#94A3B8] mt-0.5">All user and Admin replies are stored here.</p></div><span className="text-[10px] font-bold text-[#64748B]">{messages.length} messages</span></div>
            <div className="p-4 bg-[#F8FAFC] max-h-[360px] overflow-y-auto space-y-3">
              {isMessagesLoading ? <div className="py-12 text-center text-xs text-[#94A3B8]">Loading conversation...</div> : messages.length === 0 ? <div className="py-10 text-center text-xs text-[#94A3B8]">No replies yet. The original ticket is shown above.</div> : messages.map((message) => {
                const isAdmin = message.sender_type === "admin";
                return <div key={message.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-2xl px-4 py-3 border shadow-sm", isAdmin ? "bg-[#E8FBF0] border-[#BBF7D0]" : "bg-white border-[#E2E8F0]")}>
                  <div className="flex items-center justify-between gap-5 mb-1.5"><span className={cn("text-[10px] font-black uppercase", isAdmin ? "text-[#15803D]" : userTypeConfig[selectedTicket.user_type].color)}>{isAdmin ? "Rivo Support" : userTypeConfig[selectedTicket.user_type].label}</span><span className="text-[9px] text-[#94A3B8]">{formatMessageDate(message.created_at)}</span></div>
                  <p className="text-xs text-[#334155] leading-relaxed whitespace-pre-wrap">{message.message}</p>
                  {message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer" className="block text-[10px] text-[#16A34A] font-semibold mt-2">View attachment</a>}
                </div></div>;
              })}
            </div>
            <div className="p-4 bg-white border-t border-[#E2E8F0]">
              <div className="flex gap-2 items-end">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }} disabled={isSubmitting || selectedTicket.status === "closed"} placeholder={selectedTicket.status === "closed" ? "Closed tickets cannot receive replies." : "Write a reply to the user..."} rows={3} className="flex-1 resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#0F172A] focus:outline-none focus:border-[#22C55E] disabled:opacity-60" />
                <Button variant="primary" className="h-10 px-4 text-xs flex items-center gap-1.5" onClick={handleReply} disabled={isSubmitting || !replyText.trim() || selectedTicket.status === "closed"}><Send className="w-3.5 h-3.5" />{isSubmitting ? "Sending..." : "Send Reply"}</Button>
              </div>
              <p className="text-[9px] text-[#94A3B8] mt-1.5">Enter to send · Shift+Enter for a new line</p>
            </div>
          </div>

          <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-3"><h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide"><Wrench className="w-3.5 h-3.5" />Suggested Operational Action</h5><p className="text-xs text-emerald-900 font-medium leading-relaxed bg-white border border-emerald-100 p-2 rounded-lg mt-1.5">{getSuggestedFix(selectedTicket)}</p></div>

          {showDeleteConfirm && <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3"><p className="text-xs font-bold text-red-800">Delete this support ticket and its conversation permanently?</p><div className="flex gap-2"><Button variant="outline" className="h-8 text-xs flex-1" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>Cancel</Button><Button variant="primary" className="h-8 text-xs flex-1 bg-red-600 hover:bg-red-700 border-0 text-white" onClick={handleTicketDeletion} disabled={isSubmitting}>Delete Permanent</Button></div></div>}

          <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-2">
            {!showDeleteConfirm && <Button variant="outline" className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1" onClick={() => setShowDeleteConfirm(true)} disabled={isSubmitting}><Trash2 className="w-3.5 h-3.5" />Delete Ticket</Button>}
            {selectedTicket.status === "open" && <Button variant="primary" className="flex-1 text-xs h-9" onClick={() => handleTicketMutation("in_progress")} disabled={isSubmitting || showDeleteConfirm}>Claim & Start Progress</Button>}
            {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && <Button variant="primary" className="flex-1 text-xs h-9 bg-[#22C55E] hover:bg-[#16A34A] border-0 flex items-center justify-center gap-1" onClick={() => handleTicketMutation("resolved")} disabled={isSubmitting || showDeleteConfirm}><CheckCircle className="w-3.5 h-3.5" />Mark Resolved</Button>}
            {selectedTicket.status === "resolved" && <Button variant="secondary" className="flex-1 text-xs h-9 flex items-center justify-center gap-1" onClick={() => handleTicketMutation("closed")} disabled={isSubmitting || showDeleteConfirm}><XCircle className="w-3.5 h-3.5" />Archive & Close</Button>}
            {(selectedTicket.status === "resolved" || selectedTicket.status === "closed") && <Button variant="outline" className="h-9 text-xs" onClick={() => handleTicketMutation("open")} disabled={isSubmitting || showDeleteConfirm}>Reopen</Button>}
            <Button variant="outline" className="h-9 text-xs" onClick={() => setSelectedTicket(null)} disabled={isSubmitting}>Close Inspection</Button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}
