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
  plan_name?: string;
  amount?: number;
  utr_number?: string;
  is_read?: boolean;
}

type TabType = 'all' | 'subscription' | 'settlement' | 'vendor_registration' | 'notifications';
type SortOrder = 'desc' | 'asc';

export default function RequestsCenter() {
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorState(null);

      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at, recipient_id')
        .order('created_at', { ascending: false });
      if (notificationsError) throw notificationsError;

      const { data: paymentRequestsData, error: paymentRequestsError } = await supabase
        .from('subscription_payment_requests')
        .select('id, vendor_id, plan_name, status, created_at, utr_number, amount, approved_at, remarks')
        .order('created_at', { ascending: false });
      if (paymentRequestsError) throw paymentRequestsError;

      const vendorIds = new Set<string>();
      (notificationsData || []).forEach(n => { if (n.recipient_id) vendorIds.add(n.recipient_id); });
      (paymentRequestsData || []).forEach(p => { if (p.vendor_id) vendorIds.add(p.vendor_id); });

      const vendorMapObj: Record<string, Vendor> = {};
      if (vendorIds.size > 0) {
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, shop_name, owner_name, email, phone, status, created_at')
          .in('id', Array.from(vendorIds));
        if (vendorsError) throw vendorsError;
        (vendorsData || []).forEach((v: Vendor) => { vendorMapObj[v.id] = v; });
      }

      setRawNotifications((notificationsData || []) as Notification[]);
      setRawPaymentRequests((paymentRequestsData || []) as SubscriptionPaymentRequest[]);
      setVendorsMap(vendorMapObj);
    } catch (err: any) {
      console.error('Error loading center requests data:', err);
      setErrorState(err.message || 'Failed to load request records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channels = [
      supabase.channel('public:notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchData).subscribe(),
      supabase.channel('public:subscription_payment_requests').on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payment_requests' }, fetchData).subscribe(),
      supabase.channel('public:vendor_settlements').on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_settlements' }, fetchData).subscribe(),
      supabase.channel('public:vendors').on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, fetchData).subscribe()
    ];
    return () => { channels.forEach(channel => supabase.removeChannel(channel)); };
  }, [fetchData]);

  const unifiedRequestsList = useMemo((): UnifiedRequest[] => {
    const records: UnifiedRequest[] = [];
    rawPaymentRequests.forEach(req => {
      const vendor = vendorsMap[req.vendor_id];
      records.push({
        id: req.id,
        source_table: 'subscription_payment_requests',
        type: 'subscription',
        title: `Plan Upgrade Request: ${req.plan_name}`,
        message: `Amount: ₹${req.amount} | UTR: ${req.utr_number}${req.remarks ? ` | Remarks: ${req.remarks}` : ''}`,
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

    rawNotifications.forEach(notif => {
      const vendor = notif.recipient_id ? vendorsMap[notif.recipient_id] : undefined;
      const calculatedType = notif.type === 'subscription' ? 'subscription' : notif.type === 'settlement' ? 'settlement' : notif.type === 'vendor_registration' ? 'vendor_registration' : 'notification';
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

    return records.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [rawNotifications, rawPaymentRequests, vendorsMap, sortOrder]);

  const filteredRequests = useMemo(() => unifiedRequestsList.filter(req => {
    if (activeTab === 'subscription' && req.type !== 'subscription') return false;
    if (activeTab === 'settlement' && req.type !== 'settlement') return false;
    if (activeTab === 'vendor_registration' && req.type !== 'vendor_registration') return false;
    if (activeTab === 'notifications' && req.source_table !== 'notifications') return false;
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return [req.title, req.message, req.vendor_shop_name, req.vendor_owner_name, req.utr_number].some(value => value?.toLowerCase().includes(q));
    }
    return true;
  }), [unifiedRequestsList, activeTab, statusFilter, searchQuery]);

  const metrics = useMemo(() => ({
    total: unifiedRequestsList.length,
    pendingSubscriptions: rawPaymentRequests.filter(p => p.status === 'pending').length,
    unreadNotifications: rawNotifications.filter(n => !n.is_read).length,
    vendorRegs: unifiedRequestsList.filter(r => r.type === 'vendor_registration').length
  }), [unifiedRequestsList, rawPaymentRequests, rawNotifications]);

  const paginatedRequests = useMemo(() => {
    const offset = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(offset, offset + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery, statusFilter]);

  const notifyVendor = async (vendorId: string, title: string, message: string) => {
    const { error } = await supabase.from('notifications').insert([{
      recipient_id: vendorId,
      title,
      message,
      type: 'subscription',
      is_read: false
    }]);
    if (error) throw error;
  };

  const handleApproveSubscription = async (req: UnifiedRequest) => {
    if (!req.plan_name || !req.vendor_id) return;
    if (!window.confirm(`Approve subscription upgrade request for Plan: "${req.plan_name}"?`)) return;

    try {
      setProcessingId(req.id);
      setActionLoading(true);

      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('plan_name, commission_percent, monthly_settlement_request_limit, max_profile_banners, monthly_price, is_active')
        .eq('plan_name', req.plan_name)
        .maybeSingle();

      if (planError) throw planError;
      if (!planData || !planData.is_active) {
        throw new Error(`The requested subscription plan "${req.plan_name}" is currently inactive or invalid.`);
      }

      const now = new Date();
      const isFreePlan = Number(planData.monthly_price) === 0 || planData.plan_name.toLowerCase() === 'free';
      const computedExpiryDate = isFreePlan ? null : (() => { const d = new Date(now); d.setDate(d.getDate() + 30); return d.toISOString(); })();

      const { data: existingSub, error: existingSubError } = await supabase
        .from('subscriptions')
        .select('vendor_id')
        .eq('vendor_id', req.vendor_id)
        .maybeSingle();
      if (existingSubError) throw existingSubError;

      const subscriptionPayload = {
        vendor_id: req.vendor_id,
        plan_name: planData.plan_name,
        commission_percent: planData.commission_percent,
        monthly_settlement_request_limit: planData.monthly_settlement_request_limit,
        max_profile_banners: planData.max_profile_banners,
        status: 'active',
        start_date: now.toISOString(),
        end_date: computedExpiryDate,
        updated_at: now.toISOString()
      };

      if (existingSub) {
        const { error } = await supabase.from('subscriptions').update(subscriptionPayload).eq('vendor_id', req.vendor_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscriptions').insert([subscriptionPayload]);
        if (error) throw error;
      }

      const { error: requestError } = await supabase.from('subscription_payment_requests').update({ status: 'approved', approved_at: now.toISOString() }).eq('id', req.id);
      if (requestError) throw requestError;

      await notifyVendor(req.vendor_id, 'Subscription Approved', `Your ${planData.plan_name} subscription has been approved and is now active.`);
      alert(`Subscription plan successfully activated: ${planData.plan_name}.`);
      await fetchData();
    } catch (err: any) {
      console.error('Approve subscription transaction rejected:', err);
      alert(err.message || 'An operational error occurred during subscription approval.');
    } finally {
      setProcessingId(null);
      setActionLoading(false);
    }
  };

  const handleRejectSubscription = async (req: UnifiedRequest) => {
    if (!req.vendor_id) return;
    const adminRemarks = window.prompt('Enter context notes/remarks for this request rejection:', 'Invalid UTR / Payment confirmation missing');
    if (adminRemarks === null) return;

    try {
      setProcessingId(req.id);
      setActionLoading(true);
      const { error } = await supabase.from('subscription_payment_requests').update({ status: 'rejected', remarks: adminRemarks || 'Rejected by System Admin' }).eq('id', req.id);
      if (error) throw error;
      await notifyVendor(req.vendor_id, 'Subscription Request Rejected', `Your ${req.plan_name || 'subscription'} request was rejected. ${adminRemarks || 'Please review the payment details and submit again.'}`);
      alert('Subscription request rejected successfully.');
      await fetchData();
    } catch (err: any) {
      console.error('Failed executing subscription rejection:', err);
      alert(err.message || 'Failed to reject subscription request.');
    } finally {
      setProcessingId(null);
      setActionLoading(false);
    }
  };

  const toggleReadState = async (id: string, currentIsRead: boolean) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: !currentIsRead }).eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error('Failed toggling notification state:', err);
    }
  };

  const handleBulkNotificationDelete = async () => {
    const targets = selectedIds.filter(id => unifiedRequestsList.find(r => r.id === id)?.source_table === 'notifications');
    if (targets.length === 0) {
      alert('No notification records selected.');
      return;
    }
    if (!window.confirm(`Permanently remove ${targets.length} selected notification logs?`)) return;
    try {
      setActionLoading(true);
      const { error } = await supabase.from('notifications').delete().in('id', targets);
      if (error) throw error;
      setSelectedIds([]);
      await fetchData();
    } catch (err: any) {
      console.error('Failed deleting notification logs:', err);
      alert(err.message || 'Error deleting notification logs.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectRowToggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const selectAllPageToggle = () => {
    const pageIds = paginatedRequests.map(r => r.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(prev => allSelected ? prev.filter(id => !pageIds.includes(id)) : [...prev, ...pageIds.filter(id => !prev.includes(id))]);
  };

  const getTypeStyles = (type: string) => type === 'subscription' ? 'bg-amber-50 text-amber-800 border-amber-200' : type === 'settlement' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : type === 'vendor_registration' ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-blue-50 text-blue-800 border-blue-200';
  const getStatusStyles = (status: string) => ['approved', 'read'].includes(status) ? 'bg-slate-100 text-slate-700 font-medium' : ['pending', 'unread'].includes(status) ? 'bg-amber-600 text-white font-bold' : status === 'rejected' ? 'bg-rose-100 text-rose-700 font-medium' : 'bg-slate-100 text-slate-600';

  if (loading) {
    return <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 space-y-4"><Loader2 className="h-12 w-12 animate-spin text-emerald-600" /><p className="text-sm font-bold text-slate-500 animate-pulse">Loading request center...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 text-slate-800 font-sans antialiased space-y-6">
      {errorState && <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-xl flex items-start gap-3 shadow-xs"><AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} /><div className="grow"><h3 className="text-sm font-bold text-rose-900">Database Error</h3><p className="text-xs text-rose-700 mt-0.5">{errorState}</p></div><button onClick={() => setErrorState(null)} className="text-rose-400 hover:text-rose-900 font-bold text-xs px-2 py-1">Dismiss</button></div>}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4"><div><h1 className="text-2xl font-black text-slate-900 tracking-tight">System Operations Center</h1><p className="text-xs font-medium text-slate-500 mt-1">Unified administrative routing cockpit for system requests and records.</p></div><button onClick={fetchData} disabled={actionLoading} className="self-start md:self-auto h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs"><RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} /> Refresh</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-slate-800"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Records</p><p className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</p></div><div className="p-3 bg-slate-100 text-slate-700 rounded-xl"><Inbox size={20} /></div></div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-amber-500"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Subscriptions</p><p className="text-2xl font-black text-amber-600 mt-1">{metrics.pendingSubscriptions}</p></div><div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><CreditCard size={20} /></div></div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-blue-500"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unread System Logs</p><p className="text-2xl font-black text-blue-600 mt-1">{metrics.unreadNotifications}</p></div><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Bell size={20} /></div></div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between border-l-4 border-l-purple-500"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor Registrations</p><p className="text-2xl font-black text-purple-600 mt-1">{metrics.vendorRegs}</p></div><div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Store size={20} /></div></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"><div className="relative grow max-w-xl"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Search UTR, shop, title, owner..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs focus:outline-none focus:border-emerald-500" /></div><div className="flex flex-wrap items-center gap-3"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved / Read</option><option value="rejected">Rejected</option><option value="unread">Unread</option></select><select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"><option value="desc">Newest First</option><option value="asc">Oldest First</option></select></div></div>
        <hr className="border-slate-100" />
        <div className="flex border-b border-transparent gap-1 overflow-x-auto scrollbar-none">{([{ key: 'all', label: 'All' }, { key: 'subscription', label: 'Subscriptions' }, { key: 'settlement', label: 'Settlements' }, { key: 'vendor_registration', label: 'Registrations' }, { key: 'notifications', label: 'Notifications' }] as { key: TabType; label: string }[]).map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2.5 text-xs font-extrabold border-b-2 rounded-t-lg ${activeTab === tab.key ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>{tab.label}</button>)}</div>
        {selectedIds.length > 0 && <button onClick={handleBulkNotificationDelete} disabled={actionLoading} className="h-9 px-4 self-end bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 text-xs font-extrabold flex items-center gap-2 rounded-xl"><Trash2 size={13} /> Delete Selected Notifications ({selectedIds.length})</button>}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest"><th className="px-5 py-4 w-12 text-center"><button type="button" onClick={selectAllPageToggle} disabled={paginatedRequests.length === 0} className="text-slate-400 inline-block align-middle disabled:opacity-30">{paginatedRequests.length > 0 && paginatedRequests.every(r => selectedIds.includes(r.id)) ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} />}</button></th><th className="px-4 py-4">Origin</th><th className="px-5 py-4">Title</th><th className="px-5 py-4">Message</th><th className="px-5 py-4">Vendor / Owner</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-center">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">{paginatedRequests.length > 0 ? paginatedRequests.map(req => { const isChecked = selectedIds.includes(req.id); const isPendingSub = req.source_table === 'subscription_payment_requests' && req.status === 'pending'; const isRowProcessing = processingId === req.id; return <tr key={req.id} className={`hover:bg-slate-50/60 ${isChecked ? 'bg-emerald-50/20' : ''} ${isPendingSub ? 'bg-amber-50/20' : ''}`}><td className="px-5 py-4 text-center"><button type="button" onClick={() => selectRowToggle(req.id)} className="text-slate-400"><>{isChecked ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} />}</></button></td><td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 py-0.5 border text-[10px] uppercase font-extrabold rounded-md ${getTypeStyles(req.type)}`}>{req.type.replace('_', ' ')}</span></td><td className="px-5 py-4 text-slate-900 max-w-[160px] truncate font-bold">{req.title || '—'}</td><td className="px-5 py-4 text-slate-500 max-w-[280px] break-words">{req.message || '—'}</td><td className="px-5 py-4 whitespace-nowrap"><div className="flex flex-col"><span className="text-slate-900 font-bold">{req.vendor_shop_name}</span><span className="text-[10px] text-slate-400 font-mono mt-0.5">{req.vendor_owner_name || 'System Level User'}</span></div></td><td className="px-5 py-4 text-slate-500 whitespace-nowrap"><div className="flex items-center gap-1.5 text-[11px]"><Clock size={12} className="text-slate-400" />{new Date(req.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></td><td className="px-5 py-4 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${getStatusStyles(req.status)}`}>{req.status}</span></td><td className="px-5 py-4 whitespace-nowrap text-center">{req.source_table === 'subscription_payment_requests' ? (req.status === 'pending' ? <div className="flex items-center justify-center gap-1.5"><button disabled={isRowProcessing} onClick={() => handleApproveSubscription(req)} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg" title="Approve"><>{isRowProcessing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}</></button><button disabled={isRowProcessing} onClick={() => handleRejectSubscription(req)} className="p-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg" title="Reject">{isRowProcessing ? <Loader2 size={13} className="animate-spin" /> : <XIcon size={13} />}</button></div> : <span className="text-[10px] font-bold italic text-slate-400">Archived</span>) : <button onClick={() => toggleReadState(req.id, !!req.is_read)} className={`p-1.5 rounded-lg border ${req.is_read ? 'bg-white text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-transparent'}`} title={req.is_read ? 'Mark unread' : 'Mark read'}><Eye size={13} /></button>}</td></tr>; }) : <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-400 font-bold">No matching records found.</td></tr>}</tbody></table></div><div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4"><span className="text-xs font-semibold text-slate-500">Showing <strong className="text-slate-900">{filteredRequests.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong>–<strong className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</strong> of <strong className="text-slate-900">{filteredRequests.length}</strong></span><div className="flex items-center gap-1"><button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="px-3 h-8 bg-white border border-slate-200 disabled:opacity-40 text-xs font-bold rounded-lg">Previous</button><div className="px-3 text-xs font-bold text-slate-700">Page {currentPage} of {totalPages}</div><button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="px-3 h-8 bg-white border border-slate-200 disabled:opacity-40 text-xs font-bold rounded-lg">Next</button></div></div></div>
    </div>
  );
}