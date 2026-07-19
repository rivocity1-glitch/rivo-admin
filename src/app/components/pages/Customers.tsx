import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  ShoppingBag,
  RefreshCcw,
  ShieldOff,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type CustomerStatus = "active" | "blocked";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  spent: number;
  status: CustomerStatus;
  delivery_address: string;
  joinedAt: string;
  lastOrder: string;
  lastOrderRaw?: string;
}

export function Customers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals Visibility
  const [addOpen, setAddOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "refunds">("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile Real Metrics State
  const [profileMetrics, setProfileMetrics] = useState({
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
    lastOrderDate: "No orders placed",
    fullAddress: "No address provided",
    avgOrderValue: 0
  });

  // History Lists States
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerRefunds, setCustomerRefunds] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Form Controls
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const itemsPerPage = 10;

  // Realtime subscription listeners setup
  useEffect(() => {
    const customersChannel = supabase
      .channel("customers-realtime-changes")
      .on(("postgres_changes" as any), { event: "*", scheme: "public", table: "customers" }, () => {
        fetchCustomers();
      })
      .on(("postgres_changes" as any), { event: "*", scheme: "public", table: "orders" }, () => {
        fetchCustomers();
        if (viewCustomer) {
          fetchCustomerModalDetails(viewCustomer.id);
        }
      })
      .on(("postgres_changes" as any), { event: "*", scheme: "public", table: "refunds" }, () => {
        if (viewCustomer) {
          fetchCustomerModalDetails(viewCustomer.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(customersChannel);
    };
  }, [viewCustomer?.id]);

  async function fetchCustomers() {
    try {
      setIsLoading(true);
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      // Fetch default addresses
      const { data: addressesData, error: addressesError } = await supabase
        .from("customer_addresses")
        .select("customer_id, address_line1, city, state, pin_code")
        .eq("is_default", true);

      if (addressesError) console.error("Failed fetching default customer addresses:", addressesError);

      const addressMap: Record<string, string> = {};
      (addressesData || []).forEach(addr => {
        if (addr.customer_id) {
          const pieces = [addr.address_line1, addr.city, addr.state, addr.pin_code].filter(Boolean);
          addressMap[addr.customer_id] = pieces.join(", ") || "No address provided";
        }
      });

      // Load aggregated information from orders table
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("customer_id, total_amount, created_at");

      if (ordersError) console.error("Failed fetching orders for aggregation:", ordersError);

      const ordersAggregation: Record<string, { count: number; spent: number; lastOrderTime: string | null }> = {};
      (ordersData || []).forEach(order => {
        if (!order.customer_id) return;
        if (!ordersAggregation[order.customer_id]) {
          ordersAggregation[order.customer_id] = { count: 0, spent: 0, lastOrderTime: null };
        }
        
        ordersAggregation[order.customer_id].count += 1;
        ordersAggregation[order.customer_id].spent += Number(order.total_amount || 0);
        
        const orderTime = order.created_at;
        if (orderTime) {
          if (!ordersAggregation[order.customer_id].lastOrderTime || new Date(orderTime) > new Date(ordersAggregation[order.customer_id].lastOrderTime!)) {
            ordersAggregation[order.customer_id].lastOrderTime = orderTime;
          }
        }
      });

      const mapped: Customer[] = (customersData || []).map((row) => {
        const agg = ordersAggregation[row.id] || { count: 0, spent: 0, lastOrderTime: null };
        
        let lastOrderText = "No orders placed";
        if (agg.lastOrderTime) {
          lastOrderText = new Date(agg.lastOrderTime).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
          });
        }

        return {
          id: row.id,
          name: row.customer_name || "Unnamed User",
          email: row.email || "—",
          phone: row.phone || "—",
          orders: agg.count, 
          spent: agg.spent,  
          status: row.status === "blocked" ? "blocked" : "active", 
          delivery_address: addressMap[row.id] || "No address provided",
          lastOrder: lastOrderText,
          lastOrderRaw: agg.lastOrderTime || undefined,
          joinedAt: row.created_at
            ? new Date(row.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—",
        };
      });

      setCustomerList(mapped);

      if (viewCustomer) {
        const updatedTarget = mapped.find((c) => c.id === viewCustomer.id);
        if (updatedTarget) setViewCustomer(updatedTarget);
      }
    } catch (err) {
      console.error("Failed parsing live customers database:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCustomerModalDetails(customerId: string) {
    try {
      // 1. Fetch Orders Telemetry mapped to precise database columns
      const { data: orders, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_id,
          vendor_id,
          rider_id,
          subtotal,
          delivery_fee,
          total_amount,
          payment_status,
          order_status,
          created_at,
          customer_address_id,
          payment_method,
          platform_fee,
          vendors ( shop_name ),
          riders ( rider_name )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (ordersErr) throw ordersErr;
      const safeOrders = orders || [];

      // Computations
      const total = safeOrders.length;
      const completed = safeOrders.filter(o => o.order_status === "delivered").length;
      const cancelled = safeOrders.filter(o => o.order_status === "cancelled").length;
      const pending = safeOrders.filter(o => 
        ["pending", "accepted", "preparing", "packed", "out_for_delivery"].includes(o.order_status || "")
      ).length;
      const spent = safeOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const avg = total > 0 ? spent / total : 0;
      
      let lastDateText = "No orders placed";
      if (safeOrders.length > 0 && safeOrders[0].created_at) {
        lastDateText = new Date(safeOrders[0].created_at).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
      }

      // Gather all order IDs to perform a batch lookup of order items
      const orderIds = safeOrders.map(o => o.id);
      let allItems: any[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from("order_items")
          .select(`
            order_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products ( name )
          `)
          .in("order_id", orderIds);
        if (!itemsErr && itemsData) {
          allItems = itemsData;
        }
      }

      // Gather all distinct customer_address_ids across orders for a batch address lookup
      const addressIds = safeOrders.map(o => o.customer_address_id).filter(Boolean);
      let addressMap: Record<string, string> = {};
      if (addressIds.length > 0) {
        const { data: addrsData } = await supabase
          .from("customer_addresses")
          .select("id, address_line1, address_line2, landmark, city, state, pin_code")
          .in("id", addressIds);
        if (addrsData) {
          addrsData.forEach(addr => {
            const pieces = [addr.address_line1, addr.address_line2, addr.landmark, addr.city, addr.state, addr.pin_code].filter(Boolean);
            addressMap[addr.id] = pieces.join(", ") || "No address provided";
          });
        }
      }

      // 2. Map items and addresses back to orders
      const ordersWithItems = safeOrders.map((o: any) => {
        const matchingItems = allItems.filter(i => i.order_id === o.id);
        const formattedItems = matchingItems.map((i: any) => ({
          item_name: i.products?.name || "Unknown Product",
          quantity: i.quantity,
          price: Number(i.unit_price || 0),
          total_price: Number(i.total_price || 0)
        }));
        
        const orderAddressStr = o.customer_address_id ? (addressMap[o.customer_address_id] || "No address provided") : "No address provided";

        return { ...o, items: formattedItems, delivery_address_computed: orderAddressStr };
      });
      setCustomerOrders(ordersWithItems);

      // 3. Fetch Refunds Information matching exact column layout
      const { data: refunds, error: refundsErr } = await supabase
        .from("refunds")
        .select("id, order_id, customer_id, vendor_id, amount, reason, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (refundsErr) throw refundsErr;
      
      const mappedRefunds = await Promise.all((refunds || []).map(async (r: any) => {
        let orderNum = "—";
        if (r.order_id) {
          const { data: oNumData } = await supabase.from("orders").select("order_number").eq("id", r.order_id).maybeSingle();
          if (oNumData) orderNum = oNumData.order_number;
        }
        return {
          id: r.id,
          order_number: orderNum,
          refund_amount: r.amount,
          reason: r.reason,
          status: r.status,
          created_at: r.created_at,
          processed_at: null 
        };
      }));
      setCustomerRefunds(mappedRefunds);

      // 4. Fetch Default Address Components
      const { data: addr } = await supabase
        .from("customer_addresses")
        .select("address_line1, address_line2, landmark, city, state, pin_code")
        .eq("customer_id", customerId)
        .eq("is_default", true)
        .maybeSingle();

      let fullAddrStr = "No address provided";
      if (addr) {
        fullAddrStr = [addr.address_line1, addr.address_line2, addr.landmark, addr.city, addr.state, addr.pin_code].filter(Boolean).join(", ");
      }

      setProfileMetrics({
        totalOrders: total,
        completedOrders: completed,
        cancelledOrders: cancelled,
        pendingOrders: pending,
        totalSpent: spent,
        lastOrderDate: lastDateText,
        fullAddress: fullAddrStr,
        avgOrderValue: avg
      });

    } catch (err) {
      console.error("Failed fetching context profiles metrics:", err);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
  }

  async function handleAddCustomer() {
    if (!formName || !formEmail || !formPhone || !formAddress) {
      alert("All fields marked with an asterisk (*) are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        customer_name: formName,
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        status: "active"
      };

      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([payload])
        .select()
        .single();

      if (customerError) throw customerError;

      if (newCustomer) {
        const addressPayload = {
          customer_id: newCustomer.id,
          address_line1: formAddress.trim(),
          city: "N/A",
          state: "N/A",
          pin_code: "N/A",
          is_default: true,
        };

        const { error: addressError } = await supabase
          .from("customer_addresses")
          .insert([addressPayload]);

        if (addressError) throw addressError;
      }

      resetForm();
      setAddOpen(false);
      await fetchCustomers();
      alert("Customer profile successfully created!");
    } catch (err: any) {
      console.error("Critical onboarding write error:", err);
      if (err.code === "23505") {
        alert("This email address is already registered to an existing customer.");
      } else {
        alert(`Failed to create customer: ${err.message || "Database structural error"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleBlock(id: string, currentStatus: CustomerStatus) {
    try {
      const nextStatus = currentStatus === "active" ? "blocked" : "active";
      const { error } = await supabase
        .from("customers")
        .update({ status: nextStatus })
        .eq("id", id);

      if (error) throw error;
      
      await fetchCustomers();
      alert(`Customer status updated to ${nextStatus}.`);
    } catch (err: any) {
      console.error("Failed status update toggling:", err);
      alert(`Failed to toggle status: ${err.message || "Database structural error"}`);
    }
  }

  async function handleDeleteCustomer(id: string, name: string) {
    const confirmation = window.confirm(`Are you absolutely sure you want to permanently delete customer account "${name}"? Warning: Deleting the customer may affect historical order records. This action cannot be undone.`);
    if (!confirmation) return;

    try {
      const { error: addressDeleteError } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("customer_id", id);
      if (addressDeleteError) console.error("Error purging associated address records:", addressDeleteError);

      const { error: customerDeleteError } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);
      if (customerDeleteError) throw customerDeleteError;

      setViewCustomer(null);
      await fetchCustomers();
    } catch (err) {
      console.error("Failed permanent record erasure transaction:", err);
      alert("Error executing data purge.");
    }
  }

  const filtered = customerList.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${customerList.filter((c) => c.status === "active").length} active customer profiles verified`}
        actions={
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => { resetForm(); setAddOpen(true); }}>
            Add Customer
          </Button>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search by name, email, phone or ID..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "active", "blocked"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn("h-7 px-3 rounded-md text-xs font-medium capitalize", statusFilter === s ? "bg-[#22C55E] text-white" : "text-[#64748B]")}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-visible relative z-10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Phone</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Orders</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Spent</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Last Order</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-16 text-sm text-[#94A3B8]">Loading data platform metrics...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-sm text-[#94A3B8]">No user customer records found.</td></tr>
            ) : (
              paginated.map((customer) => (
                <tr key={customer.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#F5F3FF] border border-[#EDE9FE] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-purple-600">{customer.name[0]}</span>
                      </div>
                      <div>
                        <button onClick={() => { setViewCustomer(customer); setActiveTab("profile"); fetchCustomerModalDetails(customer.id); }} className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] text-left">
                          {customer.name}
                        </button>
                        <p className="text-xs text-[#64748B]">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{customer.phone}</td>
                  <td className="px-4 py-3.5 text-right"><span className="text-sm font-medium text-[#0F172A]">{customer.orders}</span></td>
                  <td className="px-4 py-3.5 text-right"><span className="text-sm font-medium text-[#0F172A]">₹{customer.spent.toLocaleString()}</span></td>
                  <td className="px-4 py-3.5 text-sm text-[#64748B]">{customer.lastOrder}</td>
                  <td className="px-4 py-3.5">
                    <Badge variant={customer.status === "active" ? "success" : "error"} label={customer.status === "active" ? "Active" : "Blocked"} dot />
                  </td>
                  <td className="px-4 py-3.5 overflow-visible">
                    <Dropdown
                      align="right"
                      trigger={<button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"><MoreHorizontal className="w-4 h-4" /></button>}
                      items={[
                        { label: "View Profile", icon: <User className="w-3.5 h-3.5" />, onClick: () => { setViewCustomer(customer); setActiveTab("profile"); fetchCustomerModalDetails(customer.id); } },
                        {
                          label: customer.status === "active" ? "Block Customer" : "Unblock Customer",
                          icon: customer.status === "active" ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />,
                          onClick: () => toggleBlock(customer.id, customer.status),
                          variant: customer.status === "active" ? "danger" : "default",
                        },
                        { label: "Delete Permanent", icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />, onClick: () => handleDeleteCustomer(customer.id, customer.name), variant: "danger" as const, divider: true }
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalPages={Math.ceil(filtered.length / itemsPerPage)} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {/* Add Customer Modal Form */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Customer"
        description="Onboard a new consumer profile directly into the system data core."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleAddCustomer} disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Customer"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full Name *" placeholder="e.g. John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email Address *" type="email" placeholder="john.doe@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <Input label="Phone Number *" placeholder="e.g. +91 98765 43210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          </div>
          <Input label="Default Delivery Address *" placeholder="Flat No, Street, Landmark, City" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
        </div>
      </Modal>

      {/* View Customer Profile Modal */}
      {viewCustomer && (
        <Modal
          open={!!viewCustomer}
          onClose={() => setViewCustomer(null)}
          title={viewCustomer.name}
          description={`Customer Reference: ${viewCustomer.id} • Joined ${viewCustomer.joinedAt}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="destructive" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteCustomer(viewCustomer.id, viewCustomer.name)}>
                Delete Customer
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setViewCustomer(null)}>Close</Button>
                <Button
                  variant="destructive"
                  leftIcon={viewCustomer.status === "active" ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  onClick={() => { toggleBlock(viewCustomer.id, viewCustomer.status); setViewCustomer(null); }}
                >
                  {viewCustomer.status === "active" ? "Block Account" : "Unblock Account"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex gap-0 border-b border-[#E2E8F0] mb-6 -mt-2">
            {(["profile", "orders", "refunds"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn("px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px", activeTab === tab ? "border-[#22C55E] text-[#16A34A]" : "border-transparent text-[#64748B]")}
              >
                {tab === "orders" ? "Order History" : tab === "refunds" ? "Refund History" : "Profile"}
              </button>
            ))}
          </div>

          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Customer Name", value: viewCustomer.name, icon: <User className="w-3.5 h-3.5" /> },
                  { label: "Email", value: viewCustomer.email, icon: <Mail className="w-3.5 h-3.5" /> },
                  { label: "Phone", value: viewCustomer.phone, icon: <Phone className="w-3.5 h-3.5" /> },
                  { label: "Joined Date", value: viewCustomer.joinedAt, icon: <Calendar className="w-3.5 h-3.5" /> },
                  { label: "Last Order Date", value: profileMetrics.lastOrderDate, icon: <ShoppingBag className="w-3.5 h-3.5" /> },
                  { label: "Average Order Value", value: `₹${profileMetrics.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: <RefreshCcw className="w-3.5 h-3.5" /> }
                ].map((item) => (
                  <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-1">{item.icon}{item.label}</div>
                    <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] mb-1">
                  <MapPin className="w-3.5 h-3.5 text-[#22C55E]" /> Default Delivery Address
                </div>
                <p className="text-sm text-[#334155] font-medium pl-5">{profileMetrics.fullAddress}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg p-4 text-center">
                  <p className="text-2xl font-semibold text-[#16A34A]">{profileMetrics.totalOrders}</p>
                  <p className="text-xs text-[#64748B] mt-1">Total Orders</p>
                </div>
                <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-4 text-center">
                  <p className="text-2xl font-semibold text-blue-700">₹{profileMetrics.totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-[#64748B] mt-1">Total Spending</p>
                </div>
                <div className="rounded-lg p-4 text-center border flex flex-col items-center justify-center bg-[#F8FAFC] border-[#E2E8F0]">
                  <Badge variant={viewCustomer.status === "active" ? "success" : "error"} label={viewCustomer.status === "active" ? "Active" : "Blocked"} />
                  <p className="text-xs text-[#64748B] mt-2">Status</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#64748B] font-medium bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div>Completed Orders: <span className="font-bold text-[#16A34A]">{profileMetrics.completedOrders}</span></div>
                <div>Pending Orders: <span className="font-bold text-blue-600">{profileMetrics.pendingOrders}</span></div>
                <div>Cancelled Orders: <span className="font-bold text-rose-600">{profileMetrics.cancelledOrders}</span></div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {customerOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#94A3B8] italic">No recent delivery order interactions associated with this profile node.</div>
              ) : (
                customerOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <div key={order.id} className="border border-[#E2E8F0] rounded-xl p-3 bg-white space-y-2 text-xs">
                      <div className="flex items-center justify-between font-medium text-[#334155]">
                        <div>Order Number: <span 
                          onClick={() => { window.location.hash = `/orders?id=${order.id}`; }}
                          className="font-mono font-bold text-[#0F172A] cursor-pointer hover:text-[#22C55E] hover:underline"
                        >
                          #{order.order_number || order.id.slice(0, 8)}
                        </span></div>
                        <div className="text-[#64748B]">
                          Created At: {new Date(order.created_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[#475569]">
                        <div>Vendor: <span className="font-semibold text-[#0F172A]">{order.vendors?.shop_name || "—"}</span></div>
                        <div className="text-right font-bold text-[#0F172A]">Amount: ₹{order.total_amount}</div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="neutral" label={`Payment Method: ${order.payment_method || "—"}`} />
                        <Badge variant={order.payment_status === "paid" ? "success" : "warning"} label={`Payment Status: ${order.payment_status}`} />
                        <Badge variant={order.order_status === "delivered" ? "success" : order.order_status === "cancelled" ? "error" : "warning"} label={`Order Status: ${order.order_status}`} />
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full text-center flex items-center justify-center gap-1 text-[#64748B] hover:text-[#0F172A] font-medium pt-1 border-t border-[#F1F5F9]"
                      >
                        {isExpanded ? (
                          <>Hide Breakdown <ChevronUp size={14} /></>
                        ) : (
                          <>View Breakdown <ChevronDown size={14} /></>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2 text-[#475569] animate-in fade-in duration-100">
                          <div className="font-bold text-[#0F172A] mb-1">Items List</div>
                          <div className="space-y-1 divide-y divide-[#E2E8F0]/50">
                            <div className="grid grid-cols-4 font-semibold text-[#64748B] pb-1 text-[10px] uppercase">
                              <span>Product Name</span>
                              <span className="text-center">Quantity</span>
                              <span className="text-right">Unit Price</span>
                              <span className="text-right">Total Price</span>
                            </div>
                            {(order.items || []).map((item: any, idx: number) => (
                              <div key={idx} className="grid grid-cols-4 py-1 items-center">
                                <span className="truncate pr-1">{item.item_name}</span>
                                <span className="text-center">x{item.quantity}</span>
                                <span className="text-right">₹{item.price}</span>
                                <span className="font-medium text-[#0F172A] text-right">₹{item.total_price || (item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-[#E2E8F0] pt-2 space-y-1">
                            <div className="flex justify-between"><span>Subtotal:</span><span>₹{order.subtotal || 0}</span></div>
                            <div className="flex justify-between"><span>Delivery Fee:</span><span>₹{order.delivery_fee || 0}</span></div>
                            <div className="flex justify-between"><span>Platform Fee:</span><span>₹{order.platform_fee || 0}</span></div>
                            <div className="flex justify-between font-bold text-[#0F172A] pt-1 border-t border-dashed border-[#E2E8F0]">
                              <span>Total Amount:</span><span>₹{order.total_amount}</span>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E2E8F0] space-y-1">
                            <div>Rider Name: <span className="font-medium text-[#0F172A]">{order.riders?.rider_name || "Not Assigned"}</span></div>
                            <div className="break-words">Delivery Address: <span className="font-medium text-[#0F172A]">{order.delivery_address_computed || "—"}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {customerRefunds.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#94A3B8] italic">No refunds found.</div>
              ) : (
                customerRefunds.map((refund) => (
                  <div key={refund.id} className="border border-[#E2E8F0] rounded-xl p-3 bg-white space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-[#0F172A]">
                      <span>Refund ID: #{refund.id.slice(0, 8)}</span>
                      <span className="text-[#16A34A]">₹{refund.refund_amount}</span>
                    </div>
                    <div className="text-[#475569]">Order Number: <span className="font-mono font-medium">#{refund.order_number}</span></div>
                    <div className="text-[#475569] break-words">Reason: <span className="font-medium text-[#334155]">{refund.reason || "—"}</span></div>
                    <div className="flex items-center justify-between pt-1">
                      <Badge variant={refund.status === "completed" || refund.status === "approved" ? "success" : "warning"} label={refund.status || "pending"} />
                      <div className="text-[10px] text-[#94A3B8] space-y-0.5 text-right">
                        <div>Created Date: {refund.created_at ? new Date(refund.created_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}