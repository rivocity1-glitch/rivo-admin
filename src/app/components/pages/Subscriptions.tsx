import React, { useState, useEffect } from "react";
import { 
  Check, 
  Store, 
  ShieldCheck, 
  RefreshCcw, 
  Sparkles,
  Lock,
  Clock,
  MapPin,
  TrendingUp
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
    basicTierCount: 0,
    growthTierCount: 0,
    proTierCount: 0,
    totalVendors: 0
  });
  
  const [subConfig, setSubConfig] = useState<any>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchPlatformData() {
    try {
      setIsLoading(true);

      // 1. Fetch Subscription Config Definitions
      const { data: subData } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "subscription_config")
        .single();
      
      if (subData?.setting_value) {
        setSubConfig(subData.setting_value);
      }

      // 2. Fetch Delivery Settings Configurations
      const { data: deliveryData } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "delivery_config")
        .single();
      
      if (deliveryData?.setting_value) {
        setDeliveryConfig(deliveryData.setting_value);
      }

      // 3. Gather Metric Counts from the subscriptions ledger safely
      const { data: activeSubs, error: subError } = await supabase
        .from("subscriptions")
        .select("*");

      if (subError) throw subError;

      const safeSubs = activeSubs || [];
      
      let freeCount = 0;
      let basicCount = 0;
      let growthCount = 0;
      let proCount = 0;
      const vendorIds = new Set<string>();

      safeSubs.forEach((sub: any) => {
        const vId = sub.vendor_id || sub.merchant_id || sub.id;
        if (vId) vendorIds.add(vId);

        // Read subscriptions ONLY from subscriptions.plan_name with backward compatibility mapping
        const rawPlanName = String(sub.plan_name || "").toLowerCase();

        if (rawPlanName === "free") {
          freeCount++;
        } else if (rawPlanName === "basic" || rawPlanName === "499") {
          basicCount++;
        } else if (rawPlanName === "growth") {
          growthCount++;
        } else if (rawPlanName === "pro") {
          proCount++;
        } else {
          // Default unknown or empty records fallback safely to free mapping rules
          freeCount++;
        }
      });

      setVendorMetrics({
        freeTierCount: freeCount,
        basicTierCount: basicCount,
        growthTierCount: growthCount,
        proTierCount: proCount,
        totalVendors: vendorIds.size || safeSubs.length
      });

    } catch (err) {
      console.error("Failed loading real-time platform distribution context:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPlatformData();
  }, []);

  // Display exactly four cards matching launch specifications
  const currentPlans: SubscriptionPlan[] = [
    {
      id: "free_tier",
      name: "FREE",
      priceLabel: "₹0",
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
      id: "basic_tier",
      name: "BASIC",
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
      id: "growth_tier",
      name: "GROWTH",
      priceLabel: "₹999",
      subtext: "0% commission premium model",
      isComingSoon: true,
      features: [
        { text: "Advanced Analytics Toolkit", included: true },
        { text: "0% Commission on Orders", included: true },
        { text: "Priority Customer Visibility", included: true },
        { text: "Dedicated Account Support Desk", included: true },
        { text: "Custom Marketing Campaigns", included: true }
      ]
    },
    {
      id: "pro_tier",
      name: "PRO",
      priceLabel: "₹1499",
      subtext: "0% commission enterprise model",
      isComingSoon: true,
      features: [
        { text: "Enterprise Workspace Suite", included: true },
        { text: "0% Commission on Orders", included: true },
        { text: "Maximum Fleet Routing Multipliers", included: true },
        { text: "24/7 VIP Dedicated Account Manager", included: true },
        { text: "API Integration Access Layer", included: true }
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
          onClick={fetchPlatformData}
          disabled={isLoading}
          className="h-9 px-3 gap-1.5 inline-flex items-center justify-center text-xs font-medium border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
        >
          <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          Refresh Stats
        </button>
      </div>

      {/* DYNAMIC SUBSCRIPTION BREAKDOWN CARDS MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* FREE Metrics Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">FREE Members (5%)</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : vendorMetrics.freeTierCount}</h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">Live commission contracts</p>
        </div>

        {/* BASIC Metrics Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-emerald-100 bg-emerald-50/5">
          <div>
            <p className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider">BASIC Members (0%)</p>
            <h3 className="text-2xl font-bold text-[#16A34A] mt-1">{isLoading ? "..." : vendorMetrics.basicTierCount}</h3>
          </div>
          <p className="text-xs text-[#16A34A] font-medium mt-3">Active fixed billing models</p>
        </div>

        {/* GROWTH Metrics Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-purple-100 bg-purple-50/5">
          <div>
            <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">GROWTH Members</p>
            <h3 className="text-2xl font-bold text-purple-700 mt-1">{isLoading ? "..." : vendorMetrics.growthTierCount}</h3>
          </div>
          <p className="text-xs text-purple-600 font-medium mt-3">Future expansion plan</p>
        </div>

        {/* PRO Metrics Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-amber-100 bg-amber-50/5">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">PRO Members</p>
            <h3 className="text-2xl font-bold text-amber-700 mt-1">{isLoading ? "..." : vendorMetrics.proTierCount}</h3>
          </div>
          <p className="text-xs text-amber-600 font-medium mt-3">Enterprise tier track</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
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
                <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-extrabold text-[#0F172A] tracking-tight">{plan.priceLabel}</span>
                  {!plan.isComingSoon && plan.priceLabel !== "FREE" && plan.priceLabel !== "₹0" && (
                    <span className="text-xs font-semibold text-[#64748B]">/ month</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#16A34A] mt-2 bg-[#F0FDF4] inline-block px-2 py-0.5 rounded-md border border-[#DCFCE7]">
                  {plan.subtext}
                </p>
              </div>

              <hr className="border-[#F1F5F9] my-4" />

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