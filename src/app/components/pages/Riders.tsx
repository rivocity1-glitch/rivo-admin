import React, { useState } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Star,
  Bike,
  MapPin,
  Phone,
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

type RiderStatus = "online" | "offline" | "busy" | "suspended";

interface Rider {
  id: string;
  name: string;
  phone: string;
  vendor: string;
  status: RiderStatus;
  orders: number;
  rating: number;
  zone: string;
  joinedAt: string;
}

const riders: Rider[] = [
  {
    id: "R001",
    name: "Arjun Kumar",
    phone: "+91 98765 11223",
    vendor: "Green Basket",
    status: "online",
    orders: 1248,
    rating: 4.9,
    zone: "Koramangala",
    joinedAt: "14 Feb 2024",
  },
  {
    id: "R002",
    name: "Priya Nair",
    phone: "+91 87654 22334",
    vendor: "Quick Mart",
    status: "busy",
    orders: 892,
    rating: 4.7,
    zone: "Whitefield",
    joinedAt: "08 Apr 2024",
  },
  {
    id: "R003",
    name: "Rahul Verma",
    phone: "+91 76543 33445",
    vendor: "Daily Grains",
    status: "offline",
    orders: 560,
    rating: 4.4,
    zone: "Indiranagar",
    joinedAt: "22 Jun 2024",
  },
  {
    id: "R004",
    name: "Sneha Pillai",
    phone: "+91 65432 44556",
    vendor: "Dairy Direct",
    status: "online",
    orders: 2041,
    rating: 4.8,
    zone: "Jayanagar",
    joinedAt: "03 Jan 2024",
  },
  {
    id: "R005",
    name: "Mohammed Faiz",
    phone: "+91 99876 55667",
    vendor: "Unassigned",
    status: "suspended",
    orders: 210,
    rating: 3.8,
    zone: "HSR Layout",
    joinedAt: "11 Sep 2024",
  },
];

const statusMap: Record<RiderStatus, { variant: "success" | "warning" | "info" | "error"; label: string }> = {
  online: { variant: "success", label: "Online" },
  busy: { variant: "warning", label: "Busy" },
  offline: { variant: "neutral" as any, label: "Offline" },
  suspended: { variant: "error", label: "Suspended" },
};

export function Riders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [riderList, setRiderList] = useState<Rider[]>(riders);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<Rider | null>(null);
  const itemsPerPage = 10;

  const filtered = riderList.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor.toLowerCase().includes(search.toLowerCase()) ||
      r.zone.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function toggleSuspend(id: string) {
    setRiderList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: r.status === "suspended" ? "offline" : "suspended" } : r))
    );
  }

  return (
    <div>
      <PageHeader
        title="Riders"
        description={`${riderList.filter((r) => r.status === "online" || r.status === "busy").length} riders active now`}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setAddOpen(true)}
          >
            Add Rider
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
            placeholder="Search riders..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "online", "busy", "offline", "suspended"].map((s) => (
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
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rider</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Assigned Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Deliveries</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rating</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Zone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((rider) => {
              const badge = statusMap[rider.status];
              return (
                <tr key={rider.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#EFF6FF] border border-[#DBEAFE] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-blue-600">{rider.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{rider.name}</p>
                        <p className="text-xs text-[#64748B]">{rider.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
                      <Phone className="w-3.5 h-3.5" />
                      {rider.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("text-sm", rider.vendor === "Unassigned" ? "text-[#94A3B8] italic" : "text-[#0F172A]")}>
                      {rider.vendor}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={badge.variant as any} label={badge.label} dot />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-medium text-[#0F172A]">{rider.orders.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm text-[#0F172A]">{rider.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-sm text-[#64748B]">
                      <MapPin className="w-3.5 h-3.5" />
                      {rider.zone}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Dropdown
                      align="right"
                      trigger={
                        <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      }
                      items={[
                        {
                          label: "Assign Vendor",
                          icon: <Bike className="w-3.5 h-3.5" />,
                          onClick: () => setAssignOpen(rider),
                        },
                        {
                          label: "Edit Rider",
                          onClick: () => {},
                        },
                        {
                          label: rider.status === "suspended" ? "Reactivate" : "Suspend Rider",
                          onClick: () => toggleSuspend(rider.id),
                          variant: rider.status !== "suspended" ? "danger" : "default",
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

      {/* Add Rider Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Rider"
        description="Register a new delivery rider on Rivo."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setAddOpen(false)}>Add Rider</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" placeholder="e.g. Arjun Kumar" />
            <Input label="Phone Number" placeholder="+91 98765 43210" />
          </div>
          <Input label="Email Address" placeholder="rider@rivo.app" />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Assign Vendor"
              value=""
              onChange={() => {}}
              options={[
                { value: "v001", label: "Green Basket" },
                { value: "v002", label: "Daily Grains" },
                { value: "v004", label: "Quick Mart" },
                { value: "v006", label: "Dairy Direct" },
              ]}
              placeholder="Select vendor"
            />
            <Input label="Delivery Zone" placeholder="e.g. Koramangala" />
          </div>
          <Input label="Vehicle Number" placeholder="KA 01 AB 1234" />
        </div>
      </Modal>

      {/* Assign Vendor Modal */}
      {assignOpen && (
        <Modal
          open={!!assignOpen}
          onClose={() => setAssignOpen(null)}
          title={`Assign Vendor — ${assignOpen.name}`}
          description="Change the vendor this rider is assigned to."
          footer={
            <>
              <Button variant="secondary" onClick={() => setAssignOpen(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => setAssignOpen(null)}>Save Assignment</Button>
            </>
          }
        >
          <Select
            label="Vendor"
            value={assignOpen.vendor}
            onChange={() => {}}
            options={[
              { value: "Green Basket", label: "Green Basket" },
              { value: "Daily Grains", label: "Daily Grains" },
              { value: "Quick Mart", label: "Quick Mart" },
              { value: "Dairy Direct", label: "Dairy Direct" },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
