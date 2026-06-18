import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  IndianRupee, 
  Store, 
  Bike, 
  Users, 
  RefreshCcw, 
  XOctagon,
  ArrowRight,
  Activity,
  UserCheck,
  UserMinus
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

export function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    revenue: 0,
    activeVendors: 0,
    activeRiders: 0,       // Out delivering orders
    idleRiders: 0,         // At a shop, waiting for orders
    availableRiders: 0,    // Unassigned pool (can be assigned to shops)
    customers: 0,
    refundRate: 0,
    cancelRate: 0,
  });

  const [pendingActions, setPendingActions] = useState({
    vendorApprovals: 0,
    refundsAwaiting: 0,
    openSupport: 0,
    unpaidSettlements: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  async function fetchDashboardData() {
    try {
      setIsLoading(true);

      // 1. Fetch and process vendor counts
      const { data: vendors, error: vendorError } = await supabase
        .from("vendors")
        .select("status, plan_type, trial_end_date, subscription_end_date");

      if (vendorError) throw vendorError;

      const safeVendors = vendors || [];
      const now = new Date();

      const activeVendorsCount = safeVendors.filter((vendor) => {
        if (vendor.status !== "approved") return false;
        const plan = (vendor.plan_type || "").toLowerCase();
        if (plan === "trial") {
          if (!vendor.trial_end_date) return true;
          return new Date(vendor.trial_end_date) >= now;
        }
        if (plan === "premium") {
          if (!vendor.subscription_end_date) return true;
          return new Date(vendor.subscription_end_date) >= now;
        }
        return plan === "free";
      }).length;

      const pendingApprovalsCount = safeVendors.filter(v => v.status === "pending").length;

      // 2. Fetch riders and their multi-shop assignments mapping counters
      const { data: riders, error: ridersError } = await supabase
        .from("riders")
        .select("id, status");

      const { data: assignments, error: assignmentsError } = await supabase
        .from("rider_vendor_assignments")
        .select("rider_id");

      if (ridersError) throw ridersError;
      if (assignmentsError) throw assignmentsError;

      const safeRiders = riders || [];
      const assignedRiderIds = new Set((assignments || []).map(a => a.rider_id));

      let availablePoolCount = 0; 
      let idleWaitingCount = 0;    
      let activeDeliveringCount = 0;

      safeRiders.forEach((rider) => {
        const isAssignedToAShop = assignedRiderIds.has(rider.id);

        if (!isAssignedToAShop) {
          // 🟢 Available: Not assigned to any shop yet (can be deployed where needed)
          availablePoolCount++;
        } else {
          // Rider is attached to a shop fleet
          if (rider.status === "available") {
            // 🟡 Idle: Waiting at their assigned shop for an incoming order
            idleWaitingCount++;
          } else if (rider.status === "approved" || rider.status === "active") {
            // 🔴 Active: On the road delivering a live order right now
            activeDeliveringCount++;
          }
        }
      });

      // 3. Fetch live dynamic customer profiles total count
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id");

      if (customersError) throw customersError;

      setMetrics((prev) => ({
        ...prev,
        activeVendors: activeVendorsCount,
        activeRiders: activeDeliveringCount,
        idleRiders: idleWaitingCount,
        availableRiders: availablePoolCount,
        customers: customersData ? customersData.length : 0,
      }));

      setPendingActions((prev) => ({
        ...prev,
        vendorApprovals: pendingApprovalsCount,
      }));

    } catch (error) {
      console.error("Dashboard engine failed to sync metrics:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="text-sm text-[#64748B]">Real-time operational overview of the Rivo platform.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="h-9 px-3 gap-1.5 inline-flex items-center justify-center text-xs font-medium border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
        >
          <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Metrics Cards Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* Total Orders Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Total Orders</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{metrics.totalOrders}</h3>
            </div>
            <div className="w-8 h-8 bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg flex items-center justify-center text-[#2563EB]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">— vs last month</p>
        </div>

        {/* Revenue Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Revenue</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">₹{metrics.revenue}</h3>
            </div>
            <div className="w-8 h-8 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg flex items-center justify-center text-[#16A34A]">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">— vs last month</p>
        </div>

        {/* Active Vendors Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Active Vendors</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : metrics.activeVendors}</h3>
            </div>
            <div className="w-8 h-8 bg-[#F5F3FF] border border-[#EDE9FE] rounded-lg flex items-center justify-center text-[#7C3AED]">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">— vs last month</p>
        </div>

        {/* Active Riders Card (Delivering right now) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-rose-100 bg-rose-50/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Active Riders</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : metrics.activeRiders}</h3>
            </div>
            <div className="w-8 h-8 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center text-rose-600">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-rose-500 font-medium mt-3">Out delivering trips</p>
        </div>

        {/* Idle Riders Card (Assigned, waiting for orders) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-amber-100 bg-amber-50/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Idle Riders</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : metrics.idleRiders}</h3>
            </div>
            <div className="w-8 h-8 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center text-amber-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-amber-600 font-medium mt-3">At shop waiting for order</p>
        </div>

        {/* Available Riders Pool Card (Unassigned, can be assigned to shops) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between border-sky-100 bg-sky-50/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">Available Pool</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : metrics.availableRiders}</h3>
            </div>
            <div className="w-8 h-8 bg-sky-50 border border-sky-100 rounded-lg flex items-center justify-center text-sky-600">
              <UserMinus className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-sky-500 font-medium mt-3">Ready to assign to shops</p>
        </div>

        {/* Customers Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Customers</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{isLoading ? "..." : metrics.customers}</h3>
            </div>
            <div className="w-8 h-8 bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg flex items-center justify-center text-[#2563EB]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">Live verified profiles</p>
        </div>
      </div>

      {/* Grid Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between min-h-[380px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#64748B]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">Recent Fleet Logs</h3>
            </div>
            <button className="text-xs font-semibold text-[#22C55E] hover:text-[#16A34A] flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-10 h-10 rounded-full bg-[#F8FAFC] flex items-center justify-center text-[#94A3B8] mb-3">
              <Activity className="w-5 h-5 stroke-[1.5]" />
            </div>
            <p className="text-sm font-medium text-[#475569]">No activity records logged</p>
            <p className="text-xs text-[#94A3B8] max-w-xs mt-1">Operational updates will show up here as actions occur across the platform.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Pending Actions</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#F8FAFC]">
                <span className="text-xs font-medium text-[#475569]">Vendor approvals pending</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-md border",
                  pendingActions.vendorApprovals > 0 ? "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]" : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"
                )}>
                  {isLoading ? "..." : pendingActions.vendorApprovals}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}