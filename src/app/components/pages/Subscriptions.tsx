import React, { useState } from "react";
import {
  Crown,
  Zap,
  Star,
  Check,
  MoreHorizontal,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { Select } from "../ui/Select";
import { cn } from "../../../lib/utils";

type SubscriptionPlan = "Starter" | "Growth" | "Premium";
type SubStatus = "active" | "expired" | "cancelled";

interface VendorSubscription {
  id: string;
  vendor: string;
  plan: SubscriptionPlan;
  status: SubStatus;
  startDate: string;
  endDate: string;
  amount: number;
  orders: number;
}

const vendorSubs: VendorSubscription[] = [
  { id: "SUB-0081", vendor: "Quick Mart", plan: "Premium", status: "active", startDate: "01 Jan 2025", endDate: "31 Dec 2025", amount: 4999, orders: 2310 },
  { id: "SUB-0082", vendor: "Green Basket", plan: "Growth", status: "active", startDate: "01 Mar 2025", endDate: "28 Feb 2026", amount: 2499, orders: 1842 },
  { id: "SUB-0083", vendor: "Dairy Direct", plan: "Growth", status: "active", startDate: "15 Jan 2025", endDate: "14 Jan 2026", amount: 2499, orders: 1120 },
  { id: "SUB-0084", vendor: "Daily Grains", plan: "Starter", status: "active", startDate: "01 Apr 2025", endDate: "31 Mar 2026", amount: 999, orders: 964 },
  { id: "SUB-0085", vendor: "Fresh Farms", plan: "Starter", status: "cancelled", startDate: "01 Feb 2025", endDate: "01 May 2025", amount: 999, orders: 420 },
  { id: "SUB-0086", vendor: "Spice World", plan: "Starter", status: "active", startDate: "10 Jun 2025", endDate: "09 Jun 2026", amount: 999, orders: 0 },
];

const plans = [
  {
    name: "Starter" as SubscriptionPlan,
    price: "₹999",
    period: "/month",
    icon: <Zap className="w-5 h-5" />,
    iconBg: "bg-slate-100 text-slate-600",
    color: "border-[#E2E8F0]",
    features: [
      "Up to 200 orders/month",
      "Basic analytics",
      "Standard support",
      "1 rider slot",
    ],
    count: vendorSubs.filter((v) => v.plan === "Starter" && v.status === "active").length,
  },
  {
    name: "Growth" as SubscriptionPlan,
    price: "₹2,499",
    period: "/month",
    icon: <Star className="w-5 h-5" />,
    iconBg: "bg-blue-50 text-blue-600",
    color: "border-blue-200 ring-1 ring-blue-100",
    features: [
      "Up to 1,000 orders/month",
      "Advanced analytics",
      "Priority support",
      "3 rider slots",
      "Promo banner",
    ],
    count: vendorSubs.filter((v) => v.plan === "Growth" && v.status === "active").length,
  },
  {
    name: "Premium" as SubscriptionPlan,
    price: "₹4,999",
    period: "/month",
    icon: <Crown className="w-5 h-5" />,
    iconBg: "bg-purple-50 text-purple-600",
    color: "border-purple-200 ring-1 ring-purple-100",
    features: [
      "Unlimited orders",
      "Full analytics suite",
      "Dedicated support",
      "Unlimited rider slots",
      "Featured listing",
      "Custom commission rate",
    ],
    count: vendorSubs.filter((v) => v.plan === "Premium" && v.status === "active").length,
  },
];

const planBadge: Record<SubscriptionPlan, { variant: any; label: string }> = {
  Starter: { variant: "neutral", label: "Starter" },
  Growth: { variant: "info", label: "Growth" },
  Premium: { variant: "purple", label: "Premium" },
};

export function Subscriptions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [subList, setSubList] = useState<VendorSubscription[]>(vendorSubs);
  const [manageModal, setManageModal] = useState<{ sub: VendorSubscription; action: string } | null>(null);
  const itemsPerPage = 10;

  const filtered = subList.filter((s) => {
    const matchSearch = s.vendor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader title="Subscriptions" description="Manage vendor subscription plans" />

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => (
          <div key={plan.name} className={cn("bg-white border rounded-xl p-5", plan.color)}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", plan.iconBg)}>
                  {plan.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A]">{plan.name}</h3>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-xl font-bold text-[#0F172A]">{plan.price}</span>
                  <span className="text-xs text-[#64748B]">{plan.period}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-[#0F172A]">{plan.count}</p>
                <p className="text-xs text-[#64748B]">active vendors</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-[#64748B]">
                  <Check className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Vendor subscriptions table */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "active", "cancelled", "expired"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium capitalize transition-all",
                statusFilter === s
                  ? "bg-[#22C55E] text-white"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Valid Until</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Amount</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Orders</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((sub) => {
              const pb = planBadge[sub.plan];
              return (
                <tr key={sub.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[#0F172A]">{sub.vendor}</p>
                    <p className="text-xs text-[#64748B]">{sub.id}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={pb.variant} label={pb.label} />
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant={sub.status === "active" ? "success" : sub.status === "cancelled" ? "error" : "warning"}
                      label={sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      dot
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
                      <Calendar className="w-3.5 h-3.5" />{sub.endDate}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-medium text-[#0F172A]">₹{sub.amount.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right text-sm text-[#0F172A]">{sub.orders.toLocaleString()}</td>
                  <td className="px-4 py-3.5">
                    <Dropdown
                      align="right"
                      trigger={
                        <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      }
                      items={[
                        { label: "Upgrade Plan", icon: <TrendingUp className="w-3.5 h-3.5" />, onClick: () => setManageModal({ sub, action: "upgrade" }) },
                        { label: "Downgrade Plan", icon: <TrendingDown className="w-3.5 h-3.5" />, onClick: () => setManageModal({ sub, action: "downgrade" }) },
                        { label: "Extend Duration", icon: <Calendar className="w-3.5 h-3.5" />, onClick: () => setManageModal({ sub, action: "extend" }) },
                        {
                          label: "Deactivate",
                          onClick: () => setSubList((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: "cancelled" } : s)),
                          variant: "danger",
                          divider: true,
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filtered.length / itemsPerPage)}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Manage Modal */}
      {manageModal && (
        <Modal
          open={!!manageModal}
          onClose={() => setManageModal(null)}
          title={`${manageModal.action.charAt(0).toUpperCase() + manageModal.action.slice(1)} — ${manageModal.sub.vendor}`}
          description={`Current plan: ${manageModal.sub.plan}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setManageModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setManageModal(null)}>
                {manageModal.action === "extend" ? "Extend" : "Change Plan"}
              </Button>
            </>
          }
        >
          {manageModal.action === "extend" ? (
            <Select
              label="Extend by"
              value=""
              onChange={() => {}}
              options={[
                { value: "1m", label: "1 Month" },
                { value: "3m", label: "3 Months" },
                { value: "6m", label: "6 Months" },
                { value: "12m", label: "12 Months" },
              ]}
              placeholder="Select duration"
            />
          ) : (
            <Select
              label="New Plan"
              value={manageModal.sub.plan}
              onChange={() => {}}
              options={[
                { value: "Starter", label: "Starter — ₹999/mo" },
                { value: "Growth", label: "Growth — ₹2,499/mo" },
                { value: "Premium", label: "Premium — ₹4,999/mo" },
              ]}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
