import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Edit,
  Crown,
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

interface Category {
  id: string;
  name: string;
  requires_drug_license?: boolean;
}

interface Vendor {
  id: string;
  shop_name: string;
  owner_name: string;
  email: string;
  phone: string;
  shop_code: string;
  status: VendorStatus;
  store_status: string; // Dynamic field mapped from vendor_profiles join
  joinedAt: string;
  created_at: string;
  category_id: string;
  category_name: string;
  
  // Subscriptions Table Mapped Fields
  plan_name: "free" | "basic" | "growth" | "pro";
  commission_percent: number;
  start_date: string;
  end_date: string;
  sub_status: string;
  is_trial?: boolean;
  
  // Drug license profile mappings
  drug_license?: string | null;
  drug_license_expiry?: string | null;
}

const statusBadgeMap: Record<VendorStatus, { variant: "success" | "warning" | "error"; label: string }> = {
  approved: { variant: "success", label: "Approved" },
  pending: { variant: "warning", label: "Pending" },
  suspended: { variant: "error", label: "Suspended" }
};

const operationalBadgeMap: Record<string, { variant: "success" | "warning" | "error" | "neutral"; label: string }> = {
  open: { variant: "success", label: "Open" },
  closed: { variant: "error", label: "Closed" },
  busy: { variant: "warning", label: "Busy" }
};

export const PLAN_CONFIG = {
  free: {
    label: "FREE",
    commission: 5,
    durationDays: null,
    variant: "neutral" as const // Gray
  },
  basic: {
    label: "BASIC",
    commission: 0,
    durationDays: 30,
    variant: "info" as const // Blue
  },
  growth: {
    label: "GROWTH",
    commission: 0,
    durationDays: 30,
    variant: "purple" as const // Purple
  },
  pro: {
    label: "PRO",
    commission: 0,
    durationDays: 30,
    variant: "warning" as const // Gold
  }
};

function getPlanDisplayLabel(planName: string, isTrial?: boolean): string {
  if (isTrial) return "🟢 BASIC TRIAL";
  const normalized = (planName || "").toLowerCase();
  if (normalized === "499") return "BASIC";
  if (normalized === "free") return "FREE";
  return normalized.toUpperCase();
}

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

export function Vendors() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Vendor Form States
  const [formShopName, setFormShopName] = useState("");
  const [formOwnerName, setFormOwnerName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formShopCode, setFormShopCode] = useState("");
  const [formStatus, setFormStatus] = useState<VendorStatus>("pending");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDrugLicense, setFormDrugLicense] = useState("");
  const [formDrugLicenseExpiry, setFormDrugLicenseExpiry] = useState("");
  
  // Subscription Form States
  const [formPlan, setFormPlan] = useState<keyof typeof PLAN_CONFIG>("free");
  const [formCommission, setFormCommission] = useState<number>(5);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formSubStatus, setFormSubStatus] = useState("active");

  const [selectedVendorForSub, setSelectedVendorForSub] = useState<Vendor | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const itemsPerPage = 10;

  const selectedCategory = categories.find(cat => cat.id === formCategoryId);
  const isDrugLicenseRequired = !!selectedCategory?.requires_drug_license;

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, requires_drug_license")
        .eq("status", "active")
        .order("display_order");
      if (!error && data) {
        setCategories(data);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function fetchVendors() {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from("vendors")
        .select(`
          id,
          shop_name,
          owner_name,
          email,
          phone,
          shop_code,
          status,
          created_at,
          category_id,
          product_categories (
            name
          ),
          subscriptions (
            id,
            plan_name,
            commission_percent,
            start_date,
            end_date,
            status,
            is_trial,
            created_at
          ),
          vendor_profiles (
            store_status,
            drug_license,
            drug_license_expiry
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedVendors: Vendor[] = (data || []).map((row: any) => {
        let sub = null;
        if (row.subscriptions) {
          if (Array.isArray(row.subscriptions)) {
            const activeSubs = row.subscriptions.filter((s: any) => s && s.status === "active");
            if (activeSubs.length > 0) {
              sub = activeSubs.sort((a: any, b: any) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateB - dateA;
              })[0];
            } else if (row.subscriptions.length > 0) {
              sub = row.subscriptions.sort((a: any, b: any) => {
                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                return dateB - dateA;
              })[0];
            }
          } else {
            sub = row.subscriptions;
          }
        }

        let rawPlanName = (sub?.plan_name || "").toLowerCase();
        if (rawPlanName === "499") rawPlanName = "basic";
        if (rawPlanName === "free" || !rawPlanName) rawPlanName = "free";

        const profileObj = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
        
        return {
          id: row.id,
          shop_name: row.shop_name || "Unnamed Shop",
          owner_name: row.owner_name || "Anonymous Owner",
          email: row.email || "—",
          phone: row.phone || "—",
          shop_code: row.shop_code || "—",
          status: (row.status?.toLowerCase() as VendorStatus) || "pending",
          store_status: profileObj?.store_status || "closed",
          joinedAt: formatDisplayDate(row.created_at),
          created_at: row.created_at || "",
          category_id: row.category_id || "",
          category_name: row.product_categories?.name || "—",
          
          plan_name: rawPlanName as "free" | "basic" | "growth" | "pro",
          commission_percent: sub ? (sub.commission_percent ?? 5) : 5,
          start_date: sub?.start_date || "",
          end_date: sub?.end_date || "",
          sub_status: sub?.status || "active",
          is_trial: sub ? !!sub.is_trial : false,
          
          drug_license: profileObj?.drug_license || null,
          drug_license_expiry: profileObj?.drug_license_expiry || null
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
    fetchCategories();
    fetchVendors();
  }, []);

  function resetForm() {
    setFormShopName("");
    setFormOwnerName("");
    setFormEmail("");
    setFormPhone("");
    setFormShopCode("");
    setFormStatus("pending");
    setFormCategoryId("");
    setFormDrugLicense("");
    setFormDrugLicenseExpiry("");
    setFormPlan("free");
    setFormCommission(PLAN_CONFIG.free.commission);
    setFormStartDate("");
    setFormEndDate("");
    setFormSubStatus("active");
  }

  function handleOpenEdit(vendor: Vendor) {
    setFormShopName(vendor.shop_name);
    setFormOwnerName(vendor.owner_name);
    setFormEmail(vendor.email === "—" ? "" : vendor.email);
    setFormPhone(vendor.phone === "—" ? "" : vendor.phone);
    setFormShopCode(vendor.shop_code === "—" ? "" : vendor.shop_code);
    setFormStatus(vendor.status as VendorStatus);
    setFormCategoryId(vendor.category_id);
    setFormDrugLicense(vendor.drug_license || "");
    setFormDrugLicenseExpiry(vendor.drug_license_expiry || "");
    setEditOpen(true);
  }

  function handleOpenSubscription(vendor: Vendor) {
    setSelectedVendorForSub(vendor);
    
    let currentPlanKey = (vendor.plan_name || "free").toLowerCase() as keyof typeof PLAN_CONFIG;
    if (currentPlanKey as string === "499") currentPlanKey = "basic";
    
    setFormPlan(currentPlanKey);
    setFormCommission(vendor.commission_percent);
    setFormStartDate(vendor.start_date ? new Date(vendor.start_date).toISOString().split('T')[0] : "");
    setFormEndDate(vendor.end_date ? new Date(vendor.end_date).toISOString().split('T')[0] : "");
    setFormSubStatus(vendor.sub_status || "active");
    
    setSubOpen(true);
  }

  function applySubscriptionPlanRules(plan: keyof typeof PLAN_CONFIG, customStartDate?: string) {
    if (plan === "growth" || plan === "pro") return;
    setFormPlan(plan);
    const config = PLAN_CONFIG[plan];
    setFormCommission(config.commission);

    if (config.durationDays === null) {
      setFormStartDate("");
      setFormEndDate("");
    } else {
      const current = customStartDate ? new Date(customStartDate) : new Date();
      setFormStartDate(current.toISOString().split("T")[0]);
      
      const future = new Date(current);
      future.setDate(future.getDate() + config.durationDays);
      setFormEndDate(future.toISOString().split("T")[0]);
    }
  }

  async function handleAddVendor() {
    if (!formShopName || !formOwnerName || !formPhone) {
      alert("Shop Name, Owner Name, and Phone Number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const autoGeneratedShopCode = `RIVO-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const newVendorPayload = {
        shop_name: formShopName,
        owner_name: formOwnerName,
        email: formEmail,
        phone: formPhone,
        shop_code: autoGeneratedShopCode,
        status: formStatus,
        category_id: formCategoryId || null,
      };

      const { data: insertedVendor, error: vendorError } = await supabase
        .from("vendors")
        .insert([newVendorPayload])
        .select()
        .single();

      if (vendorError) throw vendorError;

      // Seed Vendor Profile Row structure with dynamic drug license state logic
      const vendorProfilePayload = {
        vendor_id: insertedVendor.id,
        store_status: "closed",
        drug_license: isDrugLicenseRequired ? (formDrugLicense || null) : null,
        drug_license_expiry: isDrugLicenseRequired ? (formDrugLicenseExpiry || null) : null
      };

      const { error: profileError } = await supabase
        .from("vendor_profiles")
        .insert([vendorProfilePayload]);

      if (profileError) throw profileError;

      let finalStart = null;
      let finalEnd = null;
      const targetConfig = PLAN_CONFIG[formPlan];

      if (targetConfig.durationDays !== null) {
        const baseDate = formStartDate ? new Date(formStartDate) : new Date();
        finalStart = baseDate.toISOString();
        const endDateObj = new Date(baseDate);
        endDateObj.setDate(endDateObj.getDate() + targetConfig.durationDays);
        finalEnd = endDateObj.toISOString();
      }

      const subPayload = {
        vendor_id: insertedVendor.id,
        plan_name: formPlan,
        commission_percent: targetConfig.commission,
        start_date: finalStart,
        end_date: finalEnd,
        status: formSubStatus
      };

      const { error: subError } = await supabase.from("subscriptions").insert([subPayload]);
      if (subError) throw subError;

      resetForm();
      setAddOpen(false);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to add vendor node:", error);
      alert("An error occurred while creating the vendor profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditVendor() {
    if (!viewVendor) return;
    if (!formShopName || !formOwnerName || !formPhone) {
      alert("Shop Name, Owner Name, and Phone Number are required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const updatePayload = {
        shop_name: formShopName,
        owner_name: formOwnerName,
        email: formEmail,
        phone: formPhone,
        shop_code: formShopCode,
        status: formStatus,
        category_id: formCategoryId || null,
      };

      const { error: vendorError } = await supabase
        .from("vendors")
        .update(updatePayload)
        .eq("id", viewVendor.id);

      if (vendorError) throw vendorError;

      const profileUpdatePayload = {
        drug_license: isDrugLicenseRequired ? (formDrugLicense || null) : null,
        drug_license_expiry: isDrugLicenseRequired ? (formDrugLicenseExpiry || null) : null
      };

      const { error: profileError } = await supabase
        .from("vendor_profiles")
        .update(profileUpdatePayload)
        .eq("vendor_id", viewVendor.id);

      if (profileError) throw profileError;

      setEditOpen(false);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to update vendor context:", error);
      alert("An error occurred while saving profile modifications.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSubscription() {
    if (!selectedVendorForSub) return;

    try {
      setIsSubmitting(true);

      const currentConfig = PLAN_CONFIG[formPlan];
      let isoStart = null;
      let isoEnd = null;

      if (currentConfig.durationDays !== null) {
        const dStart = formStartDate ? new Date(formStartDate) : new Date();
        isoStart = dStart.toISOString();
        const dEnd = new Date(dStart);
        dEnd.setDate(dEnd.getDate() + currentConfig.durationDays);
        isoEnd = dEnd.toISOString();
      }

      const subPayload = {
        vendor_id: selectedVendorForSub.id,
        plan_name: formPlan,
        commission_percent: currentConfig.commission,
        start_date: isoStart,
        end_date: isoEnd,
        status: formSubStatus
      };

      const { data: existingSubs } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("vendor_id", selectedVendorForSub.id);

      if (existingSubs && existingSubs.length > 0) {
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update(subPayload)
          .eq("id", existingSubs[0].id);

        if (updateError) throw updateError;

        if (existingSubs.length > 1) {
          const duplicateIds = existingSubs.slice(1).map(s => s.id);
          await supabase.from("subscriptions").delete().in("id", duplicateIds);
        }
      } else {
        const { error: insertError } = await supabase
          .from("subscriptions")
          .insert([subPayload]);

        if (insertError) throw insertError;
      }

      setSubOpen(false);
      setSelectedVendorForSub(null);
      await fetchVendors();
    } catch (error: any) {
      console.error("CRITICAL SUBSCRIPTION TRANSACTION FAULT:", error);
      alert(`Save Failed: ${error?.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function renewPremiumSubscriptionDirectly(vendor: Vendor) {
    if (vendor.plan_name === "free") return;
    
    try {
      const anchorBase = vendor.end_date ? new Date(vendor.end_date) : new Date();
      const currentAnchor = anchorBase < new Date() ? new Date() : anchorBase;
      
      const targetConfig = PLAN_CONFIG[vendor.plan_name];
      const nextExpiryWindow = new Date(currentAnchor);
      
      if (targetConfig.durationDays !== null) {
        nextExpiryWindow.setDate(currentAnchor.getDate() + targetConfig.durationDays);
      }

      const { data: existingSubs } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("vendor_id", vendor.id);

      if (!existingSubs || existingSubs.length === 0) return;

      const updatePayload = {
        start_date: currentAnchor.toISOString(),
        end_date: nextExpiryWindow.toISOString(),
        status: "active",
        commission_percent: targetConfig.commission
      };

      const { error } = await supabase
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", existingSubs[0].id);

      if (error) throw error;
      await fetchVendors();
    } catch (error) {
      console.error("Subscription renewal failure context:", error);
    }
  }

  async function handleDeleteVendor(id: string, name: string) {
    const confirmation = window.confirm(`Are you absolutely sure you want to permanently delete "${name}"?`);
    if (!confirmation) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw error;

      setEditOpen(false);
      setViewVendor(null);
      await fetchVendors();
    } catch (error) {
      console.error("Failed to delete record:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateStatusDirectly(id: string, newStatus: VendorStatus) {
    try {
      const { error: vendorError } = await supabase
        .from("vendors")
        .update({ status: newStatus })
        .eq("id", id);
        
      if (vendorError) throw vendorError;

      if (newStatus === "approved") {
        const { data: existingSub, error: checkSubError } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("vendor_id", id);

        if (checkSubError) throw checkSubError;

        if (!existingSub || existingSub.length === 0) {
          const now = new Date();
          const future = new Date();
          future.setDate(now.getDate() + PLAN_CONFIG.basic.durationDays);

          const autoSubPayload: any = {
            vendor_id: id,
            plan_name: "basic",
            plan_code: "BASIC",
            commission_percent: 0,
            is_trial: true,
            start_date: now.toISOString(),
            end_date: future.toISOString(),
            status: "active"
          };

          const { error: autoSubInsertError } = await supabase
            .from("subscriptions")
            .insert([autoSubPayload]);

          if (autoSubInsertError) throw autoSubInsertError;
        }
      }

      await fetchVendors();
    } catch (error) {
      console.error("Failed status transaction change update:", error);
    }
  }

  const filtered = vendorList.filter((v) => {
    const matchSearch =
      v.shop_name.toLowerCase().includes(search.toLowerCase()) ||
      v.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      v.shop_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description={`${vendorList.filter((v) => v.status === "approved").length} approved merchants listed`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => { resetForm(); applySubscriptionPlanRules("free"); setAddOpen(true); }}
          >
            Add Vendor
          </Button>
        }
      />

      {/* Filters Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shops, owners, codes..."
            className="w-full h-9 pl-9 pr-3 bg-white border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "approved", "pending", "suspended"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium capitalize transition-all",
                statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dataset Table View */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl relative z-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Shop Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Shop Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Approval Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Operational Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Subscription Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Subscription End Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Joined Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-16 text-sm text-[#94A3B8]">Loading operational records...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-16 text-sm text-[#94A3B8]">No system vendor profiles matched.</td></tr>
            ) : (
              paginated.map((vendor) => {
                const approvalBadge = statusBadgeMap[vendor.status] || { variant: "neutral", label: vendor.status };
                const operationalBadge = operationalBadgeMap[vendor.store_status] || { variant: "neutral", label: vendor.store_status };
                const configMatch = PLAN_CONFIG[vendor.plan_name] || PLAN_CONFIG.free;
                
                return (
                  <tr key={vendor.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3.5 font-medium text-[#0F172A]">
                      <button onClick={() => setViewVendor(vendor)} className="hover:text-[#22C55E] text-left">
                        {vendor.shop_name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#334155]">{vendor.owner_name}</td>
                    <td className="px-4 py-3.5 text-sm text-[#334155]">{vendor.category_name}</td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#475569]">{vendor.shop_code}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={approvalBadge.variant} label={approvalBadge.label} dot />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={operationalBadge.variant} label={operationalBadge.label} dot />
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={configMatch.variant} label={getPlanDisplayLabel(vendor.plan_name, vendor.is_trial)} />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#475569]">
                      {vendor.end_date ? formatDisplayDate(vendor.end_date) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">{vendor.joinedAt}</td>
                    <td className="px-4 py-3.5 relative">
                      <Dropdown
                        align="right"
                        trigger={
                          <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        }
                        items={[
                          { label: "View Details", icon: <Edit className="w-3.5 h-3.5" />, onClick: () => setViewVendor(vendor) },
                          ...(vendor.status !== "approved" ? [{ label: "Approve Vendor", icon: <Edit className="w-3.5 h-3.5 text-emerald-500" />, onClick: () => mutateStatusDirectly(vendor.id, "approved") }] : []),
                          ...(vendor.status === "approved" ? [{ label: "Suspend Vendor", icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />, onClick: () => mutateStatusDirectly(vendor.id, "suspended"), variant: "danger" as const }] : []),
                          { label: "Renew Subscription", icon: <Plus className="w-3.5 h-3.5 text-emerald-500" />, onClick: () => renewPremiumSubscriptionDirectly(vendor), disabled: vendor.plan_name === "free" },
                          { label: "Manage Plan", icon: <Crown className="w-3.5 h-3.5 text-purple-500" />, onClick: () => handleOpenSubscription(vendor) },
                          { label: "Delete Vendor", icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => handleDeleteVendor(vendor.id, vendor.shop_name), variant: "danger" as const }
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {/* Add Vendor Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Vendor"
        description="Onboard a new vendor mapping record reference configuration manually."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleAddVendor} disabled={isSubmitting}>Add Vendor</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Shop Name *" placeholder="Green Basket Market" value={formShopName} onChange={(e) => setFormShopName(e.target.value)} />
            <Input label="Owner Full Name *" placeholder="John Doe" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Email" placeholder="ops@vendor.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <Input label="Phone Number *" placeholder="+91 98765 43210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Store Category"
              value={formCategoryId}
              onChange={(val: string) => setFormCategoryId(val)}
              options={[
                { value: "", label: "Select a Category" },
                ...categories.map(cat => ({ value: cat.id, label: cat.name }))
              ]}
            />
            <Select
              label="Initial Status"
              value={formStatus}
              onChange={(val: string) => setFormStatus(val as VendorStatus)}
              options={[
                { value: "pending", label: "Pending Review" },
                { value: "approved", label: "Pre-Approved" },
              ]}
            />
          </div>

          {isDrugLicenseRequired && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Drug Licence Number" placeholder="e.g. DL-12345" value={formDrugLicense} onChange={(e) => setFormDrugLicense(e.target.value)} />
              <Input label="Drug Licence Expiry Date" type="date" value={formDrugLicenseExpiry} onChange={(e) => setFormDrugLicenseExpiry(e.target.value)} />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Plan Type"
              value={formPlan}
              onChange={(val: string) => applySubscriptionPlanRules(val as keyof typeof PLAN_CONFIG)}
              options={[
                { value: "free", label: "FREE" },
                { value: "basic", label: "BASIC" },
                { value: "growth", label: "GROWTH (Coming Soon)" },
                { value: "pro", label: "PRO (Coming Soon)" },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* View Details Inspection Modal Window Layout */}
      {viewVendor && (
        <Modal
          open={!!viewVendor && !editOpen}
          onClose={() => setViewVendor(null)}
          title={viewVendor.shop_name}
          description={`Vendor Resource Identifier Token: ${viewVendor.id}`}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => setViewVendor(null)}>Close</Button>
              <Button variant="primary" onClick={() => handleOpenEdit(viewVendor)}>Edit Vendor</Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Shop Name", value: viewVendor.shop_name },
              { label: "Owner Name", value: viewVendor.owner_name },
              { label: "Store Category", value: viewVendor.category_name },
              { label: "Phone Connection", value: viewVendor.phone },
              { label: "Email Address", value: viewVendor.email },
              { label: "Shop Code ID Mapping", value: viewVendor.shop_code },
              { label: "Initialization Timestamp", value: viewVendor.joinedAt },
              { label: "Active Subscription Plan", value: getPlanDisplayLabel(viewVendor.plan_name, viewVendor.is_trial) },
              { label: "Commission Factor Value", value: `${viewVendor.commission_percent}%` },
              { label: "Subscription Interval Start", value: formatDisplayDate(viewVendor.start_date) },
              { label: "Subscription Interval End", value: formatDisplayDate(viewVendor.end_date) },
              { label: "Sub Track State Record", value: viewVendor.sub_status.toUpperCase() },
              { label: "Account State Approval Status", value: viewVendor.status.toUpperCase() },
              { label: "Operational Status", value: viewVendor.store_status.toUpperCase() },
              ...(viewVendor.drug_license ? [{ label: "Drug Licence Number", value: viewVendor.drug_license }] : []),
              ...(viewVendor.drug_license_expiry ? [{ label: "Drug Licence Expiry", value: formatDisplayDate(viewVendor.drug_license_expiry) }] : []),
            ].map((item) => (
              <div key={item.label} className="bg-[#F8FAFC] p-3 border rounded-lg">
                <p className="text-xs text-[#64748B] font-medium mb-0.5">{item.label}</p>
                <p className="font-semibold text-[#0F172A]">{item.value}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Edit Vendor Form Modification Overlay */}
      {viewVendor && editOpen && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`Edit Profile — ${viewVendor.shop_name}`}
          size="md"
          footer={
            <div className="flex justify-between items-center w-full">
              <Button variant="destructive" onClick={() => handleDeleteVendor(viewVendor.id, viewVendor.shop_name)} disabled={isSubmitting}>Delete Vendor</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleEditVendor} disabled={isSubmitting}>Save Modifications</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Shop Name *" value={formShopName} onChange={(e) => setFormShopName(e.target.value)} />
              <Input label="Owner Name *" value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contact Email Address" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              <Input label="Phone Connection Line *" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Shop Registration Code String Value" value={formShopCode} onChange={(e) => setFormShopCode(e.target.value)} disabled />
              <Select
                label="Store Category"
                value={formCategoryId}
                onChange={(val: string) => setFormCategoryId(val)}
                options={[
                  { value: "", label: "Select a Category" },
                  ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                ]}
              />
            </div>

            {isDrugLicenseRequired && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Drug Licence Number" value={formDrugLicense} onChange={(e) => setFormDrugLicense(e.target.value)} />
                <Input label="Drug Licence Expiry Date" type="date" value={formDrugLicenseExpiry} onChange={(e) => setFormDrugLicenseExpiry(e.target.value)} />
              </div>
            )}

            <Select
              label="System Clearance Status Level Enforced"
              value={formStatus}
              onChange={(val: string) => setFormStatus(val as VendorStatus)}
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </div>
        </Modal>
      )}

      {/* Dedicated Subscriptions Management Modal */}
      {selectedVendorForSub && subOpen && (
        <Modal
          open={subOpen}
          onClose={() => { setSubOpen(false); setSelectedVendorForSub(null); }}
          title={`Manage Subscription — ${selectedVendorForSub.shop_name}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setSubOpen(false); setSelectedVendorForSub(null); }} disabled={isSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdateSubscription} disabled={isSubmitting}>Update Subscription</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Plan"
              value={formPlan}
              onChange={(val: string) => applySubscriptionPlanRules(val as keyof typeof PLAN_CONFIG, formStartDate || undefined)}
              options={[
                { value: "free", label: "FREE" },
                { value: "basic", label: "BASIC" },
                { value: "growth", label: "GROWTH (Coming Soon)" },
                { value: "pro", label: "PRO (Coming Soon)" },
              ]}
            />
            
            <Input 
              label="Commission %" 
              type="number" 
              value={formCommission.toString()} 
              disabled 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Start Date" 
                type="date" 
                value={formStartDate} 
                onChange={(e) => applySubscriptionPlanRules(formPlan, e.target.value)}
                disabled={formPlan === "free"} 
              />
              <Input 
                label="End Date" 
                type="date" 
                value={formEndDate} 
                disabled 
              />
            </div>

            <Select
              label="Status"
              value={formSubStatus}
              onChange={(val: string) => setFormSubStatus(val)}
              options={[
                { value: "active", label: "active" },
                { value: "expired", label: "expired" },
              ]}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}