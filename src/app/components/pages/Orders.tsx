import React, { useState } from "react";
import {
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  MapPin,
  User,
  Store,
  Bike,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Phone,
  IndianRupee,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { SlideOver } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../../lib/utils";

type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "packed"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "refunded";

interface Order {
  id: string;
  customer: string;
  customerPhone: string;
  vendor: string;
  rider: string;
  items: number;
  amount: number;
  status: OrderStatus;
  date: string;
  address: string;
  paymentMethod: string;
  otp: boolean;
}

const orders: Order[] = [
  {
    id: "RIV-4821",
    customer: "Ananya Sharma",
    customerPhone: "+91 98765 43210",
    vendor: "Green Basket",
    rider: "Arjun Kumar",
    items: 3,
    amount: 648,
    status: "delivered",
    date: "Today, 2:14 PM",
    address: "14, 6th Cross, Koramangala 3rd Block, Bengaluru 560034",
    paymentMethod: "UPI",
    otp: true,
  },
  {
    id: "RIV-4820",
    customer: "Kiran Patel",
    customerPhone: "+91 87654 32109",
    vendor: "Quick Mart",
    rider: "Priya Nair",
    items: 7,
    amount: 1240,
    status: "picked_up",
    date: "Today, 1:45 PM",
    address: "22, Whitefield Main Road, Bengaluru 560066",
    paymentMethod: "Card",
    otp: false,
  },
  {
    id: "RIV-4819",
    customer: "Meera Iyer",
    customerPhone: "+91 76543 21098",
    vendor: "Daily Grains",
    rider: "Rahul Verma",
    items: 5,
    amount: 920,
    status: "preparing",
    date: "Today, 1:20 PM",
    address: "8, Indiranagar 12th Main, Bengaluru 560038",
    paymentMethod: "UPI",
    otp: false,
  },
  {
    id: "RIV-4818",
    customer: "Lakshmi Venkat",
    customerPhone: "+91 99988 77665",
    vendor: "Dairy Direct",
    rider: "Sneha Pillai",
    items: 4,
    amount: 480,
    status: "accepted",
    date: "Today, 12:58 PM",
    address: "3A, Jayanagar 4th Block, Bengaluru 560041",
    paymentMethod: "Cash",
    otp: false,
  },
  {
    id: "RIV-4817",
    customer: "Rohan Desai",
    customerPhone: "+91 65432 10987",
    vendor: "Spice World",
    rider: "—",
    items: 2,
    amount: 310,
    status: "pending",
    date: "Today, 12:30 PM",
    address: "50, HSR Layout Sector 2, Bengaluru 560102",
    paymentMethod: "UPI",
    otp: false,
  },
  {
    id: "RIV-4809",
    customer: "Kiran Patel",
    customerPhone: "+91 87654 32109",
    vendor: "Green Basket",
    rider: "Arjun Kumar",
    items: 3,
    amount: 210,
    status: "refunded",
    date: "Yesterday, 4:10 PM",
    address: "22, Whitefield Main Road, Bengaluru 560066",
    paymentMethod: "UPI",
    otp: true,
  },
];

const statusConfig: Record<OrderStatus, { variant: any; label: string }> = {
  pending: { variant: "neutral", label: "Pending" },
  accepted: { variant: "info", label: "Accepted" },
  preparing: { variant: "warning", label: "Preparing" },
  packed: { variant: "orange", label: "Packed" },
  assigned: { variant: "purple", label: "Assigned" },
  picked_up: { variant: "info", label: "Picked Up" },
  delivered: { variant: "success", label: "Delivered" },
  cancelled: { variant: "error", label: "Cancelled" },
  refunded: { variant: "error", label: "Refunded" },
};

const statusTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "packed", label: "Packed" },
  { id: "assigned", label: "Assigned" },
  { id: "picked_up", label: "Picked Up" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

const timelineSteps = (status: OrderStatus) => {
  const all = [
    { key: "pending", label: "Order Placed", time: "12:30 PM" },
    { key: "accepted", label: "Accepted by Vendor", time: "12:33 PM" },
    { key: "preparing", label: "Preparing", time: "12:36 PM" },
    { key: "packed", label: "Packed & Ready", time: "" },
    { key: "assigned", label: "Rider Assigned", time: "" },
    { key: "picked_up", label: "Picked Up", time: "" },
    { key: "delivered", label: "Delivered", time: "" },
  ];
  const order = ["pending", "accepted", "preparing", "packed", "assigned", "picked_up", "delivered"];
  const currentIdx = order.indexOf(status);
  return all.map((step, idx) => ({
    ...step,
    done: idx <= currentIdx,
    current: idx === currentIdx,
  }));
};

export function Orders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const itemsPerPage = 10;

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customer.toLowerCase().includes(search.toLowerCase()) ||
      o.vendor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${orders.length} total orders`}
      />

      {/* Status tabs */}
      <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white mb-4 overflow-x-auto">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
            className={cn(
              "h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
              statusFilter === tab.id
                ? "bg-[#22C55E] text-white"
                : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID, customer..."
          className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Order ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Rider</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {paginated.map((order) => {
              const s = statusConfig[order.status];
              return (
                <tr key={order.id} className="hover:bg-[#FAFAFA] transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-mono font-medium text-[#0F172A]">#{order.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[#0F172A]">{order.customer}</p>
                    <p className="text-xs text-[#64748B]">{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.vendor}</td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.rider}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-medium text-[#0F172A]">₹{order.amount}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={s.variant} label={s.label} dot />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.date}</td>
                  <td className="px-4 py-3.5">
                    <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
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

      {/* Order Detail SlideOver */}
      {selectedOrder && (
        <SlideOver
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.id}`}
          width="max-w-2xl"
        >
          <div className="p-6 space-y-6">
            {/* Status + amount */}
            <div className="flex items-center justify-between">
              <Badge variant={statusConfig[selectedOrder.status].variant} label={statusConfig[selectedOrder.status].label} dot />
              <div className="text-right">
                <p className="text-2xl font-semibold text-[#0F172A]">₹{selectedOrder.amount}</p>
                <p className="text-xs text-[#64748B]">{selectedOrder.items} items • {selectedOrder.paymentMethod}</p>
              </div>
            </div>

            {/* Timeline */}
            {!["cancelled", "refunded"].includes(selectedOrder.status) && (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">Order Timeline</p>
                <div className="space-y-3">
                  {timelineSteps(selectedOrder.status).map((step, idx) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        step.done ? "bg-[#22C55E]" : "bg-[#E2E8F0]"
                      )}>
                        {step.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm", step.done ? "font-medium text-[#0F172A]" : "text-[#94A3B8]")}>
                          {step.label}
                        </p>
                        {step.time && step.done && <p className="text-xs text-[#64748B]">{step.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer */}
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Customer</span>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">{selectedOrder.customer}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-[#64748B]">
                  <Phone className="w-3 h-3" />{selectedOrder.customerPhone}
                </div>
              </div>

              {/* Vendor */}
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Vendor</span>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">{selectedOrder.vendor}</p>
                <p className="text-xs text-[#64748B] mt-1">{selectedOrder.items} items in order</p>
              </div>

              {/* Rider */}
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bike className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Rider</span>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">{selectedOrder.rider}</p>
                <p className="text-xs text-[#64748B] mt-1">
                  {selectedOrder.rider === "—" ? "Not assigned yet" : "On the way"}
                </p>
              </div>

              {/* Payment */}
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-3.5 h-3.5 text-[#64748B]" />
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Payment</span>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">₹{selectedOrder.amount}</p>
                <p className="text-xs text-[#64748B] mt-1">{selectedOrder.paymentMethod} • Paid</p>
              </div>
            </div>

            {/* Delivery address */}
            <div className="border border-[#E2E8F0] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Delivery Address</span>
              </div>
              <p className="text-sm text-[#0F172A]">{selectedOrder.address}</p>
            </div>

            {/* OTP */}
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              selectedOrder.otp
                ? "bg-[#F0FDF4] border-[#DCFCE7]"
                : "bg-[#F8FAFC] border-[#E2E8F0]"
            )}>
              <ShieldCheck className={cn("w-5 h-5", selectedOrder.otp ? "text-green-600" : "text-[#94A3B8]")} />
              <div>
                <p className={cn("text-sm font-medium", selectedOrder.otp ? "text-[#16A34A]" : "text-[#64748B]")}>
                  OTP Verification
                </p>
                <p className="text-xs text-[#64748B]">
                  {selectedOrder.otp ? "Delivery confirmed via OTP" : "OTP verification pending"}
                </p>
              </div>
              {selectedOrder.otp && <Badge variant="success" label="Verified" className="ml-auto" />}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {selectedOrder.status === "pending" && (
                <Button variant="primary" className="flex-1">Accept Order</Button>
              )}
              {!["delivered", "cancelled", "refunded"].includes(selectedOrder.status) && (
                <Button variant="destructive" className="flex-1">Cancel Order</Button>
              )}
              {selectedOrder.status === "delivered" && (
                <Button variant="outline" className="flex-1">Initiate Refund</Button>
              )}
            </div>
          </div>
        </SlideOver>
      )}
    </div>
  );
}
