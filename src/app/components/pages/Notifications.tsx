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
  ChevronDown,
  Sparkles
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
          // FIXED: Fetch customers.id to correctly match current_customer_id()
          let query = supabase.from("customers").select("id, customer_name, phone").limit(20);
          if (queryTerm) {
            query = query.or(`customer_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`);
          }
          const { data, error } = await query;
          if (error) throw error;

          options = (data || []).map((c) => ({
            id: c.id,
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
          // FIXED: Fetch riders.id to correctly match current_rider_id()
          let query = supabase.from("riders").select("id, rider_name, phone").limit(20);
          if (queryTerm) {
            query = query.or(`rider_name.ilike.%${queryTerm}%,phone.ilike.%${queryTerm}%`);
          }
          const { data, error } = await query;
          if (error) throw error;

          options = (data || []).map((r) => ({
            id: r.id,
            name: r.rider_name || "Unnamed Rider",
            type: "rider",
            detail: r.phone || r.id,
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
        // FIXED: Select customer.id
        const { data } = await supabase.from("customers").select("id");
        if (data) targetRecipients = data.map((r) => ({ id: r.id, type: "customer" }));
      } else if (targetAudience === "all_vendors") {
        const { data } = await supabase.from("vendors").select("id");
        if (data) targetRecipients = data.map((r) => ({ id: r.id, type: "vendor" }));
      } else if (targetAudience === "all_riders") {
        // FIXED: Select rider.id
        const { data } = await supabase.from("riders").select("id");
        if (data) targetRecipients = data.map((r) => ({ id: r.id, type: "rider" }));
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
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Broadcast live push notifications directly to verified platform customers, vendors, and riders."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Compose Form Column */}
        <div className="col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sticky top-20 transition-all hover:shadow-md">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                  <Bell className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Compose Notification</h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Live Channel
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Target Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_customers")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                      targetAudience === "all_customers"
                        ? "border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-2xs font-semibold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Users className="w-3.5 h-3.5" /> All Customers
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium pl-5">
                      {audienceSizes.customers.toLocaleString()} active
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_vendors")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                      targetAudience === "all_vendors"
                        ? "border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-2xs font-semibold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Store className="w-3.5 h-3.5" /> All Vendors
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium pl-5">
                      {audienceSizes.vendors.toLocaleString()} active
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("all_riders")}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                      targetAudience === "all_riders"
                        ? "border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-2xs font-semibold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Bike className="w-3.5 h-3.5" /> All Riders
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium pl-5">
                      {audienceSizes.riders.toLocaleString()} active
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience("individual")}
                    className={cn(
                      "flex flex-col items-start justify-center p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer",
                      targetAudience === "individual"
                        ? "border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-2xs font-semibold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Bell className="w-3.5 h-3.5" /> Individual
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium pl-5">
                      Single Account
                    </span>
                  </button>
                </div>
              </div>

              {/* Individual Selector Sub-Panel */}
              {targetAudience === "individual" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">
                      Recipient Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["customer", "vendor", "rider"] as RecipientType[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setIndividualRole(role)}
                          className={cn(
                            "p-2 text-xs font-bold capitalize rounded-lg border text-center transition-all cursor-pointer",
                            individualRole === role
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Searchable Dropdown */}
                  <div className="relative">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Select {individualRole.charAt(0).toUpperCase() + individualRole.slice(1)}
                    </label>
                    <div
                      className="w-full border border-slate-200 rounded-lg p-2.5 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-white focus:bg-white transition-all"
                      onClick={() => setIsRecipientDropdownOpen(!isRecipientDropdownOpen)}
                    >
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {selectedRecipient
                          ? selectedRecipient.name
                          : `Search ${individualRole}...`}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>

                    {isRecipientDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 space-y-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Type name or contact detail..."
                            value={recipientSearchQuery}
                            onChange={(e) => setRecipientSearchQuery(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                            autoFocus
                          />
                        </div>

                        {isFetchingRecipients ? (
                          <div className="p-3 text-center text-xs text-slate-400 font-medium">
                            Searching database...
                          </div>
                        ) : recipientOptions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 font-medium">
                            No matching accounts found.
                          </div>
                        ) : (
                          recipientOptions.map((option) => (
                            <div
                              key={option.id}
                              onClick={() => {
                                setSelectedRecipient(option);
                                setIsRecipientDropdownOpen(false);
                              }}
                              className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <span className="font-bold text-slate-900">{option.name}</span>
                              {option.detail && (
                                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                  {option.detail}
                                </span>
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
                placeholder="e.g., Special Weekend Offer!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Message Body</label>
                <textarea
                  placeholder="Write your push notification message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-medium bg-slate-50/50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:bg-white focus:border-emerald-500 transition-all leading-relaxed"
                />
              </div>

              <Input
                label="Action Link (optional)"
                placeholder="https://rivo.app/offers"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />

              {/* Live Preview */}
              {(title || body) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 animate-in fade-in duration-150">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Mobile Device Preview
                  </p>
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
                        <Bell className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {title || "Notification Title"}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5 break-words font-normal leading-normal">
                          {body || "Your message preview will render here..."}
                        </p>
                        {cta && (
                          <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-bold underline">
                            <ExternalLink className="w-2.5 h-2.5" /> Action Link Attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full font-bold shadow-2xs cursor-pointer"
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
                {sending ? "Dispatching..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </div>

        {/* Ledger History Column */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Notification History</h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Log of all notifications sent across channels</p>
                </div>
                <span className="text-xs text-slate-500 font-bold bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  {filteredHistoryRows.length} Logged
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by title, message, or recipient ID..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium transition-all"
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
                        "px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        activeFilter === filter
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[75vh] overflow-y-auto">
              {isLoadingHistory ? (
                <div className="text-center py-16 text-xs text-slate-400 font-medium">
                  Syncing notification records...
                </div>
              ) : filteredHistoryRows.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-400 font-medium">
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
                      className="px-5 py-4 hover:bg-emerald-50/20 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant={cfg.variant} label={cfg.label} />
                            <p className="text-xs font-bold text-slate-900">{notif.title}</p>
                            {notif.action_url && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" /> CTA Attached
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mb-2 font-normal leading-relaxed">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
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
                              <span className="font-mono text-slate-700 font-bold">
                                {notif.recipient_id}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* View Modal Trigger */}
                        <div className="flex items-center gap-1.5 justify-end shrink-0">
                          <button
                            onClick={() => setViewingRow(notif)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Notification Sent</h3>
              <p className="text-xs text-slate-500 mt-1">
                Notifications successfully delivered and logged.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Audience:</span>
                <span className="font-bold text-slate-900">
                  {successDetails.audienceLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Recipients Count:</span>
                <span className="font-bold text-slate-900">
                  {successDetails.recipientsCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Title:</span>
                <span className="font-bold text-slate-900 truncate max-w-[160px]">
                  {successDetails.title}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full font-bold cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Notification Details</h3>
              <button
                onClick={() => setViewingRow(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Title</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {viewingRow.title}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Message</span>
                <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-0.5 leading-relaxed font-normal">
                  {viewingRow.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Recipient Type</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {viewingRow.recipient_type}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Recipient ID</span>
                  <span className="font-mono text-slate-900 truncate block font-bold">
                    {viewingRow.recipient_id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Notification Type</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {viewingRow.type || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Read Status</span>
                  <span className="font-bold text-slate-900">
                    {viewingRow.is_read ? "Read" : "Unread"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Created Time</span>
                  <span className="font-bold text-slate-900">
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
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Action Link</span>
                  {viewingRow.action_url ? (
                    <a
                      href={viewingRow.action_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 hover:underline truncate block font-bold"
                    >
                      {viewingRow.action_url}
                    </a>
                  ) : (
                    <span className="text-slate-400 font-medium">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full font-bold cursor-pointer"
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