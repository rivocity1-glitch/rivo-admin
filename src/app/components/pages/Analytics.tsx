import React, { useState } from "react";
import {
  BarChart2,
  TrendingUp,
  ShoppingCart,
  Users,
  IndianRupee,
  Download,
  CalendarRange,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Select } from "../ui/Select";

function EmptyChart({ height = "h-48", label }: { height?: string; label: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] rounded-xl bg-[#F8FAFC]`}>
      <BarChart2 className="w-8 h-8 text-[#CBD5E1] mb-2" />
      <p className="text-sm text-[#94A3B8] font-medium">{label}</p>
      <p className="text-xs text-[#CBD5E1] mt-1">Connect data source to populate</p>
    </div>
  );
}

const kpiCards = [
  { label: "Total Revenue", value: "—", change: "", icon: <IndianRupee className="w-4 h-4 text-green-600" />, bg: "bg-green-50" },
  { label: "Total Orders", value: "—", change: "", icon: <ShoppingCart className="w-4 h-4 text-blue-500" />, bg: "bg-blue-50" },
  { label: "Avg Order Value", value: "—", change: "", icon: <TrendingUp className="w-4 h-4 text-purple-500" />, bg: "bg-purple-50" },
  { label: "New Customers", value: "—", change: "", icon: <Users className="w-4 h-4 text-amber-500" />, bg: "bg-amber-50" },
];

export function Analytics() {
  const [period, setPeriod] = useState("30d");

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform-wide performance metrics"
        actions={
          <>
            <Select
              value={period}
              onChange={setPeriod}
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
                { value: "12m", label: "Last 12 months" },
              ]}
            />
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-semibold text-[#CBD5E1] mt-1">—</p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.bg}`}>{card.icon}</div>
            </div>
            <p className="text-xs text-[#94A3B8]">No data for selected period</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Revenue Over Time</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Daily revenue trend for selected period</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
              <ArrowUpRight className="w-3.5 h-3.5" />No data
            </span>
          </div>
          <EmptyChart height="h-52" label="Revenue Chart" />
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Order Status Breakdown</h3>
          <p className="text-xs text-[#64748B] mb-4">Distribution by order status</p>
          <EmptyChart height="h-52" label="Donut Chart" />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Orders Per Day</h3>
          <p className="text-xs text-[#64748B] mb-4">Volume trend across selected period</p>
          <EmptyChart height="h-44" label="Bar Chart" />
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Customer Growth</h3>
          <p className="text-xs text-[#64748B] mb-4">New vs returning customers</p>
          <EmptyChart height="h-44" label="Area Chart" />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top vendors */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-sm font-semibold text-[#0F172A]">Top Performing Vendors</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Ranked by revenue for selected period</p>
          </div>
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
            <BarChart2 className="w-8 h-8 text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">No vendor data available</p>
            <p className="text-xs text-[#CBD5E1] mt-1">Rankings will appear once orders are processed</p>
          </div>
        </div>

        {/* Zone performance */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h3 className="text-sm font-semibold text-[#0F172A]">Zone-wise Performance</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Orders and revenue by delivery zone</p>
          </div>
          <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
            <CalendarRange className="w-8 h-8 text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">No zone data available</p>
            <p className="text-xs text-[#CBD5E1] mt-1">Connect delivery zones to populate this view</p>
          </div>
        </div>
      </div>
    </div>
  );
}
