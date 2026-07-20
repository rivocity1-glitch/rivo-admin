import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  IndianRupee, 
  Store, 
  Bike, 
  Users, 
  RefreshCcw, 
  Activity,
  Calendar, 
  Clock, 
  Award, 
  AlertTriangle, 
  FileText 
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

function SkeletonRow({ cols = 3 }: { cols?: number }) {
  return (
    <div className="w-full space-y-2 animate-pulse py-1">
      <div className="flex items-center justify-between gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
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
    if (start === end) { setCount(end); return; }

    const duration = 400; 
    const incrementTime = Math.max(Math.floor(duration / (end || 1)), 10);
    
    const timer = setInterval(() => {
      start += Math.ceil((end - start) / 6);
      if (start >= end) {
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
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [currentTime, setCurrentTime] = useState(new Date()); 
  const [activeTrendTab, setActiveTrendTab] = useState("revenue");
  
  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [ridersLoading, setRidersLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; value: string; index: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    gmv: 0,
    commissionRevenue: 0,
    deliveryRevenue: 0,
    activeVendors: 0,
    activeRiders: 0, 
    customers: 0,
    ordersToday: 0
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
  const [topRiders, setTopRiders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);

  const calculatedAOV = metrics.totalOrders > 0 ? Math.round(metrics.gmv / metrics.totalOrders) : 0;

  const getMetricTabLabel = () => {
    switch (activeTrendTab) {
      case "revenue": return "Revenue";
      case "orders": return "Orders";
      case "commission": return "Commission";
      case "delivery":
      case "deliveryRevenue": return "Delivery Margin";
      default: return "Revenue";
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAllSections();
    const autoRefresh = setInterval(() => {
      fetchAllSections();
    }, 60000);
    return () => clearInterval(autoRefresh);
  }, [dateRange, customDates]);

  useEffect(() => {
    if (!chartLoading) {
      regenerateChartData();
    }
  }, [activeTrendTab]);

  const getDateScope = () => {
    const now = new Date();
    let startDate = new Date();

    if (dateRange === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === "last7") {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === "last30") {
      startDate.setDate(now.getDate() - 30);
    } else if (dateRange === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "lastMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (dateRange === "custom" && customDates.start) {
      startDate = new Date(customDates.start);
    } else {
      startDate.setDate(now.getDate() - 30);
    }
    return startDate;
  };

  const fetchAllSections = () => {
    fetchKpisAndMetrics();
    fetchChartMetrics();
    fetchTopVendors();
    fetchTopRiders();
    fetchPendingActions();
    fetchRecentActivity();
  };
  
  async function fetchKpisAndMetrics() {
    try {
      setKpiLoading(true);
      const isoStart = getDateScope().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [ordersRes, vendorsRes, ridersRes, customersRes, todayOrdersRes] = await Promise.all([
        supabase.from("orders").select("total_amount, platform_fee, rivo_delivery_margin, order_status").gte("created_at", isoStart),
        supabase.from("vendors").select("id").eq("status", "approved"),
        supabase.from("riders").select("id").eq("status", "active"),
        supabase.from("customers").select("id"),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString())
      ]);

      const orders = ordersRes.data || [];
      const deliveredOrders = orders.filter(o => o.order_status === "delivered");

      setMetrics({
        totalOrders: orders.length,
        gmv: deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
        commissionRevenue: deliveredOrders.reduce((sum, o) => sum + Number(o.platform_fee || 0), 0),
        deliveryRevenue: deliveredOrders.reduce((sum, o) => sum + Number(o.rivo_delivery_margin || 0), 0),
        activeVendors: vendorsRes.data?.length || 0,
        activeRiders: ridersRes.data?.length || 0,
        customers: customersRes.data?.length || 0,
        ordersToday: todayOrdersRes.count || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setKpiLoading(false);
    }
  }

  async function fetchChartMetrics() {
    try {
      setChartLoading(true);
      regenerateChartData();
    } catch (err) {
      console.error(err);
    } finally {
      setChartLoading(false);
    }
  }

  async function regenerateChartData() {
    const isoStart = getDateScope().toISOString();
    const { data: orders } = await supabase
      .from("orders")
      .select("created_at, total_amount, platform_fee, rivo_delivery_margin, order_status")
      .gte("created_at", isoStart);

    if (!orders || orders.length === 0) {
      setChartData([]);
      return;
    }

    const valueExtractor = (o: any) => {
      if (activeTrendTab === "orders") return 1;
      if (o.order_status !== "delivered") return 0;
      if (activeTrendTab === "commission") return Number(o.platform_fee || 0);
      if (activeTrendTab === "delivery" || activeTrendTab === "deliveryRevenue") return Number(o.rivo_delivery_margin || 0);
      return Number(o.total_amount || 0);
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
        const hr = new Date(o.created_at).getHours();
        const lbl = `${hr.toString().padStart(2, "0")}:00`;
        if (timeMap[lbl] !== undefined) timeMap[lbl] += valueExtractor(o);
      });
    } else {
      const startObj = getDateScope();
      const endObj = dateRange === "custom" && customDates.end ? new Date(customDates.end) : new Date();
      const iterator = new Date(startObj);
      
      while (iterator <= endObj) {
        const day = String(iterator.getDate()).padStart(2, '0');
        const month = String(iterator.getMonth() + 1).padStart(2, '0');
        const year = iterator.getFullYear();
        const lbl = `${day}/${month}/${year}`;
        
        timeMap[lbl] = 0;
        labelSequence.push(lbl);
        iterator.setDate(iterator.getDate() + 1);
      }
      
      orders.forEach(o => {
        const dObj = new Date(o.created_at);
        const day = String(dObj.getDate()).padStart(2, '0');
        const month = String(dObj.getMonth() + 1).padStart(2, '0');
        const year = dObj.getFullYear();
        const lbl = `${day}/${month}/${year}`;
        
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
      const isoStart = getDateScope().toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("vendor_id, total_amount")
        .eq("order_status", "delivered")
        .gte("created_at", isoStart);

      if (!orders || orders.length === 0) {
        setTopVendors([]);
        return;
      }

      const vendorAgg: Record<string, { count: number; sum: number }> = {};
      orders.forEach(o => {
        if (!o.vendor_id) return;
        if (!vendorAgg[o.vendor_id]) vendorAgg[o.vendor_id] = { count: 0, sum: 0 };
        vendorAgg[o.vendor_id].count += 1;
        vendorAgg[o.vendor_id].sum += Number(o.total_amount || 0);
      });

      const uniqueVendorIds = Object.keys(vendorAgg);
      const { data: vendorProfiles } = await supabase
        .from("vendor_profiles")
        .select("vendor_id, store_name")
        .in("vendor_id", uniqueVendorIds);

      const combined = uniqueVendorIds.map(vId => {
        const vpInfo = vendorProfiles?.find(vp => vp.vendor_id === vId);
        return {
          name: vpInfo?.store_name || `Store #${vId.slice(0, 4)}`,
          orders: vendorAgg[vId].count,
          revenue: vendorAgg[vId].sum
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setTopVendors(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setVendorsLoading(false);
    }
  }

  async function fetchTopRiders() {
    try {
      setRidersLoading(true);
      const isoStart = getDateScope().toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("rider_id, rider_earning")
        .eq("order_status", "delivered")
        .gte("created_at", isoStart);

      if (!orders || orders.length === 0) {
        setTopRiders([]);
        return;
      }

      const riderAgg: Record<string, { count: number; sum: number }> = {};
      orders.forEach(o => {
        if (!o.rider_id) return;
        if (!riderAgg[o.rider_id]) riderAgg[o.rider_id] = { count: 0, sum: 0 };
        riderAgg[o.rider_id].count += 1;
        riderAgg[o.rider_id].sum += Number(o.rider_earning || 0);
      });

      const uniqueRiderIds = Object.keys(riderAgg);
      const { data: riders } = await supabase
        .from("riders")
        .select("id, rider_name, vehicle_type")
        .in("id", uniqueRiderIds);

      if (!riders) {
        setTopRiders([]);
        return;
      }

      const formatted = riders.map(r => ({
        name: r.rider_name || `Rider #${r.id.slice(0, 4)}`,
        orders: riderAgg[r.id]?.count || 0,
        earnings: riderAgg[r.id]?.sum || 0,
        vehicleType: r.vehicle_type || "N/A"
      })).sort((a, b) => b.orders - a.orders).slice(0, 5);

      setTopRiders(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setRidersLoading(false);
    }
  }

  async function fetchPendingActions() {
    try {
      setActionsLoading(true);
      const [vApp, subReq, setReq, refReq, supTick] = await Promise.all([
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("subscription_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vendor_settlements").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("refunds").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed")
      ]);

      setPendingActions({
        vendorApprovals: vApp.count || 0,
        subscriptionRequests: subReq.count || 0,
        settlementRequests: setReq.count || 0,
        refundRequests: refReq.count || 0,
        openSupport: supTick.count || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionsLoading(false);
    }
  }

  async function fetchRecentActivity() {
    try {
      setActivityLoading(true);
      const isoStart = getDateScope().toISOString();

      const [ordersRes, settlementsRes, refundsRes] = await Promise.all([
        supabase.from("orders").select("id, created_at, order_status").gte("created_at", isoStart).order("created_at", { ascending: false }).limit(5),
        supabase.from("vendor_settlements").select("id, created_at, status").gte("created_at", isoStart).order("created_at", { ascending: false }).limit(5),
        supabase.from("refunds").select("id, created_at, status").gte("created_at", isoStart).order("created_at", { ascending: false }).limit(5)
      ]);

      const logStream: { id: string; title: string; timestamp: Date }[] = [];

      ordersRes.data?.forEach(o => {
        logStream.push({
          id: o.id,
          title: `Order #${o.id.slice(0, 5)} update status: ${o.order_status}`,
          timestamp: new Date(o.created_at)
        });
      });

      settlementsRes.data?.forEach(s => {
        logStream.push({
          id: s.id,
          title: `Settlement Plan #${s.id.slice(0, 5)} tracked as ${s.status}`,
          timestamp: new Date(s.created_at)
        });
      });

      refundsRes.data?.forEach(r => {
        logStream.push({
          id: r.id,
          title: `Refund Request #${r.id.slice(0, 5)} flagged: ${r.status}`,
          timestamp: new Date(r.created_at)
        });
      });

      const sorted = logStream.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
      
      setRecentActivities(sorted.map(item => ({
        id: item.id,
        title: item.title,
        time: item.timestamp.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setActivityLoading(false);
    }
  }

  const handleActionNavigation = (targetPath: string) => {
    window.location.hash = targetPath; 
  };

  const getBadgeStyles = (count: number) => {
    if (count === 0) return "bg-slate-50 text-slate-400 border-slate-200";
    if (count <= 5) return "bg-amber-50 text-amber-600 border-amber-200";
    return "bg-rose-50 text-rose-600 border-rose-200 font-bold shadow-sm shadow-rose-100";
  };

  const formatIndianDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6 relative text-slate-900 antialiased selection:bg-blue-500/10">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-slideUp { animation: slideUp 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fadeIn { animation: fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* Dynamic Header Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 text-xs text-slate-500">
            <span className="font-semibold text-blue-600 flex items-center gap-1 bg-blue-50/60 px-2.5 py-0.5 rounded-md border border-blue-100/40">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              {formatIndianDate(currentTime)} — {currentTime.toLocaleTimeString("en-IN")}
            </span>
            <span className="hidden sm:inline text-slate-200">|</span>
            <span>Real-time operational overview of the Rivo.City platform network ecosystem.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs hover:border-slate-300 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs font-semibold text-slate-600 bg-transparent border-none outline-none pr-5 cursor-pointer focus:ring-0"
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-slate-50 p-1 border border-slate-200 rounded-lg animate-fadeIn">
              <div className="flex items-center gap-1 pl-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">From</span>
                <input 
                  type="date" 
                  className="text-xs border-none bg-transparent text-slate-600 font-semibold focus:outline-none focus:ring-0 p-0.5"
                  onChange={(e) => setCustomDates(p => ({ ...p, start: e.target.value }))}
                />
              </div>
              <span className="text-xs font-semibold text-slate-300">|</span>
              <div className="flex items-center gap-1 pr-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">To</span>
                <input 
                  type="date" 
                  className="text-xs border-none bg-transparent text-slate-600 font-semibold focus:outline-none focus:ring-0 p-0.5"
                  onChange={(e) => setCustomDates(p => ({ ...p, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          <button 
            onClick={fetchAllSections}
            className="h-8 px-3 gap-1.5 inline-flex items-center justify-center text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-xs"
          >
            <RefreshCcw className={cn("w-3.5 h-3.5 text-slate-400", (kpiLoading || chartLoading) && "animate-spin text-blue-500")} />
            Refresh
          </button>
        </div>
      </div>

      {/* TWO COLUMN GRID: CHART ON LEFT, PENDING ACTIONS BOX ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* RESPONSIVE SMOOTH CURVED PATH CHART AREA CONTAINER */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 animate-slideUp shadow-xs flex flex-col justify-between gap-5 min-h-[420px]">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Sales Analytics</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Smooth curved trend telemetry visualization parameter matrix
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center bg-slate-50 p-1 border border-slate-200 rounded-xl gap-1 w-full sm:w-auto">
              {[
                { id: "revenue", label: "Revenue" },
                { id: "orders", label: "Orders" },
                { id: "commission", label: "Commission" },
                { id: "delivery", label: "Delivery Margin" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setHoveredPoint(null);
                    setActiveTrendTab(tab.id);
                  }}
                  className={cn(
                    "text-xs px-3.5 py-1.5 font-bold rounded-lg transition-all flex-1 sm:flex-none text-center whitespace-nowrap cursor-pointer",
                    activeTrendTab === tab.id || (tab.id === "delivery" && activeTrendTab === "deliveryRevenue")
                      ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic & Centered Fully Responsive Curved Line SVG Grid */}
          <div 
            className="relative w-full flex-1 min-h-[220px] flex items-center justify-center select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
          >
            {hoveredPoint && (
              <div 
                className="absolute z-50 pointer-events-none bg-slate-950 text-white px-3 py-2 rounded-xl shadow-xl transition-all duration-150 ease-out flex flex-col animate-fadeIn border border-slate-800"
                style={{ 
                  left: `${mousePos.x + 16}px`, 
                  top: `${mousePos.y - 24}px`,
                  transform: 'translate3d(0, 0, 0)'
                }}
              >
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">{hoveredPoint.label}</span>
                <span className="text-[10px] font-semibold text-slate-300 mt-0.5">{getMetricTabLabel()}</span>
                <span className="text-sm font-black mt-0.5 text-[#2ECC71]">{hoveredPoint.value}</span>
              </div>
            )}

            {chartLoading ? (
              <div className="w-full flex flex-col items-center justify-center space-y-2 py-4">
                <div className="h-32 w-full bg-slate-50 animate-pulse rounded-xl border border-slate-100"/>
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-xs text-slate-400 font-medium tracking-wide flex flex-col items-center gap-1.5 py-8 animate-fadeIn">
                <Activity className="w-5 h-5 text-slate-300" />
                <span>No telemetry metrics calculated for this period</span>
              </div>
            ) : (() => {
              const colorConfig = {
                revenue: "#2ECC71",
                commission: "#7C3AED",
                delivery: "#EA580C",
                deliveryRevenue: "#EA580C",
                orders: "#2563EB"
              }[activeTrendTab] || "#2ECC71";

              const w = 800, h = 200, p = 32;
              const maxVal = Math.max(...chartData.map(d => d.value)) || 1;
              
              const coords = chartData.map((d, i) => ({
                x: p + (i / (chartData.length - 1 || 1)) * (w - p * 2),
                y: h - p - (d.value / maxVal) * (h - p * 2.5),
                label: d.label,
                value: activeTrendTab === "orders" ? `${d.value} Orders` : `₹${Math.round(d.value).toLocaleString("en-IN")}`
              }));

              let pathD = `M ${coords[0].x} ${coords[0].y}`;
              for (let i = 0; i < coords.length - 1; i++) {
                const cpX1 = coords[i].x + (coords[i+1].x - coords[i].x) / 2;
                const cpX2 = coords[i].x + (coords[i+1].x - coords[i].x) / 2;
                pathD += ` C ${cpX1} ${coords[i].y}, ${cpX2} ${coords[i+1].y}, ${coords[i+1].x} ${coords[i+1].y}`;
              }
              const areaD = `${pathD} L ${coords[coords.length - 1].x} ${h - p} L ${coords[0].x} ${h - p} Z`;

              const labelSkipInterval = Math.ceil(chartData.length / 8);

              return (
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="smoothAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colorConfig} stopOpacity="0.12" />
                      <stop offset="100%" stopColor={colorConfig} stopOpacity="0.00" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Guidelines */}
                  <line x1={p} y1={p} x2={w - p} y2={p} stroke="#F8FAFC" strokeWidth="1" />
                  <line x1={p} y1={(h - p * 2) / 2 + p / 2} x2={w - p} y2={(h - p * 2) / 2 + p / 2} stroke="#F8FAFC" strokeWidth="1" />
                  <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="#F1F5F9" strokeWidth="1.5" />
                  
                  {/* Area fill and curved path stroke configurations */}
                  <path d={areaD} fill="url(#smoothAreaGradient)" className="transition-all duration-300 ease-in-out" />
                  <path d={pathD} fill="none" stroke={colorConfig} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300 ease-in-out" />
                  
                  {coords.map((pt, idx) => {
                    const isHovered = hoveredPoint?.index === idx;
                    const showLabel = idx % labelSkipInterval === 0 || idx === coords.length - 1;
                    return (
                      <g key={idx} className="cursor-pointer">
                        <circle 
                          cx={pt.x} cy={pt.y} r="24" fill="transparent"
                          onMouseEnter={() => setHoveredPoint({ label: pt.label, value: pt.value, index: idx })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        <circle 
                          cx={pt.x} cy={pt.y} r={isHovered ? "6" : "3.5"} 
                          fill={isHovered ? colorConfig : "#FFFFFF"} stroke={colorConfig} strokeWidth={isHovered ? "2.5" : "1.5"}
                          style={{ transformOrigin: `${pt.x}px ${pt.y}px`, transition: 'all 150ms ease-out' }}
                        />
                        {showLabel && (
                          <text x={pt.x} y={h - 10} textAnchor="middle" className="text-[9px] font-bold fill-slate-400 pointer-events-none tracking-tight">
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

          {/* Business Summary Bottom Strip Row */}
          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition-colors">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Volume Totals</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                {kpiLoading ? "—" : `₹${metrics.gmv.toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition-colors">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Orders Count</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                {kpiLoading ? "—" : metrics.totalOrders.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition-colors">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Average Order Metric</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                {kpiLoading ? "—" : `₹${calculatedAOV.toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition-colors">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Delivery Margin</p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                {kpiLoading ? "—" : `₹${metrics.deliveryRevenue.toLocaleString("en-IN")}`}
              </p>
            </div>
          </div>
        </div>

        {/* PENDING ACTIONS COUNTERS SIDEBOARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs min-h-[420px] flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Pending Actions Matrix
          </h3>
          <div className="space-y-1.5 flex-1 flex flex-col justify-center">
            {actionsLoading ? <SkeletonRow cols={2}/> : (
              [
                { label: "Vendor Approvals", count: pendingActions.vendorApprovals, path: "/vendors" },
                { label: "Subscription Requests", count: pendingActions.subscriptionRequests, path: "/requests" },
                { label: "Settlement Requests", count: pendingActions.settlementRequests, path: "/settlements" },
                { label: "Refund Requests", count: pendingActions.refundRequests, path: "/refunds" },
                { label: "Support Tickets", count: pendingActions.openSupport, path: "/support" }
              ].map((act, index) => (
                <button 
                  key={index}
                  onClick={() => handleActionNavigation(act.path)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/60 active:scale-[0.99] transition-all duration-200 cursor-pointer text-left group"
                >
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{act.label}</span>
                  <span className={cn(
                    "text-[10px] font-semibold px-2.5 py-0.5 rounded-md border transition-all duration-200",
                    getBadgeStyles(act.count)
                  )}>
                    {act.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

      </div>

      {/* CORE FINANCIAL OVERVIEW HOVER CARD BLOCKS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slideUp">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-6 w-16 bg-slate-100 animate-pulse rounded mt-1"/> : <AnimatedCounter value={metrics.totalOrders} />}
              </h3>
            </div>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100/50">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Completed Quantities</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GMV</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-6 w-20 bg-slate-100 animate-pulse rounded mt-1"/> : <AnimatedCounter value={metrics.gmv} isCurrency />}
              </h3>
            </div>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100/50">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Gross Merchandise Value</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Platform Commission</p>
              <h3 className="text-2xl font-extrabold text-violet-600 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-6 w-20 bg-slate-100 animate-pulse rounded mt-1"/> : <AnimatedCounter value={metrics.commissionRevenue} isCurrency />}
              </h3>
            </div>
            <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600 border border-violet-100/50">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Fee Revenues Accumulation</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Delivery Margin</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {kpiLoading ? <div className="h-6 w-20 bg-slate-100 animate-pulse rounded mt-1"/> : <AnimatedCounter value={metrics.deliveryRevenue} isCurrency />}
              </h3>
            </div>
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100/50">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Logistical Service Yields</p>
        </div>
      </div>

      {/* SPLIT INFRASTRUCTURE RECENT LISTINGS MATRIX FLOW ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slideUp">
        
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-violet-500"/> Top Performing Stores
            </h3>
          </div>
          <div className="overflow-x-auto">
            {vendorsLoading ? <SkeletonRow cols={3}/> : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-2.5 font-semibold">Store Name</th>
                    <th className="pb-2.5 font-semibold text-center">Orders Completed</th>
                    <th className="pb-2.5 font-semibold text-right">Vendor Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {topVendors.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-slate-400">No data inside chosen range template</td></tr>
                  ) : topVendors.map((v, idx) => (
                    <tr key={idx} className="border-b border-slate-50/80 last:border-none hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 font-medium text-slate-700">
                        <span className="inline-block w-6 text-slate-400 font-bold group-hover:text-blue-500 transition-colors">#{idx + 1}</span>
                        {v.name}
                      </td>
                      <td className="py-3 text-center text-slate-600 font-semibold">{v.orders}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">₹{v.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" /> Recent Activity System Log
          </h3>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {activityLoading ? <SkeletonRow cols={1}/> : recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Awaiting metrics telemetry streams...</p>
            ) : recentActivities.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-l-2 border-slate-200 pl-3 py-0.5 hover:border-blue-500 transition-colors group">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 mt-1.5 transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-[11px] leading-tight break-words">{log.title}</p>
                  <span className="text-[9px] font-bold text-slate-400 mt-0.5 block">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}