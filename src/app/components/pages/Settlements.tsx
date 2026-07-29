import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Calendar,
  History,
  Filter,
  ShieldCheck,
  User,
  Store,
  X,
  Loader2,
  QrCode
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

interface VendorProfile {
  id: string;
  vendor_id: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  billing_address?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  email?: string;
  qr_code_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface RiderProfile {
  id: string;
  rider_id: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  home_address?: string;
  address?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

interface Vendor {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
}

interface Rider {
  id: string;
  rider_name: string;
  phone: string;
  email?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
}

interface Wallet {
  id: string;
  entity_id: string;
  entity_type: 'vendor' | 'rider';
  balance: number;
}

interface VendorSettlement {
  id: string;
  vendor_id: string;
  amount: number;
  order_ids: string[];
  order_count?: number;
  status: 'pending' | 'paid' | 'rejected' | 'pending_request';
  created_at: string;
  paid_at?: string;
  payment_method?: string;
  utr_number?: string;
  remarks?: string;
  settlement_type?: string;
  requested_by?: string;
  request_date?: string;
}

interface RiderSettlement {
  id: string;
  rider_id: string;
  amount: number;
  order_ids: string[];
  delivery_count?: number;
  status: 'pending' | 'paid' | 'rejected' | 'pending_request';
  created_at: string;
  paid_at?: string;
  payment_method?: string;
  utr_number?: string;
  remarks?: string;
}

interface FinancialLedger {
  id: string;
  entity_type: string;
  entity_id: string;
  transaction_type: string;
  entry_type: 'credit' | 'debit';
  amount: number;
  reference_id: string;
  remarks: string;
  created_at: string;
}

interface SubscriptionPaymentRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Order {
  id: string;
  vendor_id?: string;
  rider_id?: string;
  vendor_earning?: number;
  rider_earning?: number;
  vendor_commission?: number;
  platform_fee?: number;
  rivo_delivery_margin?: number;
  order_status?: string;
  delivered_at?: string;
  settled_vendor?: boolean;
  settled_rider?: boolean;
  created_at: string;
}

export function Settlements() {
  const [activeTab, setActiveTab] = useState<'overview' | 'vendor' | 'rider' | 'ledger' | 'audit'>('overview');
  const [globalSearch, setGlobalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [realtimePulse, setRealtimePulse] = useState(false);

  const [vendorSettlements, setVendorSettlements] = useState<VendorSettlement[]>([]);
  const [riderSettlements, setRiderSettlements] = useState<RiderSettlement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<VendorProfile[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [riderProfiles, setRiderProfiles] = useState<RiderProfile[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<FinancialLedger[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionPaymentRequest[]>([]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setStartDateEnd] = useState<string>("");

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'vendor' | 'rider'>('vendor');

  const [formUtr, setFormUtr] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Bank Transfer");

  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [auditFilter, setAuditFilter] = useState({ entity: "all", status: "all" });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDatabaseState = useCallback(async () => {
    try {
      setRealtimePulse(true);

      const [
        resVSet, resRSet, resVendors, resVProf, resRiders, 
        resRProf, resWallets, resOrders, resLedger, resSubs
      ] = await Promise.all([
        supabase.from("vendor_settlements").select("*").order("created_at", { ascending: false }),
        supabase.from("rider_settlements").select("*").order("created_at", { ascending: false }),
        supabase.from("vendors").select("*"),
        supabase.from("vendor_profiles").select("*"),
        supabase.from("riders").select("*"),
        supabase.from("rider_profiles").select("*"),
        supabase.from("wallets").select("*"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("financial_ledger").select("*").order("created_at", { ascending: false }),
        supabase.from("subscription_payment_requests").select("*").eq("status", "approved")
      ]);

      const fetchedOrders: Order[] = resOrders.data || [];
      const fetchedVSets: VendorSettlement[] = resVSet.data || [];
      const fetchedRSets: RiderSettlement[] = resRSet.data || [];

      // AUTOMATIC PENDING SETTLEMENT CALCULATION FOR VENDORS
      const vendorUnsettledOrders = fetchedOrders.filter(
        o => o.order_status === 'delivered' && o.settled_vendor === false && o.vendor_id
      );

      const vendorGroups: { [vendorId: string]: Order[] } = {};
      vendorUnsettledOrders.forEach(o => {
        if (o.vendor_id) {
          if (!vendorGroups[o.vendor_id]) vendorGroups[o.vendor_id] = [];
          vendorGroups[o.vendor_id].push(o);
        }
      });

      const newVendorSettlementInserts = [];
      for (const [vId, vOrders] of Object.entries(vendorGroups)) {
        const orderIds = vOrders.map(o => o.id).sort();
        const totalAmount = vOrders.reduce((acc, o) => acc + (Number(o.vendor_earning) || 0), 0);

        const exists = fetchedVSets.some(vs => {
          if (vs.status === 'pending' || vs.status === 'pending_request') {
            const existingIds = (vs.order_ids || []).slice().sort();
            return JSON.stringify(existingIds) === JSON.stringify(orderIds);
          }
          return false;
        });

        if (!exists && orderIds.length > 0) {
          newVendorSettlementInserts.push({
            vendor_id: vId,
            amount: totalAmount,
            order_ids: orderIds,
            order_count: orderIds.length,
            status: 'pending'
          });
        }
      }

      if (newVendorSettlementInserts.length > 0) {
        await supabase.from("vendor_settlements").insert(newVendorSettlementInserts);
      }

      // AUTOMATIC PENDING SETTLEMENT CALCULATION FOR RIDERS
      const riderUnsettledOrders = fetchedOrders.filter(
        o => o.order_status === 'delivered' && o.settled_rider === false && o.rider_id
      );

      const riderGroups: { [riderId: string]: Order[] } = {};
      riderUnsettledOrders.forEach(o => {
        if (o.rider_id) {
          if (!riderGroups[o.rider_id]) riderGroups[o.rider_id] = [];
          riderGroups[o.rider_id].push(o);
        }
      });

      const newRiderSettlementInserts = [];
      for (const [rId, rOrders] of Object.entries(riderGroups)) {
        const orderIds = rOrders.map(o => o.id).sort();
        const totalAmount = rOrders.reduce((acc, o) => acc + (Number(o.rider_earning) || 0), 0);

        const exists = fetchedRSets.some(rs => {
          if (rs.status === 'pending' || rs.status === 'pending_request') {
            const existingIds = (rs.order_ids || []).slice().sort();
            return JSON.stringify(existingIds) === JSON.stringify(orderIds);
          }
          return false;
        });

        if (!exists && orderIds.length > 0) {
          newRiderSettlementInserts.push({
            rider_id: rId,
            amount: totalAmount,
            order_ids: orderIds,
            delivery_count: orderIds.length,
            status: 'pending'
          });
        }
      }

      if (newRiderSettlementInserts.length > 0) {
        await supabase.from("rider_settlements").insert(newRiderSettlementInserts);
      }

      // RE-FETCH REFRESHED SETTLEMENTS IF NEW INSERTS OCCURRED
      let finalVSets = fetchedVSets;
      let finalRSets = fetchedRSets;
      if (newVendorSettlementInserts.length > 0 || newRiderSettlementInserts.length > 0) {
        const [rfV, rfR] = await Promise.all([
          supabase.from("vendor_settlements").select("*").order("created_at", { ascending: false }),
          supabase.from("rider_settlements").select("*").order("created_at", { ascending: false })
        ]);
        if (rfV.data) finalVSets = rfV.data;
        if (rfR.data) finalRSets = rfR.data;
      }

      setVendorSettlements(finalVSets);
      setRiderSettlements(finalRSets);
      if (resVendors.data) setVendors(resVendors.data);
      if (resVProf.data) setVendorProfiles(resVProf.data);
      if (resRiders.data) setRiders(resRiders.data);
      if (resRProf.data) setRiderProfiles(resRProf.data);
      if (resWallets.data) setWallets(resWallets.data);
      setOrders(fetchedOrders);
      if (resLedger.data) setLedger(resLedger.data);
      if (resSubs.data) setSubscriptionRequests(resSubs.data);
    } catch (e) {
      console.error("Database loading exception:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setRealtimePulse(false), 500);
    }
  }, []);

  useEffect(() => {
    loadDatabaseState();
    const tables = [
      "vendor_settlements", "rider_settlements", "vendors", "vendor_profiles", 
      "riders", "rider_profiles", "wallets", "orders", "financial_ledger", "subscription_payment_requests"
    ];
    
    const channels = tables.map(table => 
      supabase.channel(`realtime-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => loadDatabaseState())
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [loadDatabaseState]);

  const resolvedEntity = useMemo(() => {
    if (!selectedSettlement) return null;

    if (selectedType === 'vendor') {
      const vendorId = selectedSettlement.vendor_id;
      const vendor = vendors.find(v => v.id === vendorId) || null;
      const wallet = wallets.find(w => w.entity_id === vendorId && w.entity_type === 'vendor') || null;
      
      const sortedProfiles = [...vendorProfiles]
        .filter(p => p.vendor_id === vendorId)
        .sort((a, b) => {
          const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });
      
      const vendorProfile = sortedProfiles[0] || null;

      return {
        vendor,
        vendorProfile,
        wallet,
        rider: null,
        riderProfile: null
      };

    } else {
      const riderId = selectedSettlement.rider_id;
      const rider = riders.find(r => r.id === riderId) || null;
      const wallet = wallets.find(w => w.entity_id === riderId && w.entity_type === 'rider') || null;
      
      const sortedProfiles = [...riderProfiles]
        .filter(p => p.rider_id === riderId)
        .sort((a, b) => {
          const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });

      const riderProfile = sortedProfiles[0] || null;

      return {
        rider,
        riderProfile,
        wallet,
        vendor: null,
        vendorProfile: null
      };
    }
  }, [selectedSettlement, selectedType, vendors, vendorProfiles, riders, riderProfiles, wallets]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    const startOfWeekTime = startOfWeek.getTime();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const isInCustomRange = (timestampStr: string) => {
      if (!startDate && !endDate) return true;
      const targetTime = new Date(timestampStr).getTime();
      if (startDate && targetTime < new Date(startDate).setHours(0,0,0,0)) return false;
      if (endDate && targetTime > new Date(endDate).setHours(23,59,59,999)) return false;
      return true;
    };

    const parseMetricsForSet = (items: any[], dateField: string, amountField: string = "amount") => {
      let today = 0, week = 0, month = 0, total = 0, customRangeTotal = 0;
      items.forEach(item => {
        const time = new Date(item[dateField]).getTime();
        const val = Number(item[amountField]) || 0;
        total += val;
        if (time >= startOfToday) today += val;
        if (time >= startOfWeekTime) week += val;
        if (time >= startOfMonth) month += val;
        if (isInCustomRange(item[dateField])) customRangeTotal += val;
      });
      return { today, week, month, total, customRangeTotal };
    };

    const collections = parseMetricsForSet(orders, "created_at", "vendor_earning");
    const commissions = parseMetricsForSet(orders, "created_at", "platform_fee");
    const subRevenue = parseMetricsForSet(subscriptionRequests, "created_at", "amount");
    const riderEarnings = parseMetricsForSet(riderSettlements, "created_at", "amount");

    const paidVendorsThisWeek = vendorSettlements.filter(s => s.status === "paid" && new Date(s.paid_at || "").getTime() >= startOfWeekTime).reduce((a,c) => a + c.amount, 0);
    const paidRidersThisWeek = riderSettlements.filter(s => s.status === "paid" && new Date(s.paid_at || "").getTime() >= startOfWeekTime).reduce((a,c) => a + c.amount, 0);
    const paidThisWeek = paidVendorsThisWeek + paidRidersThisWeek;

    const isPending = (st: string) => st === "pending" || st === "pending_request";

    const pendingVendorLiability = vendorSettlements.filter(s => isPending(s.status)).reduce((a,c) => a + c.amount, 0);
    const pendingRiderLiability = riderSettlements.filter(s => isPending(s.status)).reduce((a,c) => a + c.amount, 0);
    const pendingSettlementsCount = vendorSettlements.filter(s => isPending(s.status)).length + riderSettlements.filter(s => isPending(s.status)).length;

    return {
      collections,
      commissions,
      subRevenue,
      riderEarnings,
      pendingVendorLiability,
      pendingRiderLiability,
      paidThisWeek,
      pendingSettlementsCount,
      hasCustomFilter: !!(startDate || endDate)
    };
  }, [orders, subscriptionRequests, vendorSettlements, riderSettlements, startDate, endDate]);

  const matchesGlobalSearch = useCallback((entityId: string, type: 'vendor' | 'rider', utr: string = "", settlementId: string = "") => {
    if (!globalSearch.trim()) return true;
    const query = globalSearch.toLowerCase();
    
    const targetUtr = utr.toLowerCase();
    const targetId = settlementId.toLowerCase();

    if (type === 'vendor') {
      const vendor = vendors.find(v => v.id === entityId);
      const shopName = (vendor?.shop_name || "").toLowerCase();
      const ownerName = (vendor?.owner_name || "").toLowerCase();
      const phone = (vendor?.phone || "").toLowerCase();
      return shopName.includes(query) || ownerName.includes(query) || phone.includes(query) || targetUtr.includes(query) || targetId.includes(query);
    } else {
      const rider = riders.find(r => r.id === entityId);
      const riderName = (rider?.rider_name || "").toLowerCase();
      const phone = (rider?.phone || "").toLowerCase();
      return riderName.includes(query) || phone.includes(query) || targetUtr.includes(query) || targetId.includes(query);
    }
  }, [globalSearch, vendors, riders]);

  const handleOpenPayWorkflow = (settlement: any, type: 'vendor' | 'rider') => {
    setSelectedSettlement(settlement);
    setSelectedType(type);
    setFormUtr("");
    setFormRemarks("");
    setFormPaymentMethod("Bank Transfer");
    setPayModalOpen(true);
  };

  const handleOpenRejectWorkflow = (settlement: any, type: 'vendor' | 'rider') => {
    setSelectedSettlement(settlement);
    setSelectedType(type);
    setFormRemarks("");
    setRejectModalOpen(true);
  };

  const handleOpenDetailsWorkflow = (settlement: any, type: 'vendor' | 'rider') => {
    setSelectedSettlement(settlement);
    setSelectedType(type);
    setDetailsModalOpen(true);
  };

  const executePayFinalization = async () => {
    if (!selectedSettlement) return;
    setActionLoading(true);
    try {
      const targetTable = selectedType === 'vendor' ? 'vendor_settlements' : 'rider_settlements';
      const entityIdKey = selectedType === 'vendor' ? selectedSettlement.vendor_id : selectedSettlement.rider_id;

      // 1. UPDATE SETTLEMENT TABLE STATUS
      const { error: patchError } = await supabase
        .from(targetTable)
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: formPaymentMethod,
          utr_number: formUtr.trim(),
          remarks: formRemarks.trim()
        })
        .eq('id', selectedSettlement.id);

      if (patchError) throw patchError;

      // 2. UPDATE INCLUDED ORDERS IN ORDERS TABLE
      if (selectedSettlement.order_ids && selectedSettlement.order_ids.length > 0) {
        const orderColumnToUpdate = selectedType === 'vendor' ? { settled_vendor: true } : { settled_rider: true };
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update(orderColumnToUpdate)
          .in('id', selectedSettlement.order_ids);

        if (orderUpdateError) {
          console.error("Error updating settled flag on orders:", orderUpdateError);
        }
      }

      // 3. INSERT FINANCIAL LEDGER ENTRY
      const { error: ledgerError } = await supabase
        .from('financial_ledger')
        .insert([{
          entity_type: selectedType,
          entity_id: entityIdKey,
          transaction_type: 'Manual Transfer Clearance',
          entry_type: 'debit',
          amount: selectedSettlement.amount,
          reference_id: selectedSettlement.id,
          remarks: `Payout processed. Method: ${formPaymentMethod}. UTR: ${formUtr}. Remarks: ${formRemarks}`
        }]);

      if (ledgerError) console.error("Error writing to financial_ledger:", ledgerError);

      setPayModalOpen(false);
      triggerToast("Payment recorded successfully.");
      loadDatabaseState();
    } catch (err) {
      console.error("Payout trigger error: ", err);
      triggerToast("Failed to record payment.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const executeRejectFinalization = async () => {
    if (!selectedSettlement) return;
    setActionLoading(true);
    try {
      const targetTable = selectedType === 'vendor' ? 'vendor_settlements' : 'rider_settlements';
      const { error: rejectError } = await supabase
        .from(targetTable)
        .update({
          status: 'rejected',
          remarks: formRemarks.trim()
        })
        .eq('id', selectedSettlement.id);

      if (rejectError) throw rejectError;

      setRejectModalOpen(false);
      triggerToast("Settlement rejected.");
      loadDatabaseState();
    } catch (err) {
      console.error("Rejection error:", err);
      triggerToast("Failed to reject settlement.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const auditLogsTimeline = useMemo(() => {
    const list: any[] = [];
    vendorSettlements.forEach(vs => {
      const normalizedStatus = vs.status === 'pending_request' ? 'pending' : vs.status;
      list.push({ ts: vs.created_at, actor: 'System Auto-Calculation', action: 'Pending Settlement Generated', amount: vs.amount, targetId: vs.id, status: normalizedStatus, type: 'vendor' });
      if (vs.paid_at) {
        list.push({ ts: vs.paid_at, actor: 'Finance Admin', action: 'Settlement Marked Paid', amount: vs.amount, targetId: vs.id, status: 'paid', type: 'vendor' });
      }
    });
    riderSettlements.forEach(rs => {
      const normalizedStatus = rs.status === 'pending_request' ? 'pending' : rs.status;
      list.push({ ts: rs.created_at, actor: 'System Auto-Calculation', action: 'Pending Settlement Generated', amount: rs.amount, targetId: rs.id, status: normalizedStatus, type: 'rider' });
      if (rs.paid_at) {
        list.push({ ts: rs.paid_at, actor: 'Finance Admin', action: 'Settlement Marked Paid', amount: rs.amount, targetId: rs.id, status: 'paid', type: 'rider' });
      }
    });
    return list.sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [vendorSettlements, riderSettlements]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">Loading Financial Matrices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto bg-white min-h-screen antialiased text-slate-800 font-sans relative">
      
      {/* TOAST FEEDBACK */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-md border text-white font-medium bg-slate-900 border-emerald-500/30 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="text-xs tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* HEADER SECTION CONTROLS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Settlements</h1>
            {realtimePulse && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Review pending balances, look up bank details, and log manual payments</p>
        </div>

        {/* Search Interface */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, shop, phone or UTR..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all font-medium"
          />
        </div>
      </div>

      {/* NAVIGATION TABS ACCORDION */}
      <div className="flex gap-1.5 border-b border-gray-100 overflow-x-auto pb-px scrollbar-none">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'vendor', label: 'Vendor Settlements' },
          { id: 'rider', label: 'Rider Settlements' },
          { id: 'ledger', label: 'Financial Ledger' },
          { id: 'audit', label: 'Audit Trail Logs' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          
          {/* CUSTOM DATE RANGE BAR */}
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Calendar size={14} className="text-emerald-600" /> Filter Overview By Date Range
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">Start:</span>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1.5 bg-white border border-gray-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">End:</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setStartDateEnd(e.target.value)}
                  className="p-1.5 bg-white border border-gray-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-emerald-600"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(""); setStartDateEnd(""); }}
                  className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md hover:bg-rose-100 cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[
              { title: "Today's Collection", value: metrics.hasCustomFilter ? metrics.collections.customRangeTotal : metrics.collections.today, sub: metrics.hasCustomFilter ? "Calculated for chosen range" : `This Week: ₹${metrics.collections.week.toLocaleString()}` },
              { title: "Platform Commission", value: metrics.hasCustomFilter ? metrics.commissions.customRangeTotal : metrics.commissions.today, sub: metrics.hasCustomFilter ? "Calculated for chosen range" : `Month Total: ₹${metrics.commissions.month.toLocaleString()}` },
              { title: "Subscription Revenue", value: metrics.hasCustomFilter ? metrics.subRevenue.customRangeTotal : metrics.subRevenue.total, sub: "Approved vendor settlements" },
              { title: "Rider Earnings Summary", value: metrics.hasCustomFilter ? metrics.riderEarnings.customRangeTotal : metrics.riderEarnings.total, sub: metrics.hasCustomFilter ? "Custom date scope value" : `Month Total: ₹${metrics.riderEarnings.month.toLocaleString()}` },
              { title: "Pending Vendor Payouts", value: metrics.pendingVendorLiability, sub: "Calculated weekly pending payouts" },
              { title: "Pending Rider Payouts", value: metrics.pendingRiderLiability, sub: "Calculated weekly pending payouts" },
              { title: "Paid This Week", value: metrics.paidThisWeek, sub: "Cleared bank transactions total" }
            ].map((kpi, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-gray-200 p-5 rounded-xl transition-all duration-200 hover:border-emerald-600/30 hover:shadow-2xs group"
              >
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block transition-colors group-hover:text-slate-500">{kpi.title}</span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-2 flex items-baseline">
                    <span className="text-base font-bold text-slate-400 mr-0.5">₹</span>
                    {kpi.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-gray-50">{kpi.sub}</p>
              </div>
            ))}

            <div className="bg-white border border-gray-200 p-5 rounded-xl transition-all duration-200 hover:border-emerald-600/30 hover:shadow-2xs group">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">Pending Settlements</span>
                <h3 className="text-3xl font-black text-slate-900 mt-2">{metrics.pendingSettlementsCount}</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-gray-50">Active orders settlement queue</p>
            </div>
          </div>

          {/* RECENT TRANSACTIONS LEDGER MINI TABLE */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs space-y-3 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><History size={14} className="text-emerald-600" /> Recent Transactions Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="p-3">Date</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Transaction Type</th>
                    <th className="p-3">Credit (+ Inflow)</th>
                    <th className="p-3">Debit (- Outflow)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                  {ledger.slice(0, 8).map((item) => (
                    <tr 
                      key={item.id} 
                      className="transition-colors duration-200 hover:bg-emerald-50/30 cursor-pointer"
                    >
                      <td className="p-3 text-slate-400 font-normal">{new Date(item.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                      <td className="p-3 capitalize font-bold text-slate-900">{item.entity_type}</td>
                      <td className="p-3 text-slate-400 font-sans">{item.transaction_type}</td>
                      <td className="p-3 text-emerald-600 font-bold">{item.entry_type === 'credit' ? `₹${item.amount.toFixed(2)}` : '—'}</td>
                      <td className="p-3 text-rose-600 font-bold">{item.entry_type === 'debit' ? `₹${item.amount.toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SECTION: VENDOR SETTLEMENT */}
      {activeTab === 'vendor' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs animate-in fade-in duration-150">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="p-3.5 pl-4">Shop</th>
                  <th className="p-3.5">Owner</th>
                  <th className="p-3.5">Wallet Balance</th>
                  <th className="p-3.5">Orders Included</th>
                  <th className="p-3.5 text-emerald-600">Pending Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {vendorSettlements
                  .filter(vs => matchesGlobalSearch(vs.vendor_id, 'vendor', vs.utr_number, vs.id))
                  .map((vs) => {
                    const vendor = vendors.find(v => v.id === vs.vendor_id);
                    const wallet = wallets.find(w => w.entity_id === vs.vendor_id && w.entity_type === 'vendor');
                    const normalizedStatus = vs.status === 'pending_request' ? 'pending' : vs.status;
                    return (
                      <tr 
                        key={vs.id} 
                        className="transition-colors duration-200 hover:bg-emerald-50/30 cursor-pointer"
                      >
                        <td className="p-3.5 pl-4 font-bold text-slate-900">{vendor?.shop_name || "Unresolved Shop"}</td>
                        <td className="p-3.5 text-slate-600">{vendor?.owner_name || "—"}</td>
                        <td className="p-3.5 text-slate-500">₹{wallet?.balance?.toFixed(2) || '0.00'}</td>
                        <td className="p-3.5 text-slate-400 font-mono">{vs.order_count || vs.order_ids?.length || 0}</td>
                        <td className="p-3.5 font-bold text-emerald-600">₹{vs.amount?.toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded border tracking-wider uppercase ${
                            normalizedStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            normalizedStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {normalizedStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-4 space-x-1 whitespace-nowrap">
                          <button onClick={() => handleOpenDetailsWorkflow(vs, 'vendor')} className="px-2.5 py-1 text-[10px] font-bold border border-gray-200 rounded text-slate-600 hover:bg-gray-50 cursor-pointer">Details</button>
                          {normalizedStatus === 'pending' && (
                            <>
                              <button onClick={() => handleOpenPayWorkflow(vs, 'vendor')} className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer shadow-3xs">Pay</button>
                              <button onClick={() => handleOpenRejectWorkflow(vs, 'vendor')} className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 cursor-pointer shadow-3xs">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: RIDER SETTLEMENT */}
      {activeTab === 'rider' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs animate-in fade-in duration-150">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="p-3.5 pl-4">Rider</th>
                  <th className="p-3.5">Wallet Balance</th>
                  <th className="p-3.5">Deliveries Included</th>
                  <th className="p-3.5 text-emerald-600">Pending Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {riderSettlements
                  .filter(rs => matchesGlobalSearch(rs.rider_id, 'rider', rs.utr_number, rs.id))
                  .map((rs) => {
                    const rider = riders.find(r => r.id === rs.rider_id);
                    const wallet = wallets.find(w => w.entity_id === rs.rider_id && w.entity_type === 'rider');
                    const normalizedStatus = rs.status === 'pending_request' ? 'pending' : rs.status;
                    return (
                      <tr 
                        key={rs.id} 
                        className="transition-colors duration-200 hover:bg-emerald-50/30 cursor-pointer"
                      >
                        <td className="p-3.5 pl-4 font-bold text-slate-900">{rider?.rider_name || "Unresolved Rider"}</td>
                        <td className="p-3.5 text-slate-500">₹{wallet?.balance?.toFixed(2) || '0.00'}</td>
                        <td className="p-3.5 text-slate-400 font-mono">{rs.delivery_count || rs.order_ids?.length || 0}</td>
                        <td className="p-3.5 font-bold text-emerald-600">₹{rs.amount?.toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded border tracking-wider uppercase ${
                            normalizedStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            normalizedStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {normalizedStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-4 space-x-1 whitespace-nowrap">
                          <button onClick={() => handleOpenDetailsWorkflow(rs, 'rider')} className="px-2.5 py-1 text-[10px] font-bold border border-gray-200 rounded text-slate-600 hover:bg-gray-50 cursor-pointer">Details</button>
                          {normalizedStatus === 'pending' && (
                            <>
                              <button onClick={() => handleOpenPayWorkflow(rs, 'rider')} className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer shadow-3xs">Pay</button>
                              <button onClick={() => handleOpenRejectWorkflow(rs, 'rider')} className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 cursor-pointer shadow-3xs">Reject</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-emerald-600" />
              <select
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value)}
                className="text-xs p-1.5 bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none"
              >
                <option value="all">All Transactions</option>
                <option value="vendor">Vendor Transfers</option>
                <option value="rider">Rider Transfers</option>
              </select>
            </div>
            
            <div className="text-[10px] font-bold text-slate-400 bg-white border border-gray-200 px-3 py-1 rounded-md flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-600" /> IMMUTABLE CORE JOURNAL FILES ACTIVE
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="p-3.5 pl-4">Date</th>
                  <th className="p-3.5">Target Account</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Credit (+ Inflow)</th>
                  <th className="p-3.5">Debit (- Outflow)</th>
                  <th className="p-3.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-700">
                {ledger
                  .filter(l => ledgerFilter === 'all' || l.entity_type === ledgerFilter)
                  .map((item) => (
                    <tr 
                      key={item.id} 
                      className="transition-colors duration-200 hover:bg-emerald-50/30 cursor-pointer font-medium"
                    >
                      <td className="p-3.5 pl-4 text-slate-400 font-normal">{new Date(item.created_at).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-slate-900 font-bold uppercase">{item.entity_type}</td>
                      <td className="p-3.5 text-slate-500">{item.transaction_type}</td>
                      <td className="p-3.5 text-emerald-600 font-bold">{item.entry_type === 'credit' ? `₹${item.amount.toFixed(2)}` : '—'}</td>
                      <td className="p-3.5 text-rose-600 font-bold">{item.entry_type === 'debit' ? `₹${item.amount.toFixed(2)}` : '—'}</td>
                      <td className="p-3.5 text-slate-400 font-normal max-w-sm truncate">{item.remarks}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex items-center gap-3">
            <Filter size={14} className="text-emerald-600" />
            <select
              value={auditFilter.entity}
              onChange={(e) => setAuditFilter({ ...auditFilter, entity: e.target.value })}
              className="text-xs p-1.5 bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none"
            >
              <option value="all">All Request Node Profiles</option>
              <option value="vendor">Vendor Accounts</option>
              <option value="rider">Rider Accounts</option>
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="p-3.5 pl-4">Timestamp Trace</th>
                  <th className="p-3.5">Actor Profile</th>
                  <th className="p-3.5">Action Narrative</th>
                  <th className="p-3.5">Amount to Pay</th>
                  <th className="p-3.5">Reference ID Key</th>
                  <th className="p-3.5 text-right pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-700">
                {auditLogsTimeline
                  .filter(a => auditFilter.entity === 'all' || a.type === auditFilter.entity)
                  .map((log, idx) => (
                    <tr 
                      key={idx} 
                      className="transition-colors duration-200 hover:bg-emerald-50/30 cursor-pointer font-medium"
                    >
                      <td className="p-3.5 pl-4 text-slate-400 font-normal">{new Date(log.ts).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-slate-900 font-bold font-sans">{log.actor}</td>
                      <td className="p-3.5 text-slate-600 font-sans font-semibold">{log.action}</td>
                      <td className="p-3.5 text-slate-700 font-bold">₹{log.amount?.toFixed(2)}</td>
                      <td className="p-3.5 text-slate-400 text-[11px] font-mono tracking-tight">{log.targetId}</td>
                      <td className="p-3.5 text-right pr-4 uppercase text-[10px] font-extrabold text-slate-500">
                        {log.status}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED ANALYSIS MODAL */}
      {detailsModalOpen && selectedSettlement && resolvedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full shadow-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto max-h-[90vh]">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Business Information Summary</h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Reference ID: {selectedSettlement.id}</p>
              </div>
              <button onClick={() => setDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>

            {selectedType === 'vendor' ? (
              <div className="space-y-4 text-xs font-medium">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Shop</span><p className="text-slate-900 font-bold mt-0.5">{resolvedEntity.vendor?.shop_name || "—"}</p></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Owner</span><p className="text-slate-900 mt-0.5">{resolvedEntity.vendor?.owner_name || "—"}</p></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Phone</span><p className="text-slate-900 font-mono mt-0.5">{resolvedEntity.vendor?.phone || "—"}</p></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Email</span><p className="text-slate-900 mt-0.5">{resolvedEntity.vendorProfile?.email || "—"}</p></div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Billing Address</span>
                    <p className="text-slate-900 mt-0.5">
                      {resolvedEntity.vendorProfile?.address || resolvedEntity.vendorProfile?.billing_address || `${resolvedEntity.vendorProfile?.address_line1 || ''} ${resolvedEntity.vendorProfile?.address_line2 || ''} ${resolvedEntity.vendorProfile?.city || ''} ${resolvedEntity.vendorProfile?.state || ''} ${resolvedEntity.vendorProfile?.pin_code || ''}`.trim() || "—"}
                    </p>
                  </div>
                </div>

                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Details</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 font-mono text-[11px]">
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Account Holder</span>{resolvedEntity.vendorProfile?.account_holder_name || "—"}</div>
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Bank Name</span>{resolvedEntity.vendorProfile?.bank_name || "—"}</div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Account Number</span>
                    {resolvedEntity.vendorProfile?.account_number && resolvedEntity.vendorProfile.account_number !== "—" ? `•••• •••• ${resolvedEntity.vendorProfile.account_number.slice(-4)}` : "—"}
                  </div>
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">IFSC Code</span>{resolvedEntity.vendorProfile?.ifsc_code || "—"}</div>
                  <div className="col-span-2"><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">UPI ID</span>{resolvedEntity.vendorProfile?.upi_id || "—"}</div>
                </div>

                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement Details</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">Wallet Balance</span>₹{resolvedEntity.wallet?.balance?.toFixed(2) || '0.00'}</div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase text-emerald-600">Pending Amount</span><span className="font-bold text-emerald-600">₹{selectedSettlement.amount?.toFixed(2)}</span></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">Orders Included</span>{selectedSettlement.order_count || selectedSettlement.order_ids?.length || 0} Orders</div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">UTR / Reference Number</span><span className="font-mono">{selectedSettlement.utr_number || "—"}</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-medium">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Rider Name</span><p className="text-slate-900 font-bold mt-0.5">{resolvedEntity.rider?.rider_name || "—"}</p></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Phone</span><p className="text-slate-900 font-mono mt-0.5">{resolvedEntity.rider?.phone || "—"}</p></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Email</span><p className="text-slate-900 mt-0.5">{resolvedEntity.rider?.email || "—"}</p></div>
                  <div className="col-span-2"><span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Home Address</span><p className="text-slate-900 mt-0.5">{resolvedEntity.riderProfile?.address || resolvedEntity.riderProfile?.home_address || "—"}</p></div>
                </div>

                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Details</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 font-mono text-[11px]">
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Account Holder</span>{resolvedEntity.riderProfile?.account_holder_name || resolvedEntity.rider?.account_holder_name || "—"}</div>
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Bank Name</span>{resolvedEntity.riderProfile?.bank_name || resolvedEntity.rider?.bank_name || "—"}</div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">Account Number</span>
                    {(() => {
                      const accNum = resolvedEntity.riderProfile?.account_number || resolvedEntity.rider?.account_number;
                      return accNum && accNum !== "—" ? `•••• •••• ${accNum.slice(-4)}` : "—";
                    })()}
                  </div>
                  <div><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">IFSC Code</span>{resolvedEntity.riderProfile?.ifsc_code || resolvedEntity.rider?.ifsc_code || "—"}</div>
                  <div className="col-span-2"><span className="text-[9px] text-slate-400 block font-sans font-bold uppercase">UPI ID</span>{resolvedEntity.riderProfile?.upi_id || resolvedEntity.rider?.upi_id || "—"}</div>
                </div>

                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement Details</h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">Wallet Balance</span>₹{resolvedEntity.wallet?.balance?.toFixed(2) || '0.00'}</div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase text-emerald-600">Pending Amount</span><span className="font-bold text-emerald-600">₹{selectedSettlement.amount?.toFixed(2)}</span></div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">Deliveries Included</span>{selectedSettlement.delivery_count || selectedSettlement.order_ids?.length || 0} Deliveries</div>
                  <div><span className="text-[10px] text-slate-400 block font-bold uppercase">UTR / Reference Number</span><span className="font-mono">{selectedSettlement.utr_number || "—"}</span></div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-3 rounded-xl text-slate-400 font-sans border border-gray-100 text-xs leading-relaxed">
              <strong>Admin Remarks:</strong> {selectedSettlement.remarks || "No supplementary notes appended."}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PAY ACTIONS MODAL */}
      {payModalOpen && selectedSettlement && resolvedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-xl max-w-3xl w-full shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Record Payout Transfer</h3>
                <p className="text-xs font-bold text-emerald-600 mt-0.5">Amount to Pay: ₹{selectedSettlement.amount?.toFixed(2)}</p>
              </div>
              <button onClick={() => setPayModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Payment Destination QR</span>
                  {selectedType === 'vendor' && resolvedEntity.vendorProfile?.qr_code_url ? (
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-3xs max-w-[160px] w-full aspect-square flex items-center justify-center overflow-hidden">
                      <img 
                        src={resolvedEntity.vendorProfile.qr_code_url} 
                        alt="Vendor QR" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const fallbackSib = (e.target as HTMLElement).nextElementSibling;
                          if (fallbackSib) fallbackSib.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden flex-col items-center text-slate-400 gap-1">
                        <QrCode size={32} className="stroke-1" />
                        <span className="text-[9px]">Failed to render QR</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 py-4">
                      <QrCode size={36} className="stroke-1" />
                      <span className="text-[10px] font-medium text-slate-400">
                        {selectedType === 'vendor' ? 'No QR URL on file' : 'QR code not supported for Riders'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2 text-xs font-medium">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Bank Account Info</span>
                  {selectedType === 'vendor' ? (
                    <div className="space-y-1 font-mono text-[11px] text-slate-700">
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Account Holder:</span> {resolvedEntity.vendorProfile?.account_holder_name || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Bank Name:</span> {resolvedEntity.vendorProfile?.bank_name || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Account Number:</span> {resolvedEntity.vendorProfile?.account_number || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">IFSC Code:</span> {resolvedEntity.vendorProfile?.ifsc_code || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">UPI ID:</span> {resolvedEntity.vendorProfile?.upi_id || "—"}</div>
                    </div>
                  ) : (
                    <div className="space-y-1 font-mono text-[11px] text-slate-700">
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Account Holder:</span> {resolvedEntity.riderProfile?.account_holder_name || resolvedEntity.rider?.account_holder_name || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Bank Name:</span> {resolvedEntity.riderProfile?.bank_name || resolvedEntity.rider?.bank_name || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">Account Number:</span> {resolvedEntity.riderProfile?.account_number || resolvedEntity.rider?.account_number || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">IFSC Code:</span> {resolvedEntity.riderProfile?.ifsc_code || resolvedEntity.rider?.ifsc_code || "—"}</div>
                      <div><span className="font-sans text-[9px] uppercase text-slate-400 block">UPI ID:</span> {resolvedEntity.riderProfile?.upi_id || resolvedEntity.rider?.upi_id || "—"}</div>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); executePayFinalization(); }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase">Payment Method</label>
                  <select 
                    value={formPaymentMethod} 
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all font-medium"
                  >
                    <option value="Bank Transfer">Bank Wire IMPS / NEFT</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="Internal Wallet Transfer">Internal Wallet Adjustment</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 tracking-wider block uppercase">Transaction UTR / Reference Key</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter transaction UTR number"
                    value={formUtr}
                    onChange={(e) => setFormUtr(e.target.value)}
                    className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all font-mono text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 tracking-wider block uppercase">Remarks / Internal Memo</label>
                  <textarea
                    placeholder="Add payout documentation notes..."
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs font-bold uppercase tracking-wider">
                  <button type="button" onClick={() => setPayModalOpen(false)} className="flex-1 h-9 border border-gray-200 rounded-lg text-slate-400 hover:bg-gray-50 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={actionLoading || !formUtr.trim()} className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 size={12} className="animate-spin" />} Confirm Payment
                  </button>
                </div>
              </form>

            </div>

          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-xl max-w-sm w-full shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle size={18} className="shrink-0" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Confirm Payout Rejection</h3>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 font-normal leading-relaxed">
              Are you sure you want to reject this settlement? Please state reason below.
            </p>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Reason for Rejection</label>
              <textarea
                required
                placeholder="State reason for rejecting the payout..."
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                rows={3}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:bg-white focus:border-rose-600 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs font-bold uppercase tracking-wider">
              <button type="button" onClick={() => setRejectModalOpen(false)} className="flex-1 h-9 border border-gray-200 rounded-lg text-slate-400 hover:bg-gray-50 cursor-pointer">Cancel</button>
              <button type="button" onClick={executeRejectFinalization} disabled={actionLoading || !formRemarks.trim()} className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                {actionLoading && <Loader2 size={12} className="animate-spin" />} Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}