import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Filter,
  CheckCircle,
  XCircle,
  PauseCircle,
  Edit,
  ShoppingCart,
  Crown,
  Star,
  MapPin,
  Trash2,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type VendorStatus = "approved" | "pending" | "suspended";

interface Vendor {
  id: string;
  name: string;
  category: string;
  location: string;
  status: VendorStatus;
  orders: number;
  rating: number;
  commission_rate: number;
  plan_type: string;
  joinedAt: string;
  email: string;
  phone: string;
  trial_start_date: string;
  trial_end_date: string;
  subscription_start_date: string;
  subscription_end_date: string;
  renewal_date: string;
}

const statusBadgeMap: Record<VendorStatus, { variant: "success" | "warning" | "error"; label: string }> = {
  approved: { variant: "success", label: "Approved" },
  pending: { variant: "warning", label: "Pending" },
  suspended: { variant: "error", label: "Suspended" }
};

const MVP_CATEGORIES = [
  { value: "grocery", label: "Grocery" },
  { value: "medical", label: "Medical" },
  { value: "pet_shop", label: "Pet Shop" },
  { value: "fruits_veg", label: "Fruits & Vegetables" },
  { value: "dairy", label: "Dairy" },
  { value: "general_store", label: "General Store" },
  { value: "household", label: "Household Essentials" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
];

const subscriptionBadgeMap: Record<string, "neutral" | "info" | "purple"> = {
  trial: "neutral",
  free: "info",
  premium: "purple",
};

function formatDisplayDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// 1. helper function: calculateDaysRemaining(endDate)
function calculateDaysRemaining(endDateString: string | null | undefined): { text: string; colorClass: string } {
  if (!endDateString) return { text: "-", colorClass: "text-[#64748B]" };
  const endDate = new Date(endDateString);
  if (isNaN(endDate.getTime())) return { text: "-", colorClass: "text-[#64748B]" };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: "Expired", colorClass: "text-[#EF4444] font-medium" };
  } else if (diffDays <= 7) {
    return { text: `${diffDays} days left`, colorClass: "text-[#EF4444] font-medium" };
  } else if (diffDays <= 15) {
    return { text: `${diffDays} days left`, colorClass: "text-[#F97316] font-medium" };
  } else {
    return { text: `${diffDays} days left`, colorClass: "text-[#22C55E] font-medium" };
  }
}

// 6. helper parser wrapper for table and list layouts
function renderExpiryInfo(vendor: Vendor): { text: string; colorClass: string } {
  const plan = vendor.plan_type.toLowerCase();
  if (plan === "free") {
    return { text: "No Expiry", colorClass: "text-[#64748B]" };
  }
  if (plan === "trial") {
    return calculateDaysRemaining(vendor.trial_end_date);
  }
  if (plan === "premium") {
    return calculateDaysRemaining(vendor.subscription_end_date);
  }
  return { text: "—", colorClass: "text-[#64748B]" };
}

function getPlanIndicator(vendor: Vendor): { label: string; variant: "neutral" | "info" | "purple" | "warning" | "error" | "success" } {
  const now = new Date();
  const plan = vendor.plan_type.toLowerCase();

  if (plan === "trial") {
    if (!vendor.trial_end_date) return { label: "Active Trial", variant: "neutral" };
    const end = new Date(vendor.trial_end_date);
    return now > end 
      ? { label: "Trial Expired", variant: "error" } 
      : { label: "Active Trial", variant: "neutral" };
  }

  if (plan === "free") {
    return { label: "Free Plan", variant: "info" };
  }

  if (plan === "premium") {
    if (!vendor.subscription_end_date) return { label: "Active Subscription", variant: "purple" };
    const end = new Date(vendor.subscription_end_date);
    
    if (now > end) {
      return { label: "Subscription Expired", variant: "error" };
    }
    
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(now.getDate() + 7);
    if (sevenDaysOut >= end) {
      return { label: "Expiring Soon", variant: "warning" };
    }
    
    return { label: "Active Premium", variant: "purple" };
  }

  return { label: vendor.plan_type.toUpperCase(), variant: "neutral" };
}

export function Vendors() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal toggles and form states
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formPlan, setFormPlan] = useState("trial");
  const [formStatus, setFormStatus] = useState<VendorStatus>("pending");
  const [formCommission, setFormCommission] = useState<number>(0);
  const [formTrialStartDate, setFormTrialStartDate] = useState("");
  const [formTrialEndDate, setFormTrialEndDate] = useState("");
  const [formSubStartDate, setFormSubStartDate] = useState("");
  const [formSubEndDate, setFormSubEndDate] = useState("");
  const [formRenewalDate, setFormRenewalDate] = useState("");

  const [selectedVendorForSub, setSelectedVendorForSub] = useState<Vendor | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const itemsPerPage = 10;

  async function fetchVendors() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select(`
          id, name, email, phone, address, category, status, plan_type, commission_rate, created_at, 
          trial_start_date, trial_end_date, subscription_start_date, subscription_end_date, renewal_date
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedVendors: Vendor[] = (data || []).map((row) => {
        const matchingCat = MVP_CATEGORIES.find(c => c.value === row.category);
        const categoryDisplay = matchingCat ? matchingCat.label : (row.category || "Uncategorized");

        return {
          id: row.id,
          name: row.name || "Unnamed Vendor",
          category: categoryDisplay,
          location: row.address || "No Location Listed",
          status: (row.status?.toLowerCase() as VendorStatus) || "pending",
          orders: 0,
          rating: 0,
          commission_rate: row.commission_rate ?? 0,
          plan_type: row.plan_type || "trial",
          trial_start_date: row.trial_start_date || "",
          trial_end_date: row.trial_end_date || "",
          subscription_start_date: row.subscription_start_date || "",
          subscription_end_date: row.subscription_end_date || "",
          renewal_date: row.renewal_date || "",
          joinedAt: formatDisplayDate(row.created_at),
          email: row.email || "—",
          phone: row.phone || "—",
        };
      });

      setVendorList(mappedVendors);
      
      if (viewVendor) {
        const updatedViewTarget = mappedVendors.find(v => v.id === viewVendor.id);
        setViewVendor(updatedViewTarget || null);
      }
    } catch (error) {
      console.error("Error fetching vendors from Supabase:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchVendors();
  }, []);

  function resetForm() {
    setFormName("");
    setFormCategory("");
    setFormEmail("");
    setFormPhone("");
    setFormLocation("");
    setFormPlan("trial");
    setFormStatus("pending");
    setFormCommission(0);
    setFormTrialStartDate("");
    setFormTrialEndDate("");
    setFormSubStartDate("");
    setFormSubEndDate("");
    setFormRenewalDate("");
  }

  function handleOpenEdit(vendor: Vendor) {
    const matchedCat = MVP_CATEGORIES.find(c => c.label === vendor.category);
    
    setFormName(vendor.name);
    setFormCategory(matchedCat ? matchedCat.value : "other");
    setFormEmail(vendor.email === "—" ? "" : vendor.email);
    setFormPhone(vendor.phone === "—" ? "" : vendor.phone);
    setFormLocation(vendor.location === "No Location Listed" ? "" : vendor.location);
    setFormPlan(vendor.plan_type);
    setFormStatus(vendor.status as VendorStatus);
    setFormCommission(vendor.commission_rate);
    setFormTrialStartDate(vendor.trial_start_date ? new Date(vendor.trial_start_date).toISOString().split('T')[0] : "");
    setFormTrialEndDate(vendor.trial_end_date ? new Date(vendor.trial_end_date).toISOString().split('T')[0] : "");
    setFormSubStartDate(vendor.subscription_start_date ? new Date(vendor.subscription_start_date).toISOString().split('T')[0] : "");
    setFormSubEndDate(vendor.subscription_end_date ? new Date(vendor.subscription_end_date).toISOString().split('T')[0] : "");
    setFormRenewalDate(vendor.renewal_date ? new Date(vendor.renewal_date).toISOString().split('T')[0] : "");
    setEditOpen(true);
  }

  function handleOpenSubscription(vendor: Vendor) {
    setSelectedVendorForSub(vendor);
    setFormPlan(vendor.plan_type);
    setFormCommission(vendor.commission_rate);
    setFormTrialStartDate(vendor.trial_start_date ? new Date(vendor.trial_start_date).toISOString().split('T')[0] : "");
    setFormTrialEndDate(vendor.trial_end_date ? new Date(vendor.trial_end_date).toISOString().split('T')[0] : "");
    setFormSubStartDate(vendor.subscription_start_date ? new Date(vendor.subscription_start_date).toISOString().split('T')[0] : "");
    setFormSubEndDate(vendor.subscription_end_date ? new Date(vendor.subscription_end_date).toISOString().split('T')[0] : "");
    setFormRenewalDate(vendor.renewal_date ? new Date(vendor.renewal_date).toISOString().split('T')[0] : "");
    setSubOpen(true);
  }

  async function handleAddVendor() {
    if (!formName || !formCategory || !formPhone) {
      alert("Business Name, Phone Number, and a Primary Category are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      let commissionRate = 0;
      let trialStart = null;
      let trialEnd = null;

      if (formPlan === "free") {
        commissionRate = 5;
      } else if (formPlan === "premium") {
        commissionRate = 0;
      } else if (formPlan === "trial") {
        commissionRate = 0;
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + 60);
        trialStart = start.toISOString();
        trialEnd = end.toISOString();
      }

      const newVendorPayload: any = {
        name: formName,
        category: formCategory,
        email: formEmail,
        phone: formPhone,
        address: formLocation,
        plan_type: formPlan,
        commission_rate: commissionRate,
        status: formStatus,
        trial_start_date: trialStart,
        trial_end_date: trialEnd,
        subscription_start_date: null,
        subscription_end_date: null,
        renewal_date: null
      };

      const { error } = await supabase.from("vendors").insert([newVendorPayload]);
      if (error) throw error;

      resetForm();
      setAddOpen(false);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to append vendor node:", error);
      alert("An error occurred while creating the vendor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditVendor() {
    if (!viewVendor) return;
    if (!formName || !formCategory || !formPhone) {
      alert("Business Name, Phone Number, and a Primary Category are required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const updatePayload: any = {
        name: formName,
        category: formCategory,
        email: formEmail,
        phone: formPhone,
        address: formLocation,
        plan_type: formPlan,
        commission_rate: Number(formCommission),
        status: formStatus,
        trial_start_date: formTrialStartDate ? new Date(formTrialStartDate).toISOString() : null,
        trial_end_date: formTrialEndDate ? new Date(formTrialEndDate).toISOString() : null,
        subscription_start_date: formSubStartDate ? new Date(formSubStartDate).toISOString() : null,
        subscription_end_date: formSubEndDate ? new Date(formSubEndDate).toISOString() : null,
        renewal_date: formRenewalDate ? new Date(formRenewalDate).toISOString() : null
      };

      console.log("UPDATE PAYLOAD", updatePayload);

      const { error } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", viewVendor.id);

      if (error) throw error;

      setEditOpen(false);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to update vendor dataset context:", error);
      alert("An error occurred while saving updating modifications.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteVendor(id: string, name: string) {
    const confirmation = window.confirm(`Are you absolutely sure you want to permanently delete "${name}"? This action cannot be undone.`);
    if (!confirmation) return;

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setEditOpen(false);
      setViewVendor(null);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to delete vendor record entry:", error);
      alert("An error occurred while attempting to delete this vendor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutatePlanDirectly(vendor: Vendor, targetPlan: "free" | "premium") {
    try {
      let updatePayload: any = { plan_type: targetPlan };
      const current = new Date();

      if (targetPlan === "free") {
        updatePayload.commission_rate = 5;
        updatePayload.subscription_start_date = null;
        updatePayload.subscription_end_date = null;
        updatePayload.renewal_date = null;
      } else if (targetPlan === "premium") {
        const future = new Date();
        future.setDate(current.getDate() + 30);
        
        updatePayload.commission_rate = 0;
        updatePayload.subscription_start_date = current.toISOString();
        updatePayload.subscription_end_date = future.toISOString();
        updatePayload.renewal_date = future.toISOString();
      }

      console.log("UPDATE PAYLOAD", updatePayload);

      const { error } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", vendor.id);

      if (error) throw error;
      await fetchVendors();
    } catch (error) {
      console.error("Direct plan mutation processing fault:", error);
      alert("Could not update plan configuration layout automatically.");
    }
  }

  async function renewPremiumSubscriptionDirectly(vendor: Vendor) {
    if (vendor.plan_type.toLowerCase() !== "premium") return;
    
    try {
      const anchorBase = vendor.subscription_end_date ? new Date(vendor.subscription_end_date) : new Date();
      const currentAnchor = anchorBase < new Date() ? new Date() : anchorBase;
      
      const nextExpiryWindow = new Date(currentAnchor);
      nextExpiryWindow.setDate(currentAnchor.getDate() + 30);

      const updatePayload = {
        subscription_start_date: currentAnchor.toISOString(),
        subscription_end_date: nextExpiryWindow.toISOString(),
        renewal_date: nextExpiryWindow.toISOString(),
        commission_rate: 0
      };

      console.log("UPDATE PAYLOAD", updatePayload);

      const { error } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", vendor.id);

      if (error) throw error;
      await fetchVendors();
    } catch (error) {
      console.error("Subscription renewal generation error:", error);
      alert("An error occurred trying to parse subscription increments.");
    }
  }

  async function handleUpdateSubscription() {
    if (!selectedVendorForSub) return;

    try {
      setIsSubmitting(true);

      const updatePayload: any = {
        plan_type: formPlan,
        commission_rate: Number(formCommission),
        trial_start_date: formPlan === "trial" && formTrialStartDate ? new Date(formTrialStartDate).toISOString() : null,
        trial_end_date: formPlan === "trial" && formTrialEndDate ? new Date(formTrialEndDate).toISOString() : null,
        subscription_start_date: formPlan === "premium" && formSubStartDate ? new Date(formSubStartDate).toISOString() : null,
        subscription_end_date: formPlan === "premium" && formSubEndDate ? new Date(formSubEndDate).toISOString() : null,
        renewal_date: formPlan === "premium" && formRenewalDate ? new Date(formRenewalDate).toISOString() : null,
      };

      console.log("UPDATE PAYLOAD", updatePayload);

      const { error } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", selectedVendorForSub.id);

      if (error) throw error;

      setSubOpen(false);
      setSelectedVendorForSub(null);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to sync subscription details:", error);
      alert("An error occurred while updating the subscription parameters.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateStatusDirectly(id: string, newStatus: VendorStatus) {
    const updatePayload = { status: newStatus };

    setVendorList((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
    if (viewVendor && viewVendor.id === id) {
      setViewVendor((prev) => prev ? { ...prev, status: newStatus } : null);
    }

    try {
      console.log("UPDATE PAYLOAD", updatePayload);

      const { error } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;
      await fetchVendors();
    } catch (error) {
      console.error("Failed status transaction change sync:", error);
    }
  }

  const filtered = vendorList.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.location.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description={`${vendorList.filter((v) => v.status === "approved").length} active vendors`}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => { resetForm(); setAddOpen(true); }}
          >
            Add Vendor
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "approved", "pending", "suspended"].map((s) => (
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
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button className="h-9 w-9 flex items-center justify-center border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
          <Filter className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl relative z-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide rounded-tl-xl">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Orders</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Plan Context</th>
              {/* 6. Modified Header View Marker text context label */}
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Renewal / Expiry Column</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Joined</th>
              <th className="px-4 py-3 rounded-tr-xl" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">
                  Loading vendors...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">
                  No vendors found
                </td>
              </tr>
            ) : (
              paginated.map((vendor, index) => {
                const badge = statusBadgeMap[vendor.status] || { variant: "neutral", label: vendor.status };
                const planIndicator = getPlanIndicator(vendor);
                const isLastRow = index === paginated.length - 1;
                // 5 & 6. Gather remaining days color context payload mappings
                const remainingDaysInfo = renderExpiryInfo(vendor);
                
                return (
                  <tr key={vendor.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className={cn("px-4 py-3.5", isLastRow && "rounded-bl-xl")}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-[#16A34A]">{vendor.name[0]}</span>
                        </div>
                        <div>
                          <button
                            onClick={() => setViewVendor(vendor)}
                            className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] transition-colors"
                          >
                            {vendor.name}
                          </button>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#94A3B8]" />
                            <span className="text-xs text-[#64748B]">{vendor.location}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-[#64748B] truncate max-w-[140px] block" title={vendor.category}>
                        {vendor.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={badge.variant} label={badge.label} dot />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-medium text-[#0F172A]">{vendor.orders.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={planIndicator.variant} label={planIndicator.label} />
                    </td>
                    {/* 6. Dynamic Table Column Data Target Insertion */}
                    <td className="px-4 py-3.5">
                      <span className={cn("text-sm", remainingDaysInfo.colorClass)}>
                        {remainingDaysInfo.text}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-[#64748B]">{vendor.joinedAt}</span>
                    </td>
                    <td className={cn("px-4 py-3.5 relative", isLastRow && "rounded-br-xl")}>
                      <Dropdown
                        align="right"
                        trigger={
                          <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        }
                        items={[
                          {
                            label: "View Details",
                            icon: <Edit className="w-3.5 h-3.5" />,
                            onClick: () => setViewVendor(vendor),
                          },
                          ...(vendor.status !== "approved" ? [{
                            label: "Approve Vendor",
                            icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
                            onClick: () => mutateStatusDirectly(vendor.id, "approved"),
                          }] : []),
                          
                          ...(vendor.status === "approved" ? [{
                            label: "Suspend Vendor",
                            icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
                            onClick: () => mutateStatusDirectly(vendor.id, "suspended"),
                            variant: "danger" as const
                          }] : []),

                          {
                            label: "Upgrade to Premium",
                            icon: <Crown className="w-3.5 h-3.5 text-amber-500" />,
                            onClick: () => mutatePlanDirectly(vendor, "premium"),
                            disabled: vendor.plan_type.toLowerCase() === "premium"
                          },
                          {
                            label: "Move to Free",
                            icon: <CheckCircle className="w-3.5 h-3.5 text-sky-500" />,
                            onClick: () => mutatePlanDirectly(vendor, "free"),
                            disabled: vendor.plan_type.toLowerCase() === "free"
                          },
                          {
                            label: "Renew Subscription",
                            icon: <Plus className="w-3.5 h-3.5 text-emerald-500" />,
                            onClick: () => renewPremiumSubscriptionDirectly(vendor),
                            disabled: vendor.plan_type.toLowerCase() !== "premium"
                          },
                          {
                            label: "View Orders",
                            icon: <ShoppingCart className="w-3.5 h-3.5" />,
                            onClick: () => {},
                          },
                          {
                            label: "Manage Subscription",
                            icon: <Crown className="w-3.5 h-3.5 text-purple-500" />,
                            onClick: () => handleOpenSubscription(vendor),
                          },
                          {
                            label: "Delete Permanent",
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            onClick: () => handleDeleteVendor(vendor.id, vendor.name),
                            variant: "danger" as const
                          }
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
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

      {/* Add Vendor Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Vendor"
        description="Onboard a new vendor to the Rivo platform."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleAddVendor} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Vendor"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Business Name *" 
              placeholder="e.g. Green Basket" 
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div>
              <Select
                label="Primary Category *"
                value={formCategory}
                onChange={(val: string) => setFormCategory(val)}
                options={MVP_CATEGORIES}
                placeholder="Select category"
              />
            </div>
          </div>
          <Input 
            label="Contact Email" 
            placeholder="ops@vendor.com" 
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />
          <Input 
            label="Phone Number *" 
            placeholder="+91 98765 43210" 
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
          />
          <Input 
            label="Location / Area" 
            placeholder="Koramangala, Bengaluru" 
            value={formLocation}
            onChange={(e) => setFormLocation(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Plan"
              value={formPlan}
              onChange={(val: string) => setFormPlan(val)}
              options={[
                { value: "trial", label: "Trial (2 Months)" },
                { value: "free", label: "Free (5% Commission)" },
                { value: "premium", label: "Premium (0% Commission)" },
              ]}
              placeholder="Select plan"
            />
            <Select
              label="Initial Review Status"
              value={formStatus}
              onChange={(val: string) => setFormStatus(val as VendorStatus)}
              options={[
                { value: "pending", label: "Pending Review" },
                { value: "approved", label: "Pre-Approved" },
              ]}
              placeholder="Select initial status"
            />
          </div>
        </div>
      </Modal>

      {/* View Vendor Details Modal */}
      {viewVendor && (
        <Modal
          open={!!viewVendor && !editOpen}
          onClose={() => setViewVendor(null)}
          title={viewVendor.name}
          description={`Vendor ID: ${viewVendor.id}`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="destructive" 
                leftIcon={<Trash2 className="w-3.5 h-3.5" />} 
                onClick={() => handleDeleteVendor(viewVendor.id, viewVendor.name)}
                disabled={isSubmitting}
              >
                Delete Vendor
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setViewVendor(null)}>Close</Button>
                <Button 
                  variant="primary" 
                  leftIcon={<Edit className="w-3.5 h-3.5" />} 
                  onClick={() => handleOpenEdit(viewVendor)}
                >
                  Edit Vendor
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* 2, 3 & 4. Dynamically provision display parameters conditionally matching vendor metrics */}
              {[
                { label: "Business Name", value: viewVendor.name },
                { label: "Primary Category", value: viewVendor.category },
                { label: "Phone", value: viewVendor.phone },
                { label: "Email", value: viewVendor.email },
                { label: "Address / Location", value: viewVendor.location },
                { label: "Created Date", value: viewVendor.joinedAt },
                { label: "Active Plan", value: viewVendor.plan_type.toUpperCase() },
                { label: "Commission Rate", value: `${viewVendor.commission_rate}%` },
                
                // 2. TRIAL-Specific fields conditional rendering check blocks
                ...(viewVendor.plan_type.toLowerCase() === "trial" ? [
                  { label: "Trial Start Date", value: formatDisplayDate(viewVendor.trial_start_date) },
                  { label: "Trial End Date", value: formatDisplayDate(viewVendor.trial_end_date) },
                  { 
                    label: "Trial Remaining", 
                    value: calculateDaysRemaining(viewVendor.trial_end_date).text,
                    isCustomColor: true,
                    colorClass: calculateDaysRemaining(viewVendor.trial_end_date).colorClass 
                  }
                ] : []),

                // 3. PREMIUM-Specific fields conditional rendering check blocks
                ...(viewVendor.plan_type.toLowerCase() === "premium" ? [
                  { label: "Subscription Start Date", value: formatDisplayDate(viewVendor.subscription_start_date) },
                  { label: "Subscription End Date", value: formatDisplayDate(viewVendor.subscription_end_date) },
                  { 
                    label: "Subscription Remaining", 
                    value: calculateDaysRemaining(viewVendor.subscription_end_date).text,
                    isCustomColor: true,
                    colorClass: calculateDaysRemaining(viewVendor.subscription_end_date).colorClass
                  }
                ] : []),

                // 4. FREE-Specific conditional display string injection
                ...(viewVendor.plan_type.toLowerCase() === "free" ? [
                  { label: "Plan Expiry Status", value: "No Expiry", isCustomColor: true, colorClass: "text-[#64748B]" }
                ] : []),

                { label: "Renewal Calendar Target", value: formatDisplayDate(viewVendor.renewal_date) },
              ].map((item: any) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#F1F5F9]">
                  <p className="text-xs text-[#64748B] mb-1 font-medium">{item.label}</p>
                  <p className={cn("text-sm font-semibold", item.isCustomColor ? item.colorClass : "text-[#0F172A]")}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg p-3 text-center">
                <p className="text-lg font-semibold text-[#16A34A]">{viewVendor.orders.toLocaleString()}</p>
                <p className="text-xs text-[#64748B]">Total Orders</p>
              </div>
              <div className="bg-[#FEF9C3] border border-[#FEF08A] rounded-lg p-3 text-center">
                <p className="text-lg font-semibold text-amber-700">{viewVendor.rating || "—"}</p>
                <p className="text-xs text-[#64748B]">Avg. Rating</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center flex flex-col justify-center items-center">
                <Badge 
                  variant={(statusBadgeMap[viewVendor.status] || statusBadgeMap.pending).variant} 
                  label={(statusBadgeMap[viewVendor.status] || statusBadgeMap.pending).label} 
                />
                <p className="text-xs text-[#64748B] mt-1">Status</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Vendor Modal */}
      {viewVendor && editOpen && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`Edit ${viewVendor.name}`}
          description="Update configuration records and operational overrides."
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="destructive" 
                leftIcon={<Trash2 className="w-3.5 h-3.5" />} 
                onClick={() => handleDeleteVendor(viewVendor.id, viewVendor.name)}
                disabled={isSubmitting}
              >
                Delete Permanent
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button variant="primary" onClick={handleEditVendor} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Business Name *" 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
              <Select
                label="Primary Category *"
                value={formCategory}
                onChange={(val: string) => setFormCategory(val)}
                options={MVP_CATEGORIES}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Contact Email" 
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
              <Input 
                label="Phone Number *" 
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <Input 
              label="Address / Location" 
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Subscription Plan"
                value={formPlan}
                onChange={(val: string) => {
                  setFormPlan(val);
                  if (val === "free") {
                    setFormCommission(5);
                    setFormSubStartDate(""); setFormSubEndDate(""); setFormRenewalDate("");
                  }
                  if (val === "premium") {
                    setFormCommission(0);
                    const now = new Date().toISOString().split('T')[0];
                    const future = new Date(); future.setDate(future.getDate() + 30);
                    setFormSubStartDate(now); setFormSubEndDate(future.toISOString().split('T')[0]);
                    setFormRenewalDate(future.toISOString().split('T')[0]);
                  }
                  if (val === "trial") {
                    setFormCommission(0);
                    const now = new Date().toISOString().split('T')[0];
                    const future = new Date(); future.setDate(future.getDate() + 60);
                    setFormTrialStartDate(now); setFormTrialEndDate(future.toISOString().split('T')[0]);
                  }
                }}
                options={[
                  { value: "trial", label: "Trial" },
                  { value: "free", label: "Free" },
                  { value: "premium", label: "Premium" },
                ]}
              />
              <Select
                label="Vendor Status"
                value={formStatus}
                onChange={(val: string) => setFormStatus(val as VendorStatus)}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "suspended", label: "Suspended" },
                ]}
              />
            </div>

            <div className="border-t border-dashed border-[#E2E8F0] my-2 pt-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Lifecycle Configuration Tracking</p>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Commission Rate (%)" 
                  type="number"
                  value={formCommission.toString()}
                  onChange={(e) => setFormCommission(parseFloat(e.target.value) || 0)}
                />
                <div />
                
                <Input label="Trial Start" type="date" value={formTrialStartDate} onChange={(e) => setFormTrialStartDate(e.target.value)} disabled={formPlan !== "trial"} />
                <Input label="Trial End" type="date" value={formTrialEndDate} onChange={(e) => setFormTrialEndDate(e.target.value)} disabled={formPlan !== "trial"} />
                
                <Input label="Premium Subscription Start" type="date" value={formSubStartDate} onChange={(e) => setFormSubStartDate(e.target.value)} disabled={formPlan !== "premium"} />
                <Input label="Premium Subscription End" type="date" value={formSubEndDate} onChange={(e) => setFormSubEndDate(e.target.value)} disabled={formPlan !== "premium"} />
                <Input label="Renewal Trigger Target" type="date" value={formRenewalDate} onChange={(e) => setFormRenewalDate(e.target.value)} disabled={formPlan !== "premium"} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Dedicated Manage Subscription Modal */}
      {selectedVendorForSub && subOpen && (
        <Modal
          open={subOpen}
          onClose={() => { setSubOpen(false); setSelectedVendorForSub(null); }}
          title={`Manage Subscription — ${selectedVendorForSub.name}`}
          description="Modify plan limits, tier levels, and commission rates."
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setSubOpen(false); setSelectedVendorForSub(null); }} disabled={isSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdateSubscription} disabled={isSubmitting}>
                {isSubmitting ? "Updating Plan..." : "Update Subscription"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] mb-0.5">Current Active Plan</p>
                <p className="text-sm font-semibold text-[#0F172A] capitalize">{selectedVendorForSub.plan_type}</p>
              </div>
              <Badge 
                variant={subscriptionBadgeMap[selectedVendorForSub.plan_type.toLowerCase()] || "neutral"} 
                label={selectedVendorForSub.plan_type.toUpperCase()} 
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Select
                label="Target Subscription Plan"
                value={formPlan}
                onChange={(val: string) => {
                  setFormPlan(val);
                  if (val === "free") {
                    setFormCommission(5);
                    setFormSubStartDate(""); setFormSubEndDate(""); setFormRenewalDate("");
                  }
                  if (val === "premium") {
                    setFormCommission(0);
                    const now = new Date().toISOString().split('T')[0];
                    const future = new Date(); future.setDate(future.getDate() + 30);
                    setFormSubStartDate(now); setFormSubEndDate(future.toISOString().split('T')[0]);
                    setFormRenewalDate(future.toISOString().split('T')[0]);
                  }
                  if (val === "trial") {
                    setFormCommission(0);
                    const now = new Date().toISOString().split('T')[0];
                    const future = new Date(); future.setDate(future.getDate() + 60);
                    setFormTrialStartDate(now); setFormTrialEndDate(future.toISOString().split('T')[0]);
                  }
                }}
                options={[
                  { value: "trial", label: "Trial (2 Months Window)" },
                  { value: "free", label: "Free (5% System Commission)" },
                  { value: "premium", label: "Premium (30-Day Active Cycle)" },
                ]}
              />
            </div>

            <div className="border-t border-dashed border-[#E2E8F0] mt-2 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Commission Override (%)" 
                  type="number"
                  value={formCommission.toString()}
                  onChange={(e) => setFormCommission(parseFloat(e.target.value) || 0)}
                />
                <div />
                
                <Input label="Trial Start" type="date" value={formTrialStartDate} onChange={(e) => setFormTrialStartDate(e.target.value)} disabled={formPlan !== "trial"} />
                <Input label="Trial End" type="date" value={formTrialEndDate} onChange={(e) => setFormTrialEndDate(e.target.value)} disabled={formPlan !== "trial"} />
                
                <Input label="Premium Subscription Start" type="date" value={formSubStartDate} onChange={(e) => setFormSubStartDate(e.target.value)} disabled={formPlan !== "premium"} />
                <Input label="Premium Subscription End" type="date" value={formSubEndDate} onChange={(e) => setFormSubEndDate(e.target.value)} disabled={formPlan !== "premium"} />
                <Input label="Renewal Trigger Target" type="date" value={formRenewalDate} onChange={(e) => setFormRenewalDate(e.target.value)} disabled={formPlan !== "premium"} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}