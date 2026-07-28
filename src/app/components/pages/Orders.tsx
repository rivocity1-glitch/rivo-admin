import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  MapPin,
  User,
  Store,
  Bike,
  ShieldCheck,
  ChevronRight,
  Phone,
  Download,
  FileText,
  Clock,
  ExternalLink,
  Printer,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { SlideOver } from "../ui/Modal";
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

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderTracking {
  id: string;
  status: string;
  remarks: string;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address_complete: string;
  customer_city: string;
  customer_state: string;
  customer_pin_code: string;
  vendor_id: string;
  store_name: string;
  vendor_name: string;
  vendor_phone: string;
  vendor_address_complete: string;
  vendor_status: string;
  rider_id: string;
  rider_name: string;
  rider_phone: string;
  rider_vehicle_type: string;
  rider_vehicle_number: string;
  rider_availability_status: string;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
  order_status: OrderStatus;
  payment_status: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  customer_paid: number;
  vendor_earning: number;
  vendor_commission: number;
  rider_earning: number;
  rivo_delivery_margin: number;
  delivery_code: string;
  collection_method: string;
  delivery_distance_km: number;
  chargeable_distance_km: number;
  actual_distance_km: number;
  remarks: string;
  order_items: OrderItem[];
  order_tracking: OrderTracking[];
}

const statusConfig: Record<OrderStatus, { variant: any; label: string }> = {
  pending: { variant: "neutral", label: "Order Placed" },
  accepted: { variant: "info", label: "Vendor Accepted" },
  preparing: { variant: "warning", label: "Preparing" },
  packed: { variant: "orange", label: "Packed" },
  assigned: { variant: "purple", label: "Rider Assigned" },
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

const timelineSequence: string[] = [
  "pending",
  "accepted",
  "preparing",
  "packed",
  "assigned",
  "picked_up",
  "delivered"
];

const stepLabels: Record<string, string> = {
  pending: "Order Placed",
  accepted: "Vendor Accepted",
  preparing: "Preparing",
  packed: "Packed",
  assigned: "Rider Assigned",
  picked_up: "Picked Up",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded"
};

export function Orders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [riderFilter, setRiderFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const itemsPerPage = 10;

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customers (
            customer_name,
            phone
          ),
          customer_addresses (
            address_line1,
            address_line2,
            city,
            state,
            pin_code
          ),
          vendors (
            phone,
            shop_name,
            owner_name,
            vendor_profiles (
              store_name,
              address_line1,
              address_line2,
              city,
              state,
              pin_code,
              store_status
            )
          ),
          assigned_rider:riders!orders_rider_fk (
            id,
            rider_name,
            phone,
            vehicle_type,
            vehicle_number,
            availability_status
          ),
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            products (
              name
            )
          ),
          order_tracking (
            id,
            status,
            remarks,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Order[] = (data || []).map((row) => {
        const dbItems = row.order_items || [];
        const dbTracking = row.order_tracking || [];

        const vp = Array.isArray(row.vendors?.vendor_profiles)
          ? row.vendors?.vendor_profiles[0]
          : row.vendors?.vendor_profiles;

        const customerAddressStr = [
          row.customer_addresses?.address_line1,
          row.customer_addresses?.address_line2
        ]
          .filter(Boolean)
          .join(", ");

        const vendorAddressStr = [
          vp?.address_line1,
          vp?.address_line2
        ]
          .filter(Boolean)
          .join(", ");

        const mappedItems: OrderItem[] = dbItems.map((item: any) => ({
          id: item.id,
          product_name: item.products?.name || "Unknown Product",
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0
        }));

        return {
          id: row.id,
          order_number: row.order_number || "—",
          customer_name: row.customers?.customer_name || "—",
          customer_phone: row.customers?.phone || "—",
          customer_address_complete: customerAddressStr || "—",
          customer_city: row.customer_addresses?.city || "—",
          customer_state: row.customer_addresses?.state || "—",
          customer_pin_code: row.customer_addresses?.pin_code || "—",
          vendor_id: row.vendor_id || "",
          store_name: vp?.store_name || "",
          vendor_name: row.vendors?.owner_name || "",
          vendor_phone: row.vendors?.phone || "—",
          vendor_address_complete: vendorAddressStr || "—",
          vendor_status: vp?.store_status || "—",
          rider_id: row.assigned_rider?.id || "",
          rider_name: row.assigned_rider?.rider_name || "Not Assigned",
          rider_phone: row.assigned_rider?.phone || "—",
          rider_vehicle_type: row.assigned_rider?.vehicle_type || "—",
          rider_vehicle_number: row.assigned_rider?.vehicle_number || "—",
          rider_availability_status: row.assigned_rider?.availability_status || "—",
          subtotal: row.subtotal || 0,
          delivery_fee: row.delivery_fee || 0,
          platform_fee: row.platform_fee || 0,
          total_amount: row.total_amount || 0,
          order_status: (row.order_status as OrderStatus) || "pending",
          payment_status: row.payment_status || "pending",
          payment_method: row.payment_method || "cod",
          created_at: row.created_at,
          updated_at: row.updated_at,
          delivered_at: row.delivered_at,
          customer_paid: row.total_amount || 0,
          vendor_earning: row.vendor_earning || 0,
          vendor_commission: row.vendor_commission || 0,
          rider_earning: row.rider_earning || 0,
          rivo_delivery_margin: row.rivo_delivery_margin || 0,
          delivery_code: row.delivery_code || "—",
          collection_method: row.collection_method || "—",
          delivery_distance_km: row.delivery_distance_km || 0,
          chargeable_distance_km: row.chargeable_distance_km || 0,
          actual_distance_km: row.actual_distance_km || 0,
          remarks: row.remarks || "",
          order_items: mappedItems,
          order_tracking: dbTracking.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        };
      });

      setOrderList(mapped);
    } catch (err) {
      console.error("Failed fetching live platform orders:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();

    const orderChannel = supabase
      .channel("rivo_order_operations_matrix")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_tracking" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      const updated = orderList.find((o) => o.id === selectedOrder.id);
      if (updated) {
        setSelectedOrder(updated);
      }
    }
  }, [orderList]);

  useEffect(() => {
    if (selectedOrder) {
      setAdminNote(selectedOrder.remarks);
    }
  }, [selectedOrder?.id]);

  const handlePrintInvoice = (order: Order) => {
    const win = window.open("", "_blank");
    if (!win) return;

    const itemsHtml = order.order_items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${item.product_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">₹${item.unit_price}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold;">₹${item.total_price}</td>
        </tr>
      `
      )
      .join("");

    const orderDateStr = order.created_at
      ? new Date(order.created_at).toLocaleString("en-IN")
      : "—";
    const deliveredDateStr = order.delivered_at
      ? new Date(order.delivered_at).toLocaleString("en-IN")
      : "—";

    const invoiceContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${order.order_number}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #0F172A; padding: 40px; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 28px; font-weight: bold; margin: 0; color: #0F172A; }
            .meta { font-size: 14px; color: #64748B; text-align: right; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; font-size: 13px; }
            .card h3 { margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748B; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th { text-align: left; padding: 10px; background: #F1F5F9; color: #475569; font-weight: 600; border-bottom: 1px solid #E2E8F0; }
            .totals { width: 300px; margin-left: auto; font-size: 13px; }
            .totals div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F1F5F9; }
            .totals .grand-total { font-weight: bold; font-size: 16px; color: #2563EB; border-top: 2px solid #E2E8F0; border-bottom: none; padding-top: 10px; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 11px; background: #DCFCE7; color: #16A34A; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">INVOICE</h1>
              <p style="margin: 4px 0 0 0; color: #64748B; font-size: 14px;">Order #${order.order_number}</p>
            </div>
            <div class="meta">
              <p style="margin:0;"><strong>Order Date:</strong> ${orderDateStr}</p>
              <p style="margin:4px 0 0 0;"><strong>Delivered Date:</strong> ${deliveredDateStr}</p>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <h3>Customer Details</h3>
              <p style="margin: 0; font-weight: bold;">${order.customer_name}</p>
              <p style="margin: 4px 0;">Phone: ${order.customer_phone}</p>
              <p style="margin: 0;">${order.customer_address_complete}, ${order.customer_city}, ${order.customer_state} - ${order.customer_pin_code}</p>
            </div>
            <div class="card">
              <h3>Vendor Details</h3>
              <p style="margin: 0; font-weight: bold;">${order.store_name || order.vendor_name}</p>
              ${order.vendor_name ? `<p style="margin: 4px 0;">Owner: ${order.vendor_name}</p>` : ""}
              <p style="margin: 4px 0;">Phone: ${order.vendor_phone}</p>
              <p style="margin: 0;">${order.vendor_address_complete}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div>
              <span>Subtotal</span>
              <span>₹${order.subtotal}</span>
            </div>
            <div>
              <span>Delivery Fee</span>
              <span>₹${order.delivery_fee}</span>
            </div>
            <div>
              <span>Platform Fee</span>
              <span>₹${order.platform_fee}</span>
            </div>
            <div class="grand-total">
              <span>Grand Total</span>
              <span>₹${order.total_amount.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div style="margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 13px; display: flex; justify-content: space-between;">
            <div>
              <strong>Payment Method:</strong> <span style="text-transform: uppercase;">${order.payment_method}</span>
            </div>
            <div>
              <strong>Payment Status:</strong> <span class="status-badge">${order.payment_status}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(invoiceContent);
    win.document.close();
  };

  const uniqueVendorOptions = Array.from(
    new Map(
      orderList
        .filter((o) => o.vendor_id)
        .map((o) => {
          let label = "—";
          if (o.store_name && o.vendor_name) {
            label = `${o.store_name} — ${o.vendor_name}`;
          } else if (o.store_name) {
            label = o.store_name;
          } else if (o.vendor_name) {
            label = o.vendor_name;
          }
          return [o.vendor_id, { id: o.vendor_id, label }];
        })
    ).values()
  ).filter((v) => v.label !== "—");

  const uniqueRiders = Array.from(new Set(orderList.map((o) => o.rider_name))).filter((r) => r && r !== "Not Assigned");

  const filtered = orderList.filter((o) => {
    const matchSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.store_name.toLowerCase().includes(search.toLowerCase()) ||
      o.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      o.rider_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone.includes(search) ||
      o.vendor_phone.includes(search) ||
      o.rider_phone.includes(search);

    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const matchPayMethod = paymentMethodFilter === "all" || o.payment_method.toLowerCase() === paymentMethodFilter.toLowerCase();
    const matchPayStatus = paymentStatusFilter === "all" || o.payment_status.toLowerCase() === paymentStatusFilter.toLowerCase();
    const matchVendor = vendorFilter === "all" || o.vendor_id === vendorFilter;
    const matchRider = riderFilter === "all" || o.rider_name === riderFilter;

    let matchDate = true;
    if (dateRangeFilter !== "all" && o.created_at) {
      const orderTime = new Date(o.created_at).getTime();
      const threshold = new Date();
      if (dateRangeFilter === "today") threshold.setHours(0, 0, 0, 0);
      else if (dateRangeFilter === "7days") threshold.setDate(threshold.getDate() - 7);
      else if (dateRangeFilter === "30days") threshold.setDate(threshold.getDate() - 30);
      matchDate = orderTime >= threshold.getTime();
    }

    return matchSearch && matchStatus && matchPayMethod && matchPayStatus && matchVendor && matchRider && matchDate;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ["Order ID,Customer,Store,Vendor Business,Rider,Amount,Status,Payment Method,Payment Status,Placed Time"];
    const rows = filtered.map(o => `"${o.order_number}","${o.customer_name}","${o.store_name}","${o.vendor_name}","${o.rider_name}",${o.total_amount},"${o.order_status}","${o.payment_method}","${o.payment_status}","${o.created_at}"`);
    const blob = new Blob([headers.concat(rows).join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Order_Operations_Center_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  const handleExportExcel = () => {
    let html = "<table><tr><th>Order ID</th><th>Customer</th><th>Store Name</th><th>Vendor Name</th><th>Rider</th><th>Amount</th><th>Status</th><th>Payment Method</th><th>Payment Status</th><th>Placed Time</th></tr>";
    filtered.forEach(o => {
      html += `<tr><td>${o.order_number}</td><td>${o.customer_name}</td><td>${o.store_name}</td><td>${o.vendor_name}</td><td>${o.rider_name}</td><td>${o.total_amount}</td><td>${o.order_status}</td><td>${o.payment_method}</td><td>${o.payment_status}</td><td>${o.created_at}</td></tr>`;
    });
    html += "</table>";
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Order_Operations_Center_${new Date().toISOString().slice(0, 10)}.xls`);
    link.click();
  };

  const handleExportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    let table = "<style>table{width:100%;border-collapse:collapse;}th,td{border:1px solid #E2E8F0;padding:8px;font-size:12px;text-align:left;}</style><h3>Operational Order Logs Manifest</h3><table><tr><th>Order Number</th><th>Customer</th><th>Store / Vendor</th><th>Rider</th><th>Total Amount</th><th>Status</th><th>Placed At</th></tr>";
    filtered.forEach(o => {
      const storeVendorStr = o.store_name && o.vendor_name ? `${o.store_name} (${o.vendor_name})` : o.store_name || o.vendor_name || "—";
      table += `<tr><td>#${o.order_number}</td><td>${o.customer_name}</td><td>${storeVendorStr}</td><td>${o.rider_name}</td><td>₹${o.total_amount}</td><td>${o.order_status}</td><td>${o.created_at}</td></tr>`;
    });
    table += "</table>";
    win.document.write(table);
    win.document.close();
    win.print();
  };

  const getTimelineSteps = (order: Order) => {
    const logsMap = new Map<string, string>();
    order.order_tracking.forEach((t) => {
      logsMap.set(t.status.toLowerCase(), new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });

    if (order.order_status === "cancelled" || order.order_status === "refunded") {
      return [
        { key: "pending", label: "Order Placed", timestamp: logsMap.get("pending") || new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), done: true, current: false },
        { key: order.order_status, label: stepLabels[order.order_status], timestamp: new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), done: true, current: true }
      ];
    }

    const currentIdx = timelineSequence.indexOf(order.order_status);
    return timelineSequence.map((stepKey, idx) => {
      const isDone = idx <= currentIdx || logsMap.has(stepKey);
      const isCurrent = order.order_status === stepKey;
      let timeStr = logsMap.get(stepKey);

      if (!timeStr && isDone) {
        if (stepKey === "pending") timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        else if (stepKey === "delivered" && order.delivered_at) timeStr = new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        else timeStr = "Completed";
      }

      return {
        key: stepKey,
        label: stepLabels[stepKey],
        timestamp: timeStr || "Waiting",
        done: isDone,
        current: isCurrent
      };
    });
  };

  async function handleSaveNote() {
    if (!selectedOrder) return;
    try {
      setNoteSaving(true);
      const { error } = await supabase
        .from("orders")
        .update({ remarks: adminNote })
        .eq("id", selectedOrder.id);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error("Failed to commit operational admin note:", err);
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Rivo Order Operations Center"
        description={`${filtered.length} matching parameters tracked (Active Monitoring Hub)`}
      />

      {/* Control filter panel workspace */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shadow-sm relative z-20">
        <div>
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Payment Method</label>
          <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="w-full h-8 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E]">
            <option value="all">All Methods</option>
            <option value="cod">Cash On Delivery</option>
            <option value="upi">UPI Collection</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Payment Status</label>
          <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="w-full h-8 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E]">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Date Horizon</label>
          <select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)} className="w-full h-8 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E]">
            <option value="all">All Logs History</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Filter Vendor Store</label>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-full h-8 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E]">
            <option value="all">All Vendors</option>
            {uniqueVendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Filter Logistics Rider</label>
          <select value={riderFilter} onChange={(e) => setRiderFilter(e.target.value)} className="w-full h-8 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:border-[#22C55E]">
            <option value="all">All Riders</option>
            {uniqueRiders.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="grid grid-cols-3 gap-1">
            <button onClick={handleExportCSV} title="Export CSV Data" className="h-8 flex items-center justify-center border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors"><FileText className="w-3.5 h-3.5" /></button>
            <button onClick={handleExportExcel} title="Export Excel Document" className="h-8 flex items-center justify-center border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors"><Download className="w-3.5 h-3.5" /></button>
            <button onClick={handleExportPDF} title="Print manifest summary" className="h-8 flex items-center justify-center border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors"><CheckCircle2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Real-time Order Stream Navigation Board Tabs */}
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

      {/* Global telemetry filter query search input */}
      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, user name, stores..."
          className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E]"
        />
      </div>

      {/* Dynamic Data Board View Grid Matrix */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden relative z-10 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Order Number</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Store / Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Logistics Courier</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Fulfillment Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Timestamp</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24 mb-1" /><div className="h-3 bg-slate-200 rounded w-20" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-28 mb-1" /><div className="h-3 bg-slate-200 rounded w-20" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                  <td className="px-4 py-4 text-right"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
                  <td className="px-4 py-4"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                  <td className="px-4 py-4"><div className="h-6 bg-slate-200 rounded w-6" /></td>
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-sm text-[#94A3B8]">No parameters detected matching operational query horizons.</td></tr>
            ) : (
              paginated.map((order) => {
                const conf = statusConfig[order.order_status] || { variant: "neutral", label: order.order_status };
                
                const storeText = order.store_name || order.vendor_name || "—";
                const showVendorText = order.store_name && order.vendor_name;

                return (
                  <tr key={order.id} className="hover:bg-[#FAFAFA] transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-mono font-medium text-[#0F172A]">#{order.order_number}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-[#0F172A]">{order.customer_name}</p>
                      <p className="text-xs text-[#64748B]">{order.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-[#0F172A]">{storeText}</p>
                      {showVendorText && (
                        <p className="text-xs text-[#64748B]">{order.vendor_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">{order.rider_name}</td>
                    <td className="px-4 py-3.5 text-right"><span className="text-sm font-medium text-[#0F172A]">₹{order.total_amount.toLocaleString("en-IN")}</span></td>
                    <td className="px-4 py-3.5"><Badge variant={conf.variant} label={conf.label} dot /></td>
                    <td className="px-4 py-3.5 text-sm text-[#64748B]">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
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

      {/* Operations Room Deep Inspection Slide Panel */}
      {selectedOrder && (
        <SlideOver open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order Details • #${selectedOrder.order_number}`} width="max-w-2xl">
          <div className="p-6 space-y-6 max-h-[88vh] overflow-y-auto bg-[#F8FAFC]/40">
            
            {/* 3. ORDER HEADER CARD PANEL */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F1F5F9] pb-3 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">System Order Number</span>
                  <h4 className="text-base font-mono font-black text-[#0F172A]">#{selectedOrder.order_number}</h4>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOrder.order_status === "delivered" && (
                    <button
                      onClick={() => handlePrintInvoice(selectedOrder)}
                      className="h-7 px-2.5 flex items-center gap-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] rounded-md text-xs font-semibold transition-colors shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Print Invoice</span>
                    </button>
                  )}
                  <Badge 
                    variant={(statusConfig[selectedOrder.order_status] || { variant: "neutral" }).variant} 
                    label={(statusConfig[selectedOrder.order_status] || { label: selectedOrder.order_status }).label.toUpperCase()} 
                    dot 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[#64748B] block font-medium mb-0.5">Payment Status</span>
                  <span className={cn("font-bold capitalize", selectedOrder.payment_status === "paid" ? "text-green-600" : "text-amber-500")}>
                    {selectedOrder.payment_status}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium mb-0.5">Payment Method</span>
                  <span className="font-bold uppercase text-[#334155]">{selectedOrder.payment_method}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium mb-0.5">Placed Time</span>
                  <span className="font-medium text-[#475569]">
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-medium mb-0.5">Delivered Time</span>
                  <span className="font-medium text-[#475569]">
                    {selectedOrder.delivered_at ? new Date(selectedOrder.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 10. DELIVERY OTP AUDIT SHIELD HANDSHAKE */}
            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", selectedOrder.order_status === "delivered" ? "bg-[#F0FDF4] border-[#DCFCE7] text-green-600" : "bg-[#FFF7ED] border-[#FFEDD5] text-orange-500")}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">Fulfillment Delivery Handshake Token</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {selectedOrder.order_status === "delivered" 
                      ? "Security handshake confirmation verified completely" 
                      : "Awaiting customer authentication code verification token receipt"}
                  </p>
                </div>
              </div>
              <div>
                {selectedOrder.order_status === "delivered" ? (
                  <span className="text-xs font-mono font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0] px-3 py-1 rounded-lg">VERIFIED ({selectedOrder.delivery_code})</span>
                ) : (
                  <span className="text-xs font-mono font-bold bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5] px-3 py-1 rounded-lg">WAITING ({selectedOrder.delivery_code})</span>
                )}
              </div>
            </div>

            {/* 4. REAL-TIME GRANULAR ORDER TIMELINE */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-2 mb-4">Fulfillment Life-cycle Tracking</p>
              <div className="relative pl-6 space-y-4 border-l-2 border-[#E2E8F0]">
                {getTimelineSteps(selectedOrder).map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className={cn(
                      "absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all",
                      step.current ? "border-[#2563EB] scale-110" : step.done ? "border-[#16A34A] bg-[#16A34A]" : "border-[#CBD5E1]"
                    )}>
                      {step.done && !step.current && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {step.current && <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-xs font-semibold", step.current ? "text-[#2563EB]" : step.done ? "text-[#0F172A]" : "text-[#94A3B8]")}>
                        {step.label}
                      </p>
                      <span className="text-[10px] font-mono text-[#64748B] bg-[#F8FAFC] px-1.5 py-0.5 border border-[#E2E8F0]/40 rounded">
                        {step.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. ORDER ITEMS PROCESSED MANIFEST */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-2 mb-3">Itemized Product Manifest</p>
              <div className="divide-y divide-[#F1F5F9]">
                {selectedOrder.order_items.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] py-2">No product relationship nodes linked to this transaction record.</p>
                ) : (
                  selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-[#0F172A]">{item.product_name}</p>
                        <p className="text-[#64748B] mt-0.5">Quantity: {item.quantity} × ₹{item.unit_price}</p>
                      </div>
                      <p className="font-mono font-bold text-[#475569]">₹{item.total_price}</p>
                    </div>
                  ))
                )}
              </div>
              
              <div className="border-t border-[#E2E8F0] mt-3 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{selectedOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Delivery Fee</span>
                  <span className="font-mono">₹{selectedOrder.delivery_fee}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Platform Fee</span>
                  <span className="font-mono">₹{selectedOrder.platform_fee}</span>
                </div>
                <div className="flex justify-between text-[#0F172A] font-bold text-sm border-t border-[#F1F5F9] pt-2">
                  <span>Grand Total</span>
                  <span className="font-mono text-[#2563EB]">₹{selectedOrder.total_amount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* 9. IMMUTABLE PAYMENT SPLIT AUDIT DISPERSAL CARD */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-2 mb-3">Finance Split Auditable Dispersal Ledger</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Customer Paid</span>
                  <span className="font-mono font-bold text-[#0F172A] text-sm">₹{selectedOrder.customer_paid}</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Vendor Earning</span>
                  <span className="font-mono font-bold text-[#16A34A] text-sm">₹{selectedOrder.vendor_earning}</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Vendor Commission</span>
                  <span className="font-mono font-bold text-[#EA580C] text-sm">₹{selectedOrder.vendor_commission}</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Rider Earning</span>
                  <span className="font-mono font-bold text-[#7C3AED] text-sm">₹{selectedOrder.rider_earning}</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Platform Fee</span>
                  <span className="font-mono font-bold text-[#2563EB] text-sm">₹{selectedOrder.platform_fee}</span>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0]/60 p-2.5 rounded-lg">
                  <span className="text-[#64748B] block text-[10px] font-bold uppercase tracking-wide">Delivery Margin</span>
                  <span className="font-mono font-bold text-[#0284C7] text-sm">₹{selectedOrder.rivo_delivery_margin}</span>
                </div>
              </div>
            </div>

            {/* COMMUNICATIONS STACK ENTITIES LINK */}
            <div className="space-y-3">
              {/* 6. CUSTOMER PROFILE OPERATION CARD */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0"><User className="w-4 h-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Customer Dispatch Details</span>
                    <p className="text-sm font-bold text-[#0F172A] mt-0.5">{selectedOrder.customer_name}</p>
                    <p className="text-xs text-[#64748B] font-medium mt-1 flex items-center gap-1 flex-wrap">
                      <MapPin className="w-3 h-3 text-[#94A3B8]" />
                      {selectedOrder.customer_address_complete}, {selectedOrder.customer_city}, {selectedOrder.customer_state} - <span className="font-mono font-bold">{selectedOrder.customer_pin_code}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <a href={`tel:${selectedOrder.customer_phone}`} className="h-8 px-3 rounded-lg border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155]"><Phone className="w-3 h-3" /> Call</a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedOrder.customer_address_complete} ${selectedOrder.customer_city} ${selectedOrder.customer_pin_code}`)}`} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155]"><ExternalLink className="w-3 h-3" /> Maps</a>
                </div>
              </div>

              {/* 7. MERCHANT VENDOR CARD MODULE */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0"><Store className="w-4 h-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Merchant</span>
                    <p className="text-sm font-bold text-[#0F172A] mt-0.5">
                      {selectedOrder.store_name || selectedOrder.vendor_name || "—"} 
                      <span className="text-[10px] font-normal border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#475569] ml-1.5 capitalize">{selectedOrder.vendor_status}</span>
                    </p>
                    {selectedOrder.vendor_name && (
                      <p className="text-xs text-[#64748B] font-medium mt-0.5">
                        <span className="font-semibold text-[#475569]">Vendor:</span> {selectedOrder.vendor_name}
                      </p>
                    )}
                    <p className="text-xs text-[#64748B] font-medium mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-[#94A3B8]" />{selectedOrder.vendor_address_complete}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <a href={`tel:${selectedOrder.vendor_phone}`} className="h-8 px-3 rounded-lg border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155]"><Phone className="w-3 h-3" /> Call</a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.vendor_address_complete)}`} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155]"><ExternalLink className="w-3 h-3" /> Maps</a>
                </div>
              </div>

              {/* 8. COURIER LOGISTICS RIDER PROFILE PROFILE */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0"><Bike className="w-4 h-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Logistics Courier Profile</span>
                    <p className="text-sm font-bold text-[#0F172A] mt-0.5">{selectedOrder.rider_name}</p>
                    {selectedOrder.rider_id && (
                      <p className="text-[11px] text-[#64748B] mt-1 font-medium">
                        Vehicle: <span className="text-[#0F172A] font-bold">{selectedOrder.rider_vehicle_number}</span> ({selectedOrder.rider_vehicle_type}) • Status: <span className="text-[#2563EB] capitalize">{selectedOrder.rider_availability_status}</span>
                      </p>
                    )}
                  </div>
                </div>
                {selectedOrder.rider_id && (
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <a href={`tel:${selectedOrder.rider_phone}`} className="h-8 px-3 rounded-lg border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155]"><Phone className="w-3 h-3" /> Call</a>
                  </div>
                )}
              </div>
            </div>

            {/* 11. GENERAL LOGISTICAL ORDER INFORMATION TELEMETRY */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm text-xs space-y-2">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-2 mb-3">Logistical Distance & Timestamps Manifest</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Order Number</span><span className="font-mono font-bold text-[#0F172A]">#{selectedOrder.order_number}</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Created At</span><span className="text-[#475569] font-medium">{selectedOrder.created_at || "—"}</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Updated At</span><span className="text-[#475569] font-medium">{selectedOrder.updated_at || "—"}</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Delivered At</span><span className="text-[#475569] font-medium">{selectedOrder.delivered_at || "—"}</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Collection Method</span><span className="text-[#475569] font-medium uppercase">{selectedOrder.collection_method}</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Delivery Distance</span><span className="text-[#475569] font-medium font-mono">{selectedOrder.delivery_distance_km} km</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Chargeable Distance</span><span className="text-[#475569] font-medium font-mono">{selectedOrder.chargeable_distance_km} km</span></div>
                <div className="flex justify-between border-b border-[#F8FAFC] pb-1"><span className="text-[#64748B]">Actual Distance</span><span className="text-[#475569] font-medium font-mono">{selectedOrder.actual_distance_km} km</span></div>
              </div>
            </div>

            {/* 12. CHRONOLOGICAL SYSTEM ACTIVITY LOGS FEED */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-2 mb-3">Operational Activity Log History</p>
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                {selectedOrder.order_tracking.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-[#94A3B8] py-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting operational log history transmissions...</span>
                  </div>
                ) : (
                  selectedOrder.order_tracking.map((log) => (
                    <div key={log.id} className="text-xs flex justify-between items-start gap-4 p-2 bg-[#F8FAFC] border border-[#E2E8F0]/40 rounded-lg">
                      <div>
                        <span className="font-bold text-[#334155] block capitalize">{log.status}</span>
                        {log.remarks && <p className="text-[#64748B] mt-0.5 text-[11px] font-medium">{log.remarks}</p>}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#94A3B8] whitespace-nowrap bg-[#fff] px-1.5 py-0.5 rounded shadow-sm border border-[#E2E8F0]/40">
                        {new Date(log.created_at).toLocaleString("en-GB", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 13. INTERNAL ADMIN REMARKS SECTION */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide border-b border-[#F1F5F9] pb-1">Internal Operations Notes</p>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Write operational incident notes, support details or auditable context remarks here..."
                className="w-full h-20 p-2 border border-[#E2E8F0] rounded-lg text-xs outline-none focus:border-[#2563EB] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8]"
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={handleSaveNote} disabled={noteSaving}>
                  {noteSaving ? "Committing Notes..." : "Save Audit Remarks"}
                </Button>
              </div>
            </div>

          </div>
        </SlideOver>
      )}
    </div>
  );
}