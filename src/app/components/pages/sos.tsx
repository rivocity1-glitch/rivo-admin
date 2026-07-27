// src/app/components/pages/sos.tsx
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  X,
  ImageOff,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

interface EmergencyReport {
  id: string;
  rider_id: string;
  issue_type: string;
  description: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes?: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  order_id: string | null;
  order_number: string | null;
  // Dynamic fields
  accident_target?: string | null;
  fuel_type?: string | null;
  breakdown_type?: string | null;
  assistance_type?: string | null;
  custom_description?: string | null;
  // Augmented details
  rider?: {
    rider_name: string;
    phone: string;
    vehicle_type?: string;
    vehicle_number?: string;
    rating?: number;
  } | null;
  vendor?: {
    shop_name: string;
    phone?: string;
  } | null;
  order?: {
    order_number: string;
    total_amount: number;
    order_status: string;
    payment_status: string;
    customer_name?: string;
  } | null;
}

export function SOS() {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search States
  const [activeTab, setActiveTab] = useState<"active" | "acknowledged" | "resolved">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Selected Report for Drawer Details
  const [selectedReport, setSelectedReport] = useState<EmergencyReport | null>(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve Modal States
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [reportToResolve, setReportToResolve] = useState<EmergencyReport | null>(null);
  const [resolutionNotesInput, setResolutionNotesInput] = useState("");

  // Fetch SOS Reports and enrich them safely without failing on missing foreign key constraints
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch raw emergency reports
      const { data: rawReports, error: fetchError } = await supabase
        .from("rider_emergency_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      if (!rawReports || rawReports.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // 2. Safely enrich with riders, vendors, and orders data
      const enriched = await Promise.all(
        rawReports.map(async (report: any) => {
          let riderData = null;
          let vendorData = null;
          let orderData = null;

          if (report.rider_id) {
            const { data: r } = await supabase
              .from("riders")
              .select("rider_name, phone, vehicle_type, vehicle_number, rating")
              .eq("id", report.rider_id)
              .maybeSingle();
            riderData = r;
          }

          if (report.vendor_id) {
            const { data: v } = await supabase
              .from("vendors")
              .select("shop_name, phone")
              .eq("id", report.vendor_id)
              .maybeSingle();
            vendorData = v;
          }

          if (report.order_id) {
            const { data: o } = await supabase
              .from("orders")
              .select("order_number, total_amount, order_status, payment_status")
              .eq("id", report.order_id)
              .maybeSingle();
            orderData = o;
          }

          return {
            ...report,
            rider: riderData,
            vendor: vendorData,
            order: orderData,
          };
        })
      );

      setReports(enriched);

      // Keep drawer in sync if open
      if (selectedReport) {
        const updatedSelected = enriched.find((item) => item.id === selectedReport.id);
        if (updatedSelected) {
          setSelectedReport(updatedSelected);
        }
      }
    } catch (err: any) {
      console.error("Error fetching emergency reports:", err);
      setError(err.message || "Failed to load emergency reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    // Subscribe to Realtime emergency changes
    const channel = supabase
      .channel("admin-sos-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_emergency_reports",
        },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch signed private image URL with logging and error handling
  useEffect(() => {
    async function resolvePhotoUrl() {
      setPhotoError(null);
      setCopiedPath(false);

      if (!selectedReport?.photo_url) {
        setSignedPhotoUrl(null);
        return;
      }

      const rawUrl = selectedReport.photo_url.trim();

      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        console.log("[SOS Storage] Photo URL is already a public HTTP URL:", rawUrl);
        setSignedPhotoUrl(rawUrl);
        return;
      }

      const cleanPath = rawUrl
        .replace(/^rider-sos\//, "")
        .replace(/^\/+/, "");

      console.log("[SOS Storage] Requesting signed URL for bucket: rider-sos");
      console.log("[SOS Storage] Cleaned Object Path:", cleanPath);

      try {
        const { data, error: storageErr } = await supabase.storage
          .from("rider-sos")
          .createSignedUrl(cleanPath, 3600);

        console.log("[SOS Storage] Signed URL Response:", data);

        if (storageErr) {
          console.error("[SOS Storage Error] Failed to create signed URL:", storageErr);
          setPhotoError(storageErr.message || "Failed to generate signed URL");
          setSignedPhotoUrl(null);
          return;
        }

        if (data?.signedUrl) {
          console.log("[SOS Storage Success] Generated Signed URL:", data.signedUrl);
          setSignedPhotoUrl(data.signedUrl);
        } else {
          console.error("[SOS Storage Error] No signedUrl returned in data object:", data);
          setPhotoError("No signed URL returned from Supabase storage");
          setSignedPhotoUrl(null);
        }
      } catch (err: any) {
        console.error("[SOS Storage Exception] Exception while generating signed URL:", err);
        setPhotoError(err.message || "Unexpected exception during signed URL generation");
        setSignedPhotoUrl(null);
      }
    }

    resolvePhotoUrl();
  }, [selectedReport]);

  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // Calculations for Stat Cards
  const activeCount = reports.filter((r) => r.status?.toLowerCase() !== "resolved").length;
  const awaitingCount = reports.filter((r) => r.status?.toLowerCase() === "pending").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const resolvedTodayCount = reports.filter((r) => {
    if (r.status?.toLowerCase() !== "resolved" || !r.resolved_at) return false;
    return r.resolved_at.startsWith(todayStr);
  }).length;

  // Average response time calculation (acknowledged_at - created_at)
  const avgResponseTimeDisplay = (() => {
    const acknowledgedReports = reports.filter((r) => r.acknowledged_at && r.created_at);
    if (acknowledgedReports.length === 0) return "—";

    let totalDiffMs = 0;
    acknowledgedReports.forEach((r) => {
      const createdMs = new Date(r.created_at).getTime();
      const ackMs = new Date(r.acknowledged_at!).getTime();
      if (ackMs >= createdMs) {
        totalDiffMs += ackMs - createdMs;
      }
    });

    const avgMs = totalDiffMs / acknowledgedReports.length;
    const avgMins = Math.round(avgMs / 60000);
    return avgMins < 1 ? "< 1 min" : `${avgMins} mins`;
  })();

  // Filter & Search Logic
  const filteredReports = reports.filter((report) => {
    const statusLower = report.status?.toLowerCase() || "pending";

    // Tab Filter
    if (activeTab === "active" && statusLower === "resolved") return false;
    if (activeTab === "acknowledged" && statusLower !== "acknowledged") return false;
    if (activeTab === "resolved" && statusLower !== "resolved") return false;

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const riderName = report.rider?.rider_name?.toLowerCase() || "";
      const phone = report.rider?.phone?.toLowerCase() || "";
      const issue = report.issue_type?.toLowerCase() || "";
      const orderNo = (report.order_number || report.order?.order_number || "").toLowerCase();

      const matchesSearch =
        riderName.includes(q) || phone.includes(q) || issue.includes(q) || orderNo.includes(q);
      if (!matchesSearch) return false;
    }

    // Issue Type Filter
    if (issueFilter !== "all" && report.issue_type !== issueFilter) {
      return false;
    }

    // Date Filter
    if (dateFilter === "today") {
      if (!report.created_at.startsWith(todayStr)) return false;
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      if (!report.created_at.startsWith(yStr)) return false;
    }

    return true;
  });

  // Action: Acknowledge SOS + Send Rider Notification
  const handleAcknowledge = async (report: EmergencyReport) => {
    try {
      setActionLoading(true);
      const nowIso = new Date().toISOString();

      // 1. Update status in rider_emergency_reports
      const { error: updateErr } = await supabase
        .from("rider_emergency_reports")
        .update({
          status: "acknowledged",
          acknowledged_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", report.id);

      if (updateErr) throw updateErr;

      // 2. Insert Notification for Rider
      if (report.rider_id) {
        await supabase.from("notifications").insert({
          user_id: report.rider_id,
          user_type: "rider",
          title: "SOS Acknowledged",
          body: "Our support team is reviewing your emergency request.",
          is_read: false,
          created_at: nowIso,
        });
      }

      await fetchReports();
      if (selectedReport?.id === report.id) {
        setSelectedReport((prev) =>
          prev ? { ...prev, status: "acknowledged", acknowledged_at: nowIso } : null
        );
      }
    } catch (err: any) {
      alert("Failed to acknowledge emergency: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Resolve Modal
  const openResolveModal = (report: EmergencyReport) => {
    setReportToResolve(report);
    setResolutionNotesInput("");
    setResolveModalOpen(true);
  };

  // Action: Confirm Resolve SOS + Send Rider Notification
  const handleConfirmResolve = async () => {
    if (!reportToResolve) return;
    if (!resolutionNotesInput.trim()) {
      alert("Please enter resolution notes before resolving.");
      return;
    }

    try {
      setActionLoading(true);
      const nowIso = new Date().toISOString();

      let adminId = "admin";
      try {
        const localSession = localStorage.getItem("rivo_admin_session");
        if (localSession) {
          const parsed = JSON.parse(localSession);
          if (parsed.id) adminId = parsed.id;
        }
      } catch (e) {
        console.error(e);
      }

      // 1. Update status and notes in database
      const { error: updateErr } = await supabase
        .from("rider_emergency_reports")
        .update({
          status: "resolved",
          resolved_at: nowIso,
          resolved_by: adminId,
          updated_at: nowIso,
          resolution_notes: resolutionNotesInput.trim(),
        })
        .eq("id", reportToResolve.id);

      if (updateErr) throw updateErr;

      // 2. Insert Notification for Rider
      if (reportToResolve.rider_id) {
        await supabase.from("notifications").insert({
          user_id: reportToResolve.rider_id,
          user_type: "rider",
          title: "SOS Resolved",
          body: "Your emergency has been resolved. Tap to view the details.",
          is_read: false,
          created_at: nowIso,
        });
      }

      setResolveModalOpen(false);
      setReportToResolve(null);
      setResolutionNotesInput("");

      await fetchReports();
    } catch (err: any) {
      alert("Failed to resolve emergency: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const st = status?.toLowerCase();
    if (st === "pending") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          Pending
        </span>
      );
    }
    if (st === "acknowledged") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40">
          Acknowledged
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
        Resolved
      </span>
    );
  };

  const formatTimestamp = (isoString: string | null) => {
    if (!isoString) return "Pending";
    return new Date(isoString).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Emergency SOS Control
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Realtime monitoring and response system for rider safety reports.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="self-start sm:self-auto h-9 px-3 bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-lg text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#22C55E]" : ""}`} />
          Refresh Data
        </button>
      </div>

      {/* STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Active SOS</span>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100 mt-2">{activeCount}</p>
          <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 mt-1">Requires dispatch attention</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Awaiting Response</span>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100 mt-2">{awaitingCount}</p>
          <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 mt-1">Unacknowledged pending status</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Resolved Today</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[#22C55E]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100 mt-2">{resolvedTodayCount}</p>
          <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 mt-1">Completed emergency cases</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Avg Response Time</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#0F172A] dark:text-slate-100 mt-2">{avgResponseTimeDisplay}</p>
          <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 mt-1">Creation to acknowledgment</p>
        </div>
      </div>

      {/* FILTER CONTROLS & TAB STRIP */}
      <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex border-b border-[#F1F5F9] dark:border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3 text-xs font-bold transition-colors relative ${
              activeTab === "active"
                ? "text-[#22C55E]"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
            }`}
          >
            Active
            {activeTab === "active" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22C55E] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("acknowledged")}
            className={`pb-3 text-xs font-bold transition-colors relative ${
              activeTab === "acknowledged"
                ? "text-[#22C55E]"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
            }`}
          >
            Acknowledged
            {activeTab === "acknowledged" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22C55E] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("resolved")}
            className={`pb-3 text-xs font-bold transition-colors relative ${
              activeTab === "resolved"
                ? "text-[#22C55E]"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
            }`}
          >
            Resolved
            {activeTab === "resolved" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22C55E] rounded-full" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rider, phone, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="h-9 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="all">All Issue Types</option>
            <option value="Accident">Accident</option>
            <option value="Road Block">Road Block</option>
            <option value="Out of Fuel">Out of Fuel</option>
            <option value="Vehicle Breakdown">Vehicle Breakdown</option>
            <option value="Need Assistance">Need Assistance</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-center space-y-2">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchReports}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-200">No active emergency reports.</h3>
          <p className="text-xs text-[#94A3B8] dark:text-slate-500 max-w-sm mx-auto">
            Rider SOS alerts will appear here automatically when submitted.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-5 shadow-sm hover:border-[#22C55E]/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-slate-200">
                    <span className="text-base">🚨</span>
                    <span>{report.issue_type}</span>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#0F172A] dark:text-slate-200">
                    Rider: <span className="font-semibold text-[#475569] dark:text-slate-300">{report.rider?.rider_name || "Unknown Rider"}</span>
                  </p>
                  {report.vendor_name || report.vendor?.shop_name ? (
                    <p className="text-[#64748B] dark:text-slate-400 truncate">
                      Store: <span className="font-medium text-[#0F172A] dark:text-slate-300">{report.vendor_name || report.vendor?.shop_name}</span>
                    </p>
                  ) : null}
                  {report.order_number || report.order?.order_number ? (
                    <p className="text-[#64748B] dark:text-slate-400">
                      Order: <span className="font-medium text-[#0F172A] dark:text-slate-300">#{report.order_number || report.order?.order_number}</span>
                    </p>
                  ) : null}
                  <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 pt-1">
                    Submitted: {formatTimestamp(report.created_at)}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#F1F5F9] dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedReport(report)}
                  className="h-8 px-4 bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#16A34A] dark:text-[#22C55E] border border-[#DCFCE7] dark:border-emerald-900/40 rounded-lg text-xs font-bold hover:bg-[#22C55E] hover:text-white transition-all"
                >
                  Open Emergency Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DRAWER FOR EMERGENCY DETAILS */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 space-y-6 shadow-2xl border-l border-[#E2E8F0] dark:border-slate-800 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9] dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-slate-100">Emergency Dossier</h2>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* RIDER INFO */}
              <div className="space-y-2 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 rounded-xl border border-[#F1F5F9] dark:border-slate-800">
                <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Rider Information
                </h3>
                <div className="text-xs space-y-1 pt-1 text-[#0F172A] dark:text-slate-200">
                  <p><span className="font-semibold text-[#64748B]">Name:</span> {selectedReport.rider?.rider_name || "N/A"}</p>
                  <p><span className="font-semibold text-[#64748B]">Phone:</span> {selectedReport.rider?.phone || "N/A"}</p>
                  <p><span className="font-semibold text-[#64748B]">Vehicle:</span> {selectedReport.rider?.vehicle_type || "N/A"} ({selectedReport.rider?.vehicle_number || "No plate"})</p>
                  <p><span className="font-semibold text-[#64748B]">Rating:</span> ⭐ {selectedReport.rider?.rating || "5.0"}</p>
                </div>
              </div>

              {/* EMERGENCY DESCRIPTION */}
              <div className="space-y-2 bg-red-50/50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Emergency Description
                  </h3>
                  {getStatusBadge(selectedReport.status)}
                </div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Issue: <span className="text-red-600 dark:text-red-400">{selectedReport.issue_type}</span>
                </p>
                <p className="text-xs text-[#475569] dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800">
                  {selectedReport.description || "No description provided."}
                </p>
                <p className="text-[11px] text-[#94A3B8] dark:text-slate-500 pt-1">
                  Reported: {formatTimestamp(selectedReport.created_at)}
                </p>
              </div>

              {/* NEW SECTION: RESOLUTION STATUS */}
              <div className="space-y-2 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 rounded-xl border border-[#F1F5F9] dark:border-slate-800">
                <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Resolution
                </h3>
                {selectedReport.status?.toLowerCase() === "pending" && (
                  <p className="text-xs text-[#64748B] dark:text-slate-400 italic">Waiting for support...</p>
                )}
                {selectedReport.status?.toLowerCase() === "acknowledged" && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    Support team is reviewing this emergency.
                  </p>
                )}
                {selectedReport.status?.toLowerCase() === "resolved" && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-xs space-y-1">
                    <p className="font-bold text-[#16A34A] dark:text-[#22C55E]">Resolution Notes:</p>
                    <p className="text-[#0F172A] dark:text-slate-200 leading-relaxed">
                      {selectedReport.resolution_notes || "Emergency case has been resolved."}
                    </p>
                  </div>
                )}
              </div>

              {/* NEW SECTION: TIMELINE */}
              <div className="space-y-3 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 rounded-xl border border-[#F1F5F9] dark:border-slate-800">
                <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Emergency Timeline
                </h3>
                
                <div className="space-y-3 pl-2 text-xs">
                  {/* Step 1: Submitted */}
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-slate-100">Submitted</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">{formatTimestamp(selectedReport.created_at)}</p>
                    </div>
                  </div>

                  {/* Step 2: Acknowledged */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                        selectedReport.acknowledged_at || selectedReport.status?.toLowerCase() === "resolved"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}
                    >
                      {selectedReport.acknowledged_at || selectedReport.status?.toLowerCase() === "resolved" ? "✓" : "2"}
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-slate-100">Acknowledged</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {formatTimestamp(selectedReport.acknowledged_at)}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Resolved */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                        selectedReport.status?.toLowerCase() === "resolved"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}
                    >
                      {selectedReport.status?.toLowerCase() === "resolved" ? "✓" : "3"}
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] dark:text-slate-100">Resolved</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {formatTimestamp(selectedReport.resolved_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* EVIDENCE ATTACHMENT */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                  Evidence Attachment
                </h3>

                {selectedReport.photo_url ? (
                  signedPhotoUrl ? (
                    <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 max-h-56 bg-black flex items-center justify-center relative">
                      <img
                        src={signedPhotoUrl}
                        alt="Emergency Evidence"
                        className="object-contain max-h-56 w-full"
                        onError={() => {
                          console.error("[SOS Image Load Error] Failed to render image element:", signedPhotoUrl);
                          setPhotoError("Image rendering failed. Check storage permissions or bucket object accessibility.");
                          setSignedPhotoUrl(null);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                        <ImageOff className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold">Image Unavailable</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-500">
                            {photoError || "Signed URL could not be generated."}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/30 text-[11px] font-mono break-all text-[#334155] dark:text-slate-300 space-y-1">
                        <p className="font-semibold text-[#64748B]">Object Path:</p>
                        <p>{selectedReport.photo_url}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => copyPathToClipboard(selectedReport.photo_url!)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40 rounded-md text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors flex items-center gap-1"
                        >
                          {copiedPath ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" /> Copied Path
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy Path
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 bg-[#F8FAFC] dark:bg-slate-800/50 rounded-xl text-center text-xs text-[#94A3B8]">
                    No evidence photo uploaded.
                  </div>
                )}
              </div>

              {/* GPS COORDINATES */}
              <div className="space-y-2 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 rounded-xl border border-[#F1F5F9] dark:border-slate-800">
                <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> GPS Coordinates
                </h3>
                {selectedReport.latitude && selectedReport.longitude ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-[#0F172A] dark:text-slate-200 font-mono">
                      Lat: {selectedReport.latitude}, Lng: {selectedReport.longitude}
                    </p>
                    {selectedReport.location_accuracy && (
                      <p className="text-[11px] text-[#94A3B8]">
                        Accuracy: ±{Math.round(selectedReport.location_accuracy)} meters
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#22C55E] text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[#94A3B8]">Location coordinates unavailable.</p>
                )}
              </div>

              {/* STORE CONTEXT */}
              {(selectedReport.vendor || selectedReport.vendor_name) && (
                <div className="space-y-1 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 rounded-xl border border-[#F1F5F9] dark:border-slate-800 text-xs">
                  <h3 className="text-xs font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider mb-2">
                    Store & Order Context
                  </h3>
                  <p><span className="font-semibold text-[#64748B]">Vendor:</span> {selectedReport.vendor_name || selectedReport.vendor?.shop_name}</p>
                  {selectedReport.vendor?.phone && <p><span className="font-semibold text-[#64748B]">Vendor Phone:</span> {selectedReport.vendor.phone}</p>}
                  {selectedReport.order_number || selectedReport.order?.order_number ? (
                    <p><span className="font-semibold text-[#64748B]">Order Reference:</span> #{selectedReport.order_number || selectedReport.order?.order_number}</p>
                  ) : null}
                  {selectedReport.order?.total_amount && <p><span className="font-semibold text-[#64748B]">Amount:</span> ₹{selectedReport.order.total_amount}</p>}
                </div>
              )}
            </div>

            {/* ACTION BUTTONS BASED ON STATE */}
            <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {selectedReport.rider?.phone && (
                  <a
                    href={`tel:${selectedReport.rider.phone}`}
                    className="h-9 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-500" /> Call Rider
                  </a>
                )}

                {selectedReport.latitude && selectedReport.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs font-bold text-[#0F172A] dark:text-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Maps
                  </a>
                )}
              </div>

              {selectedReport.status?.toLowerCase() === "pending" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAcknowledge(selectedReport)}
                    className="h-10 px-4 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
                  >
                    Acknowledge
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => openResolveModal(selectedReport)}
                    className="h-10 px-4 bg-[#22C55E] text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1"
                  >
                    Resolve
                  </button>
                </div>
              )}

              {selectedReport.status?.toLowerCase() === "acknowledged" && (
                <div className="pt-1">
                  <button
                    disabled={actionLoading}
                    onClick={() => openResolveModal(selectedReport)}
                    className="w-full h-10 px-4 bg-[#22C55E] text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1"
                  >
                    Resolve Emergency
                  </button>
                </div>
              )}

              {selectedReport.status?.toLowerCase() === "resolved" && null}
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {resolveModalOpen && reportToResolve && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-slate-800">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                Resolve Emergency
              </h3>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                Resolution Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={resolutionNotesInput}
                onChange={(e) => setResolutionNotesInput(e.target.value)}
                placeholder={"Example:\n• Ambulance contacted\n• Vendor informed\n• Replacement rider assigned\n• Fuel delivered\n• Police informed"}
                className="w-full p-3 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#22C55E] resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setResolveModalOpen(false)}
                className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                disabled={actionLoading || !resolutionNotesInput.trim()}
                onClick={handleConfirmResolve}
                className="flex-1 h-10 bg-[#22C55E] text-white rounded-xl text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {actionLoading ? "Resolving..." : "Resolve Emergency"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}