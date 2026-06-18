import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  BarChart3,
  RefreshCcw
} from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

interface StatusBarMetric {
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
}

interface TopRankItem {
  name: string;
  valueLabel: string;
  percentage: number;
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState("30");

  // Top Summarized Metrics Cards State
  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    newCustomers: 0
  });

  // Descriptive Graph Charts Mappings States
  const [revenueTrend, setRevenueTrend] = useState<{ day: string; amount: number; pct: number }[]>([]);
  const [ordersTrend, setOrdersTrend] = useState<{ day: string; count: number; pct: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBarMetric[]>([]);
  const [customerGrowth, setCustomerGrowth] = useState({ newPct: 0, returningPct: 0, total: 0 });
  const [topVendors, setTopVendors] = useState<TopRankItem[]>([]);
  const [zonePerformance, setZonePerformance] = useState<TopRankItem[]>([]);

  async function calculateLiveAnalytics() {
    try {
      setIsLoading(true);

      // 1. Fetch tables row records streams
      const [ordersQuery, customersQuery] = await Promise.all([
        supabase.from("orders").select("status, amount, vendor_name, created_at, delivery_address"),
        supabase.from("customers").select("id, created_at")
      ]);

      if (ordersQuery.error) throw ordersQuery.error;
      const orders = ordersQuery.data || [];
      const customers = customersQuery.data || [];

      // Filter active orders based on timescale filter context
      const now = new Date();
      const filteredOrders = orders.filter(o => {
        if (timePeriod === "all") return true;
        const orderDate = new Date(o.created_at);
        const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        return daysDiff <= parseInt(timePeriod);
      });

      // 2. Compute Top 4 Header Summary Counters
      const revenue = filteredOrders
        .filter(o => o.status !== "cancelled" && o.status !== "refunded")
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);
      
      const totalOrdersCount = filteredOrders.length;
      const averageValue = totalOrdersCount > 0 ? Math.round(revenue / totalOrdersCount) : 0;
      
      const newCustsCount = customers.filter(c => {
        if (timePeriod === "all") return true;
        const cDate = new Date(c.created_at);
        const daysDiff = (now.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
        return daysDiff <= parseInt(timePeriod);
      }).length;

      setSummaryStats({
        totalRevenue: revenue,
        totalOrders: totalOrdersCount,
        avgOrderValue: averageValue,
        newCustomers: newCustsCount
      });

      // 3. Compute Revenue Over Time & Orders Per Day Graphs Mapped Metrics
      const last7Days = Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date();
        d.setDate(now.getDate() - idx);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      }).reverse();

      const dailyRevMap: Record<string, number> = {};
      const dailyOrdMap: Record<string, number> = {};
      
      filteredOrders.forEach(o => {
        const dayKey = new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        dailyOrdMap[dayKey] = (dailyOrdMap[dayKey] || 0) + 1;
        if (o.status !== "cancelled" && o.status !== "refunded") {
          dailyRevMap[dayKey] = (dailyRevMap[dayKey] || 0) + (o.amount || 0);
        }
      });

      const maxRev = Math.max(...last7Days.map(d => dailyRevMap[d] || 0), 1);
      const maxOrd = Math.max(...last7Days.map(d => dailyOrdMap[d] || 0), 1);

      setRevenueTrend(last7Days.map(day => ({
        day,
        amount: dailyRevMap[day] || 0,
        pct: Math.round(((dailyRevMap[day] || 0) / maxRev) * 100)
      })));

      setOrdersTrend(last7Days.map(day => ({
        day,
        count: dailyOrdMap[day] || 0,
        pct: Math.round(((dailyOrdMap[day] || 0) / maxOrd) * 100)
      })));

      // 4. Compute Order Status Breakdown
      const statusCounts: Record<string, number> = {};
      filteredOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
      
      const colors: Record<string, string> = { delivered: "bg-[#22C55E]", pending: "bg-amber-500", cancelled: "bg-rose-500" };
      setStatusBreakdown(Object.keys(statusCounts).map(status => ({
        label: status.replace("_", " ").toUpperCase(),
        count: statusCounts[status],
        percentage: totalOrdersCount > 0 ? Math.round((statusCounts[status] / totalOrdersCount) * 100) : 0,
        colorClass: colors[status] || "bg-blue-500"
      })));

      // 5. Customer Growth (Fixed fallback ratios from 70/30 down to absolute 0)
      const totalClients = customers.length;
      setCustomerGrowth({
        total: totalClients,
        newPct: totalClients > 0 ? Math.round((newCustsCount / totalClients) * 100) : 0,
        returningPct: totalClients > 0 ? (100 - Math.round((newCustsCount / totalClients) * 100)) : 0
      });

      // 6. Top Performing Vendors
      const vendorSales: Record<string, number> = {};
      filteredOrders.forEach(o => {
        if (o.status !== "cancelled" && o.status !== "refunded") {
          vendorSales[o.vendor_name] = (vendorSales[o.vendor_name] || 0) + (o.amount || 0);
        }
      });
      const topVendorMax = Math.max(...Object.values(vendorSales), 1);
      setTopVendors(Object.keys(vendorSales).map(name => ({
        name,
        valueLabel: `₹${vendorSales[name].toLocaleString()}`,
        percentage: Math.round((vendorSales[name] / topVendorMax) * 100)
      })).sort((a,b) => b.percentage - a.percentage).slice(0, 4));

      // 7. Zone-wise Regional Performance
      const zoneOrders: Record<string, number> = {};
      filteredOrders.forEach(o => {
        const address = o.delivery_address || "";
        const zone = address.includes("Koramangala") ? "Koramangala Zone" : address.includes("Indiranagar") ? "Indiranagar Zone" : address.includes("Whitefield") ? "Whitefield Zone" : "Central Zone";
        zoneOrders[zone] = (zoneOrders[zone] || 0) + 1;
      });
      const topZoneMax = Math.max(...Object.values(zoneOrders), 1);
      setZonePerformance(Object.keys(zoneOrders).map(name => ({
        name,
        valueLabel: `${zoneOrders[name]} orders`,
        percentage: Math.round((zoneOrders[name] / topZoneMax) * 100)
      })).sort((a,b) => b.percentage - a.percentage));

    } catch (err) {
      console.error("Aggregation error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { getLiveAnalytics(); }, [timePeriod]);
  function getLiveAnalytics() { calculateLiveAnalytics(); }

  return (
    <div className="space-y-6">
      {/* Title Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Analytics</h1>
          <p className="text-xs font-medium text-[#64748B] mt-0.5">Platform-wide production performance metrics</p>
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
          <button onClick={getLiveAnalytics} className="h-9 w-9 border border-[#E2E8F0] bg-white rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Top 4 Counter Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Revenue</p><span className="text-[#22C55E] text-xs font-bold">₹</span></div>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : `₹${summaryStats.totalRevenue.toLocaleString()}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Orders</p><ShoppingBag className="w-3.5 h-3.5 text-blue-500" /></div>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : summaryStats.totalOrders.toLocaleString()}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Avg Order Value</p><TrendingUp className="w-3.5 h-3.5 text-purple-500" /></div>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : `₹${summaryStats.avgOrderValue}`}</h3>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">New Customers</p><Users className="w-3.5 h-3.5 text-amber-500" /></div>
          <h3 className="text-xl font-bold text-[#0F172A] mt-2">{isLoading ? "—" : summaryStats.newCustomers}</h3>
        </div>
      </div>

      {/* Row 1: Revenue Graph & Status Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        {/* Revenue Over Time */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 lg:col-span-2">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Revenue Over Time</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-6">Daily revenue trends from closed transactions</p>
          <div className="h-44 flex items-end justify-between gap-2 pt-4">
            {isLoading ? (
              <div className="w-full text-center text-xs text-[#94A3B8] font-medium py-16">Loading metrics...</div>
            ) : revenueTrend.filter(item => item.amount > 0).length === 0 ? (
              <div className="w-full text-center text-xs text-[#94A3B8] font-medium py-16">No data for selected period</div>
            ) : (
              revenueTrend.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-6 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono font-bold z-30">₹{item.amount}</div>
                  <div className="w-full bg-[#EFF6FF] group-hover:bg-blue-100 rounded-md transition-colors relative flex items-end" style={{ height: "100%" }}>
                    <div className="w-full bg-blue-500 group-hover:bg-blue-600 rounded-md transition-all" style={{ height: `${item.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#64748B] whitespace-nowrap">{item.day}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Breakdown Bar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Order Status Breakdown</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Distribution by real-time order status logs</p>
          <div className="space-y-3.5 pt-2">
            {isLoading ? (
              <div className="text-center text-xs text-[#94A3B8] py-12">Processing...</div>
            ) : statusBreakdown.length === 0 ? (
              <div className="text-center text-xs text-[#94A3B8] py-12">No data recorded.</div>
            ) : (
              statusBreakdown.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#475569]">{item.label}</span>
                    <span className="text-[#0F172A]"> {item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", item.colorClass)} style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Orders Per Day & Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        {/* Orders Per Day */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Orders Per Day</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-6">Volume trend lines across platform endpoints</p>
          <div className="h-40 flex items-end justify-between gap-3 pt-2">
            {isLoading ? (
              <div className="w-full text-center text-xs text-[#94A3B8] py-12">Syncing volume logs...</div>
            ) : ordersTrend.filter(item => item.count > 0).length === 0 ? (
              <div className="w-full text-center text-xs text-[#94A3B8] py-12">No order counts logged.</div>
            ) : (
              ordersTrend.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="absolute -top-6 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold z-30">{item.count} items</div>
                  <div className="w-full bg-[#F0FDF4] group-hover:bg-emerald-100 rounded-md h-full flex items-end">
                    <div className="w-full bg-[#22C55E] group-hover:bg-[#16A34A] rounded-md transition-all" style={{ height: `${item.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#64748B]">{item.day}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Customer Growth Metric Box */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Customer Growth</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-6">New vs returning client ratio profiles</p>
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between text-center">
              <div className="flex-1 border-r border-[#F1F5F9]">
                <span className="text-2xl font-black text-[#0F172A]">{customerGrowth.total}</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mt-0.5">Total Accounts</p>
              </div>
              <div className="flex-1 border-r border-[#F1F5F9]">
                <span className="text-xl font-bold text-blue-500">{customerGrowth.newPct}%</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mt-0.5">New Registers</p>
              </div>
              <div className="flex-1">
                <span className="text-xl font-bold text-purple-500">{customerGrowth.returningPct}%</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mt-0.5">Returning Base</p>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full flex overflow-hidden">
              <div className="bg-blue-500 transition-all" style={{ width: `${customerGrowth.newPct}%` }} />
              <div className="bg-purple-500 transition-all" style={{ width: `${customerGrowth.returningPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Leaderboard Leader Profiles & Zone Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        {/* Top Vendors */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Top Performing Vendors</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Ranked by revenue sales throughput volume</p>
          <div className="space-y-3 pt-1">
            {isLoading ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">Calculating ranks...</div>
            ) : topVendors.length === 0 ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">No vendor sales transactions locked.</div>
            ) : (
              topVendors.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-semibold py-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono text-slate-400">0{i+1}</span>
                    <span className="text-[#334155]">{item.name}</span>
                  </div>
                  <span className="text-[#0F172A] font-mono font-bold">{item.valueLabel}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Region Zones Density */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-1">Zone-wise Performance</h3>
          <p className="text-[11px] font-medium text-[#64748B] mb-4">Order densities mapped by geo-delivery addresses</p>
          <div className="space-y-3 pt-1">
            {isLoading ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">Sorting metrics...</div>
            ) : zonePerformance.length === 0 ? (
              <div className="text-center text-xs text-[#94A3B8] py-8">No order zone statistics compiled.</div>
            ) : (
              zonePerformance.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#475569]">{item.name}</span>
                    <span className="text-[#0F172A]">{item.valueLabel}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-700 rounded-full transition-all" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}