import React, { useState, useEffect } from "react";
import {
  Bell,
  Users,
  Store,
  Bike,
  Send,
  Clock,
  CheckCircle2,
  Search,
  Eye,
  X,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Input } from "../ui/Input";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type TargetAudience = "all_customers" | "all_vendors" | "all_riders" | "individual";
type RecipientType = "customer" | "vendor" | "rider";
type HistoryFilter = "All" | "Customers" | "Vendors" | "Riders";

interface IndividualRecipientOption {
  id: string;
  name: string;
  type: RecipientType;
  detail?: string;
}

interface NotificationRow {
  id: string;
  recipient_id: string;
  recipient_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string;
  action_url?: string | null;
}

const recipientTypeBadgeConfig: Record<string, { label: string; variant: any; icon: React.ReactNode }> = {
  customer: { label: "Customer", variant: "info", icon: <Users className="w-3.5 h-3.5" /> },
  vendor: { label: "Vendor", variant: "purple", icon: <Store className="w-3.5 h-3.5" /> },
  rider: { label: "Rider", variant: "warning", icon: <Bike className="w-3.5 h-3.5" /> },
  admin: { label: "Admin", variant: "neutral", icon: <Bell className="w-3.5 h-3.5" /> },
};

export function Notifications() {
  // Target Selection State
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("all_customers");
  
  // Individual Recipient State
  const [individualRole, setIndividualRole] = useState<RecipientType>("customer");
  const [selectedRecipient, setSelectedRecipient] = useState<IndividualRecipientOption | null>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<IndividualRecipientOption[]>([]);
  const [isRecipientDropdownOpen, setIsRecipientDropdownOpen] = useState(false);
  const [isFetchingRecipients, setIsFetchingRecipients] = useState(false);

  // Form Inputs
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [sending, setSending] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<{
    audienceLabel: string;
    recipientsCount: number;
    title: string;
  }>({ audienceLabel: "", recipientsCount: 0, title: "" });

  // View Modal State
  const [viewingRow, setViewingRow] = useState<NotificationRow | null>(null);

  // History Ledger State
  const [historyRows, setHistoryRows] = useState<NotificationRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("All");

  // Audience Count Badges
  const [audienceSizes, setAudienceSizes] = useState({
    customers: 0,
    vendors: 0,
    riders: 0,
  });

  async function calculateAudienceMetrics() {
    try {
      const [customersRes, vendorsRes, ridersRes] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("riders").select("id", { count: "exact", head: true }),
      ]);

      setAudienceSizes({
        customers: customersRes.count || 0,
        vendors: vendorsRes.count || 0,
        riders: ridersRes.count || 0,
      });
    } catch (err) {
      console.error("Failed syncing platform audience metrics:", err);
    }
  }

  // Safe Individual Recipient Fetching
  useEffect(() => {
    if (targetAudience !== "individual") return;

    let isMounted = true;
    async function searchRecipients() {
      try {
        setIsFetchingRecipients(true);
        let options: IndividualRecipientOption[] = [];
        const queryTerm = recipientSearchQuery.trim();

        if (individualRole === "customer") {
          // FIXED: Fetch auth_user_id so recipient_id matches customer auth.uid()
          let query = supabase.from("customers").select("id, auth_user_id, customer_name, phone").limit(20);
          if (queryTerm) {
            query = query.or(`customer_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`);
          }
          const { data, error } = await query;
          if (error) throw error;

          options = (data || [])
            .filter((c) => Boolean(c.auth_user_id))
            .map((c) => ({
              id: c.auth_user_id, // Map auth_user_id
              name: c.customer_name || "Unnamed Customer",
              type: "customer",
              detail: c.phone || c.id,
            }));
        } else if (individualRole === "vendor") {
          let query = supabase.from("vendors").select("id, shop_name, shop_code").limit(20);
          if (queryTerm) {
            query = query.or(`shop_name.ilike.%${queryTerm}%,shop_code.ilike.%${queryTerm}%`);
          }
          const { data, error } = await query;
          if (error) throw error;

          options = (data || []).map((v) => ({
            id: v.id,
            name: v.shop_name || "Unnamed Vendor",
            type: "vendor",
            detail: v.shop_code || v.id,
          }));
        } else if (individualRole === "rider") {
          // Select auth_user_id for riders so recipient_id matches RLS and rider app listener
          let query = supabase.from("riders").select("auth_user_id, rider_name, phone").limit(20);
          if (queryTerm) {
            query = query.or(`rider_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`);
          }
          const { data, error } = await query;
          if (error) throw error;

          options = (data || []).map((r) => ({
            id: r.auth_user_id, // Map auth_user_id
            name: r.rider_name || "Unnamed Rider",
            type: "rider",
            detail: r.phone || r.auth_user_id,
          }));
        }

        if (isMounted) {
          setRecipientOptions(options);
        }
      } catch (err) {
        console.error("Failed searching individual recipient options:", err);
      } finally {
        if (isMounted) setIsFetchingRecipients(false);
      }
    }

    const timer = setTimeout(searchRecipients, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [targetAudience, individualRole, recipientSearchQuery]);

  useEffect(() => {
    setSelectedRecipient(null);
    setRecipientSearchQuery("");
  }, [individualRole]);

  // Direct fetch of notification rows
  async function fetchNotificationHistory() {
    try {
      setIsLoadingHistory(true);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Supabase notification query error:", error);
        throw error;
      }

      setHistoryRows((data as NotificationRow[]) || []);
    } catch (err) {
      console.error("Failed loading notification history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    calculateAudienceMetrics();
    fetchNotificationHistory();
  }, []);

  function resetForm() {
    setTitle("");
    setBody("");
    setCta("");
    setTargetAudience("all_customers");
    setIndividualRole("customer");
    setSelectedRecipient(null);
    setRecipientSearchQuery("");
  }

  // Handle Dispatching Notification Rows
  async function handleSend() {
    if (!title.trim() || !body.trim()) return;

    try {
      setSending(true);
      const actionUrlValue = cta.trim() ? cta.trim() : null;
      let targetRecipients: { id: string; type: RecipientType }[] = [];

      if (targetAudience === "all_customers") {
        // FIXED: Fetch auth_user_id for customers to support RLS and app subscriptions
        const { data } = await supabase
          .from("customers")
          .select("auth_user_id")
          .not("auth_user_id", "is", null);

        if (data) targetRecipients = data.map((r) => ({ id: r.auth_user_id, type: "customer" }));
      } else if (targetAudience === "all_vendors") {
        const { data } = await supabase.from("vendors").select("id");
        if (data) targetRecipients = data.map((r) => ({ id: r.id, type: "vendor" }));
      } else if (targetAudience === "all_riders") {
        // Fetch auth_user_id for riders to support RLS and app subscriptions
        const { data } = await supabase.from("riders").select("auth_user_id");
        if (data) targetRecipients = data.map((r) => ({ id: r.auth_user_id, type: "rider" }));
      } else if (targetAudience === "individual") {
        if (!selectedRecipient) {
          alert("Please select a recipient for Individual delivery.");
          return;
        }
        targetRecipients.push({ id: selectedRecipient.id, type: selectedRecipient.type });
      }

      if (targetRecipients.length === 0) {
        alert("No active recipients found for selected target.");
        return;
      }

      const timestamp = new Date().toISOString();

      const notificationRows = targetRecipients.map((rec) => ({
        recipient_id: rec.id,
        recipient_type: rec.type,
        title: title.trim(),
        message: body.trim(),
        type: targetAudience === "individual" ? "individual" : "broadcast",
        is_read: false,
        created_at: timestamp,
        action_url: actionUrlValue,
        deleted_at: null,
        metadata: null,
        reference_id: null,
      }));

      const { error } = await supabase.from("notifications").insert(notificationRows);
      if (error) throw error;

      let audienceDisplayLabel = "";
      if (targetAudience === "all_customers") audienceDisplayLabel = "All Customers";
      else if (targetAudience === "all_vendors") audienceDisplayLabel = "All Vendors";
      else if (targetAudience === "all_riders") audienceDisplayLabel = "All Riders";
      else audienceDisplayLabel = `Individual (${selectedRecipient?.name || "Recipient"})`;

      setSuccessDetails({
        audienceLabel: audienceDisplayLabel,
        recipientsCount: notificationRows.length,
        title: title.trim(),
      });
      setShowSuccessModal(true);

      resetForm();
      await calculateAudienceMetrics();
      await fetchNotificationHistory();
    } catch (err) {
      console.error("Failed dispatching notification:", err);
      alert("Error dispatching communication channel payload.");
    } finally {
      setSending(false);
    }
  }

  // Exact row filter logic
  const filteredHistoryRows = historyRows.filter((row) => {
    const searchLower = historySearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (row.title && row.title.toLowerCase().includes(searchLower)) ||
      (row.message && row.message.toLowerCase().includes(searchLower)) ||
      (row.recipient_id && row.recipient_id.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    const rowType = (row.recipient_type || "").toLowerCase();

    if (activeFilter === "All") return true;
    if (activeFilter === "Customers") return rowType === "customer";
    if (activeFilter === "Vendors") return rowType === "vendor";
    if (activeFilter === "Riders") return rowType === "rider";

    return true;
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Broadcast messages live to verified platform customer, vendor, and rider applications."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Compose Form Column */}
        <div className="col-span-1">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm sticky top-20">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#64748B]" />
                <h2 className="text-sm font-semibold text-[#0F172A]">Send Notification</h2>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Target Selector */}
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-2 uppercase tracking-wide">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_customers")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all",
                      targetAudience === "all_customers"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Users className="w-3.5 h-3.5" /> All Customers
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-medium pl-5">
                      {audienceSizes.customers.toLocaleString()} size
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_vendors")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all",
                      targetAudience === "all_vendors"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Store className="w-3.5 h-3.5" /> All Vendors
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-medium pl-5">
                      {audienceSizes.vendors.toLocaleString()} size
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_riders")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all",
                      targetAudience === "all_riders"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Bike className="w-3.5 h-3.5" /> All Riders
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-medium pl-5">
                      {audienceSizes.riders.toLocaleString()} size
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("individual")}
                    className={cn(
                      "flex flex-col items-start justify-center p-2.5 rounded-lg border text-left transition-all",
                      targetAudience === "individual"
                        ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                        : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Bell className="w-3.5 h-3.5" /> Individual
                    </div>
                    <span className="text-[10px] text-[#94A3B8] font-medium pl-5">
                      Single User
                    </span>
                  </button>
                </div>
              </div>

              {/* Individual Selector Sub-Panel */}
              {targetAudience === "individual" && (
                <div className="space-y-3 pt-1 border-t border-[#F1F5F9]">
                  <div>
                    <label className="text-xs font-semibold text-[#475569] block mb-2 uppercase tracking-wide">
                      Recipient Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["customer", "vendor", "rider"] as RecipientType[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setIndividualRole(role)}
                          className={cn(
                            "p-2 text-xs font-semibold capitalize rounded-lg border text-center transition-all",
                            individualRole === role
                              ? "border-[#22C55E] bg-[#F0FDF4] text-[#16A34A]"
                              : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Searchable Dropdown */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-[#475569] block mb-1">
                      Select {individualRole.charAt(0).toUpperCase() + individualRole.slice(1)}
                    </label>
                    <div
                      className="w-full border border-[#E2E8F0] rounded-lg p-2.5 flex items-center justify-between cursor-pointer bg-white"
                      onClick={() => setIsRecipientDropdownOpen(!isRecipientDropdownOpen)}
                    >
                      <span className="text-xs font-medium text-[#0F172A] truncate">
                        {selectedRecipient
                          ? selectedRecipient.name
                          : `Search ${individualRole}...`}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    </div>

                    {isRecipientDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-30 p-2 space-y-2 max-h-60 overflow-y-auto">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Type name or code..."
                            value={recipientSearchQuery}
                            onChange={(e) => setRecipientSearchQuery(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#22C55E]"
                            autoFocus
                          />
                        </div>

                        {isFetchingRecipients ? (
                          <div className="p-3 text-center text-xs text-[#94A3B8]">
                            Searching...
                          </div>
                        ) : recipientOptions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-[#94A3B8]">
                            No matches found.
                          </div>
                        ) : (
                          recipientOptions.map((option) => (
                            <div
                              key={option.id}
                              onClick={() => {
                                setSelectedRecipient(option);
                                setIsRecipientDropdownOpen(false);
                              }}
                              className="p-2 hover:bg-[#F8FAFC] rounded-lg cursor-pointer flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-[#0F172A]">{option.name}</span>
                              {option.detail && (
                                <span className="text-[10px] text-[#94A3B8] font-mono">{option.detail}</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Input
                label="Notification Title"
                placeholder="e.g. Weekend Special Offer!"
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

              {/* Preview */}
              {(title || body) && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#64748B] mb-2 uppercase tracking-wide">
                    Device Live Preview
                  </p>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 bg-[#22C55E] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {title || "Notification Title"}
                        </p>
                        <p className="text-xs text-[#64748B] mt-0.5 break-words font-medium">
                          {body || "Your message here..."}
                        </p>
                        {cta && (
                          <span className="inline-block mt-2 text-[10px] text-[#22C55E] font-bold underline">
                            Action Link Attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                loading={sending}
                disabled={
                  !title.trim() ||
                  !body.trim() ||
                  sending ||
                  (targetAudience === "individual" && !selectedRecipient)
                }
                onClick={handleSend}
              >
                {sending ? "Processing..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </div>

        {/* Ledger History Column */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0F172A]">Notification History</h2>
                <span className="text-xs text-[#64748B] font-medium">
                  {filteredHistoryRows.length} Rows
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by title, message, or recipient ID..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(["All", "Customers", "Vendors", "Riders"] as HistoryFilter[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "px-3 py-1 rounded-full font-semibold transition-all shrink-0",
                        activeFilter === filter
                          ? "bg-[#22C55E] text-white"
                          : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
                      )}
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="divide-y divide-[#F1F5F9] max-h-[75vh] overflow-y-auto">
              {isLoadingHistory ? (
                <div className="text-center py-16 text-xs text-[#94A3B8] font-medium">
                  Syncing notification records...
                </div>
              ) : filteredHistoryRows.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#94A3B8] font-medium">
                  No notification logs found matching criteria.
                </div>
              ) : (
                filteredHistoryRows.map((notif) => {
                  const rType = (notif.recipient_type || "").toLowerCase();
                  const cfg =
                    recipientTypeBadgeConfig[rType] || {
                      label: notif.recipient_type || "Unknown",
                      variant: "neutral",
                    };

                  return (
                    <div
                      key={notif.id}
                      className="px-5 py-4 hover:bg-[#FAFAFA] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant={cfg.variant} label={cfg.label} />
                            <p className="text-sm font-semibold text-[#0F172A]">{notif.title}</p>
                            {notif.action_url && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" /> CTA Attached
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#475569] mb-2 font-medium leading-relaxed">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-4 flex-wrap text-[11px] text-[#64748B] font-medium">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-[#94A3B8]" />
                              {notif.created_at
                                ? new Date(notif.created_at).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </span>
                            <span>
                              Recipient ID:{" "}
                              <span className="font-mono text-[#0F172A]">
                                {notif.recipient_id}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* View Modal Trigger */}
                        <div className="flex items-center gap-1.5 justify-end flex-shrink-0">
                          <button
                            onClick={() => setViewingRow(notif)}
                            className="p-1.5 text-[#64748B] hover:text-[#22C55E] hover:bg-[#F0FDF4] rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">Notification Sent</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Your message has been inserted into the database.
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Audience:</span>
                <span className="font-semibold text-[#0F172A]">
                  {successDetails.audienceLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Rows Created:</span>
                <span className="font-semibold text-[#0F172A]">
                  {successDetails.recipientsCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Title:</span>
                <span className="font-semibold text-[#0F172A] truncate max-w-[150px]">
                  {successDetails.title}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => setShowSuccessModal(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* View Read-Only Modal */}
      {viewingRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#0F172A]">Notification Details</h3>
              <button
                onClick={() => setViewingRow(null)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#64748B] block font-medium">Title</span>
                <p className="text-sm font-semibold text-[#0F172A] mt-0.5">
                  {viewingRow.title}
                </p>
              </div>

              <div>
                <span className="text-[#64748B] block font-medium">Message</span>
                <p className="text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] mt-0.5 leading-relaxed font-medium">
                  {viewingRow.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F0]">
                <div>
                  <span className="text-[#64748B] block font-medium">Recipient Type</span>
                  <span className="font-semibold text-[#0F172A] capitalize">
                    {viewingRow.recipient_type}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Recipient ID</span>
                  <span className="font-mono text-[#0F172A] truncate block">
                    {viewingRow.recipient_id}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Notification Type</span>
                  <span className="font-semibold text-[#0F172A] capitalize">
                    {viewingRow.type || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Read Status</span>
                  <span className="font-semibold text-[#0F172A]">
                    {viewingRow.is_read ? "Read" : "Unread"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">Created Time</span>
                  <span className="font-semibold text-[#0F172A]">
                    {viewingRow.created_at
                      ? new Date(viewingRow.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium">CTA Link</span>
                  {viewingRow.action_url ? (
                    <a
                      href={viewingRow.action_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#22C55E] hover:underline truncate block font-semibold"
                    >
                      {viewingRow.action_url}
                    </a>
                  ) : (
                    <span className="text-[#94A3B8]">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setViewingRow(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}