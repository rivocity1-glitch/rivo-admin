import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Eye, MessageSquare, RefreshCcw, Search, Send, Star, Trash2, UserRound, XCircle } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { supabase } from "../../../lib/supabase";

type FeedbackStatus = "unread" | "read" | "solved" | "thanked";

type Feedback = {
  id: string;
  customer_id?: string | null;
  rating: number;
  message: string;
  category?: string | null;
  status: FeedbackStatus;
  admin_reply?: string | null;
  created_at: string;
  read_at?: string | null;
  solved_at?: string | null;
  thanked_at?: string | null;
  customers?: { customer_name?: string | null; email?: string | null; phone?: string | null } | null;
};

const PAGE_SIZE = 10;

export function Feedback() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_feedback")
      .select("*, customers(customer_name,email,phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load feedback:", error);
      setRows([]);
    } else {
      setRows((data || []) as Feedback[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      const customer = item.customers;
      return [item.message, item.category, customer?.customer_name, customer?.email, customer?.phone]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [rows, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openFeedback = async (item: Feedback) => {
    setSelected(item);
    setReply(item.admin_reply || "");
    if (item.status === "unread") {
      const { error } = await supabase.from("customer_feedback").update({ status: "read", read_at: new Date().toISOString() }).eq("id", item.id);
      if (!error) {
        setRows((current) => current.map((row) => row.id === item.id ? { ...row, status: "read", read_at: new Date().toISOString() } : row));
        setSelected((current) => current ? { ...current, status: "read" } : current);
      }
    }
  };

  const updateStatus = async (nextStatus: FeedbackStatus) => {
    if (!selected) return;
    setSaving(true);
    const patch: Record<string, string | null> = { status: nextStatus };
    if (nextStatus === "read") patch.read_at = new Date().toISOString();
    if (nextStatus === "solved") patch.solved_at = new Date().toISOString();
    if (nextStatus === "thanked") patch.thanked_at = new Date().toISOString();
    const { error } = await supabase.from("customer_feedback").update(patch).eq("id", selected.id);
    if (!error) {
      setRows((current) => current.map((row) => row.id === selected.id ? { ...row, ...patch } as Feedback : row));
      setSelected((current) => current ? { ...current, ...patch } as Feedback : current);
    }
    setSaving(false);
  };

  const sendThankYou = async () => {
    if (!selected || !reply.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("customer_feedback").update({ admin_reply: reply.trim(), status: "thanked", thanked_at: now, read_at: selected.read_at || now }).eq("id", selected.id);
    if (!error) {
      const updated = { ...selected, admin_reply: reply.trim(), status: "thanked" as FeedbackStatus, thanked_at: now };
      setSelected(updated);
      setRows((current) => current.map((row) => row.id === selected.id ? updated : row));
    }
    setSaving(false);
  };

  const deleteFeedback = async () => {
    if (!selected || !window.confirm("Delete this feedback permanently?")) return;
    setSaving(true);
    const { error } = await supabase.from("customer_feedback").delete().eq("id", selected.id);
    if (!error) {
      setRows((current) => current.filter((row) => row.id !== selected.id));
      setSelected(null);
    }
    setSaving(false);
  };

  const count = (value: FeedbackStatus) => rows.filter((row) => row.status === value).length;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader title="Customer Feedback" description="Read, manage and respond to customer feedback." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["unread", "read", "solved", "thanked"] as FeedbackStatus[]).map((key) => (
          <button key={key} onClick={() => { setStatus(key); setPage(1); }} className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{key}</div>
            <div className="text-2xl font-bold mt-1">{count(key)}</div>
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search customer or feedback..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="h-10 px-3 rounded-lg border border-border bg-background text-sm">
          <option value="all">All feedback</option><option value="unread">Unread</option><option value="read">Read</option><option value="solved">Solved</option><option value="thanked">Thanked</option>
        </select>
        <Button onClick={load} disabled={loading}><RefreshCcw className="w-4 h-4" /></Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? <div className="p-10 text-center text-sm text-muted-foreground">Loading feedback...</div> : visible.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No feedback found.</div> : (
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <button key={item.id} onClick={() => openFeedback(item)} className="w-full p-4 text-left hover:bg-muted/30 flex gap-4 items-start">
                <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center"><UserRound className="w-5 h-5 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center"><span className="font-semibold text-sm">{item.customers?.customer_name || "Customer"}</span><Badge>{item.status}</Badge>{item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}</div>
                  <div className="flex items-center gap-1 mt-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < item.rating ? "fill-current" : "text-muted-foreground"}`} />)}</div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.message}</p>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{new Date(item.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Feedback Details">
        {selected && <div className="space-y-5">
          <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">{selected.customers?.customer_name || "Customer"}</div><div className="text-xs text-muted-foreground">{selected.customers?.email || ""} {selected.customers?.phone ? `• ${selected.customers.phone}` : ""}</div></div><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < selected.rating ? "fill-current" : "text-muted-foreground"}`} />)}</div></div>
          <div className="bg-muted/40 rounded-xl p-4 text-sm whitespace-pre-wrap">{selected.message}</div>
          {selected.category && <div className="text-xs text-muted-foreground">Category: <span className="text-foreground font-medium">{selected.category}</span></div>}
          {selected.admin_reply && <div className="border border-border rounded-xl p-4"><div className="text-xs font-semibold mb-2">Admin response</div><div className="text-sm whitespace-pre-wrap">{selected.admin_reply}</div></div>}
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Write a thank-you or response..." className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => updateStatus("read")} disabled={saving}><Eye className="w-4 h-4" /> Read</Button>
            <Button onClick={() => updateStatus("solved")} disabled={saving}><CheckCircle className="w-4 h-4" /> Solved</Button>
            <Button onClick={sendThankYou} disabled={saving || !reply.trim()}><Send className="w-4 h-4" /> Thank & Reply</Button>
            <Button onClick={() => updateStatus("unread")} disabled={saving}><XCircle className="w-4 h-4" /> Mark Unread</Button>
            <Button onClick={deleteFeedback} disabled={saving}><Trash2 className="w-4 h-4" /> Delete</Button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}
