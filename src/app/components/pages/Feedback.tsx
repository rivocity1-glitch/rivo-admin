import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Eye,
  MessageSquare,
  RefreshCcw,
  Search,
  Send,
  Star,
  Store,
  Trash2,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { supabase } from "../../../lib/supabase";

type SourceType = "customer" | "vendor" | "rider";

type FeedbackStatus =
  | "unread"
  | "read"
  | "solved"
  | "thanked"
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

type CustomerFeedbackRow = {
  id: string;
  customer_id?: string | null;
  rating: number;
  message: string;
  category?: string | null;
  status: "unread" | "read" | "solved" | "thanked";
  admin_reply?: string | null;
  created_at: string;
  updated_at?: string | null;
  read_at?: string | null;
  solved_at?: string | null;
  thanked_at?: string | null;
  customers?: {
    customer_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type SupportFeedbackRow = {
  id: string;
  vendor_id?: string | null;
  rider_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?:
    | "open"
    | "in_progress"
    | "resolved"
    | "closed"
    | null;
  priority?: "high" | "medium" | "low" | null;
  issue_type?: string | null;
  screenshot_url?: string | null;
  unread_for_admin?: boolean | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type FeedbackItem = {
  id: string;
  source: SourceType;
  source_id: string | null;

  name: string;
  email: string | null;
  phone: string | null;

  rating: number | null;
  message: string;
  category: string | null;

  status: FeedbackStatus;

  admin_reply: string | null;

  created_at: string;
  updated_at: string | null;

  unread_for_admin: boolean;

  title: string | null;
  priority: "high" | "medium" | "low" | null;
  screenshot_url: string | null;
};

type SourceFilter =
  | "all"
  | "customer"
  | "vendor"
  | "rider";

type StatusFilter =
  | "all"
  | "unread"
  | "read"
  | "open"
  | "in_progress"
  | "resolved"
  | "solved"
  | "closed"
  | "thanked";

const PAGE_SIZE = 10;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: SourceType) {
  switch (source) {
    case "customer":
      return "Customer";
    case "vendor":
      return "Vendor";
    case "rider":
      return "Rider";
  }
}

function sourceClasses(source: SourceType) {
  switch (source) {
    case "customer":
      return "bg-blue-50 text-blue-700 border-blue-100";

    case "vendor":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";

    case "rider":
      return "bg-purple-50 text-purple-700 border-purple-100";
  }
}

function statusLabel(status: FeedbackStatus) {
  switch (status) {
    case "unread":
      return "Unread";

    case "read":
      return "Read";

    case "open":
      return "Open";

    case "in_progress":
      return "In Progress";

    case "resolved":
      return "Resolved";

    case "solved":
      return "Solved";

    case "closed":
      return "Closed";

    case "thanked":
      return "Thanked";

    default:
      return status;
  }
}

function statusClasses(status: FeedbackStatus) {
  switch (status) {
    case "unread":
      return "bg-red-50 text-red-700 border-red-100";

    case "read":
      return "bg-slate-100 text-slate-700 border-slate-200";

    case "open":
      return "bg-amber-50 text-amber-700 border-amber-100";

    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-100";

    case "resolved":
    case "solved":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";

    case "closed":
      return "bg-slate-100 text-slate-600 border-slate-200";

    case "thanked":
      return "bg-purple-50 text-purple-700 border-purple-100";

    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function SourceIcon({
  source,
}: {
  source: SourceType;
}) {
  if (source === "customer") {
    return <UserRound className="w-4 h-4" />;
  }

  if (source === "vendor") {
    return <Store className="w-4 h-4" />;
  }

  return <Truck className="w-4 h-4" />;
}

function StarRating({
  rating,
  large = false,
}: {
  rating: number | null;
  large?: boolean;
}) {
  if (rating === null) {
    return (
      <span className="text-xs text-muted-foreground">
        No rating
      </span>
    );
  }

  const size = large ? "w-5 h-5" : "w-3.5 h-3.5";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`${size} ${
            index < rating
              ? "fill-current text-amber-500"
              : "text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

function extractRating(text: string) {
  const match = text.match(/rating\s*:\s*(\d+)\s*\/\s*5/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (value < 1 || value > 5) {
    return null;
  }

  return value;
}

function cleanFeedbackMessage(text: string) {
  const match = text.match(/feedback\s*:\s*([\s\S]*)/i);

  if (match?.[1]) {
    return match[1].trim();
  }

  return text.trim();
}

export function Feedback() {
  const [rows, setRows] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [sourceFilter, setSourceFilter] =
    useState<SourceFilter>("all");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [selected, setSelected] =
    useState<FeedbackItem | null>(null);

  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);

    try {
      const unified: FeedbackItem[] = [];

      /*
       * ======================================================
       * CUSTOMER FEEDBACK
       * ======================================================
       */

      const {
        data: customerData,
        error: customerError,
      } = await supabase
        .from("customer_feedback")
        .select(
          "*, customers(customer_name,email,phone)"
        )
        .order("created_at", {
          ascending: false,
        });

      if (customerError) {
        console.error(
          "Failed to load customer feedback:",
          customerError
        );
      }

      (customerData || []).forEach(
        (item: CustomerFeedbackRow) => {
          unified.push({
            id: item.id,
            source: "customer",
            source_id: item.customer_id || null,

            name:
              item.customers?.customer_name ||
              "Customer",

            email:
              item.customers?.email || null,

            phone:
              item.customers?.phone || null,

            rating:
              typeof item.rating === "number"
                ? item.rating
                : Number(item.rating),

            message: item.message || "",
            category: item.category || null,

            status: item.status,

            admin_reply:
              item.admin_reply || null,

            created_at: item.created_at,

            updated_at:
              item.updated_at ||
              item.created_at,

            unread_for_admin:
              item.status === "unread",

            title: null,
            priority: null,
            screenshot_url: null,
          });
        }
      );

      /*
       * ======================================================
       * VENDOR FEEDBACK
       *
       * Vendor feedback is already stored in
       * vendor_support_tickets with issue_type = feedback.
       * ======================================================
       */

      const {
        data: vendorData,
        error: vendorError,
      } = await supabase
        .from("vendor_support_tickets")
        .select(
          "id,vendor_id,title,description,status,priority,issue_type,screenshot_url,unread_for_admin,last_message_at,created_at,updated_at"
        )
        .eq("issue_type", "feedback")
        .order("created_at", {
          ascending: false,
        });

      if (vendorError) {
        console.error(
          "Failed to load vendor feedback:",
          vendorError
        );
      }

      (vendorData || []).forEach(
        (item: SupportFeedbackRow) => {
          const description =
            item.description || "";

          unified.push({
            id: item.id,
            source: "vendor",
            source_id: item.vendor_id || null,

            name: "Vendor",

            email: null,
            phone: null,

            rating:
              extractRating(description),

            message:
              cleanFeedbackMessage(
                description
              ),

            category: null,

            status:
              item.status || "open",

            admin_reply: null,

            created_at: item.created_at,

            updated_at:
              item.updated_at ||
              item.last_message_at ||
              item.created_at,

            unread_for_admin:
              Boolean(
                item.unread_for_admin
              ),

            title:
              item.title ||
              "Vendor Feedback",

            priority:
              item.priority || null,

            screenshot_url:
              item.screenshot_url ||
              null,
          });
        }
      );

      /*
       * ======================================================
       * RIDER FEEDBACK
       *
       * Rider feedback is already stored in
       * rider_support_tickets with issue_type = feedback.
       * ======================================================
       */

      const {
        data: riderData,
        error: riderError,
      } = await supabase
        .from("rider_support_tickets")
        .select(
          "id,rider_id,title,description,status,priority,issue_type,screenshot_url,unread_for_admin,last_message_at,created_at,updated_at"
        )
        .eq("issue_type", "feedback")
        .order("created_at", {
          ascending: false,
        });

      if (riderError) {
        console.error(
          "Failed to load rider feedback:",
          riderError
        );
      }

      (riderData || []).forEach(
        (item: SupportFeedbackRow) => {
          const description =
            item.description || "";

          unified.push({
            id: item.id,
            source: "rider",
            source_id: item.rider_id || null,

            name: "Rider",

            email: null,
            phone: null,

            rating:
              extractRating(description),

            message:
              cleanFeedbackMessage(
                description
              ),

            category: null,

            status:
              item.status || "open",

            admin_reply: null,

            created_at: item.created_at,

            updated_at:
              item.updated_at ||
              item.last_message_at ||
              item.created_at,

            unread_for_admin:
              Boolean(
                item.unread_for_admin
              ),

            title:
              item.title ||
              "Rider Feedback",

            priority:
              item.priority || null,

            screenshot_url:
              item.screenshot_url ||
              null,
          });
        }
      );

      /*
       * ======================================================
       * UNIFIED SORT
       * ======================================================
       */

      unified.sort((a, b) => {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });

      setRows(unified);
    } catch (error) {
      console.error(
        "Failed to load unified feedback:",
        error
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * ========================================================
   * FILTERING
   * ========================================================
   */

  const filtered = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return rows.filter((item) => {
      if (
        sourceFilter !== "all" &&
        item.source !== sourceFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        item.status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.name,
        item.email,
        item.phone,
        item.message,
        item.category,
        item.title,
        item.source_id,
        sourceLabel(item.source),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    rows,
    search,
    sourceFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / PAGE_SIZE
    )
  );

  const visible = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  /*
   * ========================================================
   * COUNTERS
   * ========================================================
   */

  const allCount = rows.length;

  const customerCount = rows.filter(
    (item) => item.source === "customer"
  ).length;

  const vendorCount = rows.filter(
    (item) => item.source === "vendor"
  ).length;

  const riderCount = rows.filter(
    (item) => item.source === "rider"
  ).length;

  const unreadCount = rows.filter(
    (item) =>
      item.unread_for_admin ||
      item.status === "unread"
  ).length;

  const solvedCount = rows.filter(
    (item) =>
      item.status === "solved" ||
      item.status === "resolved"
  ).length;

  const thankedCount = rows.filter(
    (item) => item.status === "thanked"
  ).length;

  /*
   * ========================================================
   * OPEN FEEDBACK
   * ========================================================
   */

  const openFeedback = async (
    item: FeedbackItem
  ) => {
    setSelected(item);

    setReply(
      item.admin_reply || ""
    );

    /*
     * Customer feedback uses the customer_feedback
     * status system.
     */

    if (
      item.source === "customer" &&
      item.status === "unread"
    ) {
      const now =
        new Date().toISOString();

      const { error } =
        await supabase
          .from("customer_feedback")
          .update({
            status: "read",
            read_at: now,
          })
          .eq("id", item.id);

      if (error) {
        console.error(
          "Failed to mark customer feedback as read:",
          error
        );

        return;
      }

      const updated: FeedbackItem = {
        ...item,
        status: "read",
        unread_for_admin: false,
      };

      setRows((current) =>
        current.map((row) =>
          row.id === item.id &&
          row.source === item.source
            ? updated
            : row
        )
      );

      setSelected(updated);
    }

    /*
     * Vendor / rider feedback uses the support ticket
     * unread flag.
     */

    if (
      item.source !== "customer" &&
      item.unread_for_admin
    ) {
      const table =
        item.source === "vendor"
          ? "vendor_support_tickets"
          : "rider_support_tickets";

      const { error } =
        await supabase
          .from(table)
          .update({
            unread_for_admin: false,
          })
          .eq("id", item.id);

      if (error) {
        console.error(
          "Failed to mark support feedback as read:",
          error
        );

        return;
      }

      const updated: FeedbackItem = {
        ...item,
        unread_for_admin: false,
      };

      setRows((current) =>
        current.map((row) =>
          row.id === item.id &&
          row.source === item.source
            ? updated
            : row
        )
      );

      setSelected(updated);
    }
  };

  /*
   * ========================================================
   * CUSTOMER STATUS
   * ========================================================
   */

  const updateCustomerStatus = async (
    nextStatus:
      | "unread"
      | "read"
      | "solved"
      | "thanked"
  ) => {
    if (
      !selected ||
      selected.source !== "customer"
    ) {
      return;
    }

    setSaving(true);

    try {
      const now =
        new Date().toISOString();

      const patch: {
        status:
          | "unread"
          | "read"
          | "solved"
          | "thanked";
        read_at?: string;
        solved_at?: string;
        thanked_at?: string;
      } = {
        status: nextStatus,
      };

      if (
        nextStatus === "read"
      ) {
        patch.read_at = now;
      }

      if (
        nextStatus === "solved"
      ) {
        patch.solved_at = now;
      }

      if (
        nextStatus === "thanked"
      ) {
        patch.thanked_at = now;
        patch.read_at = now;
      }

      const { error } =
        await supabase
          .from("customer_feedback")
          .update(patch)
          .eq("id", selected.id);

      if (error) {
        throw error;
      }

      const updated: FeedbackItem = {
        ...selected,
        status: nextStatus,
        unread_for_admin: false,
      };

      setRows((current) =>
        current.map((row) =>
          row.id === selected.id &&
          row.source === selected.source
            ? updated
            : row
        )
      );

      setSelected(updated);
    } catch (error) {
      console.error(
        "Customer feedback status update failed:",
        error
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ========================================================
   * VENDOR / RIDER STATUS
   * ========================================================
   */

  const updateSupportStatus = async (
    nextStatus:
      | "open"
      | "in_progress"
      | "resolved"
      | "closed"
  ) => {
    if (
      !selected ||
      selected.source === "customer"
    ) {
      return;
    }

    setSaving(true);

    try {
      const table =
        selected.source === "vendor"
          ? "vendor_support_tickets"
          : "rider_support_tickets";

      const { error } =
        await supabase
          .from(table)
          .update({
            status: nextStatus,
            unread_for_admin: false,
          })
          .eq("id", selected.id);

      if (error) {
        throw error;
      }

      const updated: FeedbackItem = {
        ...selected,
        status: nextStatus,
        unread_for_admin: false,
      };

      setRows((current) =>
        current.map((row) =>
          row.id === selected.id &&
          row.source === selected.source
            ? updated
            : row
        )
      );

      setSelected(updated);
    } catch (error) {
      console.error(
        "Support feedback status update failed:",
        error
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ========================================================
   * CUSTOMER THANK / RESPONSE
   * ========================================================
   */

  const sendCustomerThankYou =
    async () => {
      if (
        !selected ||
        selected.source !== "customer" ||
        !reply.trim()
      ) {
        return;
      }

      setSaving(true);

      try {
        const now =
          new Date().toISOString();

        const { error } =
          await supabase
            .from("customer_feedback")
            .update({
              admin_reply:
                reply.trim(),
              status: "thanked",
              thanked_at: now,
              read_at: now,
            })
            .eq("id", selected.id);

        if (error) {
          throw error;
        }

        const updated: FeedbackItem = {
          ...selected,
          admin_reply:
            reply.trim(),
          status: "thanked",
          unread_for_admin: false,
        };

        setRows((current) =>
          current.map((row) =>
            row.id === selected.id &&
            row.source === selected.source
              ? updated
              : row
          )
        );

        setSelected(updated);
        setReply("");
      } catch (error) {
        console.error(
          "Customer feedback response failed:",
          error
        );
      } finally {
        setSaving(false);
      }
    };

  /*
   * ========================================================
   * DELETE
   * ========================================================
   */

  const deleteFeedback = async () => {
    if (!selected) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this feedback permanently?"
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      let error = null;

      if (
        selected.source === "customer"
      ) {
        const result =
          await supabase
            .from(
              "customer_feedback"
            )
            .delete()
            .eq(
              "id",
              selected.id
            );

        error = result.error;
      } else {
        const table =
          selected.source ===
          "vendor"
            ? "vendor_support_tickets"
            : "rider_support_tickets";

        const result =
          await supabase
            .from(table)
            .delete()
            .eq(
              "id",
              selected.id
            );

        error = result.error;
      }

      if (error) {
        throw error;
      }

      setRows((current) =>
        current.filter(
          (row) =>
            !(
              row.id ===
                selected.id &&
              row.source ===
                selected.source
            )
        )
      );

      setSelected(null);
      setReply("");
    } catch (error) {
      console.error(
        "Feedback deletion failed:",
        error
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ========================================================
   * RENDER
   * ========================================================
   */

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader
        title="Feedback"
        description="Review feedback from customers, vendors and riders."
      />

      {/* =====================================================
          SOURCE COUNTERS
          ===================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setSourceFilter("all");
            setStatusFilter("all");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            All
          </div>

          <div className="text-2xl font-bold mt-1">
            {allCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSourceFilter("customer");
            setStatusFilter("all");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Customers
          </div>

          <div className="text-2xl font-bold mt-1">
            {customerCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSourceFilter("vendor");
            setStatusFilter("all");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Vendors
          </div>

          <div className="text-2xl font-bold mt-1">
            {vendorCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSourceFilter("rider");
            setStatusFilter("all");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Riders
          </div>

          <div className="text-2xl font-bold mt-1">
            {riderCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("unread");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Unread
          </div>

          <div className="text-2xl font-bold mt-1">
            {unreadCount}
          </div>
        </button>
      </div>

      {/* =====================================================
          STATUS COUNTERS
          ===================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("solved");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Solved / Resolved
          </div>

          <div className="text-2xl font-bold mt-1">
            {solvedCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("thanked");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Thanked
          </div>

          <div className="text-2xl font-bold mt-1">
            {thankedCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setSourceFilter("all");
            setPage(1);
          }}
          className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Current Results
          </div>

          <div className="text-2xl font-bold mt-1">
            {filtered.length}
          </div>
        </button>
      </div>

      {/* =====================================================
          FILTER BAR
          ===================================================== */}

      <div className="bg-card border border-border rounded-xl p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => {
              setSearch(
                event.target.value
              );
              setPage(1);
            }}
            placeholder="Search customer, vendor, rider or feedback..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-[#22C55E]/20"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={(event) => {
            setSourceFilter(
              event.target.value as SourceFilter
            );
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">
            All sources
          </option>

          <option value="customer">
            Customers
          </option>

          <option value="vendor">
            Vendors
          </option>

          <option value="rider">
            Riders
          </option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(
              event.target.value as StatusFilter
            );
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
        >
          <option value="all">
            All statuses
          </option>

          <option value="unread">
            Unread
          </option>

          <option value="read">
            Read
          </option>

          <option value="open">
            Open
          </option>

          <option value="in_progress">
            In Progress
          </option>

          <option value="solved">
            Solved
          </option>

          <option value="resolved">
            Resolved
          </option>

          <option value="closed">
            Closed
          </option>

          <option value="thanked">
            Thanked
          </option>
        </select>

        <Button
          onClick={load}
          disabled={loading}
        >
          <RefreshCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* =====================================================
          FEEDBACK LIST
          ===================================================== */}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading feedback...
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No feedback found.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <button
                type="button"
                key={`${item.source}-${item.id}`}
                onClick={() =>
                  openFeedback(item)
                }
                className="w-full p-4 text-left hover:bg-muted/30 flex gap-4 items-start transition-colors"
              >
                {/* SOURCE */}
                <div
                  className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${sourceClasses(
                    item.source
                  )}`}
                >
                  <SourceIcon
                    source={item.source}
                  />
                </div>

                {/* CONTENT */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-semibold text-sm">
                      {item.name}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sourceClasses(
                        item.source
                      )}`}
                    >
                      {sourceLabel(
                        item.source
                      )}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses(
                        item.status
                      )}`}
                    >
                      {statusLabel(
                        item.status
                      )}
                    </span>

                    {item.category && (
                      <span className="text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <StarRating
                      rating={
                        item.rating
                      }
                    />

                    {item.priority && (
                      <span className="text-[11px] text-muted-foreground">
                        Priority:{" "}
                        {item.priority}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.message}
                  </p>
                </div>

                {/* DATE */}
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  {formatDate(
                    item.created_at
                  )}

                  {item.unread_for_admin && (
                    <div className="mt-1 text-[10px] font-bold text-red-600">
                      NEW
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================
          PAGINATION
          ===================================================== */}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* =====================================================
          DETAILS MODAL
          ===================================================== */}

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setReply("");
        }}
        title="Feedback Details"
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {/* HEADER */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceClasses(
                      selected.source
                    )}`}
                  >
                    <SourceIcon
                      source={
                        selected.source
                      }
                    />

                    {sourceLabel(
                      selected.source
                    )}
                  </span>

                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                      selected.status
                    )}`}
                  >
                    {statusLabel(
                      selected.status
                    )}
                  </span>
                </div>

                <div className="font-semibold text-base mt-2">
                  {selected.name}
                </div>

                {selected.email && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {selected.email}
                  </div>
                )}

                {selected.phone && (
                  <div className="text-xs text-muted-foreground">
                    {selected.phone}
                  </div>
                )}

                {selected.source_id && (
                  <div className="text-[10px] text-muted-foreground mt-1 break-all">
                    {sourceLabel(
                      selected.source
                    )}{" "}
                    ID:{" "}
                    {selected.source_id}
                  </div>
                )}
              </div>

              <StarRating
                rating={selected.rating}
                large
              />
            </div>

            {/* META */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Submitted
                </div>

                <div className="text-sm font-medium mt-1">
                  {formatDate(
                    selected.created_at
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Category
                </div>

                <div className="text-sm font-medium mt-1">
                  {selected.category ||
                    selected.title ||
                    "General Feedback"}
                </div>
              </div>
            </div>

            {/* FEEDBACK */}
            <div>
              <div className="text-xs font-semibold mb-2">
                Feedback
              </div>

              <div className="bg-muted/40 rounded-xl p-4 text-sm whitespace-pre-wrap">
                {selected.message}
              </div>
            </div>

            {/* SCREENSHOT */}
            {selected.screenshot_url && (
              <div>
                <div className="text-xs font-semibold mb-2">
                  Attachment
                </div>

                <a
                  href={
                    selected.screenshot_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-emerald-600 hover:underline"
                >
                  View screenshot
                </a>
              </div>
            )}

            {/* CUSTOMER RESPONSE */}
            {selected.source ===
              "customer" &&
              selected.admin_reply && (
                <div className="border border-border rounded-xl p-4">
                  <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Admin response
                  </div>

                  <div className="text-sm whitespace-pre-wrap">
                    {selected.admin_reply}
                  </div>
                </div>
              )}

            {/* CUSTOMER RESPONSE BOX */}
            {selected.source ===
              "customer" && (
              <div>
                <div className="text-xs font-semibold mb-2">
                  Thank / Respond
                </div>

                <textarea
                  value={reply}
                  onChange={(event) =>
                    setReply(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Write a thank-you or response..."
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#22C55E]/20"
                />
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-2">
              {selected.source ===
              "customer" ? (
                <>
                  <Button
                    onClick={() =>
                      updateCustomerStatus(
                        "read"
                      )
                    }
                    disabled={saving}
                  >
                    <Eye className="w-4 h-4" />
                    Read
                  </Button>

                  <Button
                    onClick={() =>
                      updateCustomerStatus(
                        "solved"
                      )
                    }
                    disabled={saving}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Solved
                  </Button>

                  <Button
                    onClick={
                      sendCustomerThankYou
                    }
                    disabled={
                      saving ||
                      !reply.trim()
                    }
                  >
                    <Send className="w-4 h-4" />
                    Thank & Reply
                  </Button>

                  <Button
                    onClick={() =>
                      updateCustomerStatus(
                        "unread"
                      )
                    }
                    disabled={saving}
                  >
                    <XCircle className="w-4 h-4" />
                    Mark Unread
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() =>
                      updateSupportStatus(
                        "in_progress"
                      )
                    }
                    disabled={saving}
                  >
                    <Eye className="w-4 h-4" />
                    In Progress
                  </Button>

                  <Button
                    onClick={() =>
                      updateSupportStatus(
                        "resolved"
                      )
                    }
                    disabled={saving}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolve
                  </Button>

                  <Button
                    onClick={() =>
                      updateSupportStatus(
                        "open"
                      )
                    }
                    disabled={saving}
                  >
                    <XCircle className="w-4 h-4" />
                    Reopen
                  </Button>

                  <Button
                    onClick={() =>
                      updateSupportStatus(
                        "closed"
                      )
                    }
                    disabled={saving}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Close
                  </Button>
                </>
              )}

              <Button
                onClick={deleteFeedback}
                disabled={saving}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}