import React, { useState, useEffect } from "react";
import {
  Bell,
  Users,
  Store,
  Bike,
  Send,
  Clock,
  CheckCircle2,
  Megaphone,
  Trash2
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Input } from "../ui/Input";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type Audience = "customers" | "vendors" | "riders" | "all";

interface NotificationHistory {
  id: string;
  rawId: string; // Kept for exact deletion query references
  title: string;
  body: string;
  audience: Audience;
  sentAt: string;
  reached: number;
  opened: number;
}

const audienceConfig: Record<Audience, { label: string; variant: any; icon: React.ReactNode }> = {
  customers: { label: "Customers", variant: "info", icon: <Users className="w-3.5 h-3.5" /> },
  vendors: { label: "Vendors", variant: "purple", icon: <Store className="w-3.5 h-3.5" /> },
  riders: { label: "Riders", variant: "warning", icon: <Bike className="w-3.5 h-3.5" /> },
  all: { label: "All Users", variant: "success", icon: <Megaphone className="w-3.5 h-3.5" /> },
};

export function Notifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [audience, setAudience] = useState<Audience>("customers");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  
  const [historyLogs, setHistoryLogs] = useState<NotificationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [audienceSizes, setAudienceSizes] = useState({
    customers: 0,
    vendors: 0,
    riders: 0,
    all: 0,
  });

  async function calculateAudienceMetrics() {
    try {
      const [customersRes, vendorsRes, ridersRes] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("riders").select("id", { count: "exact", head: true }),
      ]);

      const cCount = customersRes.count || 0;
      const vCount = vendorsRes.count || 0;
      const rCount = ridersRes.count || 0;

      setAudienceSizes({
        customers: cCount,
        vendors: vCount,
        riders: rCount,
        all: cCount + vCount + rCount,
      });
    } catch (err) {
      console.error("Failed syncing platform target audience indexes:", err);
    }
  }

  async function fetchNotificationHistory() {
    try {
      setIsLoading(true);
      // Fetches exclusively row matrices where type = 'broadcast' from correct table
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "broadcast")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: NotificationHistory[] = (data || []).map((row) => {
        const target: Audience = "all";
        
        return {
          id: row.id.slice(0, 8).toUpperCase(),
          rawId: row.id,
          title: row.title || "Untitled Notification",
          body: row.message || "—",
          audience: target,
          reached: audienceSizes.all || 1,
          opened: 0,
          sentAt: row.created_at
            ? new Date(row.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—",
        };
      });

      setHistoryLogs(mapped);
    } catch (err) {
      console.error("Failed loading notification ledger:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      await calculateAudienceMetrics();
    }
    init();
  }, []);

  useEffect(() => {
    fetchNotificationHistory();
  }, [audienceSizes.all]);

  async function handleSend() {
    if (!title || !body) return;

    try {
      setSending(true);

      const payload = {
        title: title.trim(),
        message: body.trim(),
        type: "broadcast",
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from("notifications").insert([payload]);
      if (error) throw error;

      setSent(true);
      setTitle("");
      setBody("");
      setCta("");
      
      await calculateAudienceMetrics();
      await fetchNotificationHistory();

      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      console.error("Failed sending unified notification broadcast:", err);
      alert("Error dispatching communication channel write payload.");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteNotification(rawId: string, logTitle: string) {
    const confirmation = window.confirm(`Permanently remove broadcast log entry "${logTitle}" from history?`);
    if (!confirmation) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", rawId);

      if (error) throw error;
      
      await fetchNotificationHistory();
    } catch (err) {
      console.error("Failed deleting notification log row node:", err);
      alert("Failed to delete notification history item.");
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Broadcast messages live to verified platform customer, vendor, and rider applications." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Compose Form column */}
        <div className="col-span-1">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2 bg-[#F8FAFC]">
              <Bell className="w-4 h-4 text-[#64748B]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">Send Notification</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-2 uppercase tracking-wide">Target Audience</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["customers", "vendors", "riders", "all"] as Audience[]).map((aud) => {
                    const cfg = audienceConfig[aud];
                    return (
                      <button
                        key={aud}
                        onClick={() => setAudience(aud)}
                        className={cn(
                          "flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all",
                          audience === aud
                            ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                            : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          {cfg.icon}
                          {cfg.label}
                        </div>
                        <span className="text-[10px] text-[#94A3B8] font-medium pl-5">
                          {audienceSizes[aud].toLocaleString()} size
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Notification Title"
                placeholder="e.g. Weekend Sale!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#475569]">Message Body</label>
                <textarea
                  placeholder="Write your notification message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="w-full text-sm font-medium bg-white border border-[#E2E8F0] rounded-lg p-3 focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <Input
                label="CTA Redirect Link (optional)"
                placeholder="https://rivo.app/offers"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />

              {(title || body) && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wide">Device Live Preview</p>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 bg-[#22C55E] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{title || "Notification Title"}</p>
                        <p className="text-xs text-[#64748B] mt-0.5 break-words font-medium">{body || "Your message here..."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sent && (
                <div className="flex items-center gap-2 p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold text-[#16A34A]">Notification sent successfully!</span>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                loading={sending}
                disabled={!title || !body || sending}
                onClick={handleSend}
              >
                {sending ? "Broadcasting..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </div>

        {/* History Ledger List Column */}
        <div className="col-span-2">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <h2 className="text-sm font-semibold text-[#0F172A]">Broadcast Logs History</h2>
            </div>
            <div className="divide-y divide-[#F1F5F9] max-h-[75vh] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-16 text-xs text-[#94A3B8] font-medium">Syncing notification channel matrix records...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#94A3B8] font-medium">No system communication campaign logs located.</div>
              ) : (
                historyLogs.map((notif) => {
                  const cfg = audienceConfig[notif.audience] || { label: notif.audience, variant: "neutral" };
                  const openRate = notif.reached > 0 ? Math.round((notif.opened / notif.reached) * 100) : 0;
                  return (
                    <div key={notif.rawId} className="px-5 py-4 hover:bg-[#FAFAFA] transition-colors group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border font-semibold">#{notif.id}</span>
                            <p className="text-sm font-semibold text-[#0F172A]">{notif.title}</p>
                            <Badge variant={cfg.variant} label={cfg.label} />
                          </div>
                          <p className="text-xs text-[#475569] mb-2 font-medium leading-relaxed">{notif.body}</p>
                          <div className="flex items-center gap-4 flex-wrap text-[11px] text-[#64748B] font-medium">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-[#94A3B8]" />{notif.sentAt}
                            </span>
                            <span>
                              <span className="font-bold text-[#0F172A]">{notif.reached.toLocaleString()}</span> reached
                            </span>
                            <span>
                              <span className="font-bold text-[#0F172A]">{notif.opened.toLocaleString()}</span> opened ({openRate}%)
                            </span>
                          </div>
                        </div>

                        {/* Interactive Deletion Action and Progress section metrics layout side row */}
                        <div className="flex items-center gap-3 w-32 justify-end flex-shrink-0">
                          <div className="w-20 text-right">
                            <p className="text-xs font-bold text-[#475569] mb-1">{openRate}%</p>
                            <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#22C55E] rounded-full transition-all"
                                style={{ width: `${openRate}%` }}
                              />
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteNotification(notif.rawId, notif.title)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}