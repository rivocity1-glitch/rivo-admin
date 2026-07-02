import React, { useEffect, useState } from 'react';
import { supabase } from "../../../lib/supabase"; // Adjust path based on your architecture
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
  X as XIcon
} from 'lucide-react';

// --- TYPES ---
interface NotificationRequest {
  id: string;
  auth_user_id: string;
  title: string;
  message: string;
  type: 'subscription' | 'settlement' | 'vendor_registration' | string;
  is_read: boolean;
  created_at: string;
  request_source?: 'subscription_payment_requests' | 'notifications';
  plan_name?: string;
  amount?: number;
  utr_number?: string;
  vendor_id?: string;
}

type TabType = 'all' | 'subscription' | 'settlement' | 'vendor_registration';

export default function AllRequests() {
  // --- STATES ---
  const [loading, setLoading] = useState<boolean>(true);
  const [requests, setRequests] = useState<NotificationRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    all: 0,
    subscription: 0,
    settlement: 0,
    vendor_registration: 0
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    fetchRequestsLedger();
  }, []);

  async function fetchRequestsLedger() {
    try {
      setLoading(true);

      // 1. Fetch standard notification rows from notifications table
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .in('type', ['subscription', 'settlement', 'vendor_registration'])
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      // 2. Fetch pending payment requests from subscription_payment_requests table
      const { data: subscriptionRequests, error: subRequestsError } = await supabase
        .from('subscription_payment_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (subRequestsError) throw subRequestsError;

      // 3. Map notifications data
      const normalizedNotifications: NotificationRequest[] = (notificationsData || []).map(item => ({
        ...item,
        request_source: 'notifications'
      }));

      // 4. Transform and normalize subscription requests into unified request object format
      const normalizedSubRequests: NotificationRequest[] = (subscriptionRequests || []).map(item => ({
        id: item.id,
        auth_user_id: item.vendor_id, // Map vendor_id to user column field for grid presentation
        title: `Subscription Upgrade - ${item.plan_name}`,
        message: `Vendor requested subscription upgrade. Amount ₹${item.amount}. UTR: ${item.utr_number}`,
        type: 'subscription',
        is_read: false,
        created_at: item.created_at,
        request_source: 'subscription_payment_requests',
        plan_name: item.plan_name,
        amount: item.amount,
        utr_number: item.utr_number,
        vendor_id: item.vendor_id
      }));

      // 5. Merge and sort unified list by created_at DESC
      const combinedRequests = [...normalizedSubRequests, ...normalizedNotifications].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Log the requested verification record info to verify records
      console.log('REQUEST CENTER DATA', combinedRequests);

      setRequests(combinedRequests);

      // Pre-compute dynamic count metrics for state tabs
      const subCount = combinedRequests.filter(r => r.type === 'subscription').length;
      const setCount = combinedRequests.filter(r => r.type === 'settlement').length;
      const vendCount = combinedRequests.filter(r => r.type === 'vendor_registration').length;

      setCounts({
        all: combinedRequests.length,
        subscription: subCount,
        settlement: setCount,
        vendor_registration: vendCount
      });

      // Clear selection on refresh
      setSelectedIds([]);

    } catch (err) {
      console.error('Failed indexing operational data matrices:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- MUTATIONS ---
  async function toggleReadStatus(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      setRequests(prev => prev.map(item => item.id === id ? { ...item, is_read: !currentStatus } : item));
    } catch (err) {
      console.error('Failed writing item modification status row:', err);
    }
  }

  // --- SUBSCRIPTION APPROVAL SEQUENCE ---
  async function handleApproveSubscription(req: NotificationRequest) {
    if (!req.id || !req.vendor_id) return;
    const confirmApprove = window.confirm(`Approve subscription upgrade request for UTR: ${req.utr_number}?`);
    if (!confirmApprove) return;

    try {
      setProcessingId(req.id);

      // 1. Update subscription_payment_requests status to approved
      const { error: patchRequestError } = await supabase
        .from('subscription_payment_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', req.id);

      if (patchRequestError) throw patchRequestError;

      // Calculate future renewal epoch constraint boundary markers (30 days ahead)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // 2. Fetch or update current subscription row map sequence
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('vendor_id', req.vendor_id)
        .maybeSingle();

      if (existingSub) {
        const { error: updateSubError } = await supabase
          .from('subscriptions')
          .update({
            plan_name: req.plan_name || '499',
            status: 'active',
            commission_percent: 0,
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id);

        if (updateSubError) throw updateSubError;
      } else {
        const { error: insertSubError } = await supabase
          .from('subscriptions')
          .insert([{
            vendor_id: req.vendor_id,
            plan_name: req.plan_name || '499',
            status: 'active',
            commission_percent: 0,
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertSubError) throw insertSubError;
      }

      alert('Subscription upgraded successfully.');
      await fetchRequestsLedger();
    } catch (err: any) {
      console.error('Approval sequence failure:', err);
      alert(err.message || 'Failed to approve subscription upgrade.');
    } finally {
      setProcessingId(null);
    }
  }

  // --- SUBSCRIPTION REJECTION SEQUENCE ---
  async function handleRejectSubscription(req: NotificationRequest) {
    if (!req.id) return;
    const confirmReject = window.confirm(`Reject subscription upgrade request for UTR: ${req.utr_number}?`);
    if (!confirmReject) return;

    try {
      setProcessingId(req.id);

      // 1. Update subscription_payment_requests status to rejected
      const { error: patchRequestError } = await supabase
        .from('subscription_payment_requests')
        .update({
          status: 'rejected',
          remarks: 'Rejected by admin'
        })
        .eq('id', req.id);

      if (patchRequestError) throw patchRequestError;

      alert('Subscription upgrade request rejected.');
      await fetchRequestsLedger();
    } catch (err: any) {
      console.error('Rejection sequence failure:', err);
      alert(err.message || 'Failed to reject subscription request.');
    } finally {
      setProcessingId(null);
    }
  }

  // --- BATCH DELETE MUTATION ROUTINE ---
  async function handleBatchDelete() {
    if (selectedIds.length === 0) return;
    
    // Safety guard filtering out core primary requests from direct purge rules
    const targetNotificationsToDelete = requests.filter(r => selectedIds.includes(r.id) && r.request_source === 'notifications').map(r => r.id);
    
    if (targetNotificationsToDelete.length === 0) {
      alert('Action blocked: Deletions can only be applied to standard read notification rows, not active pending database financial logs.');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete the ${targetNotificationsToDelete.length} selected notification item(s)?`);
    if (!confirmDelete) return;

    try {
      setBatchDeleteLoading(true);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', targetNotificationsToDelete);

      if (error) throw error;

      await fetchRequestsLedger();
    } catch (err) {
      console.error('Batch deletion operation failure:', err);
      alert('Failed executing bulk records extraction routine.');
    } finally {
      setBatchDeleteLoading(false);
    }
  }

  // --- MULTI-SELECT HANDLER LOGIC ---
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 50) {
        alert('Bulk selections capped at a maximum limit of 50 item records at a single time.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSelectAllFiltered = () => {
    const currentFilteredIds = filteredRequests.map(r => r.id);
    const allAreSelected = currentFilteredIds.every(id => selectedIds.includes(id));

    if (allAreSelected) {
      setSelectedIds(prev => prev.filter(id => !currentFilteredIds.includes(id)));
    } else {
      const newSelectionStack = [...selectedIds];
      for (const id of currentFilteredIds) {
        if (!newSelectionStack.includes(id)) {
          if (newSelectionStack.length >= 50) break;
          newSelectionStack.push(id);
        }
      }
      setSelectedIds(newSelectionStack);
    }
  };

  // --- FILTERED ROWS DATA ---
  const filteredRequests = requests.filter(req => {
    if (activeTab === 'all') return true;
    return req.type === activeTab;
  });

  const getTypeBadgeStyles = (type: string) => {
    switch (type) {
      case 'subscription':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'settlement':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'vendor_registration':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatTypeName = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen text-slate-800 antialiased">
      
      {/* HEADER SECTION */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Requests</h1>
        <p className="text-slate-500 text-sm mt-1">Review and manage platform workflow operations and routing metrics</p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:shadow-sm border-l-4 border-l-slate-700">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Requests</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.all}</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Inbox size={20} /></div>
        </div>

        {/* Subscription Requests */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:shadow-sm border-l-4 border-l-amber-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscription Requests</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.subscription}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><CreditCard size={20} /></div>
        </div>

        {/* Settlement Requests */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:shadow-sm border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Settlement Requests</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.settlement}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Layers size={20} /></div>
        </div>

        {/* Vendor Registrations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between transition-all hover:shadow-sm border-l-4 border-l-purple-500">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vendor Registrations</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{counts.vendor_registration}</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Store size={20} /></div>
        </div>
      </div>

      {/* INTERACTIVE TABS & SELECTION DELETE HEADER HUB BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 gap-4 pb-1">
        <div className="flex border-b border-transparent gap-2 overflow-x-auto scrollbar-none">
          {([
            { key: 'all', label: 'All Requests' },
            { key: 'subscription', label: 'Subscription Requests' },
            { key: 'settlement', label: 'Settlement Requests' },
            { key: 'vendor_registration', label: 'Vendor Registration Requests' }
          ] as { key: TabType; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedIds([]);
              }}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all shrink-0 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* BATCH ACTION CONTROLS PANEL AREA */}
        <div className="flex items-center gap-2 px-2 sm:px-0 pb-2 sm:pb-0 animate-in fade-in duration-150">
          {selectedIds.length > 0 ? (
            <button
              onClick={handleBatchDelete}
              disabled={batchDeleteLoading}
              className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              {batchDeleteLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete Selected Notifications ({selectedIds.filter(id => requests.find(r => r.id === id)?.request_source === 'notifications').length})
            </button>
          ) : (
            <div className="text-xs font-semibold text-slate-400 italic pr-2">
              Select items below to manage logs or verify payouts
            </div>
          )}
        </div>
      </div>

      {/* DATA LEDGER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5 w-12 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    disabled={filteredRequests.length === 0}
                    className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none disabled:opacity-30 inline-block align-middle"
                  >
                    {filteredRequests.length > 0 && filteredRequests.map(r => r.id).every(id => selectedIds.includes(id)) ? (
                      <CheckSquare size={16} className="text-emerald-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3.5">Type</th>
                <th className="px-5 py-3.5">Title</th>
                <th className="px-5 py-3.5">Message</th>
                <th className="px-5 py-3.5">Vendor / Auth User ID</th>
                <th className="px-5 py-3.5">Created Date</th>
                <th className="px-5 py-3.5">Source Ledger</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const isChecked = selectedIds.includes(req.id);
                  const isSubPaymentSource = req.request_source === 'subscription_payment_requests';
                  const isBtnLoading = processingId === req.id;

                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-emerald-50/20' : isSubPaymentSource ? 'bg-amber-50/10' : !req.is_read ? 'bg-slate-50/40 font-semibold' : ''}`}
                    >
                      {/* Checkbox Activation Cell */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => handleSelectRow(req.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none inline-block align-middle"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getTypeBadgeStyles(req.type)}`}>
                          {formatTypeName(req.type)}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-5 py-4 text-slate-900 max-w-[180px] truncate">
                        {req.title || '—'}
                      </td>

                      {/* Message Body */}
                      <td className="px-5 py-4 text-slate-500 max-w-[280px] break-words font-medium">
                        {req.message || '—'}
                      </td>

                      {/* Auth User ID */}
                      <td className="px-5 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {req.auth_user_id}
                      </td>

                      {/* Created Date */}
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock size={13} className="text-slate-400" />
                          {new Date(req.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Source Ledger Tracking Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md border font-semibold ${
                          isSubPaymentSource 
                            ? 'bg-amber-100/60 border-amber-300 text-amber-800' 
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          {isSubPaymentSource ? 'Payment Queue' : 'Notifications'}
                        </span>
                      </td>

                      {/* Action Controls Column */}
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        {isSubPaymentSource ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Inline Admin Approve Workflow Trigger */}
                            <button
                              disabled={isBtnLoading}
                              onClick={() => handleApproveSubscription(req)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg transition-all shadow-2xs"
                              title="Approve Upgrade Plan"
                            >
                              {isBtnLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            {/* Inline Admin Reject Workflow Trigger */}
                            <button
                              disabled={isBtnLoading}
                              onClick={() => handleRejectSubscription(req)}
                              className="p-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg transition-all shadow-2xs"
                              title="Reject Upgrade Plan"
                            >
                              {isBtnLoading ? <Loader2 size={14} className="animate-spin" /> : <XIcon size={14} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleReadStatus(req.id, req.is_read)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              req.is_read 
                                ? 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50' 
                                : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-xs'
                            }`}
                            title={req.is_read ? 'Mark as Unread' : 'Mark as Read'}
                          >
                            <Eye size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={24} className="text-slate-300" />
                      <span>No pending requests found</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}