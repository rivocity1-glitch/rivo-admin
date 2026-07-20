import React, { useEffect, useState } from "react";
import { Bell, Search, ChevronDown } from "lucide-react";
import { PageId } from "./Sidebar";
import { NotificationService } from "../../../services/notificationService";
import { BrowserNotification } from "../../../services/browserNotification";
import { supabase } from "../../../lib/supabase";
const pageTitles: Record<PageId, string> = {
  dashboard: "Dashboard",
  vendors: "Vendors",
  riders: "Riders",
  customers: "Customers",
  orders: "Orders",
  settlements: "Settlements",
  refunds: "Refunds",
  support: "Support",
  subscriptions: "Subscriptions",
  notifications: "Notifications",
  analytics: "Analytics",
  settings: "Settings",
};

interface HeaderProps {
  activePage: PageId;
}

export function Header({ activePage }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  useEffect(() => {
  let unsubscribe: (() => void) | undefined;

  const initializeNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { count } = await NotificationService.getUnreadCount(user.id);
    setUnreadCount(count ?? 0);

    unsubscribe = NotificationService.subscribe(user.id, async (payload) => {
      const { count } = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count ?? 0);

      if (payload.eventType === "INSERT") {
        const notification = payload.new;

        BrowserNotification.show(notification.title, {
          body: notification.message,
        });
      }
    });
  };

  initializeNotifications();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, []);

  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4 z-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-[#64748B]">Rivo</span>
        <span className="text-[#CBD5E1]">/</span>
        <span className="font-medium text-[#0F172A]">{pageTitles[activePage]}</span>
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full h-8 pl-9 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder:text-[#94A3B8] text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] bg-white border border-[#E2E8F0] rounded text-[#94A3B8] font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-[#64748B] mr-2">{today}</span>

        {/* Notification bell */}
        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors">
  <Bell className="w-4 h-4" />

  {unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  )}
</button>

        {/* Avatar */}
        <button className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg hover:bg-[#F8FAFC] transition-colors">
          <div className="w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">A</span>
          </div>
          <span className="text-sm font-medium text-[#0F172A]">Admin</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
        </button>
      </div>
    </header>
  );
}
