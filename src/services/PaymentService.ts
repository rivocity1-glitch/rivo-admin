import { supabase } from '../lib/supabase';

// ==========================================
// Types & Interfaces
// ==========================================

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentRecord {
  id: string;
  order_id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_status: PaymentStatus;
  gateway_name: string | null;
  gateway_response: any | null;
  paid_at: string | null;
  failure_reason: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

export interface CreatePaymentInput {
  order_id: string;
  amount: number;
  payment_method: string;
  gateway_name: string;
}

// ==========================================
// PaymentService Implementation
// ==========================================

export const PaymentService = {
  /**
   * 1. Creates a new payment record with a default 'pending' status.
   */
  async createPayment(input: CreatePaymentInput): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .insert([
          {
            order_id: input.order_id,
            amount: input.amount,
            payment_method: input.payment_method,
            gateway_name: input.gateway_name,
            payment_status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to create payment record' };
    }
  },

  /**
   * 2. Retrieves a single payment record by its unique identifier.
   */
  async getPayment(id: string): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch payment' };
    }
  },

  /**
   * 3. Retrieves a payment record associated with a specific order_id.
   */
  async getPaymentByOrder(orderId: string): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch payment by order ID' };
    }
  },

  /**
   * 4. Updates a payment status to 'paid' and timestamps the completion.
   */
  async updatePaymentSuccess(
    paymentId: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    gatewayResponse: any
  ): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: razorpayPaymentId,
          razorpay_order_id: razorpayOrderId,
          gateway_response: gatewayResponse,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to update payment success' };
    }
  },

  /**
   * 5. Marks a payment as failed along with its corresponding reason from the gateway.
   */
  async markPaymentFailed(
    paymentId: string,
    failureReason: string,
    gatewayResponse: any
  ): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'failed',
          failure_reason: failureReason,
          gateway_response: gatewayResponse
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to mark payment as failed' };
    }
  },

  /**
   * 6. Marks a payment as refunded and logs the refund payload response.
   */
  async markPaymentRefunded(
    paymentId: string,
    gatewayResponse: any
  ): Promise<ServiceResponse<PaymentRecord>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'refunded',
          gateway_response: gatewayResponse
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to mark payment as refunded' };
    }
  },

  /**
   * 7. Fetches the latest payment records ordered by paid_at descending.
   */
  async getRecentPayments(limit: number = 20): Promise<ServiceResponse<PaymentRecord[]>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error: any) {
      return { data: null, error: error.message || 'Failed to fetch recent payments' };
    }
  }
};