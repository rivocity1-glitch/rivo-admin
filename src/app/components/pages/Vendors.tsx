import React, { useState } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Filter,
  CheckCircle,
  XCircle,
  Edit,
  ShoppingCart,
  Crown,
  Star,
  MapPin,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../../lib/utils";

type VendorStatus = "approved" | "pending" | "suspended";

interface Vendor {
  id: string;
  name: string;
  category: string;
  location: string;
  status: VendorStatus;
  orders: number;
  rating: number;
  commission: number;
  subscription: string;
  joinedAt: string;
  email: string;
  phone: string;
}

const vendors: Vendor[] = [
  {
    id: "V001",
    name: "Green Basket",
    category: "Organic Produce",
    location: "Koramangala, Bengaluru",
    status: "approved",
    orders: 1842,
    rating: 4.8,
    commission: 12,
    subscription: "Growth",
    joinedAt: "12 Jan 2024",
    email: "ops@greenbasket.in",
    phone: "+91 98761 12340",
  },
  {
    id: "V002",
    name: "Daily Grains",
    category: "Staples & Grains",
    location: "Indiranagar, Bengaluru",
    status: "approved",
    orders: 964,
    rating: 4.5,
    commission: 10,
    subscription: "Starter",
    joinedAt: "03 Mar 2024",
    email: "hello@dailygrains.in",
    phone: "+91 87654 43210",
  },
  {
    id: "V003",
    name: "Spice World",
    category: "Spices & Masalas",
    location: "HSR Layout, Bengaluru",
    status: "pending",
    orders: 0,
    rating: 0,
    commission: 10,
    subscription: "Starter",
    joinedAt: "10 Jun 2025",
    email: "info@spiceworld.co",
    phone: "+91 91234 56789",
  },
  {
    id: "V004",
    name: "Quick Mart",
    category: "Convenience Store",
    location: "Whitefield, Bengaluru",
    status: "approved",
    orders: 2310,
    rating: 4.3,
    commission: 8,
    subscription: "Premium",
    joinedAt: "20 Aug 2023",
    email: "ops@quickmart.in",
    phone: "+91 99887 76655",
  },
  {
    id: "V005",
    name: "Fresh Farms",
    category: "Fruits & Vegetables",
    location: "JP Nagar, Bengaluru",
    status: "suspended",
    orders: 420,
    rating: 3.9,
    commission: 12,
    subscription: "Starter",
    joinedAt: "05 May 2024",
    email: "contact@freshfarms.in",
    phone: "+91 80012 34567",
  },
  {
    id: "V006",
    name: "Dairy Direct",
    category: "Dairy & Eggs",
    location: "Jayanagar, Bengaluru",
    status: "approved",
    orders: 1120,
    rating: 4.6,
    commission: 11,
    subscription: "Growth",
    joinedAt: "15 Nov 2023",
    email: "support@dairydirect.in",
    phone: "+91 77654 98765",
  },
];

const statusBadgeMap: Record<VendorStatus, { variant: "success" | "warning" | "error"; label: string }> = {
  approved: { variant: "success", label: "Approved" },
  pending: { variant: "warning", label: "Pending" },
  suspended: { variant: "error", label: "Suspended" },
};

const subscriptionBadgeMap: Record<string, "neutral" | "info" | "purple"> = {
  Starter: "neutral",
  Growth: "info",
  Premium: "purple",
};

export function Vendors() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorList, setVendorList] = useState<Vendor[]>(vendors);
  const [addOpen, setAddOpen] = useState(false);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const itemsPerPage = 10;

  const filtered = vendorList.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.location.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function toggleStatus(id: string, newStatus: VendorStatus) {
    setVendorList((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
  }

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
            onClick={() => setAddOpen(true)}
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
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Orders</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rating</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">
                  No vendors found
                </td>
              </tr>
            ) : (
              paginated.map((vendor) => {
                const badge = statusBadgeMap[vendor.status];
                return (
                  <tr key={vendor.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3.5">
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
                      <span className="text-sm text-[#64748B]">{vendor.category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={badge.variant} label={badge.label} dot />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-medium text-[#0F172A]">{vendor.orders.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {vendor.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm text-[#0F172A]">{vendor.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={subscriptionBadgeMap[vendor.subscription] || "neutral"}
                        label={vendor.subscription}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-[#64748B]">{vendor.joinedAt}</span>
                    </td>
                    <td className="px-4 py-3.5">
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
                          {
                            label: vendor.status === "approved" ? "Suspend Vendor" : "Approve Vendor",
                            icon:
                              vendor.status === "approved" ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ),
                            onClick: () =>
                              toggleStatus(
                                vendor.id,
                                vendor.status === "approved" ? "suspended" : "approved"
                              ),
                            variant: vendor.status === "approved" ? "danger" : "default",
                          },
                          {
                            label: "View Orders",
                            icon: <ShoppingCart className="w-3.5 h-3.5" />,
                            onClick: () => {},
                          },
                          {
                            label: "Manage Subscription",
                            icon: <Crown className="w-3.5 h-3.5" />,
                            onClick: () => {},
                          },
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
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setAddOpen(false)}>Add Vendor</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Business Name" placeholder="e.g. Green Basket" />
            <Select
              label="Category"
              value=""
              onChange={() => {}}
              options={[
                { value: "organic", label: "Organic Produce" },
                { value: "staples", label: "Staples & Grains" },
                { value: "dairy", label: "Dairy & Eggs" },
                { value: "spices", label: "Spices & Masalas" },
                { value: "fruits", label: "Fruits & Vegetables" },
                { value: "convenience", label: "Convenience Store" },
              ]}
              placeholder="Select category"
            />
          </div>
          <Input label="Contact Email" placeholder="ops@vendor.com" />
          <Input label="Phone Number" placeholder="+91 98765 43210" />
          <Input label="Location / Area" placeholder="Koramangala, Bengaluru" />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Plan"
              value=""
              onChange={() => {}}
              options={[
                { value: "starter", label: "Starter" },
                { value: "growth", label: "Growth" },
                { value: "premium", label: "Premium" },
              ]}
              placeholder="Select plan"
            />
            <Input label="Commission %" placeholder="10" type="number" />
          </div>
        </div>
      </Modal>

      {/* View Vendor Modal */}
      {viewVendor && (
        <Modal
          open={!!viewVendor}
          onClose={() => setViewVendor(null)}
          title={viewVendor.name}
          description={`${viewVendor.id} • ${viewVendor.category}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewVendor(null)}>Close</Button>
              {viewVendor.status === "pending" && (
                <Button
                  variant="primary"
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  onClick={() => {
                    toggleStatus(viewVendor.id, "approved");
                    setViewVendor(null);
                  }}
                >
                  Approve Vendor
                </Button>
              )}
              {viewVendor.status === "approved" && (
                <Button
                  variant="destructive"
                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  onClick={() => {
                    toggleStatus(viewVendor.id, "suspended");
                    setViewVendor(null);
                  }}
                >
                  Suspend Vendor
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Email", value: viewVendor.email },
                { label: "Phone", value: viewVendor.phone },
                { label: "Location", value: viewVendor.location },
                { label: "Joined", value: viewVendor.joinedAt },
                { label: "Commission", value: `${viewVendor.commission}%` },
                { label: "Subscription", value: viewVendor.subscription },
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                  <p className="text-xs text-[#64748B] mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
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
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center">
                <Badge variant={statusBadgeMap[viewVendor.status].variant} label={statusBadgeMap[viewVendor.status].label} />
                <p className="text-xs text-[#64748B] mt-1">Status</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
