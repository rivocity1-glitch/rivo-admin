import React, { useState, useEffect } from "react";
import {
  Search,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShieldAlert,
  ChevronRight,
  Phone,
  Mail,
  HelpCircle,
  X
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "critical";

interface SupportTicket {
  id: string;
  ticket_display_id: string;
  userType: "customer" | "vendor" | "rider";
  userName: string;
  userContact: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  date: string;
}

const priorityConfig: Record<TicketPriority, { variant: "neutral" | "info" | "warning" | "error"; label: string }> = {
  low: { variant: "neutral", label: "Low" },
  medium: { variant: "info", label: "Medium" },
  high: { variant: "warning", label: "High" },
  critical: { variant: "error", label: "Critical" },
};

const statusConfig: Record<TicketStatus, { variant: "neutral" | "warning" | "success" | "neutral"; label: string }> = {
  open: { variant: "warning", label: "Open" },
  in_progress: { variant: "neutral", label: "In Progress" },
  resolved: { variant: "success", label: "Resolved" },
  closed: { variant: "neutral", label: "Closed" },
};

export function Supports() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [counters, setCounters] = useState({
    openCount: 0,
    criticalCount: 0
  });

  const itemsPerPage = 10;

  async function fetchTickets() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: SupportTicket[] = (data || []).map((row) => ({
        id: row.id,
        ticket_display_id: row.ticket_display_id || "TKT-0000",
        userType: row.user_type,
        userName: row.user_name || "Anonymous",
        userContact: row.user_contact || "—",
        subject: row.subject || "No Subject",
        description: row.description || "No description provided",
        priority: row.priority as TicketPriority,
        status: row.status as TicketStatus,
        date: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      }));

      setTickets(mapped);

      // Extract high priority counts
      const openTickets = mapped.filter(t => t.status === "open").length;
      const criticalTickets = mapped.filter(t => t.priority === "critical" || t.priority === "high").length;

      setCounters({
        openCount: openTickets,
        criticalCount: criticalTickets
      });

      if (selectedTicket) {
        const structuralRefresh = mapped.find(t => t.id === selectedTicket.id);
        if (structuralRefresh) setSelectedTicket(structuralRefresh);
      }
    } catch (err) {
      console.error("Failed loading tickets infrastructure:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, []);

  async function updateTicketStatus(id: string, nextStatus: TicketStatus) {
    try {
      setIsSubmitting(true);
      const payload: any = { status: nextStatus };
      if (nextStatus === "resolved" || nextStatus === "closed") {
        payload.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase.from("support_tickets").update(payload).eq("id", id);
      if (error) throw error;

      await fetchTickets();
    } catch (err) {
      console.error("Mutation failure hook context:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = tickets.filter((t) => {
    const matchSearch =
      t.ticket_display_id.toLowerCase().includes(search.toLowerCase()) ||
      t.userName.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader title="Support Desk" description="Manage platform client issues and deploy operations troubleshooting." />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Open Tickets</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counters.openCount} Awaiting Fix</h3>
          </div>
          <div className="w-10 h-10 bg-amber-50 border border-amber-100 text-amber-500 rounded-lg flex items-center justify-center"><HelpCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between border-rose-100 bg-rose-50/10">
          <div>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">High & Critical Priority</p>
            <h3 className="text-2xl font-bold text-rose-700 mt-1">{counters.criticalCount} Active Threats</h3>
          </div>
          <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Filtering Actions Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by ID, name..."
            className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
          />
        </div>
        <div className="flex border border-[#E2E8F0] rounded-lg p-0.5 bg-white">
          {["all", "open", "in_progress", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn("h-7 px-3 rounded-md text-xs font-medium capitalize", statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B]")}
            >
              {s === "in_progress" ? "In Progress" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Desktop Layout Grid */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Ticket ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">User Node Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Core Issue Subject</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Created At</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-16 text-xs text-[#94A3B8]">Syncing live desk infrastructure logs...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-xs text-[#94A3B8]">No active helpdesk parameters matched.</td></tr>
            ) : (
              paginated.map((t) => {
                const priority = priorityConfig[t.priority] || { variant: "neutral", label: t.priority };
                const status = statusConfig[t.status] || { variant: "neutral", label: t.status };
                return (
                  <tr key={t.id} className="hover:bg-[#FAFAFA] text-sm text-[#334155] cursor-pointer" onClick={() => setSelectedTicket(t)}>
                    <td className="px-4 py-3.5 font-mono font-medium text-[#0F172A]">#{t.ticket_display_id}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[#0F172A]">{t.userName}</div>
                      <div className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mt-0.5">{t.userType}</div>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs font-medium text-[#475569] truncate">{t.subject}</td>
                    <td className="px-4 py-3.5"><Badge variant={priority.variant} label={priority.label} /></td>
                    <td className="px-4 py-3.5"><Badge variant={status.variant} label={status.label} dot /></td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B]">{t.date}</td>
                    <td className="px-4 py-3.5"><ChevronRight className="w-4 h-4 text-[#94A3B8]" /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {/* Ticket Details Inspection Window Modal overlay */}
      {selectedTicket && (
        <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={`Ticket #${selectedTicket.ticket_display_id}`} description={`Report origin channel verified via live sync parameters.`}>
          <div className="space-y-4">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-1">Issue Subject</p>
                <h4 className="text-base font-bold text-[#0F172A]">{selectedTicket.subject}</h4>
              </div>
              <div>
                <p className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-1">Detailed Description Context</p>
                <p className="text-sm text-[#475569] leading-relaxed bg-white border border-[#F1F5F9] p-2.5 rounded-lg font-medium">{selectedTicket.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-[#475569] font-medium">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl space-y-1">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold">Contact Source</p>
                <p className="font-bold text-[#0F172A]">{selectedTicket.userName}</p>
                <p className="text-[#64748B]">{selectedTicket.userContact}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Priority Status</span>
                  <Badge variant={priorityConfig[selectedTicket.priority].variant} label={priorityConfig[selectedTicket.priority].label} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Current State</span>
                  <Badge variant={statusConfig[selectedTicket.status].variant} label={statusConfig[selectedTicket.status].label} />
                </div>
              </div>
            </div>

            {/* Workflow Progression Controls matrix */}
            <div className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
              {selectedTicket.status === "open" && (
                <Button variant="primary" className="flex-1" onClick={() => updateTicketStatus(selectedTicket.id, "in_progress")} disabled={isSubmitting}>Claim & Start Progress</Button>
              )}
              {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
                <Button variant="primary" className="flex-1 text-white bg-[#22C55E] hover:bg-[#16A34A]" onClick={() => updateTicketStatus(selectedTicket.id, "resolved")} disabled={isSubmitting}>Mark Resolved</Button>
              )}
              {selectedTicket.status === "resolved" && (
                <Button variant="secondary" className="flex-1" onClick={() => updateTicketStatus(selectedTicket.id, "closed")} disabled={isSubmitting}>Archive & Close Ticket</Button>
              )}
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>Close Inspection</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}