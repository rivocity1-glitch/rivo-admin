import { supabase } from "../lib/supabase";

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  recipient_type: string | null;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
  metadata: Record<string, any> | null;
  deleted_at: string | null;
  action_url: string | null;
  priority: string | null;
  expires_at: string | null;
  created_by: string | null;
}

export const NotificationService = {
  async getNotifications(recipientId: string) {
    return supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", recipientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
  },

  async getUnreadCount(recipientId: string) {
    return supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .eq("is_read", false)
      .is("deleted_at", null);
  },

  async markAsRead(id: string) {
    return supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
  },

  async markAllAsRead(recipientId: string) {
    return supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", recipientId)
      .eq("is_read", false);
  },

  async softDelete(id: string) {
    return supabase
      .from("notifications")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);
  },

  subscribe(
    recipientId: string,
    callback: (payload: any) => void
  ) {
    const channel = supabase
      .channel(`notifications-${recipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${recipientId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};