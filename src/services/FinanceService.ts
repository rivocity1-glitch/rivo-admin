import { supabase } from '../lib/supabase';

// ==========================================
// Types & Interfaces
// ==========================================

export type EntityType = 'vendor' | 'rider' | 'customer' | 'platform';
export type TransactionType = 'order_payment' | 'vendor_payout' | 'rider_payout' | 'commission' | 'refund' | 'adjustment';
export type EntryType = 'credit' | 'debit';
export type SettlementStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

export interface FinanceDashboardData {
  totalPayments: number;
  totalRevenue: number;
  pendingVendorSettlements: number;
  pendingRiderSettlements: number;
  totalSettlementsPaid: number;
  totalPlatformCommission: number;
  todayPayments: number;
}

export interface LedgerEntryInput {
  entity_type: EntityType;
  entity_id: string;
  transaction_type: TransactionType;
  entry_type: EntryType;
  amount: number;
  reference_id?: string | null;
  remarks?: string | null;
}

// ==========================================
// FinanceService Implementation
// ==========================================

export const FinanceService = {
  /**
   * 1. Fetches aggregated metrics for the financial dashboard using real-time queries.
   */
  async getFinanceDashboard(): Promise<ServiceResponse<FinanceDashboardData>> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Total Payments & Today's Payments from payments table
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, status, created_at');

      if (paymentsError) throw paymentsError;

      let totalPayments = 0;
      let todayPayments = 0;

      paymentsData?.forEach(p => {
        if (p.status === 'completed') {
          totalPayments += Number(p.amount) || 0;
          
          const paymentDate = new Date(p.created_at);
          if (paymentDate >= todayStart) {
            todayPayments += Number(p.amount) || 0;
          }
        }
      });

      // 2. Pending Vendor Settlements
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_settlements')
        .select('amount, status');

      if (vendorError) throw vendorError;

      let pendingVendorSettlements = 0;
      let totalVendorPaid = 0;

      vendorData?.forEach(vs => {
        if (vs.status === 'pending') {
          pendingVendorSettlements += Number(vs.amount) || 0;
        } else if (vs.status === 'paid') {
          totalVendorPaid += Number(vs.amount) || 0;
        }
      });

      // 3. Pending Rider Settlements
      const { data: riderData, error: riderError } = await supabase
        .from('rider_settlements')
        .select('amount, status');

      if (riderError) throw riderError;

      let pendingRiderSettlements = 0;
      let totalRiderPaid = 0;

      riderData?.forEach(rs => {
        if (rs.status === 'pending') {
          pendingRiderSettlements += Number(rs.amount) || 0;
        } else if (rs.status === 'paid') {
          totalRiderPaid += Number(rs.amount) || 0;
        }
      });

      // 4. Commissions and Platform revenue from the financial_ledger
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('financial_ledger')
        .select('amount, transaction_type, entry_type');

      if (ledgerError) throw ledgerError;

      let totalPlatformCommission = 0;
      let totalRevenue = 0; // Total platform earnings/inflow

      ledgerData?.forEach(entry => {
        const amt = Number(entry.amount) || 0;
        if (entry.transaction_type === 'commission') {
          totalPlatformCommission += amt;
        }
        
        // Revenue is typically calculated based on credits to the platform or net commissions
        if (entry.entry_type === 'credit') {
          totalRevenue += amt;
        } else if (entry.entry_type === 'debit') {
          totalRevenue -= amt;
        }
      });

      const dashboardData: FinanceDashboardData = {
        totalPayments,
        totalRevenue,
        pendingVendorSettlements,
        pendingRiderSettlements,
        totalSettlementsPaid: totalVendorPaid + totalRiderPaid,
        totalPlatformCommission,
        todayPayments,
      };

      return { data: dashboardData, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch finance dashboard data' };
    }
  },

  /**
   * 2. Fetches vendor settlement records, with an optional status filter.
   */
  async getVendorSettlements(status?: SettlementStatus): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('vendor_settlements')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch vendor settlements' };
    }
  },

  /**
   * 3. Fetches rider settlement records, with an optional status filter.
   */
  async getRiderSettlements(status?: SettlementStatus): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('rider_settlements')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch rider settlements' };
    }
  },

  /**
   * 4. Fetches the latest financial ledger entries.
   */
  async getRecentLedger(limit: number = 20): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('financial_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch recent ledger entries' };
    }
  },

  /**
   * 5. Creates a new financial ledger entry transaction.
   */
  async createLedgerEntry(input: LedgerEntryInput): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('financial_ledger')
        .insert([input])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to create ledger entry' };
    }
  },

  /**
   * 6. Reads the wallet balance for a given entity, accounting for both modern polymorphic column layouts
   *    and fallback/legacy auth_user_id mappings.
   */
  async getWalletBalance(entityType: EntityType, entityId: string): Promise<ServiceResponse<number>> {
    try {
      // First structural try: Polymorphic identity mapping (entity_type + entity_id columns)
      let query = supabase.from('wallets').select('balance');
      
      // Attempting to filter by modern dynamic target columns first
      const { data: polyData, error: polyError } = await query
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (!polyError && polyData) {
        return { data: Number(polyData.balance) || 0, error: null };
      }

      // Fallback/Legacy try: Match against core identifier columns like auth_user_id or vendor_id/rider_id if present
      let fallbackQuery = supabase.from('wallets').select('balance');
      
      if (entityType === 'vendor') {
        fallbackQuery = fallbackQuery.or(`vendor_id.eq.${entityId},auth_user_id.eq.${entityId}`);
      } else if (entityType === 'rider') {
        fallbackQuery = fallbackQuery.or(`rider_id.eq.${entityId},auth_user_id.eq.${entityId}`);
      } else {
        fallbackQuery = fallbackQuery.eq('auth_user_id', entityId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery.maybeSingle();
      
      if (fallbackError) throw fallbackError;
      if (!fallbackData) {
        // Safe defaults return zero if no wallet instance initialization records exist yet
        return { data: 0, error: null };
      }

      return { data: Number(fallbackData.balance) || 0, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch wallet balance' };
    }
  },

  /**
   * 7. Fetches the latest payment transactions records.
   */
  async getRecentPayments(limit: number = 20): Promise<ServiceResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch recent payments' };
    }
  }
};