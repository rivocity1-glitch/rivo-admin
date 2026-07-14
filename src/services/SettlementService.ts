import { supabase } from '../lib/supabase';

// ==========================================
// Types & Interfaces
// ==========================================

export type SettlementStatus = 'pending' | 'approved' | 'paid';
export type SettlementType = 'vendor' | 'rider';

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

export interface VendorSettlementRecord {
  id: string;
  vendor_id: string;
  amount: number;
  order_count: number;
  order_ids: string[];
  status: SettlementStatus;
  request_date: string;
  paid_at: string | null;
  payment_method: string | null;
  utr_number: string | null;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RiderSettlementRecord {
  id: string;
  rider_id: string;
  amount: number;
  delivery_count: number;
  order_ids: string[];
  status: SettlementStatus;
  request_date: string;
  paid_at: string | null;
  payment_method: string | null;
  utr_number: string | null;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateVendorSettlementInput {
  vendor_id: string;
  amount: number;
  order_count: number;
  order_ids: string[];
}

export interface CreateRiderSettlementInput {
  rider_id: string;
  amount: number;
  delivery_count: number;
  order_ids: string[];
}

export interface MarkSettlementPaidInput {
  settlementId: string;
  payment_method: string;
  utr_number: string;
  remarks: string;
}

// ==========================================
// SettlementService Implementation
// ==========================================

export const SettlementService = {
  /**
   * 1. Fetches vendor settlements, optionally filtered by status, ordered by request_date descending.
   */
  async getVendorSettlements(status?: SettlementStatus): Promise<ServiceResponse<VendorSettlementRecord[]>> {
    try {
      let query = supabase
        .from('vendor_settlements')
        .select('*')
        .order('request_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch vendor settlements' };
    }
  },

  /**
   * 2. Fetches rider settlements, optionally filtered by status, ordered by request_date descending.
   */
  async getRiderSettlements(status?: SettlementStatus): Promise<ServiceResponse<RiderSettlementRecord[]>> {
    try {
      let query = supabase
        .from('rider_settlements')
        .select('*')
        .order('request_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch rider settlements' };
    }
  },

  /**
   * 3. Retrieves a single vendor settlement by id.
   */
  async getVendorSettlement(id: string): Promise<ServiceResponse<VendorSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('vendor_settlements')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch vendor settlement' };
    }
  },

  /**
   * 4. Retrieves a single rider settlement by id.
   */
  async getRiderSettlement(id: string): Promise<ServiceResponse<RiderSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('rider_settlements')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch rider settlement' };
    }
  },

  /**
   * 5. Inserts a new vendor settlement record with 'pending' status and current timestamp.
   */
  async createVendorSettlement(input: CreateVendorSettlementInput): Promise<ServiceResponse<VendorSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('vendor_settlements')
        .insert([
          {
            vendor_id: input.vendor_id,
            amount: input.amount,
            order_count: input.order_count,
            order_ids: input.order_ids,
            status: 'pending',
            request_date: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to create vendor settlement' };
    }
  },

  /**
   * 6. Inserts a new rider settlement record with 'pending' status and current timestamp.
   */
  async createRiderSettlement(input: CreateRiderSettlementInput): Promise<ServiceResponse<RiderSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('rider_settlements')
        .insert([
          {
            rider_id: input.rider_id,
            amount: input.amount,
            delivery_count: input.delivery_count,
            order_ids: input.order_ids,
            status: 'pending',
            request_date: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to create rider settlement' };
    }
  },

  /**
   * 7. Updates the status of a vendor settlement to 'approved'.
   */
  async approveVendorSettlement(settlementId: string, remarks?: string): Promise<ServiceResponse<VendorSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('vendor_settlements')
        .update({
          status: 'approved',
          remarks: remarks || null
        })
        .eq('id', settlementId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to approve vendor settlement' };
    }
  },

  /**
   * 8. Updates the status of a rider settlement to 'approved'.
   */
  async approveRiderSettlement(settlementId: string, remarks?: string): Promise<ServiceResponse<RiderSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('rider_settlements')
        .update({
          status: 'approved',
          remarks: remarks || null
        })
        .eq('id', settlementId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to approve rider settlement' };
    }
  },

  /**
   * 9. Marks a vendor settlement as paid, storing transaction execution proofs.
   */
  async markVendorSettlementPaid(input: MarkSettlementPaidInput): Promise<ServiceResponse<VendorSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('vendor_settlements')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: input.payment_method,
          utr_number: input.utr_number,
          remarks: input.remarks
        })
        .eq('id', input.settlementId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to mark vendor settlement as paid' };
    }
  },

  /**
   * 10. Marks a rider settlement as paid, storing transaction execution proofs.
   */
  async markRiderSettlementPaid(input: MarkSettlementPaidInput): Promise<ServiceResponse<RiderSettlementRecord>> {
    try {
      const { data, error } = await supabase
        .from('rider_settlements')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: input.payment_method,
          utr_number: input.utr_number,
          remarks: input.remarks
        })
        .eq('id', input.settlementId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to mark rider settlement as paid' };
    }
  },

  /**
   * 11. Helper to retrieve only vendor settlements matching the 'pending' state.
   */
  async getPendingVendorSettlements(): Promise<ServiceResponse<VendorSettlementRecord[]>> {
    return this.getVendorSettlements('pending');
  },

  /**
   * 12. Helper to retrieve only rider settlements matching the 'pending' state.
   */
  async getPendingRiderSettlements(): Promise<ServiceResponse<RiderSettlementRecord[]>> {
    return this.getRiderSettlements('pending');
  }
};