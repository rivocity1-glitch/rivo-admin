import React, { useState } from "react";
import {
  Bell,
  Users,
  Store,
  Bike,
  Send,
  Clock,
  CheckCircle2,
  Megaphone,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { cn } from "../../../lib/utils";

type Audience = "customers" | "vendors" | "riders" | "all";

interface NotificationHistory {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  sentAt: string;
  reached: number;
  opened: number;
}

const history: NotificationHistory[] = [
  {
    id: "NOTIF-0031",
    title: "Weekend Sale — Up to 20% Off!",
    body: "Grab your groceries this weekend and save on essentials.",
    audience: "customers",
    sentAt: "14 Jun 2025, 10:00 AM",
    reached: 8642,
    opened: 3214,
  },
  {
    id: "NOTIF-0030",
    title: "New Payout Feature Available",
    body: "Settlements are now processed within 24 hours. Check your dashboard.",
    audience: "vendors",
    sentAt: "12 Jun 2025, 9:00 AM",
    reached: 142,
    opened: 118,
  },
  {
    id: "NOTIF-0029",
    title: "Zone Expansion — New Areas Added",
    body: "Deliveries are now enabled in Sarjapur and Marathahalli.",
    audience: "riders",
    sentAt: "10 Jun 2025, 8:30 AM",
    reached: 89,
    opened: 71,
  },
  {
    id: "NOTIF-0028",
    title: "Platform Maintenance Scheduled",
    body: "Rivo will be under maintenance on 08 Jun from 2–3 AM.",
    audience: "all",
    sentAt: "07 Jun 2025, 6:00 PM",
    reached: 8873,
    opened: 4201,
  },
];

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

  function handleSend() {
    if (!title || !body) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTitle("");
      setBody("");
      setCta("");
      setTimeout(() => setSent(false), 3000);
    }, 1500);
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Broadcast messages to customers, vendors, and riders" />

      <div className="grid grid-cols-3 gap-6">
        {/* Compose */}
        <div className="col-span-1">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#64748B]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">Send Notification</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Audience selector */}
              <div>
                <label className="text-sm font-medium text-[#0F172A] block mb-2">Target Audience</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["customers", "vendors", "riders", "all"] as Audience[]).map((aud) => {
                    const cfg = audienceConfig[aud];
                    return (
                      <button
                        key={aud}
                        onClick={() => setAudience(aud)}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all",
                          audience === aud
                            ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                            : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                        )}
                      >
                        {cfg.icon}
                        {cfg.label}
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
              <Textarea
                label="Message Body"
                placeholder="Write your notification message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
              <Input
                label="CTA Link (optional)"
                placeholder="https://rivo.app/offers"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />

              {/* Preview */}
              {(title || body) && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wide">Preview</p>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 bg-[#22C55E] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{title || "Notification Title"}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">{body || "Your message here..."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sent && (
                <div className="flex items-center gap-2 p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-[#16A34A]">Notification sent successfully!</span>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                loading={sending}
                disabled={!title || !body}
                onClick={handleSend}
              >
                {sending ? "Sending..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="col-span-2">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F172A]">Notification History</h2>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {history.map((notif) => {
                const cfg = audienceConfig[notif.audience];
                const openRate = Math.round((notif.opened / notif.reached) * 100);
                return (
                  <div key={notif.id} className="px-5 py-4 hover:bg-[#FAFAFA] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-[#0F172A]">{notif.title}</p>
                          <Badge variant={cfg.variant} label={cfg.label} />
                        </div>
                        <p className="text-sm text-[#64748B] mb-2">{notif.body}</p>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                            <Clock className="w-3 h-3" />{notif.sentAt}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            <span className="font-medium text-[#0F172A]">{notif.reached.toLocaleString()}</span> reached
                          </span>
                          <span className="text-xs text-[#64748B]">
                            <span className="font-medium text-[#0F172A]">{openRate}%</span> opened
                          </span>
                        </div>
                      </div>
                      {/* Open rate bar */}
                      <div className="w-24 flex-shrink-0">
                        <p className="text-xs text-[#64748B] mb-1 text-right">{openRate}%</p>
                        <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#22C55E] rounded-full transition-all"
                            style={{ width: `${openRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
