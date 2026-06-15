
import React from "react";
import {
  ShoppingCart,
  IndianRupee,
  Store,
  Bike,
  Users,
  RefreshCcw,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Activity,
} from "lucide-react";
import { MetricCard } from "../ui/MetricCard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const recentActivity: any[] = [];

const pendingActions = [
  { label: "Vendor approvals pending", count: 0, variant: "warning" as const },
  { label: "Refunds awaiting review", count: 0, variant: "error" as const },
  { label: "Open support tickets", count: 0, variant: "info" as const },
  { label: "Unpaid settlements", count: 0, variant: "neutral" as const },
];

const systemStatus = [
  { label: "API Gateway", status: "operational" },
  { label: "Payment Service", status: "operational" },
  { label: "Notification Service", status: "operational" },
  { label: "Maps & Routing", status: "operational" },
  { label: "OTP Verification", status: "operational" },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        <MetricCard
          title="Total Orders"
          value="0"
          change={0}
          changeLabel="vs last month"
          icon={<ShoppingCart className="w-4 h-4 text-blue-500" />}
          iconBg="bg-blue-50"
        />

        <MetricCard
          title="Revenue"
          value="₹0"
          change={0}
          changeLabel="vs last month"
          icon={<IndianRupee className="w-4 h-4 text-green-600" />}
          iconBg="bg-green-50"
        />

        <MetricCard
          title="Active Vendors"
          value="0"
          change={0}
          changeLabel="vs last month"
          icon={<Store className="w-4 h-4 text-purple-500" />}
          iconBg="bg-purple-50"
        />

        <MetricCard
          title="Active Riders"
          value="0"
          change={0}
          changeLabel="vs last month"
          icon={<Bike className="w-4 h-4 text-amber-500" />}
          iconBg="bg-amber-50"
        />

        <MetricCard
          title="Customers"
          value="0"
          change={0}
          changeLabel="vs last month"
          icon={<Users className="w-4 h-4 text-sky-500" />}
          iconBg="bg-sky-50"
        />

        <MetricCard
          title="Refund Rate"
          value="0%"
          change={0}
          changeLabel="vs last month"
          icon={<RefreshCcw className="w-4 h-4 text-red-500" />}
          iconBg="bg-red-50"
        />

        <MetricCard
          title="Cancel Rate"
          value="0%"
          change={0}
          changeLabel="vs last month"
          icon={<XCircle className="w-4 h-4 text-orange-500" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="col-span-2 bg-white border border-[#E2E8F0] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#64748B]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Recent Activity
              </h2>
            </div>

            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View all
            </Button>
          </div>

          <div className="p-10 text-center">
            <Activity className="w-10 h-10 mx-auto text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#64748B]">No activity yet</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Activity will appear when vendors, riders and customers start
              using Rivo.
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          {/* Pending Actions */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Pending Actions
              </h2>
            </div>

            <ul className="divide-y divide-[#F1F5F9]">
              {pendingActions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
                >
                  <span className="text-sm text-[#0F172A]">
                    {action.label}
                  </span>

                  <Badge
                    variant={action.variant}
                    label={String(action.count)}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* System Status */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                System Status
              </h2>
            </div>

            <ul className="divide-y divide-[#F1F5F9]">
              {systemStatus.map((s, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-sm text-[#0F172A]">
                    {s.label}
                  </span>

                  {s.status === "operational" ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Operational
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600">
                      <Clock className="w-3.5 h-3.5" />
                      Degraded
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
