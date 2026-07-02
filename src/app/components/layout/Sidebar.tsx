import React from "react";
import {
  LayoutDashboard,
  Store,
  Bike,
  Users,
  ShoppingCart,
  CreditCard,
  RefreshCcw,
  MessageSquare,
  Crown,
  Bell,
  Inbox,
  BarChart2,
  Settings,
  Leaf,
} from "lucide-react";
import { cn } from "../../../lib/utils";

export type PageId =
  | "dashboard"
  | "vendors"
  | "riders"
  | "customers"
  | "orders"
  | "settlements"
  | "refunds"
  | "support"
  | "requestscenter"
  | "subscriptions"
  | "notifications"
  | "analytics"
  | "settings";

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "vendors", label: "Vendors", icon: <Store className="w-4 h-4" /> },
  { id: "riders", label: "Riders", icon: <Bike className="w-4 h-4" /> },
  { id: "customers", label: "Customers", icon: <Users className="w-4 h-4" /> },
  { id: "orders", label: "Orders", icon: <ShoppingCart className="w-4 h-4" /> },
  { id: "settlements", label: "Settlements", icon: <CreditCard className="w-4 h-4" /> },
  { id: "refunds", label: "Refunds", icon: <RefreshCcw className="w-4 h-4" /> },
  { id: "support", label: "Support", icon: <MessageSquare className="w-4 h-4" />, badge: 3 },
  { id: "requestscenter", label: "Requests", icon: <Inbox className="w-4 h-4" /> },
  { id: "subscriptions", label: "Subscriptions", icon: <Crown className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-white dark:bg-slate-900 border-r border-[#E2E8F0] dark:border-slate-800 flex flex-col z-10 transition-colors duration-200">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-[#E2E8F0] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#22C55E] rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#0F172A] dark:text-slate-200 leading-none">Rivo</span>
            <span className="text-[10px] text-[#64748B] dark:text-slate-400 leading-none mt-0.5">Admin</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                    isActive
                      ? "bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#16A34A] dark:text-[#22C55E]"
                      : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#0F172A] dark:hover:text-slate-200"
                  )}
                >
                  <span className={cn(isActive ? "text-[#22C55E]" : "text-[#94A3B8] dark:text-slate-500")}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="h-4 min-w-[16px] px-1 bg-[#22C55E] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#E2E8F0] dark:border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-slate-800 cursor-pointer transition-colors duration-200">
          <div className="w-7 h-7 bg-[#22C55E] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#0F172A] dark:text-slate-200 truncate">Admin</p>
            <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">admin@rivo.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}