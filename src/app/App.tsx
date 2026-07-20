import React, { useEffect, useState } from "react";
import { 
  BarChart3, 
  Bell, 
  Bike, 
  Crown, 
  CreditCard, 
  HelpCircle, 
  LayoutDashboard, 
  LogOut, 
  RotateCcw, 
  Settings as SettingsIcon, 
  ShoppingBag, 
  Store, 
  Users 
} from "lucide-react";
import { Dashboard } from "./components/pages/Dashboard"; 
import { Vendors } from "./components/pages/Vendors"; 
import { Riders } from "./components/pages/Riders"; 
import { Login } from "./components/pages/Login"; 
import { Customers } from "./components/pages/Customers"; 
import { Orders } from "./components/pages/Orders"; 
import { Settlements } from "./components/pages/Settlements"; 
import { Refunds } from "./components/pages/Refunds"; 
import { Supports } from "./components/pages/Support"; 
import { Subscriptions } from "./components/pages/Subscriptions"; 
import { Notifications } from "./components/pages/Notifications"; 
import { Analytics } from "./components/pages/Analytics"; 
import { Settings } from "./components/pages/Settings"; 
import { supabase } from "../lib/supabase";
import RequestsCenter from "./components/pages/RequestsCenter";
import { NotificationService } from "../services/notificationService";
import { BrowserNotification } from "../services/browserNotification";

export type ThemeType = "light" | "dark" | "system";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem("rivo-theme") as ThemeType) || "system";
  });

  const [supportBadge, setSupportBadge] = useState<{ count: number; bgClass: string } | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  // 泙 Fixed Sidebar Badges State (Notifications completely removed)
  const [sidebarCounts, setSidebarCounts] = useState({
    requests: 0,
    settlements: 0,
    refunds: 0
  });

  // 泙 Theme side effect engine
  useEffect(() => {
    const root = window.document.documentElement;
    
    function applyTheme() {
      root.classList.remove("light", "dark");
      if (theme === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.add(systemDark ? "dark" : "light");
      } else {
        root.classList.add(theme);
      }
    }

    applyTheme();
    localStorage.setItem("rivo-theme", theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [theme]);

  // Realtime notification initialization and listener engine
  useEffect(() => {
    if (!session) return;

    let unsubscribe: (() => void) | undefined;

    async function initNotifications() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const count = await NotificationService.getUnreadCount(user.id);
        setUnreadNotificationCount(count);

        unsubscribe = NotificationService.subscribe(user.id, async (notification: any) => {
          const updatedCount = await NotificationService.getUnreadCount(user.id);
          setUnreadNotificationCount(updatedCount);
          
          if (notification?.title && notification?.message) {
            BrowserNotification.show(notification.title, notification.message);
          } else {
            BrowserNotification.show("New Notification", "You have a new notification.");
          }
        });
      } catch (err) {
        console.error("Failed to initialize notification system:", err);
      }
    }

    initNotifications();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [session]);

  async function syncSupportBadgeCount() {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id")
        .in("status", ["open", "in_progress"]);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSupportBadge(null);
        return;
      }

      const count = data.length;
      setSupportBadge({
        count,
        bgClass: "bg-[#22C55E] text-white"
      });
    } catch (err) {
      console.error("Support badge calculation synchronizer failed:", err);
    }
  }

  // 泙 Updated Counter Sync Engine (No outgoing broadcast scanning)
  async function syncSidebarCounts() {
    try {
      // 1. Request Center Count
      const { count: requestsCount, error: errReq } = await supabase
        .from("subscription_payment_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (errReq) throw errReq;

      // 2. Settlements Count
      const { count: settlementsCount, error: errSet } = await supabase
        .from("vendor_settlements")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (errSet) throw errSet;

      // 3. Refunds Count
      const { count: refundsCount, error: errRef } = await supabase
        .from("refunds")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (errRef) throw errRef;

      setSidebarCounts({
        requests: requestsCount || 0,
        settlements: settlementsCount || 0,
        refunds: refundsCount || 0
      });
    } catch (err) {
      console.error("Failed to sync sidebar counts:", err);
    }
  }

  useEffect(() => {
    try {
      const localSession = localStorage.getItem("rivo_admin_session");
      if (localSession) {
        setSession(JSON.parse(localSession));
      }
    } catch (err) {
      console.error("Failed to parse admin session:", err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      syncSupportBadgeCount();
      const interval = setInterval(syncSupportBadgeCount, 10000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // 泙 30-Second Refresh Cycle for operational approvals
  useEffect(() => {
    if (session) {
      syncSidebarCounts();
      const interval = setInterval(syncSidebarCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  function handleLogout() {
    const confirmation = window.confirm("Are you sure you want to sign out?");
    if (confirmation) {
      localStorage.removeItem("rivo_admin_session");
      setSession(null);
      window.location.reload(); 
    }
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
        <div className="w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "vendors", label: "Vendors", icon: <Store className="w-4 h-4" /> },
    { id: "riders", label: "Riders", icon: <Bike className="w-4 h-4" /> },
    { id: "customers", label: "Customers", icon: <Users className="w-4 h-4" /> },
    { id: "orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "settlements", label: "Settlements", icon: <CreditCard className="w-4 h-4" /> },
    { id: "refunds", label: "Refunds", icon: <RotateCcw className="w-4 h-4" /> },
    { id: "support", label: "Support", icon: <HelpCircle className="w-4 h-4" /> }, 
    { id: "requests", label: "Request Center", icon: <Bell className="w-4 h-4" /> },
    { id: "subscriptions", label: "Subscriptions", icon: <Crown className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex bg-[#F8FAFC] dark:bg-slate-950 min-h-screen w-full font-sans antialiased text-[#0F172A] dark:text-slate-200 transition-colors duration-200">
      
      {/* 1. SIDEBAR DESIGN */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-[#E2E8F0] dark:border-slate-800 flex flex-col justify-between fixed h-full z-30 transition-colors duration-200">
        <div className="overflow-y-auto flex-1">
          <div className="h-16 flex items-center px-6 border-b border-[#F1F5F9] dark:border-slate-800 gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#22C55E] flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-[#22C55E]/20">R</div>
            <div>
              <span className="font-bold text-sm text-[#0F172A] dark:text-slate-200 block leading-none">Rivo</span>
              <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-medium mt-0.5 block">Admin</span>
            </div>
          </div>

          <nav className="p-3 space-y-0.5">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const isSupportItem = item.id === "support";
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all duration-200 group ${
                    isActive
                      ? "bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#16A34A] dark:text-[#22C55E]"
                      : "text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`transition-colors duration-200 ${isActive ? "text-[#22C55E]" : "text-[#94A3B8] group-hover:text-[#64748B] dark:group-hover:text-slate-300"}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  
                  {isSupportItem && supportBadge && (
                    <span className={`h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center transition-all shadow-sm ${supportBadge.bgClass}`}>
                      {supportBadge.count}
                    </span>
                  )}

                  {/* 泙 Render Engine Matrix for targeted approval badges */}
                  {(() => {
                    const badgeConfigs: Record<string, { count: number; classes: string }> = {
                      requests: { count: sidebarCounts.requests, classes: "bg-red-500 text-white animate-pulse" },
                      settlements: { count: sidebarCounts.settlements, classes: "bg-orange-500 text-white animate-pulse" },
                      refunds: { count: sidebarCounts.refunds, classes: "bg-red-500 text-white animate-pulse" }
                    };

                    const targetConfig = badgeConfigs[item.id];
                    if (targetConfig && targetConfig.count > 0) {
                      return (
                        <span className={`h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center transition-all shadow-sm ${targetConfig.classes}`}>
                          {targetConfig.count}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#F1F5F9] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 transition-colors duration-200">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/50 border border-[#F1F5F9] dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-[#E8FBF0] dark:bg-emerald-950/40 border border-[#DCFCE7] dark:border-emerald-900/40 flex items-center justify-center text-xs font-bold text-[#16A34A] dark:text-[#22C55E]">
              {session.name ? session.name[0] : "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200 truncate leading-tight">{session.name || "Admin User"}</p>
              <p className="text-[10px] text-[#94A3B8] dark:text-slate-400 truncate font-medium capitalize mt-0.5">{session.role?.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full h-9 px-3 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg flex items-center gap-2.5 transition-colors duration-200 group"
          >
            <LogOut className="w-4 h-4 text-[#94A3B8] group-hover:text-red-500 transition-colors duration-200" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT FLEX LAYER CONTAINER */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-20 transition-colors duration-200">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-[#94A3B8]">Rivo</span>
            <span className="text-[#E2E8F0] dark:text-slate-700">/</span>
            <span className="text-[#475569] dark:text-slate-300 capitalize font-semibold">{currentTab}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab("notifications")}
              className="relative p-2 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 transition-colors duration-200 focus:outline-none"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center leading-none border-2 border-white dark:border-slate-900 shadow-sm">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>

            <div className="text-right text-xs text-[#64748B] dark:text-slate-400 font-medium bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors duration-200">
              {new Date().toLocaleDateString("en-US", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {currentTab === "dashboard" && <Dashboard />}
          {currentTab === "vendors" && <Vendors />}
          {currentTab === "riders" && <Riders />} 
          {currentTab === "customers" && <Customers />} 
          {currentTab === "orders" && <Orders />} 
          {currentTab === "settlements" && <Settlements />} 
          {currentTab === "refunds" && <Refunds />} 
          {currentTab === "support" && <Supports />} 
          {currentTab === "requests" && <RequestsCenter />} 
          {currentTab === "subscriptions" && <Subscriptions />} 
          {currentTab === "notifications" && <Notifications />} 
          {currentTab === "analytics" && <Analytics />} 
          {currentTab === "settings" && <Settings />} 

          {currentTab !== "dashboard" && currentTab !== "vendors" && currentTab !== "riders" && currentTab !== "customers" && currentTab !== "orders" && currentTab !== "settlements" && currentTab !== "refunds" && currentTab !== "support" && currentTab !== "requests" && currentTab !== "subscriptions" && currentTab !== "notifications" && currentTab !== "analytics" && currentTab !== "settings" && (
            <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-16 text-center text-xs font-medium text-[#94A3B8] dark:text-slate-500 transition-colors duration-200">
              The <span className="capitalize text-[#475569] dark:text-slate-300 font-semibold">"{currentTab}"</span> panel is connected and preparing for production initialization.
            </div>
          )}
        </main>

      </div>
    </div>
  );
}