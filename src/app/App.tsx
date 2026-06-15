import React, { useState } from "react";
import { Sidebar, PageId } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Dashboard } from "./components/pages/Dashboard";
import { Vendors } from "./components/pages/Vendors";
import { Riders } from "./components/pages/Riders";
import { Customers } from "./components/pages/Customers";
import { Orders } from "./components/pages/Orders";
import { Settlements } from "./components/pages/Settlements";
import { Refunds } from "./components/pages/Refunds";
import { Support } from "./components/pages/Support";
import { Subscriptions } from "./components/pages/Subscriptions";
import { Notifications } from "./components/pages/Notifications";
import { Analytics } from "./components/pages/Analytics";
import { Settings } from "./components/pages/Settings";

const pageComponents: Record<PageId, React.ReactNode> = {
  dashboard: <Dashboard />,
  vendors: <Vendors />,
  riders: <Riders />,
  customers: <Customers />,
  orders: <Orders />,
  settlements: <Settlements />,
  refunds: <Refunds />,
  support: <Support />,
  subscriptions: <Subscriptions />,
  notifications: <Notifications />,
  analytics: <Analytics />,
  settings: <Settings />,
};

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif]">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <Header activePage={activePage} />

      {/* Main content */}
      <main className="ml-[220px] pt-14 min-h-screen">
        <div className="p-6 max-w-[1280px]">
          {pageComponents[activePage]}
        </div>
      </main>
    </div>
  );
}
