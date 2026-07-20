import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from "../../../lib/supabase";
import { 
  Inbox, 
  CreditCard, 
  Layers, 
  Store, 
  Clock, 
  AlertCircle,
  Eye, 
  Loader2,
  Trash2,
  Square,
  CheckSquare,
  Check,
  X as XIcon,
  Search,
  RefreshCw,
  Bell
} from 'lucide-react';

// --- TYPES & INTERFACES ---
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  recipient_id?: string;
}

interface SubscriptionPaymentRequest {
  id: string;
  vendor_id: string;
  plan_name: string;
  status: string;
  created_at: string;
  utr_number: string;
  amount: number;
  approved_at: string | null;
  remarks: string | null;
}

interface Vendor {
  id: string;
  shop_name: string;
  owner_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
}

interface UnifiedRequest {
  id: string;
  source_table: 'notifications' | 'subscription_payment_requests';
  type: 'subscription' | 'settlement' | 'vendor_registration' | 'notification';
  title: string;
  message: string;
  status: string;
  created_at: string;
  vendor_id?: string;
  vendor_shop_name?: string;
  vendor_owner_name?: string;
  // Specific properties
  plan_name?: string;
  amount?: number;
  utr_number?: string;
  is_read?: boolean;
}

interface SubscriptionPlan {
  plan_name: string;
  commission_percent: number;
  monthly_settlement_request_limit: number;
  max_profile_banners: number;
  monthly_price: number;
  is_active: boolean;
}

type TabType = 'all' | 'subscription' | 'settlement' | 'vendor_registration' | 'notifications';
type SortOrder = 'desc' | 'asc';

export default function RequestsCenter() {
  // --- STATE MANAGEMENT ---
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  const [rawNotifications, setRawNotifications] = useState<Notification[]>([]);
  const [rawPaymentRequests, setRawPaymentRequests] = useState<SubscriptionPaymentRequest[]>([]);
  const [vendorsMap, setVendorsMap] = useState<Record<string, Vendor>>({});
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // --- DATA FETCHING & SYNCHRONIZATION ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorState(null);

      // 1. Fetch notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at, recipient_id')
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // 2. Fetch payment requests
      const { data: paymentRequestsData, error: paymentRequestsError } = await supabase
        .from('subscription_payment_requests')
        .select('id, vendor_id, plan_name, status, created_at, utr_number, amount, approved_at, remarks')
        .order('created_at', { ascending: false });

      if (paymentRequestsError) throw paymentRequestsError;

      // Collect all vendor IDs from both datasets safely
      const vendorIds = new Set<string>();
      (notificationsData || []).forEach(n => { if (n.recipient_id) vendorIds.add(n.recipient_id); });
      (paymentRequestsData || []).forEach(p => { if (p.vendor_id) vendorIds.add(p.vendor_id); });

      // 3. Fetch Vendors separately to respect NO SUPABASE JOINS rule
      const vendorMapObj: Record<string, Vendor> = {};
      if (vendorIds.size > 0) {
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, shop_name, owner_name, email, phone, status, created_at')
          .in('id', Array.from(vendorIds));

        if (vendorsError) throw vendorsError;

        (vendorsData || []).forEach((v: Vendor) => {
          vendorMapObj[v.id] = v;
        });
      }

      setRawNotifications(notificationsData || []);
      setRawPaymentRequests(paymentRequestsData || []);
      setVendorsMap(vendorMapObj);
    } catch (err: any) {
      console.error("Error loading center requests data:", err);
      setErrorState(err.message || "Failed to parse dashboard request records.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- SUPABASE REALTIME SUBSCRIPTION IMPLEMENTATION ---
  useEffect(() => {
    fetchData();

    const notificationsChannel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchData();
      })
      .subscribe();

    const paymentRequestsChannel = supabase
      .channel('public:subscription_payment_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payment_requests' }, () => {
        fetchData();
      })
      .subscribe();

    const vendorSettlementsChannel = supabase
      .channel('public:vendor_settlements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_settlements' }, () => {
        fetchData();
      })
      .subscribe();

    const vendorsChannel = supabase
      .channel('public:vendors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(paymentRequestsChannel);
      supabase.removeChannel(vendorSettlementsChannel);
      supabase.removeChannel(vendorsChannel);
    };
  }, [fetchData]);

  // --- MEMOIZED MEMORY MAPPER & TRANSFORMATION ---
  const unifiedRequestsList = useMemo((): UnifiedRequest[] => {
    const records: UnifiedRequest[] = [];

    // Transform payment requests
    rawPaymentRequests.forEach(req => {
      const vendor = vendorsMap[req.vendor_id];
      records.push({
        id: req.id,
        source_table: 'subscription_payment_requests',
        type: 'subscription',
        title: `Plan Upgrade Request: ${req.plan_name}`,
        message: `Amount: ₹${req.amount} | UTR: ${req.utr_number} ${req.remarks ? `| Remarks: ${req.remarks}` : ''}`,
        status: req.status,
        created_at: req.created_at,
        vendor_id: req.vendor_id,
        vendor_shop_name: vendor?.shop_name || 'Unknown Shop',
        vendor_owner_name: vendor?.owner_name || 'Unknown Owner',
        plan_name: req.plan_name,
        amount: req.amount,
        utr_number: req.utr_number
      });
    });

    // Transform system notification logs
    rawNotifications.forEach(notif => {
      const vendor = notif.recipient_id ? vendorsMap[notif.recipient_id] : undefined;
      let calculatedType: 'subscription' | 'settlement' | 'vendor_registration' | 'notification' = 'notification';
      
      if (notif.type === 'subscription') calculatedType = 'subscription';
      else if (notif.type === 'settlement') calculatedType = 'settlement';
      else if (notif.type === 'vendor_registration') calculatedType = 'vendor_registration';

      records.push({
        id: notif.id,
        source_table: 'notifications',
        type: calculatedType,
        title: notif.title,
        message: notif.message,
        status: notif.is_read ? 'read' : 'unread',
        created_at: notif.created_at,
        vendor_id: notif.recipient_id,
        vendor_shop_name: vendor?.shop_name || 'System / Platform',
        vendor_owner_name: vendor?.owner_name || 'Administrator',
        is_read: notif.is_read
      });
    });

    // Sort operations
    return records.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [rawNotifications, rawPaymentRequests, vendorsMap, sortOrder]);

  // --- SEARCH AND FILTERS EXTENSION ---
  const filteredRequests = useMemo(() => {
    return unifiedRequestsList.filter(req => {
      // Tab categorization logic
      if (activeTab === 'subscription' && req.type !== 'subscription') return false;
      if (activeTab === 'settlement' && req.type !== 'settlement') return false;
      if (activeTab === 'vendor_registration' && req.type !== 'vendor_registration') return false;
      if (activeTab === 'notifications' && req.source_table !== 'notifications') return false;

      // Status selector filters logic
      if (statusFilter !== 'all') {
        if (req.status !== statusFilter) return false;
      }

      // Query String match logic
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchTitle = req.title?.toLowerCase().includes(query);
        const matchMsg = req.message?.toLowerCase().includes(query);
        const matchShop = req.vendor_shop_name?.toLowerCase().includes(query);
        const matchOwner = req.vendor_owner_name?.toLowerCase().includes(query);
        const matchUtr = req.utr_number?.toLowerCase().includes(query);
        return matchTitle || matchMsg || matchShop || matchOwner || matchUtr;
      }

      return true;
    });
  }, [unifiedRequestsList, activeTab, statusFilter, searchQuery]);

  // --- STATISTICAL SUMMARY METRICS ---
  const metrics = useMemo(() => {
    return {
      total: unifiedRequestsList.length,
      pendingSubscriptions: rawPaymentRequests.filter(p => p.status === 'pending').length,
      unreadNotifications: rawNotifications.filter(n => !n.is_read).length,
      vendorRegs: unifiedRequestsList.filter(r => r.type === 'vendor_registration').length
    };
  }, [unifiedRequestsList, rawPaymentRequests, rawNotifications]);

  // --- PAGINATION COMPUTE HANDLER ---
  const paginatedRequests = useMemo(() => {
    const offset = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(offset, offset + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;

  // Reset page marker when filters fluctuate
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, statusFilter]);

  // --- CORE WORKFLOW OPERATIONS (APPROVE / REJECT / BATCH) ---
  const handleApproveSubscription = async (req: UnifiedRequest) => {
    if (!req.plan_name || !req.vendor_id) return;
    const confirmApprove = window.confirm(`Approve subscription upgrade request for Plan: "${req.plan_name}"?`);
    if (!confirmApprove) return;

    try {
      setProcessingId(req.id);
      setActionLoading(true);

      // STEP 1: Load requested plan configuration parameters
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('plan_name, commission_percent, monthly_settlement_request_limit, max_profile_banners, monthly_price, is_active')
        .eq('plan_name', req.plan_name)
        .eq('is_active', true)
        .maybeSingle();

      if (planError || !planData) {
        throw new Error(planError?.message || `The requested subscription plan "${req.plan_name}" is currently inactive or invalid.`);
      }

      // STEP 2: Approve target pending billing log record entries
      const { error: patchRequestError } = await supabase
        .from('subscription_payment_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', req.id);

      if (patchRequestError) throw patchRequestError;

      // Calculate calendar dates limits
      const isFreePlan = planData.monthly_price === 0 || planData.plan_name.toLowerCase() === 'free';
      let computedExpiryDate: string | null = null;
      if (!isFreePlan) {
        const boundaryDate = new Date();
        boundaryDate.setDate(boundaryDate.getDate() + 30);
        computedExpiryDate = boundaryDate.toISOString();
      }

      // STEP 3: Upsert into active profiles subscriptions mapping engine
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('vendor_id')
        .eq('vendor_id', req.vendor_id)
        .maybeSingle();

      if (existingSub) {
        const { error: updateSubError } = await supabase
          .from('subscriptions')
          .update({
            plan_name: planData.plan_name,
            commission_percent: planData.commission_percent,
            monthly_settlement_request_limit: planData.monthly_settlement_request_limit,
            max_profile_banners: planData.max_profile_banners,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: computedExpiryDate,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_id', req.vendor_id);

        if (updateSubError) throw updateSubError;
      } else {
        const { error: insertSubError } = await supabase
          .from('subscriptions')
          .insert([{
            vendor_id: req.vendor_id,
            plan_name: planData.plan_name,
            commission_percent: planData.commission_percent,
            monthly_settlement_request_limit: planData.monthly_settlement_request_limit,
            max_profile_banners: planData.max_profile_banners,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: computedExpiryDate,
            updated_at: new Date().toISOString()
          }]);

        if (insertSubError) throw insertSubError;
      }

      alert(`Subscription plan tier successfully provisioned to ${planData.plan_name}.`);
      await fetchData();
    } catch (err: any) {
      console.error("Approve subscription transaction rejected:", err);
      alert(err.message || "An operational error occurred during plan deployment provisioning setup.");
    } finally {
      setProcessingId(null);
      setActionLoading(false);
    }
  };

  const handleRejectSubscription = async (req: UnifiedRequest) => {
    const adminRemarks = window.prompt("Enter context notes/remarks for this request rejection cancellation:", "Invalid UTR / Payment confirmation missing");
    if (adminRemarks === null) return; // User cancelled prompt

    try {
      setProcessingId(req.id);
      setActionLoading(true);

      const { error } = await supabase
        .from('subscription_payment_requests')
        .update({
          status: 'rejected',
          remarks: adminRemarks || 'Rejected by System Admin'
        })
        .eq('id', req.id);

      if (error) throw error;

      alert("Subscription request rejected successfully.");
      await fetchData();
    } catch (err: any) {
      console.error("Failed executing entry denial state mutation:", err);
      alert(err.message || "Failed execution of transaction denial state.");
    } finally {
      setProcessingId(null);
      setActionLoading(false);
    }
  };

  const toggleReadState = async (id: string, currentIsRead: boolean) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: !currentIsRead })
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error("Failed executing entry modification toggle read state:", err);
    }
  };

  const handleBulkNotificationDelete = async () => {
    const filterNotificationTargets = selectedIds.filter(id => {
      const item = unifiedRequestsList.find(r => r.id === id);
      return item?.source_table === 'notifications';
    });

    if (filterNotificationTargets.length === 0) {
      alert("No disposable system operational notifications selected. Core ledger financial data rows cannot be bulk purged.");
      return;
    }

    const confirmPurge = window.confirm(`Permanently remove ${filterNotificationTargets.length} selected notification logs from database history?`);
    if (!confirmPurge) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', filterNotificationTargets);

      if (error) throw error;

      alert("Selected notification entries completely purged.");
      setSelectedIds([]);
      await fetchData();
    } catch (err: any) {
      console.error("Failed executing targeted logs block deletion sequence:", err);
      alert(err.message || "Error experienced clearing select records logs queues indices.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- MULTI-SELECT HANDLER ROW STATE INTERSECTIONS ---
  const selectRowToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllPageToggle = () => {
    const pageItemIds = paginatedRequests.map(r => r.id);
    const allSelectedOnPage = pageItemIds.every(id => selectedIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedIds(prev => prev.filter(id => !pageItemIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const combined = [...prev];
        pageItemIds.forEach(id => {
          if (!combined.includes(id)) combined.push(id);
        });
        return combined;
      });
    }
  };

  // --- PRESENTATIONAL CUSTOM COMPONENT HELPERS ---
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'subscription': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'settlement': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'vendor_registration': return 'bg-purple-50 text-purple-800 border-purple-200';
      default: return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
      case 'read':
        return 'bg-slate-100 text-slate-700 font-medium';
      case 'pending':
      case 'unread':
        return 'bg-amber-600 text-white font-bold';
      case 'rejected':
        return 'bg-rose-100 text-rose-700 font-medium';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
        <p className="text-sm font-bold text-slate-500 animate-pulse">Assembling system infrastructure framework models...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 text-slate-800 font-sans antialiased space-y-6">
      
      {/* ERROR HEADER BANNER INDICATOR DISMISSIBLE PLATFORM BAR */}
      {errorState && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
          <div className="grow">
            <h3 className="text-sm font-bold text-rose-900">Database Context Error Resolution Failure</h3>
            <p className="text-xs text-rose-700 mt-0.5">{errorState}</p>
          </div>
          <button onClick={() => setErrorState(null)} className="text-rose-400 hover:text-rose-900 font-bold text-xs px-2 py-1 transition-all">Dismiss</button>
        </div>
      )}

      {/* PRIMARY MODULE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Operations Center</h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Unified administrative routing cockpit for system requests records validation arrays</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={actionLoading}
          className="self-start md:self-auto h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-all"
        >
          <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
          Force Synchronization Update
        </button>
      </div>

      {/* METRICS & PERFORMANCE KANBAN METERS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-slate-800">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Records</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl"><Inbox size={20} /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Subscriptions</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{metrics.pendingSubscriptions}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><CreditCard size={20} /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unread System Logs</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{metrics.unreadNotifications}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Bell size={20} /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor Registrations</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{metrics.vendorRegs}</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Store size={20} /></div>
        </div>
      </div>

      {/* CONTROLS FILTERS DYNAMIC HOVER ANCHORS TOOLBAR BANNER HUB */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-4 flex flex-col gap-4">
        
        {/* ROW 1: CONTROLS INPUTS SEARCH SEARCHING CONFIGS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative grow max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Query matching matrix values (UTR, Shop, Title, Owner)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl text-xs font-semibold shadow-2xs focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value="all">All Operational Statuses</option>
              <option value="pending">Pending Validation</option>
              <option value="approved">Approved / Read</option>
              <option value="rejected">Rejected Status</option>
              <option value="unread">Unread Logs</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="h-10 px-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value="desc">Sort: Chronological Descending</option>
              <option value="asc">Sort: Chronological Ascending</option>
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ROW 2: CATEGORY CATEGORIZATION SEGMENTED NAVIGATION TABS */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-transparent gap-4">
          <div className="flex border-b border-transparent gap-1 overflow-x-auto scrollbar-none">
            {([
              { key: 'all', label: 'All Operations Matrix' },
              { key: 'subscription', label: 'Subscription Payment Queue' },
              { key: 'settlement', label: 'Settlement Logs' },
              { key: 'vendor_registration', label: 'Registrations' },
              { key: 'notifications', label: 'System Notifications Hub' }
            ] as { key: TabType; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all shrink-0 whitespace-nowrap rounded-t-lg ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* BULK SELECTION TRASH ROUTINE TRIGGER BUTTON BLOCK */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkNotificationDelete}
              disabled={actionLoading}
              className="h-9 px-4 self-end lg:self-auto bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 text-xs font-extrabold flex items-center gap-2 rounded-xl shadow-xs transition-all animate-in fade-in zoom-in-95 duration-100"
            >
              <Trash2 size={13} />
              Purge Selected System Logs ({selectedIds.length})
            </button>
          )}
        </div>

      </div>

      {/* CORE INFRASTRUCTURE MATRIX DATA PRESENTATION TABLE CONTAINER GRID */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest select-none">
                <th className="px-5 py-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={selectAllPageToggle}
                    disabled={paginatedRequests.length === 0}
                    className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none disabled:opacity-30 inline-block align-middle"
                  >
                    {paginatedRequests.length > 0 && paginatedRequests.map(r => r.id).every(id => selectedIds.includes(id)) ? (
                      <CheckSquare size={16} className="text-emerald-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-4">Origin Type</th>
                <th className="px-5 py-4">Title Identification</th>
                <th className="px-5 py-4">Message Body Parameters</th>
                <th className="px-5 py-4">Associated Vendor / Owner Profile</th>
                <th className="px-5 py-4">Created Timestamp</th>
                <th className="px-5 py-4">Operational Status</th>
                <th className="px-5 py-4 text-center">Process Pipeline Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((req) => {
                  const isChecked = selectedIds.includes(req.id);
                  const isPendingSub = req.source_table === 'subscription_payment_requests' && req.status === 'pending';
                  const isRowProcessing = processingId === req.id;

                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-slate-50/60 transition-colors ${isChecked ? 'bg-emerald-50/20' : ''} ${isPendingSub ? 'bg-amber-50/20 font-semibold' : ''}`}
                    >
                      {/* Selection Control Box Column */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => selectRowToggle(req.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none inline-block align-middle"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Origin Type Segment Label */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 border text-[10px] uppercase font-extrabold rounded-md ${getTypeStyles(req.type)}`}>
                          {req.type.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Record Parameter Title */}
                      <td className="px-5 py-4 text-slate-900 max-w-[160px] truncate font-bold">
                        {req.title || '—'}
                      </td>

                      {/* Core Content Messaging Parameters Text */}
                      <td className="px-5 py-4 text-slate-500 max-w-[280px] break-words font-medium">
                        {req.message || '—'}
                      </td>

                      {/* Associated Enterprise Entity Profiles Mapping Block */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold">{req.vendor_shop_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{req.vendor_owner_name || 'System Level User'}</span>
                        </div>
                      </td>

                      {/* Epoch Execution Date Time Label */}
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(req.created_at).toLocaleString('en-IN', {
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Operational Metrics Component Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${getStatusStyles(req.status)}`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Orchestration Pipeline Workflow Controls Triggers Column */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        {req.source_table === 'subscription_payment_requests' ? (
                          req.status === 'pending' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={isRowProcessing}
                                onClick={() => handleApproveSubscription(req)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg shadow-2xs transition-all"
                                title="Approve Upgrade Flow"
                              >
                                {isRowProcessing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button
                                disabled={isRowProcessing}
                                onClick={() => handleRejectSubscription(req)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg shadow-2xs transition-all"
                                title="Reject Denial Flow"
                              >
                                {isRowProcessing ? <Loader2 size={13} className="animate-spin" /> : <XIcon size={13} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold italic text-slate-400 select-none">Archived Pipeline</span>
                          )
                        ) : (
                          <button
                            onClick={() => toggleReadState(req.id, !!req.is_read)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              req.is_read 
                                ? 'bg-white text-slate-400 border-slate-200 hover:text-slate-800' 
                                : 'bg-blue-600 text-white border-transparent hover:bg-blue-700 shadow-2xs'
                            }`}
                            title={req.is_read ? "Mark Unread Log" : "Mark Read Log"}
                          >
                            <Eye size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400 font-bold bg-white select-none">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-xs mx-auto">
                      <Layers size={32} className="text-slate-300 stroke-[1.5]" />
                      <p className="text-sm text-slate-800 mt-1">No Operational Queue Matches Found</p>
                      <p className="text-[11px] font-medium text-slate-400">There are no operational records matched with the filtered context criteria elements.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* COMPONENT INTERACTION CONTROLS PAGINATION FOOTER PANEL SECTION */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
          <span className="text-xs font-semibold text-slate-500">
            Presenting index rows <strong className="text-slate-900">{filteredRequests.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> through <strong className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</strong> of <strong className="text-slate-900">{filteredRequests.length}</strong> catalog records filtered
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 h-8 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
            >
              Previous Queue
            </button>
            
            <div className="px-3 text-xs font-bold text-slate-700">
              Page {currentPage} of {totalPages}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 h-8 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
            >
              Next Page Stack
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}