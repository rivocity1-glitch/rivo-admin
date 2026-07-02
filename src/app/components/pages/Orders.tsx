import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  MapPin,
  User,
  Store,
  Bike,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Phone,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { SlideOver } from "../ui/Modal";
import { Select } from "../ui/Select";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

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
  order_display_id: string;
  customer: string;
  customerPhone: string;
  vendorId: string;
  vendor: string;
  riderId: string;
  rider: string;
  items: number;
  amount: number;
  status: OrderStatus;
  date: string;
  address: string;
  paymentMethod: string;
  otp: boolean;
}

interface IdleRiderOption {
  value: string;
  label: string;
}

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
    { key: "pending", label: "Order Placed" },
    { key: "accepted", label: "Accepted by Vendor" },
    { key: "preparing", label: "Preparing" },
    { key: "packed", label: "Packed & Ready" },
    { key: "assigned", label: "Rider Assigned" },
    { key: "picked_up", label: "Picked Up" },
    { key: "delivered", label: "Delivered" },
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
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [idleRiders, setIdleRiders] = useState<IdleRiderOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsPerPage = 10;

  // 🟢 Fetch All Live Orders
  async function fetchOrders() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (
            customer_name,
            phone
          ),
          vendors (
            shop_name
          ),
          riders (
            rider_name
          )
        `)
        .order("created_at", { ascending: false });

      console.log(data);

      if (error) throw error;

      const mapped: Order[] = (data || []).map((row) => ({
       id: row.id,

order_display_id: row.order_number || "RVO-0000",

customer: row.customers?.customer_name || "-",
customerPhone: row.customers?.phone || "-",

vendorId: row.vendor_id || "",
vendor: row.vendors?.shop_name || "-",

riderId: row.rider_id || "",
rider: row.riders?.rider_name || "Not Assigned",

items: 1,

amount: row.total_amount || 0,

status: (row.order_status as OrderStatus) || "pending",

address: "-",

paymentMethod: row.payment_status || "pending",

otp: false,
        date: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      }));

      setOrderList(mapped);

      if (selectedOrder) {
        const updated = mapped.find((o) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error("Failed fetching live platform orders:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // 🟢 Fetch Idle Riders assigned to the specific order vendor shop
  async function fetchIdleRidersForShop(vendorId: string) {
    if (!vendorId) {
      setIdleRiders([]);
      return;
    }
    try {
      // Pull riders attached to this shop from junction table assignments
      const { data: assignments, error: assignError } = await supabase
        .from("rider_vendor_assignments")
        .select("rider_id")
        .eq("vendor_id", vendorId);

      if (assignError) throw assignError;

      const riderIds = (assignments || []).map((a) => a.rider_id);
      if (riderIds.length === 0) {
        setIdleRiders([]);
        return;
      }

      // Filter riders that are online/waiting (status = 'available')
      const { data: riders, error: ridersError } = await supabase
        .from("riders")
        .select("id, name")
        .in("id", riderIds)
        .eq("status", "available");

      if (ridersError) throw ridersError;

      setIdleRiders((riders || []).map((r) => ({ value: r.id, label: r.name })));
    } catch (err) {
      console.error("Failed pulling idle shop riders pool:", err);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedOrder && selectedOrder.vendorId) {
      fetchIdleRidersForShop(selectedOrder.vendorId);
    }
  }, [selectedOrder?.id]);

  // 🟢 General Order Status Mutator
  async function mutateOrderStatus(orderId: string, nextStatus: OrderStatus) {
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error("Failed parsing status update execution block:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 🟢 Dispatch Order to an Idle Shop Rider
  async function handleDispatchRider(riderId: string) {
    if (!selectedOrder || !riderId) return;
    const targetRider = idleRiders.find((r) => r.value === riderId);
    if (!targetRider) return;

    try {
      setIsSubmitting(true);

      // 1. Assign rider metadata to order record context
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          rider_id: riderId,
          status: "assigned",
        })
        .eq("id", selectedOrder.id);

      if (orderError) throw orderError;

      // 2. Flip rider operational state flag on dashboard to Active/Approved (On Delivery)
      await supabase.from("riders").update({ status: "approved" }).eq("id", riderId);

      await fetchOrders();
    } catch (err) {
      console.error("Failed dispatching delivery personnel node:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = orderList.filter((o) => {
    const matchSearch =
      o.order_display_id.toLowerCase().includes(search.toLowerCase()) ||
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
        description={`${orderList.length} total live transactions`}
      />

      {/* Status tabs */}
      <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white mb-4 overflow-x-auto relative z-10">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
            className={cn(
              "h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
              statusFilter === tab.id ? "bg-[#22C55E] text-white" : "text-[#64748B] hover:text-[#0F172A]"
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
          className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10">
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
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">Syncing data core orders flow...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">No platform order entries match filter criteria.</td></tr>
            ) : (
              paginated.map((order) => {
                const s = statusConfig[order.status] || { variant: "neutral", label: order.status };
                return (
                  <tr key={order.id} className="hover:bg-[#FAFAFA] transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-mono font-medium text-[#0F172A]">#{order.order_display_id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-[#0F172A]">{order.customer}</p>
                      <p className="text-xs text-[#64748B]">{order.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.vendor}</td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.rider}</td>
                    <td className="px-4 py-3.5 text-right"><span className="text-sm font-medium text-[#0F172A]">₹{order.amount}</span></td>
                    <td className="px-4 py-3.5"><Badge variant={s.variant} label={s.label} dot /></td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.date}</td>
                    <td className="px-4 py-3.5">
                      <button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {/* Order Detail SlideOver */}
      {selectedOrder && (
        <SlideOver open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order #${selectedOrder.order_display_id}`} width="max-w-2xl">
          <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <Badge variant={(statusConfig[selectedOrder.status] || {variant:"neutral"}).variant} label={(statusConfig[selectedOrder.status] || {label:selectedOrder.status}).label} dot />
              <div className="text-right">
                <p className="text-2xl font-semibold text-[#0F172A]">₹{selectedOrder.amount}</p>
                <p className="text-xs text-[#64748B]">{selectedOrder.items} items • {selectedOrder.paymentMethod}</p>
              </div>
            </div>

            {/* Timeline */}
            {!["cancelled", "refunded"].includes(selectedOrder.status) && (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">Order Fulfillment Steps</p>
                <div className="space-y-3">
                  {timelineSteps(selectedOrder.status).map((step) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", step.done ? "bg-[#22C55E]" : "bg-[#E2E8F0]")}>
                        {step.done ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />}
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm", step.done ? "font-medium text-[#0F172A]" : "text-[#94A3B8]")}>{step.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rider Dispatch Control Dropdown overlay link parameters */}
            {selectedOrder.status === "accepted" && (
              <div className="bg-white border border-[#22C55E]/30 rounded-xl p-4 ring-2 ring-[#22C55E]/5">
                <div className="flex items-center gap-2 mb-2">
                  <Bike className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Logistics Dispatcher Control</span>
                </div>
                <p className="text-xs text-[#64748B] mb-3">Assign one of this shop's idle online riders to accept and dispatch this order package.</p>
                <Select
                  label="Available Idle Store Riders Pool"
                  value=""
                  onChange={handleDispatchRider}
                  options={idleRiders}
                  placeholder={idleRiders.length === 0 ? "No idle store drivers online" : "Choose a driver to assign..."}
                  disabled={idleRiders.length === 0 || isSubmitting}
                />
              </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3"><User className="w-3.5 h-3.5 text-[#64748B]" /><span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Customer</span></div>
                <p className="text-sm font-medium text-[#0F172A]"> {selectedOrder.customer}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-[#64748B]"><Phone className="w-3 h-3" />{selectedOrder.customerPhone}</div>
              </div>
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3"><Store className="w-3.5 h-3.5 text-[#64748B]" /><span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Vendor</span></div>
                <p className="text-sm font-medium text-[#0F172A]">{selectedOrder.vendor}</p>
              </div>
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3"><Bike className="w-3.5 h-3.5 text-[#64748B]" /><span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Rider</span></div>
                <p className="text-sm font-medium text-[#0F172A]">{selectedOrder.rider}</p>
              </div>
              <div className="border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3"><CreditCard className="w-3.5 h-3.5 text-[#64748B]" /><span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Payment</span></div>
                <p className="text-sm font-medium text-[#0F172A]">₹{selectedOrder.amount}</p>
                <p className="text-xs text-[#64748B] mt-1">{selectedOrder.paymentMethod} • Settled</p>
              </div>
            </div>

            <div className="border border-[#E2E8F0] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><MapPin className="w-3.5 h-3.5 text-[#64748B]" /><span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Delivery Address</span></div>
              <p className="text-sm text-[#0F172A]">{selectedOrder.address}</p>
            </div>

            {/* OTP Status */}
            <div className={cn("flex items-center gap-3 p-4 rounded-xl border", selectedOrder.otp ? "bg-[#F0FDF4] border-[#DCFCE7]" : "bg-[#F8FAFC] border-[#E2E8F0]")}>
              <ShieldCheck className={cn("w-5 h-5", selectedOrder.otp ? "text-green-600" : "text-[#94A3B8]")} />
              <div>
                <p className={cn("text-sm font-medium", selectedOrder.otp ? "text-[#16A34A]" : "text-[#64748B]")}>Secure Drop Pin Verification</p>
                <p className="text-xs text-[#64748B]">{selectedOrder.otp ? "Handover authorized via device OTP code token" : "Requires secure delivery handshake verification code"}</p>
              </div>
            </div>

            {/* Structural State Flow Actions Matrix */}
            <div className="flex gap-3 pt-2">
              {selectedOrder.status === "pending" && (
                <Button variant="primary" className="flex-1" onClick={() => mutateOrderStatus(selectedOrder.id, "accepted")} disabled={isSubmitting}>Accept Order Request</Button>
              )}
              {selectedOrder.status === "assigned" && (
                <Button variant="primary" className="flex-1" onClick={() => mutateOrderStatus(selectedOrder.id, "picked_up")} disabled={isSubmitting}>Simulate Handover Pick Up</Button>
              )}
              {selectedOrder.status === "picked_up" && (
                <Button variant="primary" className="flex-1" onClick={() => mutateOrderStatus(selectedOrder.id, "delivered")} disabled={isSubmitting}>Complete Secure Handover (Delivered)</Button>
              )}
              {!["delivered", "cancelled", "refunded"].includes(selectedOrder.status) && (
                <Button variant="destructive" className="flex-1" onClick={() => mutateOrderStatus(selectedOrder.id, "cancelled")} disabled={isSubmitting}>Cancel Order</Button>
              )}
              {selectedOrder.status === "delivered" && (
                <Button variant="outline" className="flex-1" onClick={() => mutateOrderStatus(selectedOrder.id, "refunded")} disabled={isSubmitting}>Initiate Financial Refund Ledger</Button>
              )}
            </div>
          </div>
        </SlideOver>
      )}
    </div>
  );
}