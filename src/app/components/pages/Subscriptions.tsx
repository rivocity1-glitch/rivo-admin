import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Lock, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type Plan = { id: string; name: string; price: string; description: string; comingSoon?: boolean; popular?: boolean; features: string[] };

type SubscriptionRow = { vendor_id: string | null; plan_name: string | null };

const PLANS: Plan[] = [
  { id: "free", name: "FREE", price: "₹0", description: "5% commission per order", features: ["No fixed monthly fee", "Unlimited customer orders", "Basic analytics", "Standard support", "Core settlements ledger"] },
  { id: "basic", name: "BASIC", price: "₹499", description: "0% commission", popular: true, features: ["Fixed monthly fee", "0% commission on orders", "Unlimited customer orders", "Basic analytics", "Standard support"] },
  { id: "growth", name: "GROWTH", price: "₹999", description: "0% commission", comingSoon: true, features: ["Advanced analytics", "0% commission on orders", "Priority visibility", "Priority support", "Marketing campaigns"] },
  { id: "pro", name: "PRO", price: "₹1499", description: "0% commission", comingSoon: true, features: ["Enterprise workspace", "0% commission on orders", "Advanced fleet routing", "Priority account support", "API integration access"] },
];

function normalizePlan(value: string | null): "free" | "basic" | "growth" | "pro" {
  const name = String(value || "").trim().toLowerCase();
  if (name === "basic" || name === "499") return "basic";
  if (name === "growth" || name === "999") return "growth";
  if (name === "pro" || name === "1499") return "pro";
  return "free";
}

export function Subscriptions() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.from("subscriptions").select("vendor_id, plan_name");
    if (queryError) {
      console.error("Subscription dashboard query failed:", queryError);
      setRows([]);
      setError(queryError.message || "Unable to load subscription data.");
    } else {
      setRows((data || []) as SubscriptionRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const counts = { free: 0, basic: 0, growth: 0, pro: 0 };
    const vendorKeys = new Set<string>();
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const plan = normalizePlan(row.plan_name);
      const vendorKey = row.vendor_id || `row-${index}`;
      const key = `${vendorKey}:${plan}`;
      if (seen.has(key)) return;
      seen.add(key);
      counts[plan] += 1;
      if (row.vendor_id) vendorKeys.add(row.vendor_id);
    });
    return { ...counts, total: vendorKeys.size || rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Platform Subscription Plans</h1>
          <p className="text-sm text-[#64748B]">Current subscription model and live vendor distribution.</p>
        </div>
        <button onClick={load} disabled={loading} className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">
          <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><div><b>Subscription data unavailable.</b><div className="text-xs mt-0.5">{error}</div></div></div>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[['FREE Members (5%)', metrics.free], ['BASIC Members (0%)', metrics.basic], ['GROWTH Members', metrics.growth], ['PRO Members', metrics.pro], ['Total Vendors', metrics.total]].map(([label, value]) => (
          <div key={String(label)} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">{label}</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{loading ? "..." : value}</h3>
            <p className="text-xs text-[#94A3B8] mt-3">Live subscription records</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <div key={plan.id} className={cn("bg-white border rounded-2xl p-6 relative flex flex-col justify-between", plan.popular ? "border-[#22C55E] ring-1 ring-[#22C55E]/10" : "border-[#E2E8F0]", plan.comingSoon && "opacity-75 bg-[#FBFCFD]")}>
            {plan.popular && <span className="absolute -top-3 right-4 bg-[#22C55E] text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" /> Most Popular</span>}
            <div>
              <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-2"><span className="text-3xl font-extrabold text-[#0F172A]">{plan.price}</span>{plan.id !== "free" && !plan.comingSoon && <span className="text-xs text-[#64748B]">/ month</span>}</div>
              <p className="text-xs font-semibold text-[#16A34A] mt-2 bg-[#F0FDF4] inline-block px-2 py-0.5 rounded-md border border-[#DCFCE7]">{plan.description}</p>
              <hr className="border-[#F1F5F9] my-4" />
              <ul className="space-y-3 mb-6">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-xs"><span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-[#EFF6FF] text-[#2563EB]"><Check className="w-3 h-3 stroke-[3]" /></span><span className="font-medium text-[#334155]">{feature}</span></li>)}</ul>
            </div>
            {plan.comingSoon ? <div className="w-full h-9 bg-slate-100 rounded-lg text-xs font-bold text-slate-400 border border-slate-200 inline-flex items-center justify-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Coming Soon</div> : <div className="w-full h-9 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 bg-slate-50 border-slate-200 text-slate-600"><ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" /> Operational Rule Profile</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
