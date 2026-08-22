import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type SettlementType = "vendor" | "rider";

type SettlementStatus =
  | "AVAILABLE"
  |  "REQUESTED"
  | "PAID"
  | "pending"
  | "pending_request"
  | "paid"
  | "rejected"
  | string;

interface VendorSettlement {
  id: string;
  vendor_id: string;
  amount: number;
  order_ids: string[];
  order_count?: number;
  status: SettlementStatus;
  created_at: string;
  paid_at?: string | null;
  payment_method?: string | null;
  utr_number?: string | null;
  remarks?: string | null;
  settlement_type?: string | null;
  requested_by?: string | null;
  request_date?: string | null;
}

interface RiderSettlement {
  id: string;
  rider_id: string;
  amount: number;
  order_ids: string[];
  delivery_count?: number;
  status: SettlementStatus;
  created_at: string;
  paid_at?: string | null;
  payment_method?: string | null;
  utr_number?: string | null;
  remarks?: string | null;
  settlement_type?: string | null;
  requested_by?: string | null;
  request_date?: string | null;
}

interface Order {
  id: string;
  order_number?: string | null;
  vendor_id?: string | null;
  rider_id?: string | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  platform_fee?: number | null;
  total_amount?: number | null;
  payment_status?: string | null;
  order_status?: string | null;
  payment_method?: string | null;
  delivery_distance_km?: number | null;
  actual_distance_km?: number | null;
  chargeable_distance_km?: number | null;
  rider_earning?: number | null;
  rivo_delivery_margin?: number | null;
  vendor_commission?: number | null;
  vendor_earning?: number | null;
  settled_vendor?: boolean | null;
  settled_rider?: boolean | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface LedgerEntry {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  transaction_type: string;
  amount: number;
  reference_id?: string | null;
  remarks?: string | null;
  created_at: string;
  entry_type: string;
  status?: string | null;
  metadata?: Record<string, any> | null;
}

interface Vendor {
  id: string;
  shop_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Rider {
  id: string;
  rider_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface HistoryRow {
  id: string;
  type: SettlementType;
  entityId: string;
  entityName: string;
  settlementId: string;
  settlementStatus: string;
  settlementDate: string;
  paidDate: string | null;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  amount: number;
  paymentMethod: string;
  utr: string;
}

function money(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status?: string | null) {
  return String(status || "").toUpperCase();
}

function isPaid(status?: string | null) {
  return normalizeStatus(status) === "PAID";
}

function isPending(status?: string | null) {
  const value = normalizeStatus(status);

  return (
    value === "REQUESTED" ||
    value === "PENDING" ||
    value === "PENDING_REQUEST"
  );
}

function isAvailable(status?: string | null) {
  const value = normalizeStatus(status);

  return value === "AVAILABLE" || value === "PENDING";
}

export function Settlements() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "vendor" | "rider" | "ledger" | "audit"
  >("overview");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const [vendorSettlements, setVendorSettlements] = useState<
    VendorSettlement[]
  >([]);

  const [riderSettlements, setRiderSettlements] = useState<
    RiderSettlement[]
  >([]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedSettlement, setSelectedSettlement] = useState<
    VendorSettlement | RiderSettlement | null
  >(null);

  const [selectedType, setSelectedType] =
    useState<SettlementType>("vendor");

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const [formUtr, setFormUtr] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] =
    useState("Bank Transfer");

  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const realtimeLock = useRef(false);

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error" = "success"
    ) => {
      setToast({ message, type });

      window.setTimeout(() => {
        setToast(null);
      }, 3500);
    },
    []
  );

  const loadData = useCallback(
    async (showLoader = true) => {
      if (realtimeLock.current) return;

      realtimeLock.current = true;

      try {
        if (showLoader) {
          setLoading(true);
        }

        const [
          vendorSettlementResult,
          riderSettlementResult,
          vendorsResult,
          ridersResult,
          ordersResult,
          ledgerResult,
        ] = await Promise.all([
          supabase
            .from("vendor_settlements")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("rider_settlements")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase.from("vendors").select("*"),

          supabase.from("riders").select("*"),

          supabase
            .from("orders")
            .select(
              `
              id,
              order_number,
              vendor_id,
              rider_id,
              subtotal,
              delivery_fee,
              platform_fee,
              total_amount,
              payment_status,
              order_status,
              payment_method,
              delivery_distance_km,
              actual_distance_km,
              chargeable_distance_km,
              rider_earning,
              rivo_delivery_margin,
              vendor_commission,
              vendor_earning,
              settled_vendor,
              settled_rider,
              delivered_at,
              created_at,
              updated_at
            `
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("financial_ledger")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (vendorSettlementResult.error) {
          throw vendorSettlementResult.error;
        }

        if (riderSettlementResult.error) {
          throw riderSettlementResult.error;
        }

        if (vendorsResult.error) {
          throw vendorsResult.error;
        }

        if (ridersResult.error) {
          throw ridersResult.error;
        }

        if (ordersResult.error) {
          throw ordersResult.error;
        }

        if (ledgerResult.error) {
          throw ledgerResult.error;
        }

        setVendorSettlements(
          (vendorSettlementResult.data || []) as VendorSettlement[]
        );

        setRiderSettlements(
          (riderSettlementResult.data || []) as RiderSettlement[]
        );

        setVendors((vendorsResult.data || []) as Vendor[]);
        setRiders((ridersResult.data || []) as Rider[]);
        setOrders((ordersResult.data || []) as Order[]);
        setLedger((ledgerResult.data || []) as LedgerEntry[]);
      } catch (error: any) {
        console.error("Settlements loading error:", error);

        showToast(
          error?.message || "Failed to load settlement data.",
          "error"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        realtimeLock.current = false;
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const tables = [
      "vendor_settlements",
      "rider_settlements",
      "orders",
      "financial_ledger",
      "vendors",
      "riders",
    ];

    const channels = tables.map((table) =>
      supabase
        .channel(`admin-settlements-${table}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
          },
          () => {
            loadData(false);
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [loadData]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();

    vendors.forEach((vendor) => {
      map.set(vendor.id, vendor);
    });

    return map;
  }, [vendors]);

  const riderMap = useMemo(() => {
    const map = new Map<string, Rider>();

    riders.forEach((rider) => {
      map.set(rider.id, rider);
    });

    return map;
  }, [riders]);

  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();

    orders.forEach((order) => {
      map.set(order.id, order);
    });

    return map;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const orderNumber =
        order.order_number?.toLowerCase() || "";

      const orderId = order.id.toLowerCase();

      const matchesSearch =
        !search ||
        orderNumber.includes(search) ||
        orderId.includes(search);

      const createdTime = new Date(order.created_at).getTime();

      let matchesDate = true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`).getTime();
        matchesDate = createdTime >= start;
      }

      if (matchesDate && endDate) {
        const end = new Date(`${endDate}T23:59:59.999`).getTime();
        matchesDate = createdTime <= end;
      }

      return matchesSearch && matchesDate;
    });
  }, [orders, globalSearch, startDate, endDate]);

  const filteredLedger = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();

    return ledger.filter((item) => {
      if (!search) return true;

      return (
        item.transaction_type?.toLowerCase().includes(search) ||
        item.remarks?.toLowerCase().includes(search) ||
        item.reference_id?.toLowerCase().includes(search) ||
        item.entity_type?.toLowerCase().includes(search)
      );
    });
  }, [ledger, globalSearch]);

  const vendorRows = useMemo(() => {
    return vendorSettlements.filter((settlement) => {
      const vendor = vendorMap.get(settlement.vendor_id);

      const search = globalSearch.trim().toLowerCase();

      if (!search) return true;

      return (
        vendor?.shop_name?.toLowerCase().includes(search) ||
        vendor?.owner_name?.toLowerCase().includes(search) ||
        vendor?.phone?.toLowerCase().includes(search) ||
        settlement.utr_number?.toLowerCase().includes(search) ||
        settlement.id.toLowerCase().includes(search)
      );
    });
  }, [vendorSettlements, vendorMap, globalSearch]);

  const riderRows = useMemo(() => {
    return riderSettlements.filter((settlement) => {
      const rider = riderMap.get(settlement.rider_id);

      const search = globalSearch.trim().toLowerCase();

      if (!search) return true;

      return (
        rider?.rider_name?.toLowerCase().includes(search) ||
        rider?.email?.toLowerCase().includes(search) ||
        rider?.phone?.toLowerCase().includes(search) ||
        settlement.utr_number?.toLowerCase().includes(search) ||
        settlement.id.toLowerCase().includes(search)
      );
    });
  }, [riderSettlements, riderMap, globalSearch]);

  const historyRows = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [];

    vendorSettlements.forEach((settlement) => {
      const vendor = vendorMap.get(settlement.vendor_id);

      const orderIds = Array.isArray(settlement.order_ids)
        ? settlement.order_ids
        : [];

      orderIds.forEach((orderId) => {
        const order = orderMap.get(orderId);

        if (!order) return;

        rows.push({
          id: `${settlement.id}-${order.id}`,
          type: "vendor",
          entityId: settlement.vendor_id,
          entityName:
            vendor?.shop_name ||
            vendor?.owner_name ||
            "Unknown Vendor",
          settlementId: settlement.id,
          settlementStatus: settlement.status,
          settlementDate: settlement.created_at,
          paidDate: settlement.paid_at || null,
          orderId: order.id,
          orderNumber: order.order_number || order.id,
          orderDate:
            order.delivered_at ||
            order.created_at,
          amount: Number(order.vendor_earning || 0),
          paymentMethod:
            settlement.payment_method || "—",
          utr: settlement.utr_number || "—",
        });
      });
    });

    riderSettlements.forEach((settlement) => {
      const rider = riderMap.get(settlement.rider_id);

      const orderIds = Array.isArray(settlement.order_ids)
        ? settlement.order_ids
        : [];

      orderIds.forEach((orderId) => {
        const order = orderMap.get(orderId);

        if (!order) return;

        rows.push({
          id: `${settlement.id}-${order.id}`,
          type: "rider",
          entityId: settlement.rider_id,
          entityName:
            rider?.rider_name ||
            rider?.email ||
            "Unknown Rider",
          settlementId: settlement.id,
          settlementStatus: settlement.status,
          settlementDate: settlement.created_at,
          paidDate: settlement.paid_at || null,
          orderId: order.id,
          orderNumber: order.order_number || order.id,
          orderDate:
            order.delivered_at ||
            order.created_at,
          amount: Number(order.rider_earning || 0),
          paymentMethod:
            settlement.payment_method || "—",
          utr: settlement.utr_number || "—",
        });
      });
    });

    const search = globalSearch.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!search) return true;

        return (
          row.orderNumber.toLowerCase().includes(search) ||
          row.entityName.toLowerCase().includes(search) ||
          row.settlementId.toLowerCase().includes(search) ||
          row.utr.toLowerCase().includes(search)
        );
      })
      .filter((row) => {
        const time = new Date(row.orderDate).getTime();

        if (startDate) {
          const start = new Date(
            `${startDate}T00:00:00`
          ).getTime();

          if (time < start) return false;
        }

        if (endDate) {
          const end = new Date(
            `${endDate}T23:59:59.999`
          ).getTime();

          if (time > end) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() -
          new Date(a.orderDate).getTime()
      );
  }, [
    vendorSettlements,
    riderSettlements,
    vendorMap,
    riderMap,
    orderMap,
    globalSearch,
    startDate,
    endDate,
  ]);

  const metrics = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(
      (order) =>
        String(order.order_status || "").toLowerCase() ===
        "delivered"
    );

    const vendorPending = deliveredOrders
      .filter((order) => !order.settled_vendor)
      .reduce(
        (sum, order) =>
          sum + Number(order.vendor_earning || 0),
        0
      );

    const riderPending = deliveredOrders
      .filter((order) => !order.settled_rider)
      .reduce(
        (sum, order) =>
          sum + Number(order.rider_earning || 0),
        0
      );

    const vendorPaid = vendorSettlements
      .filter((item) => isPaid(item.status))
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const riderPaid = riderSettlements
      .filter((item) => isPaid(item.status))
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const vendorRequested = vendorSettlements
      .filter((item) => isPending(item.status))
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const riderRequested = riderSettlements
      .filter((item) => isPending(item.status))
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const platformCredits = ledger
      .filter(
        (item) =>
          item.entity_type === "platform" &&
          String(item.entry_type).toLowerCase() === "credit"
      )
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    const platformDebits = ledger
      .filter(
        (item) =>
          item.entity_type === "platform" &&
          String(item.entry_type).toLowerCase() === "debit"
      )
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

    return {
      deliveredOrders: deliveredOrders.length,
      vendorPending,
      riderPending,
      vendorPaid,
      riderPaid,
      vendorRequested,
      riderRequested,
      totalPaid: vendorPaid + riderPaid,
      totalRequested:
        vendorRequested + riderRequested,
      platformCredits,
      platformDebits,
      platformNet:
        platformCredits - platformDebits,
      historyCount: historyRows.length,
    };
  }, [
    filteredOrders,
    vendorSettlements,
    riderSettlements,
    ledger,
    historyRows.length,
  ]);

  const getEntityName = (
    settlement: VendorSettlement | RiderSettlement,
    type: SettlementType
  ) => {
    if (type === "vendor") {
      const vendor = vendorMap.get(
        (settlement as VendorSettlement).vendor_id
      );

      return (
        vendor?.shop_name ||
        vendor?.owner_name ||
        "Unknown Vendor"
      );
    }

    const rider = riderMap.get(
      (settlement as RiderSettlement).rider_id
    );

    return (
      rider?.rider_name ||
      rider?.email ||
      "Unknown Rider"
    );
  };

  const getSettlementOrders = (
    settlement: VendorSettlement | RiderSettlement
  ) => {
    const ids = Array.isArray(settlement.order_ids)
      ? settlement.order_ids
      : [];

    return ids
      .map((id) => orderMap.get(id))
      .filter(Boolean) as Order[];
  };

  const openDetails = (
    settlement: VendorSettlement | RiderSettlement,
    type: SettlementType
  ) => {
    setSelectedSettlement(settlement);
    setSelectedType(type);
    setDetailsModalOpen(true);
  };

  const openPayment = (
    settlement: VendorSettlement | RiderSettlement,
    type: SettlementType
  ) => {
    setSelectedSettlement(settlement);
    setSelectedType(type);
    setFormUtr("");
    setFormRemarks("");
    setFormPaymentMethod("Bank Transfer");
    setPayModalOpen(true);
  };

  const recordPayment = async () => {
    if (!selectedSettlement) return;

    const settlementId = selectedSettlement.id;

    const targetTable =
      selectedType === "vendor"
        ? "vendor_settlements"
        : "rider_settlements";

    const entityId =
      selectedType === "vendor"
        ? (selectedSettlement as VendorSettlement).vendor_id
        : (selectedSettlement as RiderSettlement).rider_id;

    const orderIds = Array.isArray(
      selectedSettlement.order_ids
    )
      ? selectedSettlement.order_ids
      : [];

    if (!formPaymentMethod.trim()) {
      showToast(
        "Payment method is required.",
        "error"
      );
      return;
    }

    setActionLoading(true);

    try {
      const paidAt = new Date().toISOString();

      const { error: settlementError } = await supabase
        .from(targetTable)
        .update({
          status: "PAID",
          payment_method:
            formPaymentMethod.trim(),
          utr_number:
            formUtr.trim() || null,
          remarks:
            formRemarks.trim() || null,
          paid_at: paidAt,
        })
        .eq("id", settlementId);

      if (settlementError) {
        throw settlementError;
      }

      if (orderIds.length > 0) {
        const settledColumn =
          selectedType === "vendor"
            ? "settled_vendor"
            : "settled_rider";

        const { error: orderError } = await supabase
          .from("orders")
          .update({
            [settledColumn]: true,
          })
          .in("id", orderIds);

        if (orderError) {
          throw orderError;
        }
      }

      const ledgerRemarks =
        selectedType === "vendor"
          ? `Vendor payout processed. Method: ${formPaymentMethod}. UTR: ${
              formUtr.trim() || "N/A"
            }. Orders: ${orderIds.length}.`
          : `Rider payout processed. Method: ${formPaymentMethod}. UTR: ${
              formUtr.trim() || "N/A"
            }. Orders: ${orderIds.length}.`;

      const { data: existingLedger, error: ledgerCheckError } =
        await supabase
          .from("financial_ledger")
          .select("id")
          .eq("reference_id", settlementId)
          .limit(1);

      if (ledgerCheckError) {
        throw ledgerCheckError;
      }

      if (!existingLedger || existingLedger.length === 0) {
        const { error: ledgerError } = await supabase
          .from("financial_ledger")
          .insert([
            {
              entity_type: selectedType,
              entity_id: entityId,
              transaction_type:
                "Manual Transfer Clearance",
              amount: Number(
                selectedSettlement.amount || 0
              ),
              reference_id: settlementId,
              remarks:
                `${ledgerRemarks} ${
                  formRemarks.trim()
                    ? `Remarks: ${formRemarks.trim()}`
                    : ""
                }`.trim(),
              entry_type: "DEBIT",
              status: "COMPLETED",
              metadata: {
                settlement_id: settlementId,
                order_ids: orderIds,
                payment_method:
                  formPaymentMethod.trim(),
                utr_number:
                  formUtr.trim() || null,
              },
            },
          ]);

        if (ledgerError) {
          throw ledgerError;
        }
      }

      setPayModalOpen(false);
      setSelectedSettlement(null);

      showToast(
        "Payment recorded successfully."
      );

      await loadData(false);
    } catch (error: any) {
      console.error(
        "Settlement payment error:",
        error
      );

      showToast(
        error?.message ||
          "Failed to record payment.",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setGlobalSearch("");
  };

  const renderStatus = (status?: string | null) => {
    const value = normalizeStatus(status);

    if (value === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
          <CheckCircle size={11} />
          Paid
        </span>
      );
    }

    if (
      value === "REQUESTED" ||
      value === "PENDING" ||
      value === "PENDING_REQUEST"
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] font-bold uppercase text-amber-700">
          <Clock size={11} />
          Pending
        </span>
      );
    }

    if (value === "AVAILABLE") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-1 text-[10px] font-bold uppercase text-blue-700">
          Available
        </span>
      );
    }

    if (value === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase text-rose-700">
          Rejected
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase text-gray-600">
        {value || "Unknown"}
      </span>
    );
  };

  const renderSettlementTable = (
    items: Array<
      VendorSettlement | RiderSettlement
    >,
    type: SettlementType
  ) => {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="p-4">
                  {type === "vendor"
                    ? "Vendor"
                    : "Rider"}
                </th>
                <th className="p-4">
                  Amount
                </th>
                <th className="p-4">
                  Orders
                </th>
                <th className="p-4">
                  Created
                </th>
                <th className="p-4">
                  Paid
                </th>
                <th className="p-4">
                  Status
                </th>
                <th className="p-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center text-sm text-slate-400"
                  >
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                items.map((settlement) => {
                  const orderCount =
                    Array.isArray(
                      settlement.order_ids
                    )
                      ? settlement.order_ids.length
                      : Number(
                          (
                            settlement as any
                          ).order_count ||
                            (
                              settlement as any
                            ).delivery_count ||
                            0
                        );

                  const paid = isPaid(
                    settlement.status
                  );

                  return (
                    <tr
                      key={settlement.id}
                      className="hover:bg-emerald-50/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-900">
                          {getEntityName(
                            settlement,
                            type
                          )}
                        </div>

                        <div className="font-mono text-[9px] text-slate-400 mt-1">
                          {settlement.id}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-black text-slate-900">
                          {money(
                            settlement.amount
                          )}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-700">
                          {orderCount}
                        </span>
                      </td>

                      <td className="p-4 text-xs text-slate-500">
                        {formatDate(
                          settlement.created_at
                        )}
                      </td>

                      <td className="p-4 text-xs text-slate-500">
                        {formatDate(
                          settlement.paid_at
                        )}
                      </td>

                      <td className="p-4">
                        {renderStatus(
                          settlement.status
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDetails(
                                settlement,
                                type
                              )
                            }
                            className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-slate-600 flex items-center gap-1.5 text-[10px] font-bold"
                          >
                            <Eye size={13} />
                            View
                          </button>

                          {!paid &&
                            isPending(
                              settlement.status
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  openPayment(
                                    settlement,
                                    type
                                  )
                                }
                                className="h-8 px-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white flex items-center gap-1.5 text-[10px] font-bold"
                              >
                                <Banknote
                                  size={13}
                                />
                                Pay
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#10B981]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Loading settlements...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 p-6 space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            toast.type === "success"
              ? "bg-slate-900 border border-emerald-500/30"
              : "bg-rose-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle
              size={17}
              className="text-[#10B981]"
            />
          ) : (
            <AlertCircle size={17} />
          )}

          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-950">
              Settlements
            </h1>

            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          </div>

          <p className="text-xs text-slate-400 mt-1">
            Vendor payouts, rider payouts, order history and financial ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-2.5 text-slate-400"
            />

            <input
              value={globalSearch}
              onChange={(e) =>
                setGlobalSearch(e.target.value)
              }
              placeholder="Search vendor, rider, order, UTR..."
              className="w-72 h-9 pl-9 pr-3 rounded-lg bg-gray-50 border border-gray-200 text-xs outline-none focus:border-[#10B981]"
            />
          </div>

          <button
            type="button"
            onClick={refresh}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-slate-600 flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw
              size={14}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {[
          ["overview", "Overview"],
          ["vendor", "Vendor Settlements"],
          ["rider", "Rider Settlements"],
          ["ledger", "Financial Ledger"],
          ["audit", "Payment History"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setActiveTab(id as any)
            }
            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 whitespace-nowrap ${
              activeTab === id
                ? "border-[#10B981] text-[#10B981]"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <Calendar
            size={14}
            className="text-[#10B981]"
          />
          Date Range
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400">
            From
          </span>

          <input
            type="date"
            value={startDate}
            onChange={(e) =>
              setStartDate(e.target.value)
            }
            className="h-8 px-2 rounded-lg bg-white border border-gray-200 text-xs outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400">
            To
          </span>

          <input
            type="date"
            value={endDate}
            onChange={(e) =>
              setEndDate(e.target.value)
            }
            className="h-8 px-2 rounded-lg bg-white border border-gray-200 text-xs outline-none focus:border-[#10B981]"
          />
        </div>

        {(startDate ||
          endDate ||
          globalSearch) && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 px-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Delivered Orders
              </span>

              <div className="text-2xl font-black mt-2">
                {metrics.deliveredOrders}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Vendor Pending
              </span>

              <div className="text-2xl font-black mt-2 text-amber-600">
                {money(
                  metrics.vendorPending
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Rider Pending
              </span>

              <div className="text-2xl font-black mt-2 text-amber-600">
                {money(
                  metrics.riderPending
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Paid
              </span>

              <div className="text-2xl font-black mt-2 text-[#10B981]">
                {money(
                  metrics.totalPaid
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Clock
                  size={16}
                  className="text-amber-500"
                />

                <span className="text-xs font-black">
                  Pending Requests
                </span>
              </div>

              <div className="text-xl font-black mt-3">
                {money(
                  metrics.totalRequested
                )}
              </div>

              <p className="text-[10px] text-slate-400 mt-1">
                Vendor + rider settlement requests
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Banknote
                  size={16}
                  className="text-[#10B981]"
                />

                <span className="text-xs font-black">
                  Vendor Paid
                </span>
              </div>

              <div className="text-xl font-black mt-3 text-[#10B981]">
                {money(
                  metrics.vendorPaid
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Banknote
                  size={16}
                  className="text-[#10B981]"
                />

                <span className="text-xs font-black">
                  Rider Paid
                </span>
              </div>

              <div className="text-xl font-black mt-3 text-[#10B981]">
                {money(
                  metrics.riderPaid
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History
                  size={16}
                  className="text-[#10B981]"
                />

                <h2 className="text-xs font-black uppercase tracking-wider">
                  Recent Payment Activity
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="p-3">
                      Date
                    </th>

                    <th className="p-3">
                      Entity
                    </th>

                    <th className="p-3">
                      Type
                    </th>

                    <th className="p-3">
                      Transaction
                    </th>

                    <th className="p-3 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {ledger.slice(0, 10).map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="p-3 text-xs text-slate-500">
                          {formatDateTime(
                            item.created_at
                          )}
                        </td>

                        <td className="p-3 text-xs font-bold capitalize">
                          {item.entity_type}
                        </td>

                        <td className="p-3 text-xs">
                          {item.transaction_type}
                        </td>

                        <td className="p-3 text-xs text-slate-500">
                          {item.remarks ||
                            item.reference_id ||
                            "—"}
                        </td>

                        <td className="p-3 text-right font-black text-xs">
                          {money(item.amount)}
                        </td>
                      </tr>
                    )
                  )}

                  {ledger.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-10 text-center text-sm text-slate-400"
                      >
                        No financial ledger entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "vendor" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Vendor Settlements
              </h2>

              <p className="text-[10px] text-slate-400 mt-1">
                Every settlement and its associated orders.
              </p>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {vendorRows.length} records
            </span>
          </div>

          {renderSettlementTable(
            vendorRows,
            "vendor"
          )}
        </div>
      )}

      {activeTab === "rider" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Rider Settlements
              </h2>

              <p className="text-[10px] text-slate-400 mt-1">
                Every rider payout and its associated deliveries.
              </p>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {riderRows.length} records
            </span>
          </div>

          {renderSettlementTable(
            riderRows,
            "rider"
          )}
        </div>
      )}

      {activeTab === "ledger" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black">
                Financial Ledger
              </h2>

              <p className="text-[10px] text-slate-400 mt-1">
                All recorded financial movements.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-400">
              {filteredLedger.length} entries
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-3">
                    Date
                  </th>

                  <th className="p-3">
                    Entity
                  </th>

                  <th className="p-3">
                    Transaction
                  </th>

                  <th className="p-3">
                    Reference
                  </th>

                  <th className="p-3">
                    Entry
                  </th>

                  <th className="p-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredLedger.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="p-3 text-xs text-slate-500">
                        {formatDateTime(
                          item.created_at
                        )}
                      </td>

                      <td className="p-3">
                        <div className="text-xs font-bold capitalize">
                          {item.entity_type}
                        </div>

                        {item.entity_id && (
                          <div className="font-mono text-[8px] text-slate-400 mt-1">
                            {item.entity_id}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-xs font-semibold">
                        {item.transaction_type}
                      </td>

                      <td className="p-3 font-mono text-[9px] text-slate-400">
                        {item.reference_id ||
                          "—"}
                      </td>

                      <td className="p-3">
                        <span
                          className={
                            String(
                              item.entry_type
                            ).toLowerCase() ===
                            "debit"
                              ? "text-rose-600 font-bold text-[10px] uppercase"
                              : "text-emerald-600 font-bold text-[10px] uppercase"
                          }
                        >
                          {item.entry_type}
                        </span>
                      </td>

                      <td className="p-3 text-right font-black text-xs">
                        {money(item.amount)}
                      </td>
                    </tr>
                  )
                )}

                {filteredLedger.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-10 text-center text-sm text-slate-400"
                    >
                      No ledger entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText
                size={16}
                className="text-[#10B981]"
              />

              <h2 className="text-sm font-black">
                Complete Order Payment History
              </h2>
            </div>

            <p className="text-[10px] text-slate-400 mt-1">
              This is the order-level history showing exactly which orders are included in vendor and rider payments.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-3">
                    Order
                  </th>

                  <th className="p-3">
                    Entity
                  </th>

                  <th className="p-3">
                    Type
                  </th>

                  <th className="p-3">
                    Order Date
                  </th>

                  <th className="p-3">
                    Settlement
                  </th>

                  <th className="p-3">
                    Payment Date
                  </th>

                  <th className="p-3">
                    Method / UTR
                  </th>

                  <th className="p-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {historyRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-emerald-50/20"
                  >
                    <td className="p-3">
                      <div className="text-xs font-black text-slate-900">
                        {row.orderNumber}
                      </div>

                      <div className="font-mono text-[8px] text-slate-400 mt-1">
                        {row.orderId}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="text-xs font-bold">
                        {row.entityName}
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                          row.type ===
                          "vendor"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>

                    <td className="p-3 text-xs text-slate-500">
                      {formatDate(
                        row.orderDate
                      )}
                    </td>

                    <td className="p-3">
                      {renderStatus(
                        row.settlementStatus
                      )}
                    </td>

                    <td className="p-3 text-xs text-slate-500">
                      {formatDate(
                        row.paidDate
                      )}
                    </td>

                    <td className="p-3">
                      <div className="text-[10px] font-bold text-slate-600">
                        {row.paymentMethod}
                      </div>

                      <div className="font-mono text-[9px] text-slate-400 mt-1">
                        {row.utr}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <span className="font-black text-xs text-slate-900">
                        {money(row.amount)}
                      </span>
                    </td>
                  </tr>
                ))}

                {historyRows.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-12 text-center"
                    >
                      <History
                        size={25}
                        className="mx-auto text-slate-300"
                      />

                      <p className="text-sm font-bold text-slate-500 mt-3">
                        No order-level settlement history found.
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1">
                        Orders will appear here when they are linked to settlement records through order_ids.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailsModalOpen &&
        selectedSettlement && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider">
                    Settlement Details
                  </h2>

                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {selectedSettlement.id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDetailsModalOpen(false)
                  }
                  className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[75vh] space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-[9px] font-black uppercase text-slate-400">
                      Entity
                    </span>

                    <div className="text-sm font-black mt-2">
                      {getEntityName(
                        selectedSettlement,
                        selectedType
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-[9px] font-black uppercase text-slate-400">
                      Amount
                    </span>

                    <div className="text-sm font-black mt-2 text-[#10B981]">
                      {money(
                        selectedSettlement.amount
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-[9px] font-black uppercase text-slate-400">
                      Orders
                    </span>

                    <div className="text-sm font-black mt-2">
                      {Array.isArray(
                        selectedSettlement.order_ids
                      )
                        ? selectedSettlement
                            .order_ids
                            .length
                        : 0}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-[9px] font-black uppercase text-slate-400">
                      Status
                    </span>

                    <div className="mt-2">
                      {renderStatus(
                        selectedSettlement.status
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">
                      Created
                    </span>

                    <span className="font-semibold">
                      {formatDateTime(
                        selectedSettlement.created_at
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">
                      Paid
                    </span>

                    <span className="font-semibold">
                      {formatDateTime(
                        selectedSettlement.paid_at
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">
                      Payment Method
                    </span>

                    <span className="font-semibold">
                      {selectedSettlement.payment_method ||
                        "—"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">
                      UTR
                    </span>

                    <span className="font-mono font-semibold">
                      {selectedSettlement.utr_number ||
                        "—"}
                    </span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      Orders Included In This Payment
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-gray-100">
                          <th className="p-3">
                            Order
                          </th>

                          <th className="p-3">
                            Date
                          </th>

                          <th className="p-3">
                            Status
                          </th>

                          <th className="p-3">
                            Subtotal
                          </th>

                          <th className="p-3">
                            Delivery
                          </th>

                          <th className="p-3 text-right">
                            Earnings
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {getSettlementOrders(
                          selectedSettlement
                        ).map((order) => {
                          const earning =
                            selectedType ===
                            "vendor"
                              ? Number(
                                  order.vendor_earning ||
                                    0
                                )
                              : Number(
                                  order.rider_earning ||
                                    0
                                );

                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-gray-50"
                            >
                              <td className="p-3">
                                <div className="text-xs font-black">
                                  {order.order_number ||
                                    order.id}
                                </div>

                                <div className="font-mono text-[8px] text-slate-400 mt-1">
                                  {order.id}
                                </div>
                              </td>

                              <td className="p-3 text-xs text-slate-500">
                                {formatDate(
                                  order.delivered_at ||
                                    order.created_at
                                )}
                              </td>

                              <td className="p-3 text-[10px] font-bold uppercase">
                                {order.order_status ||
                                  "—"}
                              </td>

                              <td className="p-3 text-xs">
                                {money(
                                  order.subtotal
                                )}
                              </td>

                              <td className="p-3 text-xs">
                                {money(
                                  order.delivery_fee
                                )}
                              </td>

                              <td className="p-3 text-right text-xs font-black text-[#10B981]">
                                {money(earning)}
                              </td>
                            </tr>
                          );
                        })}

                        {getSettlementOrders(
                          selectedSettlement
                        ).length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-8 text-center text-xs text-slate-400"
                            >
                              No matching order records found for the stored order IDs.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <span className="text-[9px] font-black uppercase text-slate-400">
                    Admin Remarks
                  </span>

                  <p className="text-xs text-slate-600 mt-2">
                    {selectedSettlement.remarks ||
                      "No remarks recorded."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      {payModalOpen &&
        selectedSettlement && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider">
                    Record Payout
                  </h2>

                  <p className="text-xs text-[#10B981] font-black mt-1">
                    {getEntityName(
                      selectedSettlement,
                      selectedType
                    )}{" "}
                    ·{" "}
                    {money(
                      selectedSettlement.amount
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPayModalOpen(false)
                  }
                  className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">
                        Settlement
                      </span>

                      <span className="text-xs font-mono">
                        {selectedSettlement.id}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">
                        Orders
                      </span>

                      <span className="text-xs font-black">
                        {Array.isArray(
                          selectedSettlement.order_ids
                        )
                          ? selectedSettlement
                              .order_ids
                              .length
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Payment Method
                  </label>

                  <select
                    value={formPaymentMethod}
                    onChange={(e) =>
                      setFormPaymentMethod(
                        e.target.value
                      )
                    }
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-[#10B981]"
                  >
                    <option>
                      Bank Transfer
                    </option>
                    <option>
                      UPI
                    </option>
                    <option>
                      Cash
                    </option>
                    <option>
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    UTR / Transaction Reference
                  </label>

                  <input
                    value={formUtr}
                    onChange={(e) =>
                      setFormUtr(
                        e.target.value
                      )
                    }
                    placeholder="Enter UTR or transaction reference"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-[#10B981]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Remarks
                  </label>

                  <textarea
                    value={formRemarks}
                    onChange={(e) =>
                      setFormRemarks(
                        e.target.value
                      )
                    }
                    rows={3}
                    placeholder="Optional payment remarks"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-[#10B981] resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPayModalOpen(false)
                    }
                    disabled={
                      actionLoading
                    }
                    className="flex-1 h-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      recordPayment
                    }
                    disabled={
                      actionLoading
                    }
                    className="flex-1 h-10 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading && (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    )}

                    Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Settlements;