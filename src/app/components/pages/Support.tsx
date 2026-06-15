import React, { useState } from "react";
import {
  Search,
  MoreHorizontal,
  MessageSquare,
  UserCheck,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { cn } from "../../../lib/utils";

type TicketStatus = "open" | "in_review" | "resolved" | "closed";
type TicketCategory = "delivery" | "payment" | "product" | "vendor" | "app" | "other";

interface Ticket {
  id: string;
  subject: string;
  customer: string;
  category: TicketCategory;
  assignedTo: string;
  status: TicketStatus;
  priority: "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
  orderId?: string;
}

const tickets: Ticket[] = [
  {
    id: "TKT-0052",
    subject: "Rider delivered to wrong address",
    customer: "Ananya Sharma",
    category: "delivery",
    assignedTo: "Preethi R.",
    status: "open",
    priority: "high",
    createdAt: "Today, 2:30 PM",
    updatedAt: "Today, 2:30 PM",
    orderId: "RIV-4820",
  },
  {
    id: "TKT-0051",
    subject: "Payment deducted but order not placed",
    customer: "Rohan Desai",
    category: "payment",
    assignedTo: "Unassigned",
    status: "open",
    priority: "high",
    createdAt: "Today, 11:14 AM",
    updatedAt: "Today, 11:14 AM",
  },
  {
    id: "TKT-0050",
    subject: "App crashes on checkout screen",
    customer: "Meera Iyer",
    category: "app",
    assignedTo: "Dev Team",
    status: "in_review",
    priority: "medium",
    createdAt: "Yesterday",
    updatedAt: "Today, 9:00 AM",
  },
  {
    id: "TKT-0049",
    subject: "Expired products received from vendor",
    customer: "Kiran Patel",
    category: "product",
    assignedTo: "Preethi R.",
    status: "in_review",
    priority: "high",
    createdAt: "13 Jun 2025",
    updatedAt: "14 Jun 2025",
    orderId: "RIV-4791",
  },
  {
    id: "TKT-0048",
    subject: "Late delivery — over 2 hours",
    customer: "Meera Iyer",
    category: "delivery",
    assignedTo: "Preethi R.",
    status: "resolved",
    priority: "medium",
    createdAt: "12 Jun 2025",
    updatedAt: "13 Jun 2025",
    orderId: "RIV-4783",
  },
  {
    id: "TKT-0047",
    subject: "Request to change delivery address",
    customer: "Lakshmi Venkat",
    category: "delivery",
    assignedTo: "Auto-closed",
    status: "closed",
    priority: "low",
    createdAt: "11 Jun 2025",
    updatedAt: "11 Jun 2025",
  },
];

const statusConfig: Record<TicketStatus, { variant: any; label: string }> = {
  open: { variant: "error", label: "Open" },
  in_review: { variant: "warning", label: "In Review" },
  resolved: { variant: "success", label: "Resolved" },
  closed: { variant: "neutral", label: "Closed" },
};

const priorityConfig = {
  high: { variant: "error" as const, label: "High" },
  medium: { variant: "warning" as const, label: "Medium" },
  low: { variant: "neutral" as const, label: "Low" },
};

const categoryLabels: Record<TicketCategory, string> = {
  delivery: "Delivery",
  payment: "Payment",
  product: "Product Quality",
  vendor: "Vendor Issue",
  app: "App / Technical",
  other: "Other",
};

export function Support() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [ticketList, setTicketList] = useState<Ticket[]>(tickets);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [replyOpen, setReplyOpen] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const itemsPerPage = 10;

  const filtered = ticketList.filter((t) => {
    const matchSearch =
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.customer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function updateStatus(id: string, status: TicketStatus) {
    setTicketList((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setViewTicket(null);
  }

  return (
    <div>
      <PageHeader
        title="Support"
        description={`${ticketList.filter((t) => t.status === "open").length} open tickets`}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "open", "in_review", "resolved", "closed"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all",
                statusFilter === s
                  ? "bg-[#22C55E] text-white"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
              )}
            >
              {s === "all" ? "All" : s === "in_review" ? "In Review" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Ticket</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Assigned To</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((ticket) => {
              const s = statusConfig[ticket.status];
              const p = priorityConfig[ticket.priority];
              return (
                <tr key={ticket.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3.5">
                    <div>
                      <button
                        onClick={() => setViewTicket(ticket)}
                        className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] transition-colors text-left"
                      >
                        {ticket.subject}
                      </button>
                      <p className="text-xs text-[#64748B] mt-0.5">{ticket.id} · {ticket.customer}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-[#64748B]">{categoryLabels[ticket.category]}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={p.variant} label={p.label} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("text-sm", ticket.assignedTo === "Unassigned" ? "text-[#94A3B8] italic" : "text-[#0F172A]")}>
                      {ticket.assignedTo}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={s.variant} label={s.label} dot />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{ticket.createdAt}</td>
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
                          label: "View Ticket",
                          icon: <Eye className="w-3.5 h-3.5" />,
                          onClick: () => setViewTicket(ticket),
                        },
                        {
                          label: "Reply",
                          icon: <MessageSquare className="w-3.5 h-3.5" />,
                          onClick: () => setReplyOpen(ticket),
                        },
                        ...(ticket.status !== "resolved" && ticket.status !== "closed"
                          ? [{
                              label: "Mark Resolved",
                              icon: <CheckCircle className="w-3.5 h-3.5" />,
                              onClick: () => updateStatus(ticket.id, "resolved"),
                            }]
                          : []),
                        ...(ticket.status !== "closed"
                          ? [{
                              label: "Close Ticket",
                              icon: <XCircle className="w-3.5 h-3.5" />,
                              onClick: () => updateStatus(ticket.id, "closed"),
                              variant: "danger" as const,
                              divider: true,
                            }]
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

      {/* View Ticket */}
      {viewTicket && (
        <Modal
          open={!!viewTicket}
          onClose={() => setViewTicket(null)}
          title={viewTicket.subject}
          description={`${viewTicket.id} · ${viewTicket.createdAt}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewTicket(null)}>Close</Button>
              {viewTicket.status !== "resolved" && (
                <Button
                  variant="primary"
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  onClick={() => updateStatus(viewTicket.id, "resolved")}
                >
                  Resolve
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Customer", value: viewTicket.customer },
                { label: "Category", value: categoryLabels[viewTicket.category] },
                { label: "Priority", value: viewTicket.priority.charAt(0).toUpperCase() + viewTicket.priority.slice(1) },
                { label: "Assigned To", value: viewTicket.assignedTo },
                ...(viewTicket.orderId ? [{ label: "Related Order", value: `#${viewTicket.orderId}` }] : []),
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                  <p className="text-xs text-[#64748B] mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select
                label="Assign to"
                value={viewTicket.assignedTo}
                onChange={() => {}}
                options={[
                  { value: "Preethi R.", label: "Preethi R." },
                  { value: "Dev Team", label: "Dev Team" },
                  { value: "Operations", label: "Operations" },
                ]}
              />
              <Select
                label="Status"
                value={viewTicket.status}
                onChange={(v) => updateStatus(viewTicket.id, v as TicketStatus)}
                options={[
                  { value: "open", label: "Open" },
                  { value: "in_review", label: "In Review" },
                  { value: "resolved", label: "Resolved" },
                  { value: "closed", label: "Closed" },
                ]}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Reply Modal */}
      {replyOpen && (
        <Modal
          open={!!replyOpen}
          onClose={() => setReplyOpen(null)}
          title={`Reply to ${replyOpen.customer}`}
          description={`${replyOpen.id} · ${replyOpen.subject}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setReplyOpen(null)}>Cancel</Button>
              <Button
                variant="primary"
                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                onClick={() => { setReplyOpen(null); setReply(""); }}
              >
                Send Reply
              </Button>
            </>
          }
        >
          <Textarea
            label="Message"
            placeholder="Type your reply to the customer..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={5}
          />
        </Modal>
      )}
    </div>
  );
}
