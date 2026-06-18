import React, { useState, useEffect } from "react";
import { 
  Check, 
  Store, 
  ShieldCheck, 
  RefreshCcw, 
  Sparkles,
  Lock,
  Clock
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  priceLabel: string;
  subtext: string;
  badge?: string;
  isComingSoon?: boolean;
  features: PlanFeature[];
}

export function Subscriptions() {
  const [vendorMetrics, setVendorMetrics] = useState({
    freeTierCount: 0,
    premiumTierCount: 0,
    trialTierCount: 0,
    totalVendors: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 Fetch live subscription split counts from your Supabase production node
  async function fetchSubscriptionDistribution() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("plan_type");

      if (error) throw error;

      const safeVendors = data || [];
      
      // Calculate normalized string distributions from database records
      const freeCount = safeVendors.filter(v => (v.plan_type || "").toLowerCase() === "free").length;
      const premiumCount = safeVendors.filter(v => (v.plan_type || "").toLowerCase() === "premium").length;
      const trialCount = safeVendors.filter(v => (v.plan_type || "").toLowerCase() === "trial").length;

      setVendorMetrics({
        freeTierCount: freeCount,
        premiumTierCount: premiumCount,
        trialTierCount: trialCount,
        totalVendors: safeVendors.length
      });
    } catch (err) {
      console.error("Failed loading real-time subscription distribution:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSubscriptionDistribution();
  }, []);

  // 🟢 Production plans definition aligned precisely with your pricing tiers
  const currentPlans: SubscriptionPlan[] = [
    {
      id: "free_tier",
      name: "Free Plan",
      priceLabel: "Free",
      subtext: "5% commission per order",
      features: [
        { text: "No Fixed Monthly Fee", included: true },
        { text: "Unlimited Customer Orders", included: true },
        { text: "Basic Analytics Workspace", included: true },
        { text: "Standard Support Helpdesk", included: true },
        { text: "Core Payout Settlements Ledger", included: true }
      ]
    },
    {
      id: "premium_tier",
      name: "Premium Plan",
      priceLabel: "₹499",
      subtext: "0% commission layout model",
      badge: "Most Popular",
      features: [
        { text: "Fixed Monthly Fee", included: true },
        { text: "0% Commission on Orders", included: true },
        { text: "Unlimited Customer Orders", included: true },
        { text: "Basic Analytics Workspace", included: true },
        { text: "Standard Support Helpdesk", included: true }
      ]
    },
    {
      id: "enterprise_tier",
      name: "Enterprise Fleet",
      priceLabel: "₹4,999",
      subtext: "Advanced system tools",
      isComingSoon: true,
      features: [
        { text: "Dedicated Dispatch Infrastructure", included: true },
        { text: "Custom Optimization Routing", included: true },
        { text: "Unlimited Customer Orders", included: true },
        { text: "Basic Analytics Workspace", included: true },
        { text: "Standard Support Helpdesk", included: true }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header Component Block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Platform Subscription Plans</h1>
          <p className="text-sm text-[#64748B]">Manage Rivo's core commission rules and subscription price points.</p>
        </div>
        <button 
          onClick={fetchSubscriptionDistribution}
          disabled={isLoading}
          className="h-9 px-3 gap-1.5 inline-flex items-center justify-center text-xs font-medium border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
        >
          <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          Refresh Stats
        </button>
      </div>

      {/* 🔴 DYNAMIC SUBSCRIPTION BREAKDOWN CARDS MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Free Plan Cards */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Free Members (5%)</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : vendorMetrics.freeTierCount}</h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">Live commission contracts</p>
        </div>

        {/* Premium Plan Cards */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-emerald-100 bg-emerald-50/5">
          <div>
            <p className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider">₹499 Members (0%)</p>
            <h3 className="text-2xl font-bold text-[#16A34A] mt-1">{isLoading ? "..." : vendorMetrics.premiumTierCount}</h3>
          </div>
          <p className="text-xs text-[#16A34A] font-medium mt-3">Active fixed billing models</p>
        </div>

        {/* Trial Plan Cards */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-amber-100 bg-amber-50/5">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Active Trial Members</p>
            <h3 className="text-2xl font-bold text-amber-700 mt-1">{isLoading ? "..." : vendorMetrics.trialTierCount}</h3>
          </div>
          <p className="text-xs text-amber-600 font-medium mt-3">Temporary test periods</p>
        </div>

        {/* Summary Card */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Total Active Merchants</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : vendorMetrics.totalVendors}</h3>
          </div>
          <p className="text-xs text-[#64748B] font-medium mt-3">Unified directory footprint</p>
        </div>
      </div>

      {/* Subscription Pricing Matrix Cards Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {currentPlans.map((plan) => (
          <div 
            key={plan.id}
            className={cn(
              "bg-white border rounded-2xl p-6 relative flex flex-col justify-between transition-all",
              plan.badge ? "border-[#22C55E] shadow-sm ring-1 ring-[#22C55E]/10" : "border-[#E2E8F0]",
              plan.isComingSoon && "opacity-75 bg-[#FBFCFD]"
            )}
          >
            {/* Top Section */}
            <div>
              {plan.badge && (
                <span className="absolute -top-3 right-4 bg-[#22C55E] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-[#0F172A]">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-extrabold text-[#0F172A] tracking-tight">{plan.priceLabel}</span>
                  {!plan.isComingSoon && plan.priceLabel !== "Free" && (
                    <span className="text-xs font-semibold text-[#64748B]">/ month</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#16A34A] mt-1 bg-[#F0FDF4] inline-block px-2 py-0.5 rounded-md border border-[#DCFCE7]">
                  {plan.subtext}
                </p>
              </div>

              <hr className="border-[#F1F5F9] my-4" />

              {/* Feature Checkmarks Array Container */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <div className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      feature.included ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className={cn("font-medium", feature.included ? "text-[#334155]" : "text-[#94A3B8] line-through")}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Bottom Section Slot Layout */}
            <div>
              {plan.isComingSoon ? (
                <div className="w-full h-9 bg-slate-100 rounded-lg text-xs font-bold text-slate-400 border border-slate-200 inline-flex items-center justify-center gap-1.5 cursor-not-allowed">
                  <Lock className="w-3.5 h-3.5" /> Coming Soon
                </div>
              ) : (
                <div className={cn(
                  "w-full h-9 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 bg-slate-50 border-slate-200 text-slate-600 select-none"
                )}>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" /> Operational Rule Profile
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}