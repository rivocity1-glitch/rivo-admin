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
  MapPin,
  Trash2,
  Star,
  Store,
  X,
  UserCheck
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

// 🔵 Added 'available' status to model onboarding state profiles
type RiderStatus = "approved" | "pending" | "suspended" | "paused" | "available";
type VehicleType = "bicycle" | "bike" | "scooter" | "electric_scooter";

interface Rider {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_number: string;
  status: RiderStatus;
  location_area: string;
  orders_completed: number;
  rating: number;
  joinedAt: string;
  assigned_vendors: { id: string; name: string }[];
}

interface VendorOption {
  value: string;
  label: string;
}

// 🔵 Status badge mapping handles the 'available' variant cleanly
const statusBadgeMap: Record<RiderStatus, { variant: "success" | "warning" | "error" | "neutral" | "info"; label: string }> = {
  approved: { variant: "success", label: "Active" },
  available: { variant: "info", label: "Available" },
  pending: { variant: "warning", label: "Pending" },
  suspended: { variant: "error", label: "Suspended" },
  paused: { variant: "neutral", label: "Offline" },
};

const vehicleLabelMap: Record<VehicleType, string> = {
  bicycle: "Bicycle",
  bike: "Motorcycle",
  scooter: "Scooter",
  electric_scooter: "EV Scooter",
};

export function Riders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [riderList, setRiderList] = useState<Rider[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals Visibility
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewRider, setViewRider] = useState<Rider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Controls
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formVehicleType, setFormVehicleType] = useState<VehicleType>("bike");
  const [formVehicleNumber, setFormVehicleNumber] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStatus, setFormStatus] = useState<RiderStatus>("pending");
  const [formVendors, setFormVendors] = useState<{ id: string; name: string }[]>([]);

  const itemsPerPage = 10;

  async function fetchVendorOptions() {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setVendorOptions((data || []).map(v => ({ value: v.id, label: v.name || "Unnamed Shop" })));
    } catch (err) {
      console.error("Failed parsing vendor options layout:", err);
    }
  }

  async function fetchRiders() {
    try {
      setIsLoading(true);
      
      // 1. Fetch riders raw dataset
      const { data: ridersData, error: ridersError } = await supabase
        .from("riders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ridersError) throw ridersError;

      // 2. Pull relational junction table parameters via explicit foreign key column mapping syntax
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("rider_vendor_assignments")
        .select("rider_id, vendor_id, vendors:vendor_id(name)"); // 🟢 Plural relation error resolve hook

      if (assignmentsError) throw assignmentsError;

      const mapped: Rider[] = (ridersData || []).map((row) => {
        const matchedAssignments = (assignmentsData || [])
          .filter((a) => a.rider_id === row.id && a.vendors)
          .map((a: any) => ({ id: a.vendor_id, name: a.vendors.name }));

        return {
          id: row.id,
          name: row.name || "Unnamed Rider",
          email: row.email || "—",
          phone: row.phone || "—",
          vehicle_type: (row.vehicle_type as VehicleType) || "bike",
          vehicle_number: row.vehicle_number || "—",
          status: (row.status as RiderStatus) || "pending",
          location_area: row.location_area || "No Area Listed",
          orders_completed: row.orders_completed || 0,
          rating: row.rating || 5.0,
          assigned_vendors: matchedAssignments,
          joinedAt: row.created_at
            ? new Date(row.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—",
        };
      });

      setRiderList(mapped);

      if (viewRider) {
        const freshTarget = mapped.find((r) => r.id === viewRider.id);
        if (freshTarget) setViewRider(freshTarget);
      }
    } catch (err) {
      console.error("Failed fleet datastream construction mapping:", err);
    } finally { // 🟢 Keyword loop structural compile error fixed
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchVendorOptions();
    fetchRiders();
  }, []);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormVehicleType("bike");
    setFormVehicleNumber("");
    setFormLocation("");
    setFormStatus("available"); // Defaults new verified onboarding entries as available
    setFormVendors([]);
  }

  function handleOpenEdit(rider: Rider) {
    setFormName(rider.name);
    setFormEmail(rider.email === "—" ? "" : rider.email);
    setFormPhone(rider.phone === "—" ? "" : rider.phone);
    setFormVehicleType(rider.vehicle_type);
    setFormVehicleNumber(rider.vehicle_number === "—" ? "" : rider.vehicle_number);
    setFormLocation(rider.location_area === "No Area Listed" ? "" : rider.location_area);
    setFormStatus(rider.status);
    setFormVendors(rider.assigned_vendors);
    setEditOpen(true);
  }

  function handleSelectVendor(vendorId: string) {
    if (!vendorId || vendorId === "") return;
    const matchedOption = vendorOptions.find(o => o.value === vendorId);
    if (matchedOption && !formVendors.some(v => v.id === vendorId)) {
      setFormVendors([...formVendors, { id: vendorId, name: matchedOption.label }]);
    }
  }

  async function syncVendorAssignments(riderId: string, vendorsList: { id: string; name: string }[]) {
    await supabase.from("rider_vendor_assignments").delete().eq("rider_id", riderId);

    if (vendorsList.length > 0) {
      const batchPayload = vendorsList.map(v => ({
        rider_id: riderId,
        vendor_id: v.id
      }));
      const { error } = await supabase.from("rider_vendor_assignments").insert(batchPayload);
      if (error) throw error;
    }
  }

  async function handleAddRider() {
    if (!formName || !formPhone || !formLocation) {
      alert("Rider Name, Contact Phone, and Operating Area are required fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        name: formName,
        email: formEmail || null,
        phone: formPhone,
        vehicle_type: formVehicleType,
        vehicle_number: formVehicleNumber || null,
        location_area: formLocation,
        status: "available", // 🔵 Automatically inserts onboarded riders as ready/available
        orders_completed: 0,
        rating: 5.0,
      };

      const { data, error } = await supabase.from("riders").insert([payload]).select().single();
      if (error) throw error;

      if (data) {
        await syncVendorAssignments(data.id, formVendors);
      }

      resetForm();
      setAddOpen(false);
      await fetchRiders();
    } catch (err) {
      console.error("Critical onboarding write error:", err);
      alert("Failed to create rider."); //
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditRider() {
    if (!viewRider) return;
    if (!formName || !formPhone || !formLocation) {
      alert("Required profile metrics fields cannot be blank.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        name: formName,
        email: formEmail || null,
        phone: formPhone,
        vehicle_type: formVehicleType,
        vehicle_number: formVehicleNumber || null,
        location_area: formLocation,
        status: formStatus
      };

      const { error: riderError } = await supabase.from("riders").update(payload).eq("id", viewRider.id);
      if (riderError) throw riderError;

      await syncVendorAssignments(viewRider.id, formVendors);

      setEditOpen(false);
      await fetchRiders();
    } catch (err) {
      console.error("Critical edit mutation fault context:", err);
      alert("Failed to save adjustments safely."); //
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateStatusDirectly(id: string, newStatus: RiderStatus) {
    setRiderList((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    if (viewRider && viewRider.id === id) {
      setViewRider((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    try {
      await supabase.from("riders").update({ status: newStatus }).eq("id", id);
      await fetchRiders();
    } catch (err) {
      console.error("Status mutation sync fault:", err);
    }
  }

  async function handleDeleteRider(id: string, name: string) {
    const check = window.confirm(`Permanently delete "${name}"? This will wipe out all assignments.`);
    if (!check) return;

    try {
      setIsSubmitting(true);
      await supabase.from("riders").delete().eq("id", id);
      setEditOpen(false);
      setViewRider(null);
      await fetchRiders();
    } catch (err) {
      console.error("Destructive process fault:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = riderList.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.location_area.toLowerCase().includes(search.toLowerCase()) ||
      r.assigned_vendors.some(v => v.name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader
        title="Riders"
        description={`${riderList.filter((r) => r.status === "approved" || r.status === "available").length} fleet riders onboarded`}
        actions={
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => { resetForm(); setAddOpen(true); }}>
            Add Fleet Rider
          </Button>
        }
      />

      {/* Control Filter row elements */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet riders, attached shops..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {/* 🔵 Included available option category button inside row selectors */}
          {["all", "available", "approved", "pending", "paused", "suspended"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn("h-7 px-3 rounded-md text-xs font-medium capitalize", statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B]")}
            >
              {s === "all" ? "All Fleet" : s === "approved" ? "Active" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Framework */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl relative z-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide rounded-tl-xl">Rider Companion</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vehicle Model</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Assigned Shops</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Deliveries</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rating</th>
              <th className="px-4 py-3 rounded-tr-xl" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-16 text-sm text-[#94A3B8]">Loading active fleet...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-sm text-[#94A3B8]">No matching records found.</td></tr>
            ) : (
              paginated.map((rider, index) => {
                const badge = statusBadgeMap[rider.status] || { variant: "neutral", label: rider.status };
                const isLastRow = index === paginated.length - 1;
                return (
                  <tr key={rider.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-[#2563EB]">{rider.name[0]}</span>
                        </div>
                        <div>
                          <button onClick={() => setViewRider(rider)} className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] text-left">
                            {rider.name}
                          </button>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-[#64748B]">
                            <MapPin className="w-3 h-3 text-[#94A3B8]" />
                            <span>{rider.location_area}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-[#334155] font-medium">{vehicleLabelMap[rider.vehicle_type]}</div>
                      <div className="text-xs text-[#94A3B8] uppercase mt-0.5 tracking-wider font-semibold">{rider.vehicle_number}</div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {rider.assigned_vendors.length === 0 ? (
                        <span className="text-xs text-[#94A3B8] italic">General Fleet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-h-[45px] overflow-y-auto">
                          {rider.assigned_vendors.map(v => (
                            <span key={v.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F1F5F9] text-[10px] font-semibold text-[#475569] border border-[#E2E8F0]">
                              <Store className="w-2.5 h-2.5 text-[#64748B]" />
                              {v.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><Badge variant={badge.variant} label={badge.label} dot /></td>
                    <td className="px-4 py-3.5 text-right"><span className="text-sm font-medium text-[#0F172A]">{rider.orders_completed.toLocaleString()}</span></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-sm font-semibold text-[#0F172A]">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{rider.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className={cn("px-4 py-3.5 relative", isLastRow && "rounded-br-xl")}>
                      <Dropdown
                        align="right"
                        trigger={<button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"><MoreHorizontal className="w-4 h-4" /></button>}
                        items={[
                          { label: "View Details", icon: <Edit className="w-3.5 h-3.5" />, onClick: () => setViewRider(rider) },
                          
                          // 🔵 DYNAMIC WORKFLOW ACTIONS MENU FOR OPERATING ACCESS MODES
                          ...(rider.status !== "available" ? [{ 
                            label: "Mark Available", 
                            icon: <UserCheck className="w-3.5 h-3.5 text-sky-500" />, 
                            onClick: () => mutateStatusDirectly(rider.id, "available") 
                          }] : []),
                          ...(rider.status !== "approved" ? [{ 
                            label: "Set Active", 
                            icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />, 
                            onClick: () => mutateStatusDirectly(rider.id, "approved") 
                          }] : []),
                          ...(rider.status === "approved" || rider.status === "available" ? [{ 
                            label: "Put Offline", 
                            icon: <PauseCircle className="w-3.5 h-3.5 text-amber-500" />, 
                            onClick: () => mutateStatusDirectly(rider.id, "paused") 
                          }] : []),
                          ...(rider.status !== "suspended" ? [{ 
                            label: "Suspend Rider", 
                            icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />, 
                            onClick: () => mutateStatusDirectly(rider.id, "suspended"), 
                            variant: "danger" as const 
                          }] : []),
                          
                          { label: "Delete Permanent", icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => handleDeleteRider(rider.id, rider.name), variant: "danger" as const }
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

      {/* Add Rider Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Onboard Fleet Rider"
        description="Register a new delivery companion and assign them to one or more fulfillment shops."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleAddRider} disabled={isSubmitting}>{isSubmitting ? "Registering..." : "Onboard Rider"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name *" placeholder="e.g. Ramesh Kumar" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Input label="Contact Phone *" placeholder="+91 98765 12345" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Vehicle Segment Type *"
              value={formVehicleType}
              onChange={(val: string) => setFormVehicleType(val as VehicleType)}
              options={[{ value: "bike", label: "Motorcycle" }, { value: "scooter", label: "Scooter" }, { value: "electric_scooter", label: "EV Scooter" }, { value: "bicycle", label: "Bicycle" }]}
            />
            <Input label="Vehicle Registration No." placeholder="KA-01-EF-4321" value={formVehicleNumber} onChange={(e) => setFormVehicleNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email Address" placeholder="ops@delivery.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <Input label="Primary Operating Area *" placeholder="Koramangala, Bangalore" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
          </div>
          <div>
            <Select label="Assign to Stores / Shops (Supports Multiple)" value="" onChange={handleSelectVendor} options={vendorOptions} placeholder="Click to attach a store..." />
            {formVendors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 max-h-[65px] overflow-y-auto border border-[#E2E8F0] p-1.5 rounded-lg bg-[#F8FAFC]">
                {formVendors.map(v => (
                  <span key={v.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-xs font-semibold text-[#475569] border border-[#E2E8F0]">
                    {v.name}
                    <button type="button" onClick={() => setFormVendors(formVendors.filter(item => item.id !== v.id))} className="text-[#94A3B8] hover:text-red-500 font-bold ml-1"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* View Rider Details Modal */}
      {viewRider && (
        <Modal
          open={!!viewRider && !editOpen}
          onClose={() => setViewRider(null)}
          title={viewRider.name}
          description={`Rider Profile ID: ${viewRider.id}`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="destructive" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteRider(viewRider.id, viewRider.name)}>Remove Rider</Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setViewRider(null)}>Close</Button>
                <Button variant="primary" leftIcon={<Edit className="w-3.5 h-3.5" />} onClick={() => handleOpenEdit(viewRider)}>Edit Details</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Rider Name", value: viewRider.name },
                { label: "Delivery Zone Area", value: viewRider.location_area },
                { label: "Phone Connection", value: viewRider.phone },
                { label: "Email Address", value: viewRider.email },
                { label: "Vehicle Category Type", value: vehicleLabelMap[viewRider.vehicle_type] },
                { label: "License Plate Details", value: viewRider.vehicle_number.toUpperCase() },
                { label: "Registration Date", value: viewRider.joinedAt },
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#F1F5F9]">
                  <p className="text-xs text-[#64748B] mb-1 font-medium">{item.label}</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg">
              <p className="text-xs text-[#64748B] mb-1.5 font-medium">Currently Attached Stores ({viewRider.assigned_vendors.length})</p>
              <div className="flex flex-wrap gap-1">
                {viewRider.assigned_vendors.length === 0 ? <span className="text-xs text-[#94A3B8] italic">General Fleet unassigned pool</span> : 
                  viewRider.assigned_vendors.map(v => (
                    <span key={v.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-xs font-semibold text-[#0F172A] border border-[#E2E8F0]"><Store className="w-3.5 h-3.5 text-[#22C55E]" />{v.name}</span>
                  ))
                }
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Rider Modal */}
      {viewRider && editOpen && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`Edit ${viewRider.name}`}
          description="Update field records or modify systemic store alignment contexts."
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="destructive" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteRider(viewRider.id, viewRider.name)} disabled={isSubmitting}>Delete Permanent</Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button variant="primary" onClick={handleEditRider} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name *" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <Input label="Primary Delivery Zone *" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contact Email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              <Input label="Phone Number *" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Vehicle Segment Type"
                value={formVehicleType}
                onChange={(val: string) => setFormVehicleType(val as VehicleType)}
                options={[{ value: "bike", label: "Motorcycle" }, { value: "scooter", label: "Scooter" }, { value: "electric_scooter", label: "EV Scooter" }, { value: "bicycle", label: "Bicycle" }]}
              />
              <Input label="License Number Plate" value={formVehicleNumber} onChange={(e) => setFormVehicleNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Select
                label="Fulfillment Status Profile"
                value={formStatus}
                onChange={(val: string) => setFormStatus(val as RiderStatus)}
                options={[
                  { value: "pending", label: "Pending Review" }, 
                  { value: "available", label: "Available (Online/Ready)" }, 
                  { value: "approved", label: "Active (On Delivery)" }, 
                  { value: "paused", label: "Offline" }, 
                  { value: "suspended", label: "Suspended" }
                ]}
              />
            </div>
            <div>
              <Select label="Modify Attached Stores (Supports Multi-Shop Link)" value="" onChange={handleSelectVendor} options={vendorOptions} placeholder="Click to attach a store..." />
              <div className="flex flex-wrap gap-1 mt-2 max-h-[65px] overflow-y-auto border border-[#E2E8F0] p-1.5 rounded-lg bg-[#F8FAFC]">
                {formVendors.length === 0 ? <span className="text-xs text-[#94A3B8] italic">No active shop parameters linked</span> : 
                  formVendors.map(v => (
                    <span key={v.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-xs font-semibold text-[#475569] border border-[#E2E8F0]">
                      {v.name}
                      <button type="button" onClick={() => setFormVendors(formVendors.filter(item => item.id !== v.id))} className="text-[#94A3B8] hover:text-red-500 font-bold ml-1"><X className="w-3 h-3" /></button>
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}