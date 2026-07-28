import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  IndianRupee, 
  Store, 
  RefreshCcw, 
  Activity,
  Calendar, 
  Clock, 
  AlertTriangle, 
  FileText,
  TrendingUp,
  Coins,
  Truck,
  Sparkles,
  Zap,
  ChevronDown
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

function SkeletonRow({ cols = 3 }: { cols?: number }) {
  return (
    <div className="w-full space-y-2 animate-pulse py-1">
      <div className="flex items-center justify-between gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200/80 rounded flex-1" />
        ))}
      </div>
    </div>
  );
}

function AnimatedCounter({ value, isCurrency = false }: { value: number; isCurrency?: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (start === end) { 
      setCount(end); 
      return; 
    }

    const duration = 300; 
    const incrementTime = Math.max(Math.floor(duration / (Math.abs(end - start) || 1)), 10);
    
    const timer = setInterval(() => {
      start += Math.ceil((end - start) / 5);
      if ((end >= 0 && start >= end) || (end < 0 && start <= end)) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {isCurrency ? `₹${count.toLocaleString("en-IN")}` : count.toLocaleString("en-IN")}
    </span>
  );
}

export function Dashboard() {
  const [dateRange, setDateRange] = useState("last30");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [currentTime, setCurrentTime] = useState(new Date()); 
  const [activeTrendTab, setActiveTrendTab] = useState("revenue");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; value: string; index: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    platformFee: 0,
    deliveryMargin: 0,
    vendorCommission: 0,
    todayEarnings: 0
  });

  const [pendingActions, setPendingActions] = useState({
    vendorApprovals: 0,
    subscriptionRequests: 0,
    settlementRequests: 0,
    refundRequests: 0,
    openSupport: 0
  });

  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);

  // Realtime clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute exact ISO boundaries for date-filtered queries
  const getDateRangeBounds = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (dateRange === "today") {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "last7") {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "last30") {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "lastMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateRange === "custom" && customRange.start && customRange.end) {
      startDate = new Date(customRange.start);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customRange.end);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { 
      startIso: startDate.toISOString(), 
      endIso: endDate.toISOString(),
      startDateObj: startDate,
      endDateObj: endDate
    };
  };

  const fetchAllDashboardData = () => {
    fetchKpisAndMetrics();
    fetchChartMetrics();
    fetchTopVendors();
    fetchPendingActions();
    fetchRecentActivity();
  };

  // Supabase Realtime Setup with targeted handlers
  useEffect(() => {
    fetchAllDashboardData();

    const channel = supabase.channel("dashboard_targeted_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchKpisAndMetrics();
        fetchChartMetrics();
        fetchTopVendors();
        fetchRecentActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, () => {
        fetchTopVendors();
        fetchPendingActions();
        fetchRecentActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_profiles" }, () => {
        fetchTopVendors();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        fetchPendingActions();
        fetchRecentActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_settlements" }, () => {
        fetchPendingActions();
        fetchRecentActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "refunds" }, () => {
        fetchPendingActions();
        fetchRecentActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        fetchPendingActions();
        fetchRecentActivity();
      })
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, customRange]);

  useEffect(() => {
    regenerateChartData();
  }, [activeTrendTab]);

  async function fetchKpisAndMetrics() {
    try {
      setKpiLoading(true);
      const { startIso, endIso } = getDateRangeBounds();
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Delivered orders within range and today based on delivered_at
      const [rangeOrdersRes, todayOrdersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("platform_fee, rivo_delivery_margin, vendor_commission, order_status")
          .eq("order_status", "delivered")
          .gte("delivered_at", startIso)
          .lte("delivered_at", endIso),
        supabase
          .from("orders")
          .select("platform_fee, rivo_delivery_margin, vendor_commission")
          .eq("order_status", "delivered")
          .gte("delivered_at", todayStart.toISOString())
          .lte("delivered_at", todayEnd.toISOString())
      ]);

      const deliveredOrders = rangeOrdersRes.data || [];
      const todayDelivered = todayOrdersRes.data || [];

      if (deliveredOrders.length === 0) {
        setMetrics({
          totalOrders: 0,
          platformFee: 0,
          deliveryMargin: 0,
          vendorCommission: 0,
          todayEarnings: 0
        });
        return;
      }

      const totalFee = deliveredOrders.reduce((s, o) => s + Number(o.platform_fee || 0), 0);
      const totalMargin = deliveredOrders.reduce((s, o) => s + Number(o.rivo_delivery_margin || 0), 0);
      const totalComm = deliveredOrders.reduce((s, o) => s + Number(o.vendor_commission || 0), 0);

      const todayFee = todayDelivered.reduce((s, o) => s + Number(o.platform_fee || 0), 0);
      const todayMargin = todayDelivered.reduce((s, o) => s + Number(o.rivo_delivery_margin || 0), 0);
      const todayComm = todayDelivered.reduce((s, o) => s + Number(o.vendor_commission || 0), 0);

      setMetrics({
        totalOrders: deliveredOrders.length,
        platformFee: totalFee,
        deliveryMargin: totalMargin,
        vendorCommission: totalComm,
        todayEarnings: todayFee + todayMargin + todayComm
      });
    } catch (err) {
      console.error("Error fetching KPI metrics:", err);
      setMetrics({ totalOrders: 0, platformFee: 0, deliveryMargin: 0, vendorCommission: 0, todayEarnings: 0 });
    } finally {
      setKpiLoading(false);
    }
  }

  async function fetchChartMetrics() {
    try {
      setChartLoading(true);
      await regenerateChartData();
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }

  async function regenerateChartData() {
    const { startIso, endIso, startDateObj, endDateObj } = getDateRangeBounds();
    const { data: orders } = await supabase
      .from("orders")
      .select("delivered_at, platform_fee, rivo_delivery_margin, vendor_commission, order_status")
      .eq("order_status", "delivered")
      .gte("delivered_at", startIso)
      .lte("delivered_at", endIso);

    if (!orders || orders.length === 0) {
      setChartData([]);
      return;
    }

    const valueExtractor = (o: any) => {
      if (activeTrendTab === "orders") return 1;
      if (activeTrendTab === "commission") return Number(o.vendor_commission || 0);
      if (activeTrendTab === "deliveryMargin") return Number(o.rivo_delivery_margin || 0);
      return Number(o.platform_fee || 0) + Number(o.rivo_delivery_margin || 0) + Number(o.vendor_commission || 0);
    };

    const timeMap: Record<string, number> = {};
    const labelSequence: string[] = [];

    if (dateRange === "today") {
      for (let i = 0; i < 24; i++) {
        const lbl = `${i.toString().padStart(2, "0")}:00`;
        timeMap[lbl] = 0;
        labelSequence.push(lbl);
      }
      orders.forEach(o => {
        if (!o.delivered_at) return;
        const hr = new Date(o.delivered_at).getHours();
        const lbl = `${hr.toString().padStart(2, "0")}:00`;
        if (timeMap[lbl] !== undefined) timeMap[lbl] += valueExtractor(o);
      });
    } else {
      const iterator = new Date(startDateObj);
      while (iterator <= endDateObj) {
        const day = String(iterator.getDate()).padStart(2, '0');
        const month = String(iterator.getMonth() + 1).padStart(2, '0');
        const lbl = `${day}/${month}`;
        
        timeMap[lbl] = 0;
        labelSequence.push(lbl);
        iterator.setDate(iterator.getDate() + 1);
      }
      
      orders.forEach(o => {
        if (!o.delivered_at) return;
        const dObj = new Date(o.delivered_at);
        const day = String(dObj.getDate()).padStart(2, '0');
        const month = String(dObj.getMonth() + 1).padStart(2, '0');
        const lbl = `${day}/${month}`;
        
        if (timeMap[lbl] !== undefined) {
          timeMap[lbl] += valueExtractor(o);
        }
      });
    }

    const formatted = labelSequence.map(lbl => ({
      label: lbl,
      value: timeMap[lbl] || 0
    }));

    setChartData(formatted);
  }

  async function fetchTopVendors() {
    try {
      setVendorsLoading(true);
      const { startIso, endIso } = getDateRangeBounds();
      
      const { data: orders } = await supabase
        .from("orders")
        .select("vendor_id, vendor_earning")
        .eq("order_status", "delivered")
        .gte("delivered_at", startIso)
        .lte("delivered_at", endIso);

      if (!orders || orders.length === 0) {
        setTopVendors([]);
        return;
      }

      const vendorAgg: Record<string, { count: number; earningSum: number }> = {};
      orders.forEach(o => {
        if (!o.vendor_id) return;
        if (!vendorAgg[o.vendor_id]) vendorAgg[o.vendor_id] = { count: 0, earningSum: 0 };
        vendorAgg[o.vendor_id].count += 1;
        vendorAgg[o.vendor_id].earningSum += Number(o.vendor_earning || 0);
      });

      const uniqueVendorIds = Object.keys(vendorAgg);
      if (uniqueVendorIds.length === 0) {
        setTopVendors([]);
        return;
      }

      const [vpRes, vRes] = await Promise.all([
        supabase.from("vendor_profiles").select("vendor_id, store_name").in("vendor_id", uniqueVendorIds),
        supabase.from("vendors").select("id, shop_name, owner_name").in("id", uniqueVendorIds)
      ]);

      const vendorProfiles = vpRes.data || [];
      const vendorsList = vRes.data || [];

      const combined = uniqueVendorIds.map(vId => {
        const vpInfo = vendorProfiles.find(vp => vp.vendor_id === vId);
        const vInfo = vendorsList.find(v => v.id === vId);
        
        const storeName = vpInfo?.store_name || vInfo?.shop_name || "Store Merchant";
        const ownerName = vInfo?.owner_name || "Unassigned Owner";

        return {
          storeName,
          ownerName,
          orders: vendorAgg[vId].count,
          revenue: vendorAgg[vId].earningSum
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setTopVendors(combined);
    } catch (err) {
      console.error("Error fetching top vendors:", err);
      setTopVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  }

  async function fetchPendingActions() {
    try {
      setActionsLoading(true);
      const [vApp, subReq, setReq, refReq, supTick] = await Promise.all([
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vendor_settlements").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open")
      ]);

      setPendingActions({
        vendorApprovals: vApp.count || 0,
        subscriptionRequests: subReq.count || 0,
        settlementRequests: setReq.count || 0,
        refundRequests: refReq.count || 0,
        openSupport: supTick.count || 0
      });
    } catch (err) {
      console.error("Error fetching pending actions:", err);
    } finally {
      setActionsLoading(false);
    }
  }

  async function fetchRecentActivity() {
    try {
      setActivityLoading(true);
      const { startIso, endIso } = getDateRangeBounds();

      const [ordersRes, vendorsRes, subsRes, settlementsRes, refundsRes, ticketsRes] = await Promise.all([
        supabase.from("orders").select("id, delivered_at, order_number").eq("order_status", "delivered").gte("delivered_at", startIso).lte("delivered_at", endIso).order("delivered_at", { ascending: false }).limit(4),
        supabase.from("vendors").select("id, status, shop_name, owner_name").eq("status", "approved").limit(4),
        supabase.from("subscriptions").select("id, plan_name, status").eq("status", "active").limit(4),
        supabase.from("vendor_settlements").select("id, created_at, amount").eq("status", "approved").gte("created_at", startIso).lte("created_at", endIso).order("created_at", { ascending: false }).limit(4),
        supabase.from("refunds").select("id, created_at, amount").eq("status", "processed").gte("created_at", startIso).lte("created_at", endIso).order("created_at", { ascending: false }).limit(4),
        supabase.from("support_tickets").select("id, created_at, subject").gte("created_at", startIso).lte("created_at", endIso).order("created_at", { ascending: false }).limit(4)
      ]);

      const logStream: { id: string; title: string; timestamp: Date }[] = [];

      ordersRes.data?.forEach(o => {
        if (!o.delivered_at) return;
        logStream.push({
          id: `ord-${o.id}`,
          title: `Delivered Order #${o.order_number || o.id.slice(0, 5)}`,
          timestamp: new Date(o.delivered_at)
        });
      });

      vendorsRes.data?.forEach(v => {
        logStream.push({
          id: `ven-${v.id}`,
          title: `Vendor Approved: ${v.shop_name || v.owner_name || 'Store'}`,
          timestamp: new Date()
        });
      });

      subsRes.data?.forEach(s => {
        logStream.push({
          id: `sub-${s.id}`,
          title: `Subscription Activated: ${s.plan_name || 'Standard'}`,
          timestamp: new Date()
        });
      });

      settlementsRes.data?.forEach(s => {
        logStream.push({
          id: `set-${s.id}`,
          title: `Settlement Approved: ₹${s.amount}`,
          timestamp: new Date(s.created_at)
        });
      });

      refundsRes.data?.forEach(r => {
        logStream.push({
          id: `ref-${r.id}`,
          title: `Refund Processed: ₹${r.amount}`,
          timestamp: new Date(r.created_at)
        });
      });

      ticketsRes.data?.forEach(t => {
        logStream.push({
          id: `tic-${t.id}`,
          title: `Support Ticket: ${t.subject || `#${t.id.slice(0, 5)}`}`,
          timestamp: new Date(t.created_at)
        });
      });

      const sorted = logStream.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);
      
      setRecentActivities(sorted.map(item => ({
        id: item.id,
        title: item.title,
        time: item.timestamp.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
      })));
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      setRecentActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }

  const formatIndianDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6 relative text-slate-900 antialiased">
      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Overview</h1>
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all",
              realtimeConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", realtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              {realtimeConnected ? "Realtime Live" : "Connecting..."}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            System performance telemetry and operation metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date & Time display */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>{formatIndianDate(currentTime)}</span>
            <span className="text-slate-300">|</span>
            <span>{currentTime.toLocaleTimeString("en-IN")}</span>
          </div>

          {/* Date Range Selector Dropdown */}
          <div className="relative inline-flex items-center bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Calendar className="w-4 h-4 text-slate-400 ml-3 pointer-events-none" />
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none py-2 pl-2 pr-8 cursor-pointer focus:ring-0 appearance-none"
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Custom Date Range Picker Input */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 transition-all">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                placeholder="End Date"
              />
            </div>
          )}

          {/* Manual Sync / Refresh Button */}
          <button 
            onClick={fetchAllDashboardData}
            className="h-9 px-3.5 gap-1.5 inline-flex items-center justify-center text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-2xs cursor-pointer"
          >
            <RefreshCcw className={cn("w-3.5 h-3.5 text-slate-500", (kpiLoading || chartLoading) && "animate-spin text-blue-600")} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS (EXACTLY 5 SPECIFIED CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Orders */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-lg mt-1"/> : <AnimatedCounter value={metrics.totalOrders} />}
              </h3>
            </div>
            <div className="w-9 h-9 bg-blue-50/80 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100/80 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Delivered orders count
          </p>
        </div>

        {/* 2. Platform Fee */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platform Fee</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-lg mt-1"/> : <AnimatedCounter value={metrics.platformFee} isCurrency />}
              </h3>
            </div>
            <div className="w-9 h-9 bg-emerald-50/80 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100/80 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-semibold">Platform charges total</p>
        </div>

        {/* 3. Delivery Margin */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Margin</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-lg mt-1"/> : <AnimatedCounter value={metrics.deliveryMargin} isCurrency />}
              </h3>
            </div>
            <div className="w-9 h-9 bg-amber-50/80 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100/80 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-semibold">Delivery yield margin</p>
        </div>

        {/* 4. Vendor Commission */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Vendor Commission</p>
              <h3 className="text-2xl font-black text-violet-600 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-lg mt-1"/> : <AnimatedCounter value={metrics.vendorCommission} isCurrency />}
              </h3>
            </div>
            <div className="w-9 h-9 bg-violet-50/80 rounded-xl flex items-center justify-center text-violet-600 border border-violet-100/80 group-hover:bg-violet-600 group-hover:text-white transition-colors">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-semibold">Vendor commission earnings</p>
        </div>

        {/* 5. Today's Rivo Earnings */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 flex flex-col justify-between shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-16 h-16 text-white" />
          </div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" /> Today's Rivo Earnings
              </p>
              <h3 className="text-2xl font-black text-white mt-1 tracking-tight">
                {kpiLoading ? <div className="h-7 w-20 bg-slate-700 animate-pulse rounded-lg mt-1"/> : <AnimatedCounter value={metrics.todayEarnings} isCurrency />}
              </h3>
            </div>
            <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-300 mt-3 font-medium relative z-10">
            Fee + Margin + Commission
          </p>
        </div>
      </div>

      {/* CHART & PENDING ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* CHART WIDGET */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between gap-6 min-h-[440px]">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50/80 rounded-xl border border-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
                <Activity className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Performance Trend Analysis</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Metrics across specified range
                </p>
              </div>
            </div>
            
            {/* Chart Metric Tabs */}
            <div className="flex flex-wrap items-center bg-slate-100/70 p-1 rounded-xl gap-1 w-full sm:w-auto">
              {[
                { id: "revenue", label: "Revenue" },
                { id: "orders", label: "Orders" },
                { id: "commission", label: "Commission" },
                { id: "deliveryMargin", label: "Delivery Margin" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setHoveredPoint(null);
                    setActiveTrendTab(tab.id);
                  }}
                  className={cn(
                    "text-xs px-3 py-1.5 font-bold rounded-lg transition-all flex-1 sm:flex-none text-center cursor-pointer",
                    activeTrendTab === tab.id
                      ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80" 
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Smooth Curve Chart Canvas */}
          <div 
            className="relative w-full flex-1 min-h-[240px] flex items-center justify-center select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
          >
            {hoveredPoint && (
              <div 
                className="absolute z-50 pointer-events-none bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-800 flex flex-col"
                style={{ 
                  left: `${mousePos.x + 10}px`, 
                  top: `${mousePos.y - 25}px`
                }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase">{hoveredPoint.label}</span>
                <span className="text-sm font-black text-emerald-400 mt-0.5">{hoveredPoint.value}</span>
              </div>
            )}

            {chartLoading ? (
              <div className="w-full h-40 bg-slate-50 animate-pulse rounded-2xl border border-slate-100"/>
            ) : chartData.length === 0 ? (
              <div className="text-xs text-slate-400 font-semibold flex flex-col items-center gap-2 py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 w-full text-center">
                <Activity className="w-6 h-6 text-slate-300" />
                <span>No data available for selected date range</span>
              </div>
            ) : (() => {
              const colorMap: Record<string, string> = {
                revenue: "#10B981",
                orders: "#3B82F6",
                commission: "#8B5CF6",
                deliveryMargin: "#F59E0B"
              };
              const color = colorMap[activeTrendTab] || "#10B981";

              const w = 800, h = 220, p = 36;
              const maxVal = Math.max(...chartData.map(d => d.value)) || 1;
              
              const coords = chartData.map((d, i) => ({
                x: p + (i / (chartData.length - 1 || 1)) * (w - p * 2),
                y: h - p - (d.value / maxVal) * (h - p * 2.5),
                label: d.label,
                value: activeTrendTab === "orders" ? `${d.value} Orders` : `₹${Math.round(d.value).toLocaleString("en-IN")}`
              }));

              let pathD = `M ${coords[0].x} ${coords[0].y}`;
              for (let i = 0; i < coords.length - 1; i++) {
                const cpX = coords[i].x + (coords[i+1].x - coords[i].x) / 2;
                pathD += ` C ${cpX} ${coords[i].y}, ${cpX} ${coords[i+1].y}, ${coords[i+1].x} ${coords[i+1].y}`;
              }
              const areaD = `${pathD} L ${coords[coords.length - 1].x} ${h - p} L ${coords[0].x} ${h - p} Z`;
              const skipInterval = Math.ceil(chartData.length / 8);

              return (
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.00" />
                    </linearGradient>
                  </defs>
                  
                  <line x1={p} y1={p} x2={w - p} y2={p} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="#E2E8F0" strokeWidth="1.5" />
                  
                  <path d={areaD} fill="url(#chartGradient)" className="transition-all duration-300" />
                  <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
                  
                  {coords.map((pt, idx) => {
                    const isHovered = hoveredPoint?.index === idx;
                    const showLabel = idx % skipInterval === 0 || idx === coords.length - 1;
                    return (
                      <g key={idx}>
                        <circle 
                          cx={pt.x} cy={pt.y} r="18" fill="transparent" className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ label: pt.label, value: pt.value, index: idx })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        <circle 
                          cx={pt.x} cy={pt.y} r={isHovered ? "5.5" : "3.5"} 
                          fill={isHovered ? color : "#FFFFFF"} stroke={color} strokeWidth={isHovered ? "3" : "2"}
                        />
                        {showLabel && (
                          <text x={pt.x} y={h - 10} textAnchor="middle" className="text-[10px] font-bold fill-slate-400 pointer-events-none">
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* PENDING ACTIONS QUEUE */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs min-h-[440px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Pending Actions
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mb-3">Requests requiring manual administrative intervention.</p>
          </div>

          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            {actionsLoading ? <SkeletonRow cols={2}/> : (
              [
                { label: "Vendor Approvals", count: pendingActions.vendorApprovals },
                { label: "Subscription Requests", count: pendingActions.subscriptionRequests },
                { label: "Settlement Requests", count: pendingActions.settlementRequests },
                { label: "Refund Requests", count: pendingActions.refundRequests },
                { label: "Open Support Tickets", count: pendingActions.openSupport }
              ].map((act, index) => (
                <div 
                  key={index}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-slate-700">{act.label}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-lg border",
                    act.count === 0 ? "bg-slate-100 text-slate-400 border-slate-200" :
                    act.count <= 5 ? "bg-amber-50 text-amber-700 border-amber-200 font-bold" :
                    "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                  )}>
                    {act.count}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 text-[11px] text-slate-400 font-medium text-center">
            Updated in real time
          </div>
        </div>

      </div>

      {/* TOP STORES AND RECENT ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TOP STORES TABLE */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-violet-600"/> Top Stores
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Ranked by Vendor Earnings</span>
          </div>
          <div className="overflow-x-auto">
            {vendorsLoading ? <SkeletonRow cols={4}/> : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 pl-1">Store Name</th>
                    <th className="pb-3">Owner Name</th>
                    <th className="pb-3 text-center">Delivered Orders</th>
                    <th className="pb-3 text-right pr-1">Vendor Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topVendors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400 font-medium">
                        No stores found for selected period.
                      </td>
                    </tr>
                  ) : topVendors.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-1 font-bold text-slate-800">
                        <span className="inline-block w-5 text-slate-400 font-bold">#{idx + 1}</span>
                        {v.storeName}
                      </td>
                      <td className="py-3 text-slate-500 font-medium">{v.ownerName}</td>
                      <td className="py-3 text-center text-slate-700 font-semibold">{v.orders}</td>
                      <td className="py-3 text-right pr-1 font-bold text-emerald-600">₹{v.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RECENT ACTIVITY AUDIT */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-slate-500" /> Recent Activity
          </h3>
          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {activityLoading ? <SkeletonRow cols={1}/> : recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No recent activity.</p>
            ) : recentActivities.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-l-2 border-slate-200 pl-3 py-0.5 hover:border-blue-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-[11px] leading-tight break-words">{log.title}</p>
                  <span className="text-[9px] font-bold text-slate-400 mt-0.5 block font-mono">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}