import React, { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, User, Store, Truck, Star, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type FeedbackUserType = "customer" | "rider" | "vendor";
type FeedbackStatus = "new" | "reviewing" | "resolved" | "closed";

interface FeedbackRecord {
  id: string;
  user_type: FeedbackUserType;
  user_id: string;
  order_id: string | null;
  category: string;
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const userTypeConfig: Record<FeedbackUserType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  customer: { label: "Customer", icon: User, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  rider: { label: "Rider", icon: Truck, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
  vendor: { label: "Vendor", icon: Store, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
};

const statusConfig: Record<FeedbackStatus, { label: string; variant: "neutral" | "warning" | "success" }> = {
  new: { label: "New", variant: "warning" },
  reviewing: { label: "Reviewing", variant: "neutral" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "neutral" },
};

export function Feedback() {
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | FeedbackUserType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<FeedbackRecord | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const itemsPerPage = 10;

  async function fetchFeedback() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, user_type, user_id, order_id, category, rating, message, status, admin_note, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedback((data || []) as FeedbackRecord[]);
    } catch (error) {
      console.error("Failed to load feedback:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFeedback();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feedback.filter((item) => {
      const matchesSearch = !query ||
        item.id.toLowerCase().includes(query) ||
        item.user_id.toLowerCase().includes(query) ||
        (item.order_id || "").toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || item.user_type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [feedback, search, typeFilter, statusFilter]);

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function openFeedback(item: FeedbackRecord) {
    setSelected(item);
    setAdminNote(item.admin_note || "");
  }

  async function updateFeedback(patch: Partial<Pick<FeedbackRecord, "status" | "admin_note">>) {
    if (!selected) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", selected.id)
        .select("id, user_type, user_id, order_id, category, rating, message, status, admin_note, created_at, updated_at")
        .single();

      if (error) throw error;
      const updated = data as FeedbackRecord;
      setFeedback((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      setAdminNote(updated.admin_note || "");
      setSuccessToast("Feedback updated successfully.");
      window.setTimeout(() => setSuccessToast(null), 3000);
    } catch (error) {
      console.error("Failed to update feedback:", error);
    } finally {
      setIsSaving(false);
    }
  }

  const counts = {
    total: feedback.length,
    new: feedback.filter((item) => item.status === "new").length,
    reviewing: feedback.filter((item) => item.status === "reviewing").length,
    resolved: feedback.filter((item) => item.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Review customer, rider, and vendor feedback from the Rivo platform."
      />

      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 border border-emerald-500 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total Feedback", counts.total, MessageSquareText],
          ["New", counts.new, Clock],
          ["Reviewing", counts.reviewing, Search],
          ["Resolved", counts.resolved, CheckCircle],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{value as number}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[#64748B]">
                {React.createElement(Icon as React.ElementType, { className: "w-4 h-4" })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder="Search feedback, user ID, order ID, category..."
              className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:border-[#22C55E]"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as typeof typeFilter); setCurrentPage(1); }} className="h-9 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium">
              <option value="all">All Users</option>
              <option value="customer">Customer</option>
              <option value="rider">Rider</option>
              <option value="vendor">Vendor</option>
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setCurrentPage(1); }} className="h-9 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium">
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Feedback</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rating</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-16 text-xs text-[#94A3B8]">Loading feedback...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-xs text-[#94A3B8]">No feedback matched your filters.</td></tr>
              ) : paginated.map((item) => {
                const config = userTypeConfig[item.user_type];
                const UserIcon = config.icon;
                const status = statusConfig[item.status];
                return (
                  <tr key={item.id} onClick={() => openFeedback(item)} className="hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                    <td className="px-4 py-3.5 max-w-[330px]">
                      <div className="font-mono text-[10px] text-[#94A3B8]">FB-{item.id.slice(0, 8)}</div>
                      <div className="font-semibold text-sm text-[#0F172A] truncate mt-0.5">{item.message}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-bold rounded-md", config.bg, config.color)}>
                        <UserIcon className="w-3 h-3" />
                        {config.label}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-[#475569]">{item.category}</td>
                    <td className="px-4 py-3.5">
                      {item.rating ? <span className="inline-flex items-center gap-1 text-xs font-bold text-[#334155]"><Star className="w-3.5 h-3.5 fill-current" />{item.rating}/5</span> : <span className="text-xs text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><Badge variant={status.variant} label={status.label} dot /></td>
                    <td className="px-4 py-3.5 text-xs text-[#64748B] whitespace-nowrap">{new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3.5 text-right text-[#94A3B8]">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => { if (!isSaving) setSelected(null); }} title={`Feedback #FB-${selected.id.slice(0, 8)}`} description="Feedback review and administration">
          <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={cn("p-3 rounded-xl border", userTypeConfig[selected.user_type].bg)}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Submitted By</p>
                <p className={cn("text-xs font-black mt-1", userTypeConfig[selected.user_type].color)}>{userTypeConfig[selected.user_type].label}</p>
              </div>
              <div className="p-3 rounded-xl border bg-slate-50 border-slate-200">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Rating</p>
                <p className="text-xs font-black mt-1">{selected.rating ? `${selected.rating}/5` : "Not rated"}</p>
              </div>
              <div className="p-3 rounded-xl border bg-slate-50 border-slate-200">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Status</p>
                <Badge className="mt-1" variant={statusConfig[selected.status].variant} label={statusConfig[selected.status].label} />
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              <div><p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Category</p><p className="text-sm font-bold text-[#0F172A] mt-1">{selected.category}</p></div>
              <div><p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Feedback</p><p className="text-sm text-[#475569] leading-relaxed bg-white border border-[#F1F5F9] p-3 rounded-lg whitespace-pre-wrap mt-1">{selected.message}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 bg-white border border-[#E2E8F0] rounded-lg"><span className="text-[#94A3B8]">USER ID</span><div className="text-[#334155] break-all mt-1">{selected.user_id}</div></div>
                <div className="p-2 bg-white border border-[#E2E8F0] rounded-lg"><span className="text-[#94A3B8]">ORDER ID</span><div className="text-[#334155] break-all mt-1">{selected.order_id || "—"}</div></div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Admin Note</label>
              <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={4} placeholder="Add an internal note..." className="w-full border border-[#E2E8F0] rounded-xl p-3 text-sm focus:outline-none focus:border-[#22C55E] resize-none" />
              <Button variant="outline" className="h-9 text-xs" onClick={() => updateFeedback({ admin_note: adminNote })} disabled={isSaving}>Save Note</Button>
            </div>

            <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-2">
              {selected.status === "new" && <Button variant="primary" className="flex-1 h-9 text-xs" onClick={() => updateFeedback({ status: "reviewing" })} disabled={isSaving}>Start Review</Button>}
              {(selected.status === "new" || selected.status === "reviewing") && <Button variant="primary" className="flex-1 h-9 text-xs bg-[#22C55E] hover:bg-[#16A34A] border-0" onClick={() => updateFeedback({ status: "resolved" })} disabled={isSaving}><CheckCircle className="w-3.5 h-3.5 mr-1" />Resolve</Button>}
              {selected.status === "resolved" && <Button variant="secondary" className="flex-1 h-9 text-xs" onClick={() => updateFeedback({ status: "closed" })} disabled={isSaving}><XCircle className="w-3.5 h-3.5 mr-1" />Close</Button>}
              <Button variant="outline" className="h-9 text-xs" onClick={() => setSelected(null)} disabled={isSaving}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Feedback;
