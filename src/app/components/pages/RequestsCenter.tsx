import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { supabase } from '../../../lib/supabase';
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
  Bell,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

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
  source_table:
    | 'notifications'
    | 'subscription_payment_requests';
  type:
    | 'subscription'
    | 'settlement'
    | 'vendor_registration'
    | 'notification';
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

interface SubscriptionPlan {
  plan_name: string;
  commission_percent: number;
  monthly_settlement_request_limit: number;
  max_profile_banners: number;
  monthly_price: number;
  is_active: boolean;
}

type TabType =
  | 'all'
  | 'subscription'
  | 'settlement'
  | 'vendor_registration'
  | 'notifications';

type SortOrder = 'desc' | 'asc';

// ============================================================
// BUILT-IN FREE FALLBACK
// ============================================================
//
// FREE is the platform's automatic fallback tier.
// It must NOT depend on subscription_plans containing a row.
//
// Existing Rivo business rule:
// FREE = 5% commission.
//
// ============================================================

const FREE_FALLBACK_PLAN: SubscriptionPlan = {
  plan_name: 'free',
  commission_percent: 5,
  monthly_settlement_request_limit: 3,
  max_profile_banners: 3,
  monthly_price: 0,
  is_active: true,
};

// ============================================================
// COMPONENT
// ============================================================

export default function RequestsCenter() {
  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(
    null
  );

  const [rawNotifications, setRawNotifications] = useState<
    Notification[]
  >([]);

  const [rawPaymentRequests, setRawPaymentRequests] = useState<
    SubscriptionPaymentRequest[]
  >([]);

  const [vendorsMap, setVendorsMap] = useState<
    Record<string, Vendor>
  >({});

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] =
    useState<string>('all');

  const [sortOrder, setSortOrder] =
    useState<SortOrder>('desc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [actionLoading, setActionLoading] =
    useState<boolean>(false);

  const [currentPage, setCurrentPage] =
    useState<number>(1);

  const itemsPerPage = 10;

  // ==========================================================
  // DATA FETCH
  // ==========================================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorState(null);

      // ------------------------------------------------------
      // Notifications
      // ------------------------------------------------------

      const {
        data: notificationsData,
        error: notificationsError,
      } = await supabase
        .from('notifications')
        .select(
          'id, title, message, type, is_read, created_at, recipient_id'
        )
        .order('created_at', {
          ascending: false,
        });

      if (notificationsError) {
        throw notificationsError;
      }

      // ------------------------------------------------------
      // Subscription payment requests
      // ------------------------------------------------------

      const {
        data: paymentRequestsData,
        error: paymentRequestsError,
      } = await supabase
        .from('subscription_payment_requests')
        .select(
          'id, vendor_id, plan_name, status, created_at, utr_number, amount, approved_at, remarks'
        )
        .order('created_at', {
          ascending: false,
        });

      if (paymentRequestsError) {
        throw paymentRequestsError;
      }

      // ------------------------------------------------------
      // Vendor IDs
      // ------------------------------------------------------

      const vendorIds = new Set<string>();

      (notificationsData || []).forEach(
        (notification) => {
          if (notification.recipient_id) {
            vendorIds.add(
              notification.recipient_id
            );
          }
        }
      );

      (paymentRequestsData || []).forEach(
        (request) => {
          if (request.vendor_id) {
            vendorIds.add(request.vendor_id);
          }
        }
      );

      // ------------------------------------------------------
      // Vendors
      // ------------------------------------------------------

      const vendorMapObj: Record<
        string,
        Vendor
      > = {};

      if (vendorIds.size > 0) {
        const {
          data: vendorsData,
          error: vendorsError,
        } = await supabase
          .from('vendors')
          .select(
            'id, shop_name, owner_name, email, phone, status, created_at'
          )
          .in(
            'id',
            Array.from(vendorIds)
          );

        if (vendorsError) {
          throw vendorsError;
        }

        (vendorsData || []).forEach(
          (vendor: Vendor) => {
            vendorMapObj[vendor.id] =
              vendor;
          }
        );
      }

      setRawNotifications(
        notificationsData || []
      );

      setRawPaymentRequests(
        paymentRequestsData || []
      );

      setVendorsMap(vendorMapObj);
    } catch (error: any) {
      console.error(
        'Error loading Requests Center:',
        error
      );

      setErrorState(
        error?.message ||
          'Failed to load Requests Center data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // REALTIME
  // ==========================================================

  useEffect(() => {
    fetchData();

    const notificationsChannel =
      supabase
        .channel(
          'requests-center-notifications'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

    const paymentRequestsChannel =
      supabase
        .channel(
          'requests-center-payment-requests'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'subscription_payment_requests',
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

    const vendorSettlementsChannel =
      supabase
        .channel(
          'requests-center-vendor-settlements'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'vendor_settlements',
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

    const vendorsChannel =
      supabase
        .channel(
          'requests-center-vendors'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'vendors',
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        notificationsChannel
      );

      supabase.removeChannel(
        paymentRequestsChannel
      );

      supabase.removeChannel(
        vendorSettlementsChannel
      );

      supabase.removeChannel(
        vendorsChannel
      );
    };
  }, [fetchData]);

  // ==========================================================
  // UNIFIED DATA
  // ==========================================================

  const unifiedRequestsList = useMemo(
    (): UnifiedRequest[] => {
      const records: UnifiedRequest[] = [];

      // ------------------------------------------------------
      // Payment requests
      // ------------------------------------------------------

      rawPaymentRequests.forEach(
        (request) => {
          const vendor =
            vendorsMap[request.vendor_id];

          records.push({
            id: request.id,

            source_table:
              'subscription_payment_requests',

            type: 'subscription',

            title: `Plan Upgrade Request: ${request.plan_name}`,

            message: [
              `Amount: ₹${request.amount}`,
              `UTR: ${
                request.utr_number ||
                'Not provided'
              }`,
              request.remarks
                ? `Remarks: ${request.remarks}`
                : '',
            ]
              .filter(Boolean)
              .join(' | '),

            status: request.status,

            created_at:
              request.created_at,

            vendor_id:
              request.vendor_id,

            vendor_shop_name:
              vendor?.shop_name ||
              'Unknown Shop',

            vendor_owner_name:
              vendor?.owner_name ||
              'Unknown Owner',

            plan_name:
              request.plan_name,

            amount:
              request.amount,

            utr_number:
              request.utr_number,
          });
        }
      );

      // ------------------------------------------------------
      // Notifications
      // ------------------------------------------------------

      rawNotifications.forEach(
        (notification) => {
          const vendor =
            notification.recipient_id
              ? vendorsMap[
                  notification
                    .recipient_id
                ]
              : undefined;

          let calculatedType:
            | 'subscription'
            | 'settlement'
            | 'vendor_registration'
            | 'notification' =
            'notification';

          if (
            notification.type ===
            'subscription'
          ) {
            calculatedType =
              'subscription';
          } else if (
            notification.type ===
            'settlement'
          ) {
            calculatedType =
              'settlement';
          } else if (
            notification.type ===
            'vendor_registration'
          ) {
            calculatedType =
              'vendor_registration';
          }

          records.push({
            id: notification.id,

            source_table:
              'notifications',

            type: calculatedType,

            title:
              notification.title,

            message:
              notification.message,

            status:
              notification.is_read
                ? 'read'
                : 'unread',

            created_at:
              notification.created_at,

            vendor_id:
              notification.recipient_id,

            vendor_shop_name:
              vendor?.shop_name ||
              'System / Platform',

            vendor_owner_name:
              vendor?.owner_name ||
              'Administrator',

            is_read:
              notification.is_read,
          });
        }
      );

      // ------------------------------------------------------
      // Sort
      // ------------------------------------------------------

      return records.sort(
        (a, b) => {
          const timeA =
            new Date(
              a.created_at
            ).getTime();

          const timeB =
            new Date(
              b.created_at
            ).getTime();

          return sortOrder ===
            'desc'
            ? timeB - timeA
            : timeA - timeB;
        }
      );
    },
    [
      rawNotifications,
      rawPaymentRequests,
      vendorsMap,
      sortOrder,
    ]
  );

  // ==========================================================
  // FILTERS
  // ==========================================================

  const filteredRequests =
    useMemo(() => {
      return unifiedRequestsList.filter(
        (request) => {
          if (
            activeTab ===
              'subscription' &&
            request.type !==
              'subscription'
          ) {
            return false;
          }

          if (
            activeTab ===
              'settlement' &&
            request.type !==
              'settlement'
          ) {
            return false;
          }

          if (
            activeTab ===
              'vendor_registration' &&
            request.type !==
              'vendor_registration'
          ) {
            return false;
          }

          if (
            activeTab ===
              'notifications' &&
            request.source_table !==
              'notifications'
          ) {
            return false;
          }

          if (
            statusFilter !== 'all' &&
            request.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            searchQuery.trim() !== ''
          ) {
            const query =
              searchQuery
                .trim()
                .toLowerCase();

            const matchTitle =
              request.title
                ?.toLowerCase()
                .includes(query);

            const matchMessage =
              request.message
                ?.toLowerCase()
                .includes(query);

            const matchShop =
              request.vendor_shop_name
                ?.toLowerCase()
                .includes(query);

            const matchOwner =
              request.vendor_owner_name
                ?.toLowerCase()
                .includes(query);

            const matchUtr =
              request.utr_number
                ?.toLowerCase()
                .includes(query);

            const matchPlan =
              request.plan_name
                ?.toLowerCase()
                .includes(query);

            if (
              !matchTitle &&
              !matchMessage &&
              !matchShop &&
              !matchOwner &&
              !matchUtr &&
              !matchPlan
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      unifiedRequestsList,
      activeTab,
      statusFilter,
      searchQuery,
    ]);

  // ==========================================================
  // METRICS
  // ==========================================================

  const metrics = useMemo(
    () => ({
      total:
        unifiedRequestsList.length,

      pendingSubscriptions:
        rawPaymentRequests.filter(
          (request) =>
            request.status ===
            'pending'
        ).length,

      unreadNotifications:
        rawNotifications.filter(
          (notification) =>
            !notification.is_read
        ).length,

      vendorRegs:
        unifiedRequestsList.filter(
          (request) =>
            request.type ===
            'vendor_registration'
        ).length,
    }),
    [
      unifiedRequestsList,
      rawPaymentRequests,
      rawNotifications,
    ]
  );

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages =
    Math.ceil(
      filteredRequests.length /
        itemsPerPage
    ) || 1;

  const paginatedRequests =
    useMemo(() => {
      const offset =
        (currentPage - 1) *
        itemsPerPage;

      return filteredRequests.slice(
        offset,
        offset + itemsPerPage
      );
    }, [
      filteredRequests,
      currentPage,
    ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    searchQuery,
    statusFilter,
  ]);

  // ==========================================================
  // VENDOR NOTIFICATION
  // ==========================================================

  const createVendorNotification =
    async (
      vendorId: string,
      title: string,
      message: string
    ) => {
      const {
        error,
      } = await supabase
        .from('notifications')
        .insert([
          {
            recipient_id:
              vendorId,
            title,
            message,
            type: 'subscription',
            is_read: false,
          },
        ]);

      if (error) {
        throw error;
      }
    };

  // ==========================================================
  // LOAD REQUESTED PLAN
  // ==========================================================

  const loadRequestedPlan =
    async (
      requestedPlanName: string
    ): Promise<SubscriptionPlan> => {
      const normalizedName =
        requestedPlanName
          .trim()
          .toLowerCase();

      if (!normalizedName) {
        throw new Error(
          'Subscription plan name is missing.'
        );
      }

      // ------------------------------------------------------
      // FREE:
      //
      // Free is the automatic 5% fallback tier.
      // It does not require a row in subscription_plans.
      // ------------------------------------------------------

      if (
        normalizedName === 'free'
      ) {
        return {
          ...FREE_FALLBACK_PLAN,
        };
      }

      // ------------------------------------------------------
      // PAID PLAN:
      //
      // Paid plans must exist in the subscription_plans
      // table and must be active.
      // ------------------------------------------------------

      const {
        data,
        error,
      } = await supabase
        .from('subscription_plans')
        .select(
          'plan_name, commission_percent, monthly_settlement_request_limit, max_profile_banners, monthly_price, is_active'
        )
        .ilike(
          'plan_name',
          requestedPlanName.trim()
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          `Subscription plan "${requestedPlanName}" could not be found.`
        );
      }

      if (
        data.is_active !== true
      ) {
        throw new Error(
          `The requested subscription plan "${requestedPlanName}" is currently inactive.`
        );
      }

      return data as SubscriptionPlan;
    };

  // ==========================================================
  // APPROVE SUBSCRIPTION
  // ==========================================================

  const handleApproveSubscription =
    async (
      request: UnifiedRequest
    ) => {
      if (
        !request.plan_name ||
        !request.vendor_id
      ) {
        alert(
          'This request is missing the vendor or plan information.'
        );
        return;
      }

      if (
        request.source_table !==
        'subscription_payment_requests'
      ) {
        return;
      }

      if (
        request.status !==
        'pending'
      ) {
        alert(
          `This request has already been ${request.status}.`
        );
        return;
      }

      const confirmApprove =
        window.confirm(
          `Approve subscription request?\n\nPlan: ${
            request.plan_name
          }\nVendor: ${
            request.vendor_shop_name ||
            'Unknown Vendor'
          }\nAmount: ₹${
            request.amount ?? 0
          }\n\nThe subscription will become active immediately.`
        );

      if (!confirmApprove) {
        return;
      }

      try {
        setProcessingId(
          request.id
        );

        setActionLoading(true);
        setErrorState(null);

        // ----------------------------------------------------
        // STEP 1: Load plan
        // ----------------------------------------------------

        const planData =
          await loadRequestedPlan(
            request.plan_name
          );

        const now = new Date();

        const normalizedPlan =
          planData.plan_name
            .trim()
            .toLowerCase();

        const isFreePlan =
          normalizedPlan ===
            'free' ||
          Number(
            planData.monthly_price
          ) === 0;

        // ----------------------------------------------------
        // FREE = no expiry
        // PAID = 30 days
        // ----------------------------------------------------

        let expiryDate:
          | string
          | null = null;

        if (!isFreePlan) {
          const paidExpiry =
            new Date(now);

          paidExpiry.setDate(
            paidExpiry.getDate() +
              30
          );

          expiryDate =
            paidExpiry.toISOString();
        }

        // ----------------------------------------------------
        // STEP 2: Verify request is still pending
        // ----------------------------------------------------

        const {
          data: currentRequest,
          error:
            currentRequestError,
        } = await supabase
          .from(
            'subscription_payment_requests'
          )
          .select(
            'id, vendor_id, plan_name, status'
          )
          .eq(
            'id',
            request.id
          )
          .maybeSingle();

        if (
          currentRequestError
        ) {
          throw currentRequestError;
        }

        if (!currentRequest) {
          throw new Error(
            'The subscription payment request no longer exists.'
          );
        }

        if (
          currentRequest.status !==
          'pending'
        ) {
          throw new Error(
            `This request has already been processed as "${currentRequest.status}".`
          );
        }

        // ----------------------------------------------------
        // STEP 3: Mark payment request approved
        // ----------------------------------------------------

        const {
          data:
            approvedRequest,
          error:
            approvalError,
        } = await supabase
          .from(
            'subscription_payment_requests'
          )
          .update({
            status:
              'approved',
            approved_at:
              now.toISOString(),
          })
          .eq(
            'id',
            request.id
          )
          .eq(
            'status',
            'pending'
          )
          .select(
            'id, status'
          )
          .maybeSingle();

        if (approvalError) {
          throw approvalError;
        }

        if (!approvedRequest) {
          throw new Error(
            'The payment request could not be approved because it was already processed.'
          );
        }

        // ----------------------------------------------------
        // STEP 4: Find current subscription
        // ----------------------------------------------------

        const {
          data: existingSubscription,
          error:
            subscriptionLookupError,
        } = await supabase
          .from(
            'subscriptions'
          )
          .select(
            'vendor_id'
          )
          .eq(
            'vendor_id',
            request.vendor_id
          )
          .maybeSingle();

        if (
          subscriptionLookupError
        ) {
          throw subscriptionLookupError;
        }

        // ----------------------------------------------------
        // STEP 5: Build subscription
        // ----------------------------------------------------

        const subscriptionValues =
          {
            plan_name:
              planData.plan_name,

            commission_percent:
              planData.commission_percent,

            monthly_settlement_request_limit:
              planData.monthly_settlement_request_limit,

            max_profile_banners:
              planData.max_profile_banners,

            status: 'active',

            start_date:
              now.toISOString(),

            end_date:
              expiryDate,

            updated_at:
              now.toISOString(),
          };

        // ----------------------------------------------------
        // STEP 6: Activate subscription
        // ----------------------------------------------------

        if (
          existingSubscription
        ) {
          const {
            error:
              updateSubscriptionError,
          } = await supabase
            .from(
              'subscriptions'
            )
            .update(
              subscriptionValues
            )
            .eq(
              'vendor_id',
              request.vendor_id
            );

          if (
            updateSubscriptionError
          ) {
            throw updateSubscriptionError;
          }
        } else {
          const {
            error:
              insertSubscriptionError,
          } = await supabase
            .from(
              'subscriptions'
            )
            .insert([
              {
                vendor_id:
                  request.vendor_id,

                ...subscriptionValues,
              },
            ]);

          if (
            insertSubscriptionError
          ) {
            throw insertSubscriptionError;
          }
        }

        // ----------------------------------------------------
        // STEP 7: Notify vendor
        // ----------------------------------------------------

        let notificationWarning =
          '';

        try {
          if (isFreePlan) {
            await createVendorNotification(
              request.vendor_id,
              'Subscription Approved',
              'Your RivoCity subscription request has been approved. You are now on the Free plan with 5% commission.'
            );
          } else {
            const expiryText =
              expiryDate
                ? new Date(
                    expiryDate
                  ).toLocaleDateString(
                    'en-IN',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }
                  )
                : '';

            await createVendorNotification(
              request.vendor_id,
              'Subscription Approved',
              `Your ${planData.plan_name} subscription has been approved by RivoCity Admin and is now active until ${expiryText}.`
            );
          }
        } catch (
          notificationError
        ) {
          console.error(
            'Subscription activated but notification failed:',
            notificationError
          );

          notificationWarning =
            '\n\nWarning: The subscription was activated, but the vendor notification could not be created.';
        }

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        alert(
          `Subscription approved successfully.\n\nPlan: ${planData.plan_name}\nVendor: ${
            request.vendor_shop_name ||
            'Unknown Vendor'
          }${notificationWarning}`
        );

        await fetchData();
      } catch (error: any) {
        console.error(
          'Approve subscription transaction rejected:',
          error
        );

        const message =
          error?.message ||
          'Failed to approve the subscription request.';

        setErrorState(message);

        alert(message);
      } finally {
        setProcessingId(null);
        setActionLoading(false);
      }
    };

  // ==========================================================
  // REJECT SUBSCRIPTION
  // ==========================================================

  const handleRejectSubscription =
    async (
      request: UnifiedRequest
    ) => {
      if (
        request.source_table !==
        'subscription_payment_requests'
      ) {
        return;
      }

      if (!request.vendor_id) {
        alert(
          'This request does not contain a valid vendor.'
        );
        return;
      }

      if (
        request.status !==
        'pending'
      ) {
        alert(
          `This request has already been ${request.status}.`
        );
        return;
      }

      const remarks =
        window.prompt(
          'Enter the reason for rejecting this subscription request:',
          'Invalid UTR / Payment confirmation missing'
        );

      if (remarks === null) {
        return;
      }

      const rejectionReason =
        remarks.trim() ||
        'Subscription payment request rejected by RivoCity Admin.';

      const confirmReject =
        window.confirm(
          `Reject subscription request?\n\nVendor: ${
            request.vendor_shop_name ||
            'Unknown Vendor'
          }\nPlan: ${
            request.plan_name ||
            'Unknown Plan'
          }\n\nReason:\n${rejectionReason}`
        );

      if (!confirmReject) {
        return;
      }

      try {
        setProcessingId(
          request.id
        );

        setActionLoading(true);
        setErrorState(null);

        // ----------------------------------------------------
        // Update only pending request
        // ----------------------------------------------------

        const {
          data: rejectedRequest,
          error: rejectionError,
        } = await supabase
          .from(
            'subscription_payment_requests'
          )
          .update({
            status:
              'rejected',

            remarks:
              rejectionReason,
          })
          .eq(
            'id',
            request.id
          )
          .eq(
            'status',
            'pending'
          )
          .select(
            'id, vendor_id, status'
          )
          .maybeSingle();

        if (rejectionError) {
          throw rejectionError;
        }

        if (!rejectedRequest) {
          throw new Error(
            'This request was already processed or could not be found.'
          );
        }

        // ----------------------------------------------------
        // Vendor notification
        // ----------------------------------------------------

        let notificationWarning =
          '';

        try {
          await createVendorNotification(
            request.vendor_id,
            'Subscription Request Rejected',
            `Your ${
              request.plan_name ||
              'subscription'
            } payment request was rejected by RivoCity Admin. Reason: ${rejectionReason}`
          );
        } catch (
          notificationError
        ) {
          console.error(
            'Rejection saved but vendor notification failed:',
            notificationError
          );

          notificationWarning =
            '\n\nWarning: The rejection was saved, but the vendor notification could not be created.';
        }

        alert(
          `Subscription request rejected successfully.${notificationWarning}`
        );

        await fetchData();
      } catch (error: any) {
        console.error(
          'Failed rejecting subscription request:',
          error
        );

        const message =
          error?.message ||
          'Failed to reject the subscription request.';

        setErrorState(message);

        alert(message);
      } finally {
        setProcessingId(null);
        setActionLoading(false);
      }
    };

  // ==========================================================
  // NOTIFICATION READ STATE
  // ==========================================================

  const toggleReadState =
    async (
      id: string,
      currentIsRead: boolean
    ) => {
      try {
        setActionLoading(true);

        const {
          error,
        } = await supabase
          .from('notifications')
          .update({
            is_read:
              !currentIsRead,
          })
          .eq(
            'id',
            id
          );

        if (error) {
          throw error;
        }

        await fetchData();
      } catch (error: any) {
        console.error(
          'Failed updating notification:',
          error
        );

        alert(
          error?.message ||
            'Failed to update notification status.'
        );
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // DELETE NOTIFICATIONS
  // ==========================================================

  const handleBulkNotificationDelete =
    async () => {
      const notificationIds =
        selectedIds.filter(
          (id) => {
            const item =
              unifiedRequestsList.find(
                (request) =>
                  request.id === id
              );

            return (
              item?.source_table ===
              'notifications'
            );
          }
        );

      if (
        notificationIds.length ===
        0
      ) {
        alert(
          'Only notification records can be deleted. Subscription payment records are protected.'
        );
        return;
      }

      const confirmDelete =
        window.confirm(
          `Delete ${notificationIds.length} selected notification record(s)?\n\nSubscription payment records will not be deleted.`
        );

      if (!confirmDelete) {
        return;
      }

      try {
        setActionLoading(true);

        const {
          error,
        } = await supabase
          .from('notifications')
          .delete()
          .in(
            'id',
            notificationIds
          );

        if (error) {
          throw error;
        }

        setSelectedIds([]);

        alert(
          'Selected notification records deleted successfully.'
        );

        await fetchData();
      } catch (error: any) {
        console.error(
          'Failed deleting notifications:',
          error
        );

        alert(
          error?.message ||
            'Failed to delete selected notifications.'
        );
      } finally {
        setActionLoading(false);
      }
    };

  // ==========================================================
  // SELECTION
  // ==========================================================

  const selectRowToggle =
    (id: string) => {
      setSelectedIds(
        (previous) =>
          previous.includes(id)
            ? previous.filter(
                (item) =>
                  item !== id
              )
            : [
                ...previous,
                id,
              ]
      );
    };

  const selectAllPageToggle =
    () => {
      const pageIds =
        paginatedRequests.map(
          (request) =>
            request.id
        );

      if (
        pageIds.length === 0
      ) {
        return;
      }

      const allSelected =
        pageIds.every(
          (id) =>
            selectedIds.includes(
              id
            )
        );

      if (allSelected) {
        setSelectedIds(
          (previous) =>
            previous.filter(
              (id) =>
                !pageIds.includes(
                  id
                )
            )
        );
      } else {
        setSelectedIds(
          (previous) => {
            const combined =
              [...previous];

            pageIds.forEach(
              (id) => {
                if (
                  !combined.includes(
                    id
                  )
                ) {
                  combined.push(id);
                }
              }
            );

            return combined;
          }
        );
      }
    };

  // ==========================================================
  // STYLES
  // ==========================================================

  const getTypeStyles =
    (type: string) => {
      switch (type) {
        case 'subscription':
          return 'bg-amber-50 text-amber-800 border-amber-200';

        case 'settlement':
          return 'bg-emerald-50 text-emerald-800 border-emerald-200';

        case 'vendor_registration':
          return 'bg-purple-50 text-purple-800 border-purple-200';

        default:
          return 'bg-blue-50 text-blue-800 border-blue-200';
      }
    };

  const getStatusStyles =
    (status: string) => {
      switch (status) {
        case 'approved':
          return 'bg-emerald-100 text-emerald-700 font-bold';

        case 'read':
          return 'bg-slate-100 text-slate-700 font-medium';

        case 'pending':
          return 'bg-amber-600 text-white font-bold';

        case 'unread':
          return 'bg-blue-600 text-white font-bold';

        case 'rejected':
          return 'bg-rose-100 text-rose-700 font-bold';

        default:
          return 'bg-slate-100 text-slate-600';
      }
    };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 space-y-4">
        <Loader2
          className="h-12 w-12 animate-spin text-emerald-600"
        />

        <p className="text-sm font-bold text-slate-500">
          Loading system operations...
        </p>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 text-slate-800 font-sans antialiased space-y-6">
      {/* ======================================================
          ERROR
      ======================================================= */}

      {errorState && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle
            className="text-rose-600 shrink-0 mt-0.5"
            size={18}
          />

          <div className="grow">
            <h3 className="text-sm font-bold text-rose-900">
              Operation Error
            </h3>

            <p className="text-xs text-rose-700 mt-1">
              {errorState}
            </p>
          </div>

          <button
            onClick={() =>
              setErrorState(null)
            }
            className="text-rose-400 hover:text-rose-900 font-bold text-xs px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            System Operations Center
          </h1>

          <p className="text-xs font-medium text-slate-500 mt-1">
            Manage subscriptions, payment requests,
            notifications, settlements and vendor operations.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={actionLoading}
          className="self-start md:self-auto h-9 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <RefreshCw
            size={14}
            className={
              actionLoading
                ? 'animate-spin'
                : ''
            }
          />

          Refresh
        </button>
      </div>

      {/* ======================================================
          METRICS
      ======================================================= */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-slate-800">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total Records
            </p>

            <p className="text-2xl font-black text-slate-900 mt-1">
              {metrics.total}
            </p>
          </div>

          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Inbox size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Pending Subscriptions
            </p>

            <p className="text-2xl font-black text-amber-600 mt-1">
              {metrics.pendingSubscriptions}
            </p>
          </div>

          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Unread Notifications
            </p>

            <p className="text-2xl font-black text-blue-600 mt-1">
              {metrics.unreadNotifications}
            </p>
          </div>

          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Bell size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Vendor Registrations
            </p>

            <p className="text-2xl font-black text-purple-600 mt-1">
              {metrics.vendorRegs}
            </p>
          </div>

          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Store size={20} />
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
      ======================================================= */}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative grow max-w-xl">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />

            <input
              type="text"
              placeholder="Search UTR, shop, owner, plan or title..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl text-xs font-semibold shadow-sm focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="h-10 px-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="unread">
                Unread
              </option>

              <option value="read">
                Read
              </option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(
                  event.target.value as SortOrder
                )
              }
              className="h-10 px-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value="desc">
                Newest First
              </option>

              <option value="asc">
                Oldest First
              </option>
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {(
              [
                {
                  key: 'all',
                  label: 'All Operations',
                },
                {
                  key: 'subscription',
                  label: 'Subscription Requests',
                },
                {
                  key: 'settlement',
                  label: 'Settlement Logs',
                },
                {
                  key: 'vendor_registration',
                  label: 'Registrations',
                },
                {
                  key: 'notifications',
                  label: 'Notifications',
                },
              ] as {
                key: TabType;
                label: string;
              }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() =>
                  setActiveTab(
                    tab.key
                  )
                }
                className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all shrink-0 whitespace-nowrap rounded-t-lg ${
                  activeTab ===
                  tab.key
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedIds.length >
            0 && (
            <button
              onClick={
                handleBulkNotificationDelete
              }
              disabled={
                actionLoading
              }
              className="h-9 px-4 self-end lg:self-auto bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 text-xs font-extrabold flex items-center gap-2 rounded-xl shadow-sm transition-all"
            >
              <Trash2 size={13} />

              Delete Notifications (
              {selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          TABLE
      ======================================================= */}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest select-none">
                <th className="px-5 py-4 w-12 text-center">
                  <button
                    type="button"
                    onClick={
                      selectAllPageToggle
                    }
                    disabled={
                      paginatedRequests.length ===
                      0
                    }
                    className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none disabled:opacity-30 inline-block align-middle"
                  >
                    {paginatedRequests.length >
                      0 &&
                    paginatedRequests
                      .map(
                        (
                          request
                        ) =>
                          request.id
                      )
                      .every(
                        (id) =>
                          selectedIds.includes(
                            id
                          )
                      ) ? (
                      <CheckSquare
                        size={16}
                        className="text-emerald-600"
                      />
                    ) : (
                      <Square
                        size={16}
                      />
                    )}
                  </button>
                </th>

                <th className="px-4 py-4">
                  Type
                </th>

                <th className="px-5 py-4">
                  Request
                </th>

                <th className="px-5 py-4">
                  Details
                </th>

                <th className="px-5 py-4">
                  Vendor
                </th>

                <th className="px-5 py-4">
                  Created
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4 text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
              {paginatedRequests.length >
              0 ? (
                paginatedRequests.map(
                  (request) => {
                    const isChecked =
                      selectedIds.includes(
                        request.id
                      );

                    const isPendingSubscription =
                      request.source_table ===
                        'subscription_payment_requests' &&
                      request.status ===
                        'pending';

                    const isRowProcessing =
                      processingId ===
                      request.id;

                    return (
                      <tr
                        key={
                          request.id
                        }
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/20'
                            : ''
                        } ${
                          isPendingSubscription
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() =>
                              selectRowToggle(
                                request.id
                              )
                            }
                            className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none inline-block align-middle"
                          >
                            {isChecked ? (
                              <CheckSquare
                                size={16}
                                className="text-emerald-600"
                              />
                            ) : (
                              <Square
                                size={16}
                              />
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 border text-[10px] uppercase font-extrabold rounded-md ${getTypeStyles(
                              request.type
                            )}`}
                          >
                            {request.type.replace(
                              '_',
                              ' '
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-900 max-w-[220px]">
                          <div className="font-bold truncate">
                            {request.title ||
                              '—'}
                          </div>

                          {request.plan_name && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              Plan:{' '}
                              <span className="font-bold text-slate-500">
                                {
                                  request.plan_name
                                }
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-500 max-w-[320px]">
                          <div className="break-words leading-relaxed">
                            {request.message ||
                              '—'}
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-bold">
                              {
                                request.vendor_shop_name
                              }
                            </span>

                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {
                                request.vendor_owner_name ||
                                'System Level User'
                              }
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Clock
                              size={12}
                              className="text-slate-400"
                            />

                            {new Date(
                              request.created_at
                            ).toLocaleString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${getStatusStyles(
                              request.status
                            )}`}
                          >
                            {
                              request.status
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          {request.source_table ===
                          'subscription_payment_requests' ? (
                            request.status ===
                            'pending' ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  disabled={
                                    isRowProcessing ||
                                    actionLoading
                                  }
                                  onClick={() =>
                                    handleApproveSubscription(
                                      request
                                    )
                                  }
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg shadow-sm transition-all"
                                  title="Approve Subscription"
                                >
                                  {isRowProcessing ? (
                                    <Loader2
                                      size={
                                        13
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Check
                                      size={
                                        13
                                      }
                                    />
                                  )}
                                </button>

                                <button
                                  disabled={
                                    isRowProcessing ||
                                    actionLoading
                                  }
                                  onClick={() =>
                                    handleRejectSubscription(
                                      request
                                    )
                                  }
                                  className="p-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg shadow-sm transition-all"
                                  title="Reject Subscription"
                                >
                                  {isRowProcessing ? (
                                    <Loader2
                                      size={
                                        13
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <XIcon
                                      size={
                                        13
                                      }
                                    />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold italic text-slate-400">
                                Processed
                              </span>
                            )
                          ) : (
                            <button
                              onClick={() =>
                                toggleReadState(
                                  request.id,
                                  !!request.is_read
                                )
                              }
                              disabled={
                                actionLoading
                              }
                              className={`p-1.5 rounded-lg border transition-all ${
                                request.is_read
                                  ? 'bg-white text-slate-400 border-slate-200 hover:text-slate-800'
                                  : 'bg-blue-600 text-white border-transparent hover:bg-blue-700 shadow-sm'
                              }`}
                              title={
                                request.is_read
                                  ? 'Mark Unread'
                                  : 'Mark Read'
                              }
                            >
                              <Eye
                                size={13}
                              />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-slate-400 font-bold bg-white select-none"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 max-w-xs mx-auto">
                      <Layers
                        size={32}
                        className="text-slate-300 stroke-[1.5]"
                      />

                      <p className="text-sm text-slate-800 mt-1">
                        No Records Found
                      </p>

                      <p className="text-[11px] font-medium text-slate-400">
                        No records match
                        the current
                        filters.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ====================================================
            PAGINATION
        ===================================================== */}

        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
          <span className="text-xs font-semibold text-slate-500">
            Showing{' '}
            <strong className="text-slate-900">
              {filteredRequests.length >
              0
                ? (currentPage -
                    1) *
                    itemsPerPage +
                  1
                : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-900">
              {Math.min(
                currentPage *
                  itemsPerPage,
                filteredRequests.length
              )}
            </strong>{' '}
            of{' '}
            <strong className="text-slate-900">
              {
                filteredRequests.length
              }
            </strong>{' '}
            records
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={
                currentPage ===
                1
              }
              onClick={() =>
                setCurrentPage(
                  (previous) =>
                    Math.max(
                      previous -
                        1,
                      1
                    )
                )
              }
              className="px-3 h-8 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
            >
              Previous
            </button>

            <div className="px-3 text-xs font-bold text-slate-700">
              Page{' '}
              {currentPage} of{' '}
              {totalPages}
            </div>

            <button
              disabled={
                currentPage ===
                totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (previous) =>
                    Math.min(
                      previous +
                        1,
                      totalPages
                    )
                )
              }
              className="px-3 h-8 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 text-xs font-bold rounded-lg transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}