import React, { useState } from "react";
import {
  Search,
  MoreHorizontal,
  ShoppingBag,
  RefreshCcw,
  ShieldOff,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../../lib/utils";

type CustomerStatus = "active" | "blocked";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  spent: number;
  status: CustomerStatus;
  joinedAt: string;
  lastOrder: string;
}

const customers: Customer[] = [
  {
    id: "C001",
    name: "Ananya Sharma",
    email: "ananya.sharma@gmail.com",
    phone: "+91 98765 43210",
    orders: 48,
    spent: 14820,
    status: "active",
    joinedAt: "10 Jan 2024",
    lastOrder: "2 hours ago",
  },
  {
    id: "C002",
    name: "Kiran Patel",
    email: "kpatel@outlook.com",
    phone: "+91 87654 32109",
    orders: 23,
    spent: 7640,
    status: "active",
    joinedAt: "03 Mar 2024",
    lastOrder: "Yesterday",
  },
  {
    id: "C003",
    name: "Meera Iyer",
    email: "meeraiyer@yahoo.in",
    phone: "+91 76543 21098",
    orders: 81,
    spent: 28450,
    status: "active",
    joinedAt: "22 Aug 2023",
    lastOrder: "3 days ago",
  },
  {
    id: "C004",
    name: "Rohan Desai",
    email: "rohan.desai@proton.me",
    phone: "+91 65432 10987",
    orders: 7,
    spent: 1920,
    status: "blocked",
    joinedAt: "15 Nov 2024",
    lastOrder: "2 weeks ago",
  },
  {
    id: "C005",
    name: "Lakshmi Venkat",
    email: "lvenkat@gmail.com",
    phone: "+91 99988 77665",
    orders: 134,
    spent: 42100,
    status: "active",
    joinedAt: "06 Jun 2023",
    lastOrder: "Today",
  },
];

export function Customers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [customerList, setCustomerList] = useState<Customer[]>(customers);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "refunds">("profile");
  const itemsPerPage = 10;

  const filtered = customerList.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function toggleBlock(id: string) {
    setCustomerList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: c.status === "blocked" ? "active" : "blocked" } : c))
    );
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${customerList.filter((c) => c.status === "active").length} active customers`}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 bg-white">
          {["all", "active", "blocked"].map((s) => (
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
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
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
            {paginated.map((customer) => (
              <tr key={customer.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#F5F3FF] border border-[#EDE9FE] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-purple-600">{customer.name[0]}</span>
                    </div>
                    <div>
                      <button
                        onClick={() => { setViewCustomer(customer); setActiveTab("profile"); }}
                        className="text-sm font-medium text-[#0F172A] hover:text-[#22C55E] transition-colors"
                      >
                        {customer.name}
                      </button>
                      <p className="text-xs text-[#64748B]">{customer.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#64748B]">{customer.phone}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-medium text-[#0F172A]">{customer.orders}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-medium text-[#0F172A]">₹{customer.spent.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#64748B]">{customer.lastOrder}</td>
                <td className="px-4 py-3.5">
                  <Badge
                    variant={customer.status === "active" ? "success" : "error"}
                    label={customer.status === "active" ? "Active" : "Blocked"}
                    dot
                  />
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
                        label: "View Profile",
                        icon: <User className="w-3.5 h-3.5" />,
                        onClick: () => { setViewCustomer(customer); setActiveTab("profile"); },
                      },
                      {
                        label: "Order History",
                        icon: <ShoppingBag className="w-3.5 h-3.5" />,
                        onClick: () => { setViewCustomer(customer); setActiveTab("orders"); },
                      },
                      {
                        label: "Refund History",
                        icon: <RefreshCcw className="w-3.5 h-3.5" />,
                        onClick: () => { setViewCustomer(customer); setActiveTab("refunds"); },
                      },
                      {
                        label: customer.status === "blocked" ? "Unblock Customer" : "Block Customer",
                        icon: customer.status === "blocked" ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />,
                        onClick: () => toggleBlock(customer.id),
                        variant: customer.status !== "blocked" ? "danger" : "default",
                        divider: true,
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
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

      {/* View Customer Modal */}
      {viewCustomer && (
        <Modal
          open={!!viewCustomer}
          onClose={() => setViewCustomer(null)}
          title={viewCustomer.name}
          description={`${viewCustomer.id} • Joined ${viewCustomer.joinedAt}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewCustomer(null)}>Close</Button>
              <Button
                variant={viewCustomer.status === "blocked" ? "primary" : "destructive"}
                leftIcon={viewCustomer.status === "blocked" ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                onClick={() => { toggleBlock(viewCustomer.id); setViewCustomer(null); }}
              >
                {viewCustomer.status === "blocked" ? "Unblock Customer" : "Block Customer"}
              </Button>
            </>
          }
        >
          {/* Tabs */}
          <div className="flex gap-0 border-b border-[#E2E8F0] mb-6 -mt-2">
            {(["profile", "orders", "refunds"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                  activeTab === tab
                    ? "border-[#22C55E] text-[#16A34A]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                )}
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
                  { label: "Last Order", value: viewCustomer.lastOrder, icon: <ShoppingBag className="w-3.5 h-3.5" /> },
                ].map((item) => (
                  <div key={item.label} className="bg-[#F8FAFC] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-1">
                      {item.icon}{item.label}
                    </div>
                    <p className="text-sm font-medium text-[#0F172A]">{item.value}</p>
                  </div>
                ))}
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
                <div className={cn(
                  "rounded-lg p-4 text-center border",
                  viewCustomer.status === "active" ? "bg-[#F0FDF4] border-[#DCFCE7]" : "bg-red-50 border-red-200"
                )}>
                  <Badge
                    variant={viewCustomer.status === "active" ? "success" : "error"}
                    label={viewCustomer.status === "active" ? "Active" : "Blocked"}
                  />
                  <p className="text-xs text-[#64748B] mt-2">Status</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-2">
              {[
                { id: "RIV-4821", vendor: "Green Basket", amount: 648, status: "Delivered", date: "Today, 2:14 PM" },
                { id: "RIV-4763", vendor: "Quick Mart", amount: 320, status: "Delivered", date: "12 Jun 2025" },
                { id: "RIV-4701", vendor: "Daily Grains", amount: 1240, status: "Cancelled", date: "08 Jun 2025" },
              ].map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">#{order.id}</p>
                    <p className="text-xs text-[#64748B]">{order.vendor} • {order.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#0F172A]">₹{order.amount}</span>
                    <Badge variant={order.status === "Delivered" ? "success" : "error"} label={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="space-y-2">
              {[
                { id: "REF-0089", order: "RIV-4701", amount: 1240, reason: "Order cancelled", status: "Approved", date: "09 Jun 2025" },
              ].map((refund) => (
                <div key={refund.id} className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0]">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">#{refund.id}</p>
                    <p className="text-xs text-[#64748B]">Order #{refund.order} • {refund.reason}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{refund.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#0F172A]">₹{refund.amount}</span>
                    <Badge variant="success" label={refund.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
