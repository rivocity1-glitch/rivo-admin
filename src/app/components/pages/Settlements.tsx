import React, { useState, useEffect } from "react";
import { 
  Banknote, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Eye,
  IndianRupee,
  CreditCard,
  Calendar,
  History
} from "lucide-react";
import { supabase } from "../../../lib/supabase"; // Adjust path based on your project structure

// --- Types ---
interface Settlement {
  id: string;
  type: "vendor" | "rider";
  entity_id: string;
  entity_name: string; 
  owner_name?: string;
  phone?: string;
  amount: number;
  status: "pending_request" | "processing" | "paid" | "rejected";
  payment_method?: string;
  utr_number?: string;
  remarks?: string;
  paid_at?: string;
  created_at: string;
  order_ids?: string[];
  // Bank Details
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  qr_code_url?: string;
  // Address Fields (Vendor Only)
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
}

interface LedgerEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  transaction_type: string;
  amount: number;
  reference_id: string;
  remarks: string;
  created_at: string;
}

interface PlatformSettings {
  subscription_upi_id?: string;
  subscription_qr_url?: string;
}

// --- Mock Modal Component ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Settlements() {
  // --- State ---
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"pending" | "paid" | "rejected" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "vendor" | "rider">("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    pendingVendor: 0,
    pendingRider: 0,
    paidToday: 0,
    pendingAmount: 0,
    paidThisMonth: 0,
    rejectedAmount: 0
  });

  // Selection state for Bulk Settlements
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ success: number; failure: number } | null>(null);

  // Modal & Action States
  const [activeModal, setActiveModal] = useState<"approve" | "reject" | "view" | "ledger" | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [includedOrders, setIncludedOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Form State
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [utrNumber, setUtrNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  // --- Fetch Core Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Vendor Settlements joined with vendors (No address column queried here)
      const { data: vendorData, error: vError } = await supabase
        .from("vendor_settlements")
        .select(`
          id, vendor_id, amount, status, payment_method, utr_number, remarks, paid_at, created_at, order_ids,
          vendors!vendor_id(shop_name, owner_name, phone)
        `);
      
      // Fetch Rider Settlements with riders join
      const { data: rData, error: rError } = await supabase
        .from("rider_settlements")
        .select(`
          id, rider_id, amount, status, payment_method, utr_number, remarks, paid_at, created_at, order_ids,
          riders(rider_name, phone, account_holder_name, bank_name, account_number, ifsc_code, upi_id)
        `);

      if (vError) throw vError;
      if (rError) throw rError;

      // 2. Extract vendor IDs for secondary join profile loading
      const vendorIds = (vendorData || []).map((v: any) => v.vendor_id).filter((id): id is string => !!id);

      let vendorProfilesMap: Record<string, any> = {};
      if (vendorIds.length > 0) {
        // Fetch bank details along with address fields and qr_code_url from vendor_profiles
        const { data: pData, error: pError } = await supabase
          .from("vendor_profiles")
          .select("vendor_id, account_holder_name, bank_name, account_number, ifsc_code, upi_id, qr_code_url, address_line1, address_line2, city, state, pin_code")
          .in("vendor_id", vendorIds);
        if (!pError && pData) {
          vendorProfilesMap = pData.reduce((acc: any, profile: any) => {
            acc[profile.vendor_id] = profile;
            return acc;
          }, {});
        }
      }

      // 3. Transform and format data sets
      const formattedVendors: Settlement[] = (vendorData || []).map((v: any) => {
        const profile = vendorProfilesMap[v.vendor_id] || {};
        return {
          id: v.id,
          type: "vendor",
          entity_id: v.vendor_id || "",
          entity_name: v.vendors?.shop_name || "Unknown Vendor",
          owner_name: v.vendors?.owner_name || "",
          phone: v.vendors?.phone || "",
          amount: v.amount,
          status: v.status,
          payment_method: v.payment_method,
          utr_number: v.utr_number,
          remarks: v.remarks,
          paid_at: v.paid_at,
          created_at: v.created_at,
          order_ids: v.order_ids || [],
          account_holder_name: profile.account_holder_name || "",
          bank_name: profile.bank_name || "",
          account_number: profile.account_number || "",
          ifsc_code: profile.ifsc_code || "",
          upi_id: profile.upi_id || "",
          qr_code_url: profile.qr_code_url || "",
          address_line1: profile.address_line1 || "",
          address_line2: profile.address_line2 || "",
          city: profile.city || "",
          state: profile.state || "",
          pin_code: profile.pin_code || ""
        };
      });

      const formattedRiders: Settlement[] = (rData || []).map((r: any) => ({
        id: r.id,
        type: "rider",
        entity_id: r.rider_id || "",
        entity_name: r.riders?.rider_name || "Unknown Rider",
        owner_name: r.riders?.rider_name || "",
        phone: r.riders?.phone || "",
        amount: r.amount,
        status: r.status,
        payment_method: r.payment_method,
        utr_number: r.utr_number,
        remarks: r.remarks,
        paid_at: r.paid_at,
        created_at: r.created_at,
        order_ids: r.order_ids || [],
        account_holder_name: r.riders?.account_holder_name || "",
        bank_name: r.riders?.bank_name || "",
        account_number: r.riders?.account_number || "",
        ifsc_code: r.riders?.ifsc_code || "",
        upi_id: r.riders?.upi_id || "",
      }));

      const allData = [...formattedVendors, ...formattedRiders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setSettlements(allData);
      calculateMetrics(allData);
    } catch (err) {
      console.error("Error fetching financial settlements center datasets:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Compute Financial Framework Analytical Dashboards Metrics ---
  const calculateMetrics = (data: Settlement[]) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let pendingVendor = 0;
    let pendingRider = 0;
    let paidToday = 0;
    let pendingAmount = 0;
    let paidThisMonth = 0;
    let rejectedAmount = 0;

    data.forEach((s) => {
      if (s.status === "pending_request" || s.status === "processing") {
        pendingAmount += s.amount;
        if (s.type === "vendor") pendingVendor += s.amount;
        if (s.type === "rider") pendingRider += s.amount;
      } else if (s.status === "paid") {
        if (s.paid_at && s.paid_at.startsWith(todayStr)) {
          paidToday += s.amount;
        }
        if (s.paid_at) {
          const paidDate = new Date(s.paid_at);
          if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
            paidThisMonth += s.amount;
          }
        }
      } else if (s.status === "rejected") {
        rejectedAmount += s.amount;
      }
    });

    setMetrics({ pendingVendor, pendingRider, paidToday, pendingAmount, paidThisMonth, rejectedAmount });
  };

  // --- Fetch Configuration Platform Settings ---
  const fetchPlatformConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("subscription_upi_id, subscription_qr_url")
        .maybeSingle();
      if (!error && data) {
        setPlatformSettings(data);
      }
    } catch (err) {
      console.error("Error extracting platform global settings lookup fallback configurations:", err);
    }
  };

  // --- Realtime Subscriptions Synchronization Hooks ---
  useEffect(() => {
    fetchData();
    fetchPlatformConfig();

    const vendorChannel = supabase
      .channel("vendor-settlements-center-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_settlements" }, () => fetchData())
      .subscribe();

    const riderChannel = supabase
      .channel("rider-settlements-center-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rider_settlements" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(vendorChannel);
      supabase.removeChannel(riderChannel);
    };
  }, []);

  // --- Load Ledger Database History Logs ---
  const viewLedgerHistory = async (settlement: Settlement) => {
    try {
      setLoadingLedger(true);
      setSelectedSettlement(settlement);
      setActiveModal("ledger");
      
      const orderIds = settlement.order_ids || [];
      if (orderIds.length === 0) {
        setLedgerHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from("financial_ledger")
        .select("id, entity_type, entity_id, transaction_type, amount, reference_id, remarks, created_at")
        .in("reference_id", orderIds);

      if (!error && data) {
        setLedgerHistory(data);
      } else {
        setLedgerHistory([]);
      }
    } catch (err) {
      console.error("Failed downloading audit logging history traces from system ledger files:", err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // --- Action Framework Dispatch Interconnect Modals Operations ---
  const openApproveModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setPaymentMethod(settlement.payment_method || "Bank Transfer");
    setUtrNumber("");
    setRemarks("");
    setActiveModal("approve");
  };

  const openRejectModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setRemarks("");
    setActiveModal("reject");
  };

  const openViewModal = async (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setActiveModal("view");
    setIncludedOrders([]);
    
    const orderIds = settlement.order_ids || [];
    if (orderIds.length > 0) {
      setLoadingOrders(true);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, order_number, payment_method, status, vendor_earning, rider_earning, platform_fee")
          .in("id", orderIds);
        if (!error && data) {
          setIncludedOrders(data);
        }
      } catch (err) {
        console.error("Error loading linked orders for settlement profile:", err);
      } finally {
        setLoadingOrders(false);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedSettlement(null);
    setLedgerHistory([]);
    setIncludedOrders([]);
  };

  const handleApprove = async () => {
    if (!selectedSettlement) return;
    if (selectedSettlement.status === "paid") return;

    const tableName = selectedSettlement.type === "vendor" ? "vendor_settlements" : "rider_settlements";
    const now = new Date().toISOString();

    try {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          status: "paid",
          payment_method: paymentMethod,
          utr_number: utrNumber,
          remarks: remarks,
          paid_at: now
        })
        .eq("id", selectedSettlement.id)
        .eq("status", "pending_request");

      if (updateError) throw updateError;

      const orderIds = selectedSettlement.order_ids || [];
      if (orderIds.length > 0) {
        if (selectedSettlement.type === "vendor") {
          await supabase
            .from("orders")
            .update({ settled_vendor: true })
            .in("id", orderIds);
        } else if (selectedSettlement.type === "rider") {
          await supabase
            .from("orders")
            .update({ settled_rider: true })
            .in("id", orderIds);
        }
      }

      const { data: existingLedger } = await supabase
        .from("financial_ledger")
        .select("id")
        .eq("transaction_type", "settlement")
        .eq("reference_id", selectedSettlement.id)
        .maybeSingle();

      if (!existingLedger) {
        await supabase.from("financial_ledger").insert({
          entity_type: selectedSettlement.type,
          entity_id: selectedSettlement.entity_id,
          transaction_type: "settlement",
          entry_type: "debit",
          amount: selectedSettlement.amount,
          reference_id: selectedSettlement.id,
          remarks: "Settlement payout completed"
        });
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error finalizing state modification transaction cycles:", error);
      alert("Failed to submit state transition adjustments down into system records safely.");
    }
  };

  const handleReject = async () => {
    if (!selectedSettlement) return;
    if (selectedSettlement.status !== "pending_request") return;
    
    const tableName = selectedSettlement.type === "vendor" ? "vendor_settlements" : "rider_settlements";

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ status: "rejected", remarks: remarks })
        .eq("id", selectedSettlement.id)
        .eq("status", "pending_request");

      if (error) throw error;
      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error setting operational workflow cancellation status flags:", error);
    }
  };

  // --- Sequential Transaction Framework Loop Processing Batch Elements ---
  const processBulkSettlementBatch = async () => {
    if (selectedIds.length === 0) return;
    const itemsToProcess = settlements.filter(s => selectedIds.includes(s.id) && s.status === "pending_request");
    
    if (!window.confirm(`Initialize processing queue array for [${itemsToProcess.length}] chosen entries?`)) return;

    setProcessingBulk(true);
    let successCount = 0;
    let failureCount = 0;

    for (const item of itemsToProcess) {
      const tableName = item.type === "vendor" ? "vendor_settlements" : "rider_settlements";
      const now = new Date().toISOString();
      const generatedUtr = `BATCH-${Date.now()}-${item.id.substring(0, 4)}`.toUpperCase();

      try {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            status: "paid",
            payment_method: "Bank Transfer",
            utr_number: generatedUtr,
            remarks: "Settled automatically via system administrative mass selection pipelines.",
            paid_at: now
          })
          .eq("id", item.id)
          .eq("status", "pending_request");

        if (updateError) throw updateError;

        const orderIds = item.order_ids || [];
        if (orderIds.length > 0) {
          if (item.type === "vendor") {
            await supabase
              .from("orders")
              .update({ settled_vendor: true })
              .in("id", orderIds);
          } else if (item.type === "rider") {
            await supabase
              .from("orders")
              .update({ settled_rider: true })
              .in("id", orderIds);
          }
        }

        const { data: existingLedger } = await supabase
          .from("financial_ledger")
          .select("id")
          .eq("transaction_type", "settlement")
          .eq("reference_id", item.id)
          .maybeSingle();

        if (!existingLedger) {
          await supabase.from("financial_ledger").insert({
            entity_type: item.type,
            entity_id: item.entity_id,
            transaction_type: "settlement",
            entry_type: "debit",
            amount: item.amount,
            reference_id: item.id,
            remarks: "Settlement payout completed"
          });
        }
        successCount++;
      } catch (err) {
        console.error(`Failure processing discrete entry element item ID [${item.id}]:`, err);
        failureCount++;
      }
    }

    setBulkSummary({ success: successCount, failure: failureCount });
    setSelectedIds([]);
    setProcessingBulk(false);
    fetchData();
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllVisiblePending = (visiblePendingItems: Settlement[]) => {
    const visiblePendingIds = visiblePendingItems.map(x => x.id);
    const checkingAll = visiblePendingIds.every(id => selectedIds.includes(id));
    
    if (checkingAll) {
      setSelectedIds(prev => prev.filter(id => !visiblePendingIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visiblePendingIds])));
    }
  };

  // --- Filtering Evaluation Architecture Layer ---
  const filteredSettlements = settlements.filter((s) => {
    // 1. Tab Status Filter
    if (activeTab === "pending" && s.status !== "pending_request" && s.status !== "processing") return false;
    if (activeTab === "paid" && s.status !== "paid") return false;
    if (activeTab === "rejected" && s.status !== "rejected") return false;

    // 2. Settlement Type Filter
    if (filterType !== "all" && s.type !== filterType) return false;

    // 3. Payment Method Filter
    if (filterMethod !== "all" && s.payment_method !== filterMethod) return false;

    // 4. Date Range Filter
    if (filterDateRange.start) {
      const startBoundary = new Date(filterDateRange.start).getTime();
      const itemTime = new Date(s.created_at).getTime();
      if (itemTime < startBoundary) return false;
    }
    if (filterDateRange.end) {
      const endBoundary = new Date(filterDateRange.end).setHours(23, 59, 59, 999);
      const itemTime = new Date(s.created_at).getTime();
      if (itemTime > endBoundary) return false;
    }

    // 5. Query Search String Matching Text Components
    const query = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(query) ||
      s.entity_name.toLowerCase().includes(query) ||
      (s.utr_number && s.utr_number.toLowerCase().includes(query))
    );
  });

  const visiblePending = filteredSettlements.filter(s => s.status === "pending_request");

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance Settlement Center</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Advanced corporate clearing ledger configuration architecture workspace matrix control.</p>
          </div>
        </div>
      </div>

      {/* Analytics Summary Matrices Cards Segment */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Pending Vendor Payouts</p>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.pendingVendor.toFixed(2)}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Pending Rider Payouts</p>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.pendingRider.toFixed(2)}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Paid Today</p>
          <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.paidToday.toFixed(2)}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Pending Amount</p>
          <h4 className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.pendingAmount.toFixed(2)}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Paid This Month</p>
          <h4 className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.paidThisMonth.toFixed(2)}</h4>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 truncate">Rejected</p>
          <h4 className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center"><IndianRupee className="h-4 w-4" />{metrics.rejectedAmount.toFixed(2)}</h4>
        </div>
      </div>

      {/* Batch Processing Execution Loop Reporting Status Alerts */}
      {bulkSummary && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <AlertCircle className="h-4 w-4" />
            <span>Massive clearing updates completed. <strong>Success: {bulkSummary.success}</strong> rows, <strong>Failures: {bulkSummary.failure}</strong> rows.</span>
          </div>
          <button onClick={() => setBulkSummary(null)} className="text-xs underline text-blue-600 dark:text-blue-400 font-semibold">Dismiss</button>
        </div>
      )}

      {/* Primary Workflow Sorting Tab Matrices Panels */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(["all", "pending", "paid", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab 
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400" 
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab === "all" ? "History Logs (All)" : tab === "pending" ? "Pending Tab" : tab}
          </button>
        ))}
      </div>

      {/* Controls Filters Grid Infrastructure */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Queries Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter ID, Target, Merchant, Key, UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Selectors */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Recipient Types</option>
              <option value="vendor">Vendors Only</option>
              <option value="rider">Riders Only</option>
            </select>
          </div>

          {/* Method Selectors */}
          <div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Settlement Methods</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI Payout</option>
              <option value="Card Payout">Card Payout</option>
              <option value="Wallet">Wallet Transfer</option>
            </select>
          </div>

          {/* Mass Clearing Batch Automation Buttons Triggers */}
          <div>
            {selectedIds.length > 0 && (
              <button
                onClick={processBulkSettlementBatch}
                disabled={processingBulk}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-all"
              >
                <CreditCard className="h-4 w-4" />
                {processingBulk ? "Processing Batch Loop..." : `Execute Mass Clear (${selectedIds.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Date Ranges Matrix Selection Component Panels */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Range:</span>
          </div>
          <div className="flex items-center gap-1">
            <span>From</span>
            <input 
              type="date" 
              value={filterDateRange.start} 
              onChange={(e) => setFilterDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <span>Until</span>
            <input 
              type="date" 
              value={filterDateRange.end} 
              onChange={(e) => setFilterDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          {(filterDateRange.start || filterDateRange.end || filterMethod !== "all" || filterType !== "all" || searchQuery) && (
            <button 
              onClick={() => {
                setFilterDateRange({ start: "", end: "" });
                setFilterMethod("all");
                setFilterType("all");
                setSearchQuery("");
              }}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline ml-auto"
            >
              Reset Center Filters Matrix
            </button>
          )}
        </div>
      </div>

      {/* Main Core Tracking Table Output Visualization Canvas */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-6 py-3 w-4">
                  {activeTab === "pending" || visiblePending.length > 0 ? (
                    <input 
                      type="checkbox"
                      checked={visiblePending.length > 0 && visiblePending.every(x => selectedIds.includes(x.id))}
                      onChange={() => handleSelectAllVisiblePending(visiblePending)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  ) : null}
                </th>
                <th className="px-6 py-3">Settlement ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Recipient Name</th>
                <th className="px-6 py-3">Disbursement Total</th>
                <th className="px-6 py-3">Clearing Details</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Operations Architecture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">Retrieving secure financial records data metrics layers...</td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">No matches found within current filter configurations.</td>
                </tr>
              ) : (
                filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      {s.status === "pending_request" ? (
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => handleSelectToggle(s.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      ) : null}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{s.id}</td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        s.type === "vendor" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{s.entity_name}</td>
                    <td className="px-6 py-4 font-semibold flex items-center gap-0.5 mt-4">
                      <IndianRupee className="h-3.5 w-3.5" />
                      {s.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate">
                      {s.status === "paid" ? (
                        <div className="text-xs space-y-0.5 text-gray-500 dark:text-gray-400">
                          <div><span className="font-medium">Method:</span> {s.payment_method}</div>
                          <div><span className="font-medium">UTR:</span> {s.utr_number}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Awaiting clearance confirmation</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                        s.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        s.status === "rejected" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400" :
                        s.status === "processing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {s.status === "paid" && <CheckCircle className="h-3 w-3" />}
                        {s.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {(s.status === "pending_request" || s.status === "processing") && <Clock className="h-3 w-3" />}
                        <span>
                          {s.status === "pending_request" ? "Pending Request" : 
                           s.status === "processing" ? "Processing" : 
                           s.status === "paid" ? "Paid" : "Rejected"}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openViewModal(s)}
                        className="inline-flex items-center justify-center gap-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </button>
                      <button
                        onClick={() => viewLedgerHistory(s)}
                        className="inline-flex items-center justify-center gap-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        <History className="h-3.5 w-3.5" />
                        Ledger
                      </button>
                      {s.status === "pending_request" && (
                        <>
                          <button
                            onClick={() => openApproveModal(s)}
                            className="inline-flex items-center justify-center text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(s)}
                            className="inline-flex items-center justify-center text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {s.status === "processing" && (
                        <span className="text-xs text-gray-400 italic px-2">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Comprehensive Settlement Information Modal */}
      <Modal isOpen={activeModal === "view"} onClose={closeModal} title="Comprehensive Settlement Profile View">
        {selectedSettlement && (
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase block mb-0.5">Recipient Profile</span>
                <p className="font-semibold text-gray-900 dark:text-white capitalize">{selectedSettlement.type} ({selectedSettlement.entity_name})</p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase block mb-0.5">Contact Connection</span>
                <p className="font-mono text-gray-900 dark:text-white">{selectedSettlement.phone || "None Logged"}</p>
              </div>
              {selectedSettlement.type === "vendor" && (
                <div className="col-span-2">
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-0.5">Physical Store Registration Address</span>
                  <p className="text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/30 p-2 rounded border border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
                    {selectedSettlement.address_line1 ? (
                      <>
                        {selectedSettlement.address_line1}
                        {selectedSettlement.address_line2 ? `\n${selectedSettlement.address_line2}` : ""}
                        {`\n${selectedSettlement.city || ""}, ${selectedSettlement.state || ""} - ${selectedSettlement.pin_code || ""}`}
                      </>
                    ) : (
                      "No Physical Address Fields Found In Profiles Records"
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Secure Banking Context Matrices Mapping Blocks */}
            <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-lg border border-gray-100 dark:border-gray-700 space-y-3">
              <span className="text-xs font-bold text-gray-500 uppercase block tracking-wider">Secured Target Node Remittance Wire Details</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block">Bank Account Holder</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedSettlement.account_holder_name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-gray-400 block">Bank Entity Identifier</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedSettlement.bank_name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-gray-400 block">Account Registration Serial</span>
                  <p className="font-mono font-medium text-gray-900 dark:text-white">{selectedSettlement.account_number || "N/A"}</p>
                </div>
                <div>
                  <span className="text-gray-400 block">IFSC System Code</span>
                  <p className="font-mono font-medium text-gray-900 dark:text-white">{selectedSettlement.ifsc_code || "N/A"}</p>
                </div>
                <div className="col-span-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50">
                  <span className="text-gray-400 block">Target Remittance Virtual Address (UPI)</span>
                  <p className="font-mono font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    {selectedSettlement.upi_id || "No Setup Configured"} 
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center pt-2 bg-white dark:bg-gray-800 rounded p-3 border border-gray-200/60 dark:border-gray-600/60">
                {selectedSettlement.type === "vendor" ? (
                  selectedSettlement.qr_code_url ? (
                    <img 
                      src={selectedSettlement.qr_code_url} 
                      alt="Vendor QR" 
                      className="w-28 h-28 object-contain cursor-pointer" 
                      onClick={() => window.open(selectedSettlement.qr_code_url, "_blank")}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-medium py-4">QR Not Uploaded</span>
                  )
                ) : (
                  <span className="text-xs text-gray-400 font-medium py-4">No QR Uploaded</span>
                )}
                <span className="text-[10px] text-gray-400 mt-1.5 uppercase font-semibold"> remitting node scanner index link </span>
              </div>
            </div>

            {/* Orders Included Section */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase block tracking-wider">Orders Included</span>
              {loadingOrders ? (
                <p className="text-xs text-gray-400 italic">Loading included orders...</p>
              ) : includedOrders.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No orders linked to this settlement.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold uppercase">
                      <tr>
                        <th className="px-3 py-1.5">Order Number</th>
                        <th className="px-3 py-1.5">Payment Method</th>
                        <th className="px-3 py-1.5">Status</th>
                        <th className="px-3 py-1.5">Vendor Earning</th>
                        <th className="px-3 py-1.5">Rider Earning</th>
                        <th className="px-3 py-1.5">Platform Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                      {includedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                          <td className="px-3 py-1.5 font-mono">{order.order_number || order.id}</td>
                          <td className="px-3 py-1.5">{order.payment_method || "N/A"}</td>
                          <td className="px-3 py-1.5 capitalize">{order.status || "N/A"}</td>
                          <td className="px-3 py-1.5">₹{(order.vendor_earning || 0).toFixed(2)}</td>
                          <td className="px-3 py-1.5">₹{(order.rider_earning || 0).toFixed(2)}</td>
                          <td className="px-3 py-1.5">₹{(order.platform_fee || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transaction Metrics Details Fields Rows */}
            <div className="grid grid-cols-3 gap-2 text-xs border-t border-gray-100 dark:border-gray-700 pt-3">
              <div>
                <span className="text-gray-400 block">Request Ingestion Date</span>
                <p className="font-medium text-gray-900 dark:text-white">{new Date(selectedSettlement.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-400 block">Settlement Target Amount</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center"><IndianRupee className="h-3.5 w-3.5" />{selectedSettlement.amount.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-400 block">Settlement Status Flag</span>
                <span className="capitalize font-semibold text-blue-600 dark:text-blue-400">
                  {selectedSettlement.status === "pending_request" ? "Pending Request" : selectedSettlement.status}
                </span>
              </div>
            </div>

            {/* Administrative Workflow Tracking Remarks Section History */}
            {selectedSettlement.remarks && (
              <div className="p-2.5 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-100 dark:border-gray-700 text-xs italic">
                <span className="text-[10px] font-bold text-gray-400 uppercase block not-italic mb-1">Previous Internal Audit Logs Narrative Remarks</span>
                "{selectedSettlement.remarks}"
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg">Close View Window</button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Financial Ledger History Entry Logs Tracking Modal */}
      <Modal isOpen={activeModal === "ledger"} onClose={closeModal} title="Financial Ledger Registry Trail Trackers">
        <div className="space-y-4">
          {loadingLedger ? (
            <p className="text-sm text-center text-gray-500 py-4">Extracting ledger index listings metrics tables mapping registers...</p>
          ) : ledgerHistory.length === 0 ? (
            <p className="text-sm text-center text-gray-500 py-4">No associated audit logs references mapped in the ledger system database.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ledgerHistory.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Type: <strong className="text-gray-700 dark:text-gray-200 capitalize">{log.transaction_type}</strong></span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white text-sm">
                    <span>Reference Record Token: <span className="font-mono text-xs">{log.reference_id}</span></span>
                    <span className="flex items-center text-emerald-600 dark:text-emerald-400"><IndianRupee className="h-3.5 w-3.5" />{log.amount.toFixed(2)}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 border-t border-gray-200/50 dark:border-gray-600/50 pt-1">
                    Remarks: <span className="italic">"{log.remarks}"</span>
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg">Dismiss</button>
          </div>
        </div>
      </Modal>

      {/* Manual Processing Approve Verification Modal Screen */}
      <Modal isOpen={activeModal === "approve"} onClose={closeModal} title="Authorize Settlement & Release Funds">
        {selectedSettlement && (
          <div className="space-y-4 text-sm">
            {/* Secure Node Metadata Layout Component Matrices Block */}
            <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remittance Profile Data Clearance Summary</span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600 dark:text-gray-300">
                <div>Holder: <span className="text-gray-900 dark:text-white font-medium">{selectedSettlement.account_holder_name || "N/A"}</span></div>
                <div>Bank: <span className="text-gray-900 dark:text-white font-medium">{selectedSettlement.bank_name || "N/A"}</span></div>
                <div>A/C Number: <span className="text-gray-900 dark:text-white font-mono">{selectedSettlement.account_number || "N/A"}</span></div>
                <div>IFSC Identifier: <span className="text-gray-900 dark:text-white font-mono">{selectedSettlement.ifsc_code || "N/A"}</span></div>
                <div className="col-span-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50">
                  UPI Handle: <span className="text-gray-900 dark:text-white font-mono">{selectedSettlement.upi_id || "No Setup Configured"}</span>
                </div>
              </div>

              <div className="flex items-center justify-center pt-2">
                <div className="bg-white p-2 rounded border border-gray-200">
                  {selectedSettlement.type === "vendor" ? (
                    selectedSettlement.qr_code_url ? (
                      <img 
                        src={selectedSettlement.qr_code_url} 
                        alt="Vendor QR" 
                        className="w-24 h-24 object-contain cursor-pointer" 
                        onClick={() => window.open(selectedSettlement.qr_code_url, "_blank")}
                      />
                    ) : (
                      <span className="text-xs text-gray-400 font-medium py-4 block">QR Not Uploaded</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-400 font-medium py-4 block">No QR Uploaded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Input Interactive Forms Processing Parameters Configs Elements */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Clearing Channel Mechanism</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI Payout Network</option>
                  <option value="Card Payout">Card Payout</option>
                  <option value="Wallet">Digital Wallet Network</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Unique Bank Transaction Reference (UTR / Reference Number)</label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="Provide sequence confirmation numeric token reference hash string"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Internal Ledger Accounting Audit Remarks / Notes</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional administrative operational oversight notes tracking annotations strings log mapping context."
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs"
                />
              </div>
            </div>

            {/* Control Adjustments Dispatches Matrix Triggers */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleApprove}
                disabled={!utrNumber.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
              >
                Confirm Asset Release & Mark Paid
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Rejection State Modal Segment View Panel */}
      <Modal isOpen={activeModal === "reject"} onClose={closeModal} title="Confirm Transaction Denying Action Request">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Denying clearing action requests cancels the target row operational workflow path cycle execution context parameters securely. This state modifier adjust cannot be effortlessly reverted.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reason for Processing Denial Verification Rejection</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="State structural reasoning rationale behind transaction denial processes mapping details."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button onClick={closeModal} className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleReject} className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors">Confirm Rejection State Assignment</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}