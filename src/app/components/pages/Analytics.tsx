import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  BarChart3,
  RefreshCcw,
  ShieldAlert,
  Activity
} from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

// Estimated default platform commission rate (10%)
const COMMISSION_RATE = 0.10;

interface FinancialMetrics {
  gmv: number;
  commissionRevenue: number;
  deliveryRevenue: number;
  netPlatformRevenue: number;
  avgOrderValue: number;
}

interface OrderPerformance {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  successRate: number;
}

interface ChartTrendItem {
  day: string;
  value: number;
  pct: number;
}

interface VendorRow {
  name: string;
  orders: number;
  revenue: number;
  commission: number;
}

interface RiderRow {
  rider_name: string;
  orders_completed: number;
  rating: number;
}

interface HealthStats {
  pendingSubscriptions: number;
  pendingSettlements: number;
  pendingRefunds: number;
  openTickets: number;
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState("30");
  const [activeDataset, setActiveDataset] = useState<"revenue" | "orders" | "commission" | "delivery">("revenue");

  // State Management
  const [financials, setFinancials] = useState<FinancialMetrics>({
    gmv: 0,
    commissionRevenue: 0,
    deliveryRevenue: 0,
    netPlatformRevenue: 0,
    avgOrderValue: 0
  });

  const [performance, setPerformance] = useState<OrderPerformance>({
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    successRate: 0
  });

  const [chartTrends, setChartTrends] = useState<ChartTrendItem[]>([]);
  const [topVendors, setTopVendors] = useState<VendorRow[]>([]);
  const [topRiders, setTopRiders] = useState<RiderRow[]>([]);
  const [health, setHealth] = useState<HealthStats>({
    pendingSubscriptions: 0,
    pendingSettlements: 0,
    pendingRefunds: 0,
    openTickets: 0
  });

  async function calculateLiveAnalytics() {
    try {
      setIsLoading(true);

      const now = new Date();
      let startDate = new Date();
      if (timePeriod !== "all") {
        startDate.setDate(now.getDate() - parseInt(timePeriod));
      }

      // 1. Core Orders Query joined with Vendors
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id, 
          total_amount, 
          delivery_fee, 
          order_status, 
          created_at, 
          vendor_id,
          vendors ( shop_name )
        `);

      if (timePeriod !== "all") {
        ordersQuery = ordersQuery.gte("created_at", startDate.toISOString());
      }
      
      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;
      const orders = ordersData || [];

      // 2. Platform Health Counters (Parallelized requests)
      const [subReq, setReq, refReq, ticketReq] = await Promise.all([
        supabase.from("subscription_payment_requests").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("vendor_settlements").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("refunds").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact" }).neq("status", "closed")
      ]);

      setHealth({
        pendingSubscriptions: subReq.count || 0,
        pendingSettlements: setReq.count || 0,
        pendingRefunds: refReq.count || 0,
        openTickets: ticketReq.count || 0
      });

      // 3. Top Riders Query (Global Leaderboard Limit 5)
      const { data: ridersData, error: ridersError } = await supabase
        .from("riders")
        .select("rider_name, orders_completed, rating")
        .order("orders_completed", { ascending: false })
        .limit(5);
      
      if (ridersError) throw ridersError;
      setTopRiders(ridersData || []);

      // 4. Financial Metric Calculations
      const gmv = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
      const deliveryRevenue = orders.reduce((acc, o) => acc + (o.delivery_fee || 0), 0);
      const commissionRevenue = orders
        .filter(o => o.order_status === "delivered")
        .reduce((acc, o) => acc + ((o.total_amount || 0) * COMMISSION_RATE), 0);
      const netPlatformRevenue = commissionRevenue + deliveryRevenue;
      const avgOrderValue = orders.length > 0 ? Math.round(gmv / orders.length) : 0;

      setFinancials({
        gmv,
        commissionRevenue,
        deliveryRevenue,
        netPlatformRevenue,
        avgOrderValue
      });

      // 5. Fulfillment Performance Metrics
      const totalOrders = orders.length;
      const deliveredOrders = orders.filter(o => o.order_status === "delivered").length;
      const cancelledOrders = orders.filter(o => o.order_status === "cancelled").length;
      const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setPerformance({
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        successRate
      });

      // 6. Chronological Trend Maps Construction (Last 7 Days Bar charts)
      const last7Days = Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date();
        d.setDate(now.getDate() - idx);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      }).reverse();

      const dynamicTimelineMap: Record<string, Record<string, number>> = {};
      last7Days.forEach(day => {
        dynamicTimelineMap[day] = { revenue: 0, orders: 0, commission: 0, delivery: 0 };
      });

      orders.forEach(o => {
        const dayKey = new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        if (dynamicTimelineMap[dayKey]) {
          dynamicTimelineMap[dayKey].orders += 1;
          dynamicTimelineMap[dayKey].revenue += (o.total_amount || 0);
          dynamicTimelineMap[dayKey].delivery += (o.delivery_fee || 0);
          if (o.order_status === "delivered") {
            dynamicTimelineMap[dayKey].commission += ((o.total_amount || 0) * COMMISSION_RATE);
          }
        }
      });

      const valuesArray = last7Days.map(d => dynamicTimelineMap[d][activeDataset] || 0);
      const maxVal = Math.max(...valuesArray, 1);

      setChartTrends(last7Days.map(day => {
        const val = dynamicTimelineMap[day][activeDataset] || 0;
        return {
          day,
          value: val,
          pct: Math.round((val / maxVal) * 100)
        };
      }));

      // 7. Aggregate Top 5 Vendors Metrics
      const vendorMap: Record<string, VendorRow> = {};
      orders.forEach(o => {
        // Handle Supabase joined object types cleanly
        const singleVendor: any = o.vendors;
        const shopName = singleVendor?.shop_name || "Unknown Shop";
        
        if (!vendorMap[o.vendor_id]) {
          vendorMap[o.vendor_id] = { name: shopName, orders: 0, revenue: 0, commission: 0 };
        }
        vendorMap[o.vendor_id].orders += 1;
        vendorMap[o.vendor_id].revenue += (o.total_amount || 0);
        if (o.order_status === "delivered") {
          vendorMap[o.vendor_id].commission += ((o.total_amount || 0) * COMMISSION_RATE);
        }
      });

      setTopVendors(
        Object.values(vendorMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

    } catch (err) {
      console.error("Operational analytics query failure:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    calculateLiveAnalytics();
  }, [timePeriod, activeDataset]);

  return (
    <div className="space-y-6">
      {/* View Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Platform Analytics</h1>
          <p className="text-xs font-medium text-[#64748B] mt-0.5">Real-time analytical pipeline and financial ledgers</p>
        </div>
        <div className="flex items-center gap-2 relative z-20">
          <select 
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#334155] focus:outline-none"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={calculateLiveAnalytics} className="h-9 w-9 border border-[#E2E8F0] bg-white rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Financial KPI Rows */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Gross Bookings (GMV)</p>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : `₹${financials.gmv.toLocaleString()}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Commission Revenue</p>
          <h3 className="text-xl font-bold text-blue-600 mt-2">{isLoading ? "—" : `₹${financials.commissionRevenue.toLocaleString()}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Delivery Fees</p>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : `₹${financials.deliveryRevenue.toLocaleString()}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm bg-emerald-50/30 border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Net Platform Earnings</p>
          <h3 className="text-xl font-bold text-emerald-600 mt-2">{isLoading ? "—" : `₹${financials.netPlatformRevenue.toLocaleString()}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Avg Order Value</p>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : `₹${financials.avgOrderValue.toLocaleString()}`}</h3>
        </div>
      </div>

      {/* Fulfillment Quality Summary Block */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-[#0F172A] mb-4 uppercase tracking-wider">Order Fulfillment Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Total Bookings</span>
            <p className="text-xl font-extrabold text-[#0F172A]">{isLoading ? "—" : performance.totalOrders}</p>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-600 block mb-1">Delivered</span>
            <p className="text-xl font-extrabold text-emerald-700">{isLoading ? "—" : performance.deliveredOrders}</p>
          </div>
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
            <span className="text-[11px] font-semibold text-rose-600 block mb-1">Cancelled</span>
            <p className="text-xl font-extrabold text-rose-700">{isLoading ? "—" : performance.cancelledOrders}</p>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <span className="text-[11px] font-semibold text-blue-600 block mb-1">Success Rate</span>
            <p className="text-xl font-extrabold text-blue-700">{isLoading ? "—" : `${performance.successRate}%`}</p>
          </div>
        </div>
      </div>

      {/* Time Trend Interactive Module */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Time Series Performance</h3>
            <p className="text-[11px] font-medium text-[#64748B]">Daily granular breakdown updates across active interval metrics</p>
          </div>
          <select
            value={activeDataset}
            onChange={(e) => setActiveDataset(e.target.value as any)}
            className="h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#334155] focus:outline-none max-w-xs self-start"
          >
            <option value="revenue">Gross Revenue Flow (GMV)</option>
            <option value="orders">Total Order Volume Counts</option>
            <option value="commission">Commission Yield Logs</option>
            <option value="delivery">Collected Delivery Inflows</option>
          </select>
        </div>

        <div className="h-44 flex items-end justify-between gap-2 pt-4">
          {isLoading ? (
            <div className="w-full text-center text-xs text-[#94A3B8] font-medium py-16">Syncing ledger metrics...</div>
          ) : chartTrends.length === 0 || performance.totalOrders === 0 ? (
            <div className="w-full text-center text-xs text-[#94A3B8] font-medium py-16">No data available for selected period</div>
          ) : (
            chartTrends.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                <div className="absolute -top-7 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono font-bold z-30 shadow-sm">
                  {activeDataset === "orders" ? item.value : `₹${item.value.toLocaleString()}`}
                </div>
                <div className="w-full bg-slate-50 group-hover:bg-slate-100/80 rounded-md transition-colors relative flex items-end h-32">
                  <div 
                    className={cn(
                      "w-full rounded-md transition-all duration-500", 
                      activeDataset === "orders" ? "bg-emerald-500 group-hover:bg-emerald-600" : "bg-blue-500 group-hover:bg-blue-600"
                    )} 
                    style={{ height: `${item.pct}%` }} 
                  />
                </div>
                <span className="text-[10px] font-bold text-[#64748B] whitespace-nowrap">{item.day}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Operational Ranks & Platform Health Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        
        {/* Top Performing Vendors */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Top Vendors</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Ranked by gross sales volume throughput</p>
          <div className="space-y-3 pt-1">
            {isLoading ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">Calculating analytics...</div>
            ) : topVendors.length === 0 ? (
              <div className="text-center text-xs text-[#94A3B8] py-8 font-medium">No data available for selected period</div>
            ) : (
              topVendors.map((vendor, i) => (
                <div key={i} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-[#334155]">{vendor.name}</p>
                    <span className="text-[10px] text-slate-400 font-medium">{vendor.orders} Complete Orders</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#0F172A]">₹{vendor.revenue.toLocaleString()}</p>
                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 rounded">Com: ₹{Math.round(vendor.commission)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Operational Riders */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Top Operational Riders</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Ranked by historical fulfillment numbers</p>
          <div className="space-y-3 pt-1">
            {isLoading ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">Syncing logistics ranking...</div>
            ) : topRiders.length === 0 ? (
              <div className="text-center text-xs text-[#94A3B8] py-8 font-medium">No data available for selected period</div>
            ) : (
              topRiders.map((rider, i) => (
                <div key={i} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-[#334155]">{rider.rider_name || "Active Express Rider"}</p>
                    <span className="text-[10px] text-slate-400 font-medium">{rider.orders_completed || 0} Deliveries Finished</span>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-0.5">
                      ★ {(rider.rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Platform Health Desk Task Panel */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Platform Operations Health</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Critical back-office execution logs pending action</p>
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Subscription Intent Forms</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", health.pendingSubscriptions > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600")}>
                {health.pendingSubscriptions} pending
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Vendor Outbound Settlements</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", health.pendingSettlements > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600")}>
                {health.pendingSettlements} pending
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Pending Customer Escrows</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", health.pendingRefunds > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-600")}>
                {health.pendingRefunds} pending
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <span className="font-medium text-slate-600">Open Active Help Tickets</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", health.openTickets > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600")}>
                {health.openTickets} unresolved
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}