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
  Trash2
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

  // Form Controls
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const itemsPerPage = 10;

  async function fetchCustomers() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Customer[] = (data || []).map((row) => ({
        id: row.id,
        name: row.name || "Unnamed User",
        email: row.email || "—",
        phone: row.phone || "—",
        orders: row.total_orders || 0,
        spent: row.total_spent || 0,
        status: (row.status as CustomerStatus) || "active",
        delivery_address: row.delivery_address || "No address provided",
        lastOrder: row.last_order_at 
          ? new Date(row.last_order_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "No orders placed",
        joinedAt: row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—",
      }));

      setCustomerList(mapped);

      if (viewCustomer) {
        const updatedTarget = mapped.find((c) => c.id === viewCustomer.id);
        if (updatedTarget) setViewCustomer(updatedTarget);
      }
    } catch (err) {
      console.error("Failed parsing live customers database:", err);
    } finally {  // 🟢 Fixed here!
      setIsLoading(false);
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
        name: formName,
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        delivery_address: formAddress.trim(),
        status: "active",
        total_orders: 0,
        total_spent: 0.0,
      };

      const { error } = await supabase.from("customers").insert([payload]);
      if (error) throw error;

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
    const nextStatus: CustomerStatus = currentStatus === "blocked" ? "active" : "blocked";
    
    setCustomerList((prev) => prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c)));
    if (viewCustomer && viewCustomer.id === id) {
      setViewCustomer((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      const { error } = await supabase.from("customers").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;
      await fetchCustomers();
    } catch (err) {
      console.error("Failed syncing block configuration mutations:", err);
    }
  }

  async function handleDeleteCustomer(id: string, name: string) {
    const confirmation = window.confirm(`Are you absolutely sure you want to permanently delete customer account "${name}"? This action cannot be undone.`);
    if (!confirmation) return;

    try {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
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
      c.phone.includes(search);
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
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

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10">
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
                        <button onClick={() => { setViewCustomer(customer); setActiveTab("profile"); }} className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] text-left">
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
                  <td className="px-4 py-3.5"><Badge variant={customer.status === "active" ? "success" : "error"} label={customer.status === "active" ? "Active" : "Blocked"} dot /></td>
                  <td className="px-4 py-3.5">
                    <Dropdown
                      align="right"
                      trigger={<button className="h-7 w-7 flex items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"><MoreHorizontal className="w-4 h-4" /></button>}
                      items={[
                        { label: "View Profile", icon: <User className="w-3.5 h-3.5" />, onClick: () => { setViewCustomer(customer); setActiveTab("profile"); } },
                        {
                          label: customer.status === "blocked" ? "Unblock Customer" : "Block Customer",
                          icon: customer.status === "blocked" ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />,
                          onClick: () => toggleBlock(customer.id, customer.status),
                          variant: customer.status !== "blocked" ? "danger" : "default",
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
          description={`Customer Reference: ${viewCustomer.id.slice(0, 8)}... • Joined ${viewCustomer.joinedAt}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="destructive" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteCustomer(viewCustomer.id, viewCustomer.name)}>
                Delete Customer
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setViewCustomer(null)}>Close</Button>
                <Button
                  variant={viewCustomer.status === "blocked" ? "primary" : "destructive"}
                  leftIcon={viewCustomer.status === "blocked" ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                  onClick={() => { toggleBlock(viewCustomer.id, viewCustomer.status); setViewCustomer(null); }}
                >
                  {viewCustomer.status === "blocked" ? "Unblock Account" : "Block Account"}
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
                  { label: "Email", value: viewCustomer.email, icon: <Mail className="w-3.5 h-3.5" /> },
                  { label: "Phone", value: viewCustomer.phone, icon: <Phone className="w-3.5 h-3.5" /> },
                  { label: "Joined", value: viewCustomer.joinedAt, icon: <Calendar className="w-3.5 h-3.5" /> },
                  { label: "Last Order Update", value: viewCustomer.lastOrder, icon: <ShoppingBag className="w-3.5 h-3.5" /> },
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
                <p className="text-sm text-[#334155] font-medium pl-5">{viewCustomer.delivery_address}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg p-4 text-center">
                  <p className="text-2xl font-semibold text-[#16A34A]">{viewCustomer.orders}</p>
                  <p className="text-xs text-[#64748B] mt-1">Total Orders</p>
                </div>
                <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-4 text-center">
                  <p className="text-2xl font-semibold text-blue-700">₹{viewCustomer.spent.toLocaleString()}</p>
                  <p className="text-xs text-[#64748B] mt-1">Total Spent</p>
                </div>
                <div className={cn("rounded-lg p-4 text-center border flex flex-col items-center justify-center", viewCustomer.status === "active" ? "bg-[#F0FDF4] border-[#DCFCE7]" : "bg-red-50 border-red-200")}>
                  <Badge variant={viewCustomer.status === "active" ? "success" : "error"} label={viewCustomer.status === "active" ? "Active" : "Blocked"} />
                  <p className="text-xs text-[#64748B] mt-2">Status</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-2 max-h-[350px] overflow-y-auto text-center py-8 text-xs text-[#94A3B8] italic">
              No recent delivery order interactions associated with this profile node.
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="space-y-2 max-h-[350px] overflow-y-auto text-center py-8 text-xs text-[#94A3B8] italic">
              No recent platform refund ledger tracking items associated with this profile node.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}