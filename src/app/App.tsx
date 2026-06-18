import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Store, 
  Bike, 
  Users, 
  ShoppingBag, 
  CreditCard, 
  RotateCcw, 
  HelpCircle, 
  Crown, 
  Bell, 
  BarChart3, 
  Settings as SettingsIcon,
  LogOut
} from "lucide-react";
import { Dashboard } from "./components/pages/Dashboard"; 
import { Vendors } from "./components/pages/Vendors"; 
import { Riders } from "./components/pages/Riders"; // 🟢 IMPORTED THE RIDERS PAGE HERE
import { Login } from "./components/pages/Login"; 
import { Customers } from "./components/pages/Customers"; // 🟢 IMPORTED THE CUSTOMERS PAGE HERE
import { Orders } from "./components/pages/Orders"; // 🟢 IMPORTED THE ORDERS PAGE HERE
import { Settlements } from "./components/pages/Settlements"; // 🟢 IMPORTED THE SETTLEMENTS PAGE HERE
import { Refunds } from "./components/pages/Refunds"; // 🟢 IMPORTED THE REFUNDS PAGE HERE
import { Supports } from "./components/pages/Support"; // 🟢 IMPORTED THE SUPPORTS PAGE HERE (fixed export name)
import { Subscriptions } from "./components/pages/Subscriptions"; // 🟢 IMPORTED THE SUBSCRIPTIONS PAGE HERE
import { Notifications } from "./components/pages/Notifications"; // 🟢 IMPORTED THE NOTIFICATIONS PAGE HERE
import { Analytics } from "./components/pages/Analytics"; // 🟢 IMPORTED THE ANALYTICS PAGE HERE
import { Settings } from "./components/pages/Settings"; // 🟢 IMPORTED THE SETTINGS PAGE HERE
import { supabase } from "../lib/supabase";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentTab, setCurrentTab] = useState("dashboard");

  // 🟢 Real-time Support Badge Priority & Count State Engine
  const [supportBadge, setSupportBadge] = useState<{ count: number; bgClass: string } | null>(null);

  async function syncSupportBadgeCount() {
    try {
      // Pull only non-resolved, unresolved active tickets
      const { data, error } = await supabase
        .from("support_tickets")
        .select("priority")
        .in("status", ["open", "in_progress"]);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSupportBadge(null); // Completely hide badge indicator if count is 0
        return;
      }

      const count = data.length;
      const priorities = data.map((t) => (t.priority || "").toLowerCase());

      // 🔴 Determine dynamic color flashing parameters matching severity rules
      if (priorities.includes("critical") || priorities.includes("high")) {
        setSupportBadge({
          count,
          bgClass: "bg-rose-500 animate-pulse text-white" // Serious flashing red indicator
        });
      } else if (priorities.includes("medium")) {
        setSupportBadge({
          count,
          bgClass: "bg-amber-500 text-white" // Medium warning amber indicator
        });
      } else {
        setSupportBadge({
          count,
          bgClass: "bg-[#22C55E] text-white" // Default operational green indicator
        });
      }
    } catch (err) {
      console.error("Support badge calculation synchronizer failed:", err);
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

  // 🟢 Polling loop to evaluate support ticket changes cleanly every 10 seconds
  useEffect(() => {
    if (session) {
      syncSupportBadgeCount();
      const interval = setInterval(syncSupportBadgeCount, 10000);
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
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 🛡️ Guard checks: Redirect unauthorized sessions straight to the login screen
  if (!session) {
    return <Login />;
  }

  // Nav elements list matching your original sidebar panel options
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "vendors", label: "Vendors", icon: <Store className="w-4 h-4" /> },
    { id: "riders", label: "Riders", icon: <Bike className="w-4 h-4" /> },
    { id: "customers", label: "Customers", icon: <Users className="w-4 h-4" /> },
    { id: "orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "settlements", label: "Settlements", icon: <CreditCard className="w-4 h-4" /> },
    { id: "refunds", label: "Refunds", icon: <RotateCcw className="w-4 h-4" /> },
    { id: "support", label: "Support", icon: <HelpCircle className="w-4 h-4" /> }, // Badge handled dynamically below now
    { id: "subscriptions", label: "Subscriptions", icon: <Crown className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen w-full font-sans antialiased text-[#0F172A]">
      
      {/* 1. SIDEBAR DESIGN */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between fixed h-full z-30">
        <div className="overflow-y-auto flex-1">
          {/* Brand Identity Branding row */}
          <div className="h-16 flex items-center px-6 border-b border-[#F1F5F9] gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#22C55E] flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-[#22C55E]/20">R</div>
            <div>
              <span className="font-bold text-sm text-[#0F172A] block leading-none">Rivo</span>
              <span className="text-[10px] text-[#64748B] font-medium mt-0.5 block">Admin</span>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="p-3 space-y-0.5">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const isSupportItem = item.id === "support";
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all group ${
                    isActive
                      ? "bg-[#F0FDF4] text-[#16A34A]"
                      : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`transition-colors ${isActive ? "text-[#22C55E]" : "text-[#94A3B8] group-hover:text-[#64748B]"}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  
                  {/* 🟢 DYNAMIC LIVE BADGE COMPONENT FOR SUPPORT VIEW OVERLAY */}
                  {isSupportItem && supportBadge && (
                    <span className={`h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center transition-all shadow-sm ${supportBadge.bgClass}`}>
                      {supportBadge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Element & Destructive Sign Out */}
        <div className="p-3 border-t border-[#F1F5F9] bg-white space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
            <div className="w-8 h-8 rounded-full bg-[#E8FBF0] border border-[#DCFCE7] flex items-center justify-center text-xs font-bold text-[#16A34A]">
              {session.name ? session.name[0] : "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0F172A] truncate leading-tight">{session.name || "Admin User"}</p>
              <p className="text-[10px] text-[#94A3B8] truncate font-medium capitalize mt-0.5">{session.role?.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full h-9 px-3 text-xs font-semibold text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2.5 transition-colors group"
          >
            <LogOut className="w-4 h-4 text-[#94A3B8] group-hover:text-red-500 transition-colors" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT FLEX LAYER CONTAINER */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        
        {/* TOP BAR ACTION BAR HEADERS */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-[#94A3B8]">Rivo</span>
            <span className="text-[#E2E8F0]">/</span>
            <span className="text-[#475569] capitalize font-semibold">{currentTab}</span>
          </div>
          
          <div className="text-right text-xs text-[#64748B] font-medium bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-lg">
            {new Date().toLocaleDateString("en-US", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </header>

        {/* 3. WORKSPACE PAGE NAVIGATION SLOTS */}
        <main className="flex-1 p-8 overflow-y-auto">
          {currentTab === "dashboard" && <Dashboard />}
          {currentTab === "vendors" && <Vendors />}
          {currentTab === "riders" && <Riders />} 
          {currentTab === "customers" && <Customers />} 
          {currentTab === "orders" && <Orders />} 
          {currentTab === "settlements" && <Settlements />} 
          {currentTab === "refunds" && <Refunds />} 
          {currentTab === "support" && <Supports />} 
          {currentTab === "subscriptions" && <Subscriptions />} 
          {currentTab === "notifications" && <Notifications />} 
          {currentTab === "analytics" && <Analytics />} 
          {currentTab === "settings" && <Settings />} 

          {/* Default fallback catch-all for missing pages */}
          {currentTab !== "dashboard" && currentTab !== "vendors" && currentTab !== "riders" && currentTab !== "customers" && currentTab !== "orders" && currentTab !== "settlements" && currentTab !== "refunds" && currentTab !== "support" && currentTab !== "subscriptions" && currentTab !== "notifications" && currentTab !== "analytics" && currentTab !== "settings" && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 text-center text-xs font-medium text-[#94A3B8]">
              The <span className="capitalize text-[#475569] font-semibold">"{currentTab}"</span> panel is connected and preparing for production initialization.
            </div>
          )}
        </main>

      </div>
    </div>
  );
}