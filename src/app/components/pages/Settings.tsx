import React, { useState } from "react";
import {
  Globe,
  Truck,
  Crown,
  Bell,
  UserCog,
  Shield,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageHeader } from "../ui/PageHeader";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";

type SettingsTab =
  | "platform"
  | "delivery"
  | "subscription"
  | "notification"
  | "admin_users"
  | "security";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "platform", label: "Platform", icon: <Globe className="w-3.5 h-3.5" /> },
  { id: "delivery", label: "Delivery", icon: <Truck className="w-3.5 h-3.5" /> },
  { id: "subscription", label: "Subscription", icon: <Crown className="w-3.5 h-3.5" /> },
  { id: "notification", label: "Notifications", icon: <Bell className="w-3.5 h-3.5" /> },
  { id: "admin_users", label: "Admin Users", icon: <UserCog className="w-3.5 h-3.5" /> },
  { id: "security", label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0",
        enabled ? "bg-[#22C55E]" : "bg-[#CBD5E1]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#F1F5F9] last:border-0">
      <div className="mr-8">
        <p className="text-sm font-medium text-[#0F172A]">{label}</p>
        {description && <p className="text-xs text-[#64748B] mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

const adminUsers = [
  { id: "ADM-001", name: "Aditya Menon", email: "aditya@rivo.app", role: "Super Admin", status: "active" },
  { id: "ADM-002", name: "Preethi R.", email: "preethi@rivo.app", role: "Support Lead", status: "active" },
  { id: "ADM-003", name: "Nikhil Shah", email: "nikhil@rivo.app", role: "Operations", status: "active" },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("platform");
  const [showPassword, setShowPassword] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const [platformSettings, setPlatformSettings] = useState({
    platformName: "Rivo",
    supportEmail: "support@rivo.app",
    timezone: "Asia/Kolkata",
    currency: "INR",
    maintenanceMode: false,
    allowRegistration: true,
  });

  const [deliverySettings, setDeliverySettings] = useState({
    baseDeliveryFee: "25",
    perKmCharge: "5",
    freeDeliveryAbove: "500",
    maxDeliveryRadius: "10",
    otpVerification: true,
    autoAssignRider: true,
    allowScheduledDelivery: false,
  });

  const [notifSettings, setNotifSettings] = useState({
    orderUpdates: true,
    promotionalEmails: false,
    smsAlerts: true,
    pushNotifications: true,
    adminAlerts: true,
  });

  return (
    <div>
      <PageHeader title="Settings" description="Configure platform, delivery, and admin settings" />

      <div className="flex gap-6">
        {/* Tabs sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="bg-white border border-[#E2E8F0] rounded-xl p-2 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left",
                  activeTab === tab.id
                    ? "bg-[#F0FDF4] text-[#16A34A]"
                    : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                )}
              >
                <span className={activeTab === tab.id ? "text-[#22C55E]" : "text-[#94A3B8]"}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-[#E2E8F0] rounded-xl">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                {tabs.find((t) => t.id === activeTab)?.label} Settings
              </h2>
              {activeTab !== "admin_users" && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Changes
                </Button>
              )}
            </div>

            <div className="px-6 py-2">
              {/* Platform */}
              {activeTab === "platform" && (
                <div>
                  <SettingRow label="Platform Name" description="Displayed on customer-facing interfaces">
                    <Input
                      value={platformSettings.platformName}
                      onChange={(e) => setPlatformSettings((p) => ({ ...p, platformName: e.target.value }))}
                      className="w-64"
                    />
                  </SettingRow>
                  <SettingRow label="Support Email" description="Receives all customer support queries">
                    <Input
                      value={platformSettings.supportEmail}
                      onChange={(e) => setPlatformSettings((p) => ({ ...p, supportEmail: e.target.value }))}
                      className="w-64"
                    />
                  </SettingRow>
                  <SettingRow label="Timezone">
                    <Select
                      value={platformSettings.timezone}
                      onChange={(v) => setPlatformSettings((p) => ({ ...p, timezone: v }))}
                      options={[
                        { value: "Asia/Kolkata", label: "IST (Asia/Kolkata)" },
                        { value: "UTC", label: "UTC" },
                      ]}
                      className="w-64"
                    />
                  </SettingRow>
                  <SettingRow label="Currency">
                    <Select
                      value={platformSettings.currency}
                      onChange={(v) => setPlatformSettings((p) => ({ ...p, currency: v }))}
                      options={[{ value: "INR", label: "INR — Indian Rupee" }]}
                      className="w-48"
                    />
                  </SettingRow>
                  <SettingRow label="Maintenance Mode" description="Take the platform offline for maintenance">
                    <Toggle
                      enabled={platformSettings.maintenanceMode}
                      onChange={(v) => setPlatformSettings((p) => ({ ...p, maintenanceMode: v }))}
                    />
                  </SettingRow>
                  <SettingRow label="Allow New Registrations" description="Enable customer and vendor sign-ups">
                    <Toggle
                      enabled={platformSettings.allowRegistration}
                      onChange={(v) => setPlatformSettings((p) => ({ ...p, allowRegistration: v }))}
                    />
                  </SettingRow>
                </div>
              )}

              {/* Delivery */}
              {activeTab === "delivery" && (
                <div>
                  <SettingRow label="Base Delivery Fee (₹)" description="Flat fee charged per delivery">
                    <Input
                      value={deliverySettings.baseDeliveryFee}
                      onChange={(e) => setDeliverySettings((p) => ({ ...p, baseDeliveryFee: e.target.value }))}
                      type="number"
                      className="w-32"
                    />
                  </SettingRow>
                  <SettingRow label="Per KM Charge (₹)" description="Additional charge per kilometer">
                    <Input
                      value={deliverySettings.perKmCharge}
                      onChange={(e) => setDeliverySettings((p) => ({ ...p, perKmCharge: e.target.value }))}
                      type="number"
                      className="w-32"
                    />
                  </SettingRow>
                  <SettingRow label="Free Delivery Above (₹)" description="Order value threshold for free delivery">
                    <Input
                      value={deliverySettings.freeDeliveryAbove}
                      onChange={(e) => setDeliverySettings((p) => ({ ...p, freeDeliveryAbove: e.target.value }))}
                      type="number"
                      className="w-32"
                    />
                  </SettingRow>
                  <SettingRow label="Max Delivery Radius (km)" description="Maximum distance for deliveries">
                    <Input
                      value={deliverySettings.maxDeliveryRadius}
                      onChange={(e) => setDeliverySettings((p) => ({ ...p, maxDeliveryRadius: e.target.value }))}
                      type="number"
                      className="w-32"
                    />
                  </SettingRow>
                  <SettingRow label="OTP Verification on Delivery" description="Require OTP from customer at delivery">
                    <Toggle
                      enabled={deliverySettings.otpVerification}
                      onChange={(v) => setDeliverySettings((p) => ({ ...p, otpVerification: v }))}
                    />
                  </SettingRow>
                  <SettingRow label="Auto-assign Rider" description="Automatically assign nearest available rider">
                    <Toggle
                      enabled={deliverySettings.autoAssignRider}
                      onChange={(v) => setDeliverySettings((p) => ({ ...p, autoAssignRider: v }))}
                    />
                  </SettingRow>
                  <SettingRow label="Scheduled Delivery" description="Allow customers to schedule deliveries">
                    <Toggle
                      enabled={deliverySettings.allowScheduledDelivery}
                      onChange={(v) => setDeliverySettings((p) => ({ ...p, allowScheduledDelivery: v }))}
                    />
                  </SettingRow>
                </div>
              )}

              {/* Subscription */}
              {activeTab === "subscription" && (
                <div>
                  {[
                    { plan: "Starter", price: "999", orders: "200", commission: "12" },
                    { plan: "Growth", price: "2499", orders: "1000", commission: "10" },
                    { plan: "Premium", price: "4999", orders: "Unlimited", commission: "8" },
                  ].map((plan) => (
                    <div key={plan.plan} className="py-5 border-b border-[#F1F5F9] last:border-0">
                      <p className="text-sm font-semibold text-[#0F172A] mb-3">{plan.plan} Plan</p>
                      <div className="grid grid-cols-3 gap-3">
                        <Input label="Monthly Price (₹)" defaultValue={plan.price} type="number" />
                        <Input label="Order Limit" defaultValue={plan.orders} />
                        <Input label="Commission %" defaultValue={plan.commission} type="number" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notifications */}
              {activeTab === "notification" && (
                <div>
                  <SettingRow label="Order Status Updates" description="Notify customers on every order status change">
                    <Toggle enabled={notifSettings.orderUpdates} onChange={(v) => setNotifSettings((p) => ({ ...p, orderUpdates: v }))} />
                  </SettingRow>
                  <SettingRow label="Promotional Emails" description="Send marketing and offer emails">
                    <Toggle enabled={notifSettings.promotionalEmails} onChange={(v) => setNotifSettings((p) => ({ ...p, promotionalEmails: v }))} />
                  </SettingRow>
                  <SettingRow label="SMS Alerts" description="Send SMS for order updates and OTP">
                    <Toggle enabled={notifSettings.smsAlerts} onChange={(v) => setNotifSettings((p) => ({ ...p, smsAlerts: v }))} />
                  </SettingRow>
                  <SettingRow label="Push Notifications" description="Send push notifications via app">
                    <Toggle enabled={notifSettings.pushNotifications} onChange={(v) => setNotifSettings((p) => ({ ...p, pushNotifications: v }))} />
                  </SettingRow>
                  <SettingRow label="Admin Alerts" description="Notify admins for critical system events">
                    <Toggle enabled={notifSettings.adminAlerts} onChange={(v) => setNotifSettings((p) => ({ ...p, adminAlerts: v }))} />
                  </SettingRow>
                </div>
              )}

              {/* Admin Users */}
              {activeTab === "admin_users" && (
                <div className="py-2">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-[#64748B]">{adminUsers.length} admin users</p>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setAddUserOpen(true)}
                    >
                      Add Admin
                    </Button>
                  </div>
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Role</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {adminUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-[#FAFAFA] transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-[#22C55E] rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-semibold">{user.name[0]}</span>
                                </div>
                                <span className="text-sm font-medium text-[#0F172A]">{user.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-[#64748B]">{user.email}</td>
                            <td className="px-4 py-3.5 text-sm text-[#0F172A]">{user.role}</td>
                            <td className="px-4 py-3.5">
                              <button className="text-[#64748B] hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Security */}
              {activeTab === "security" && (
                <div>
                  <SettingRow label="Current Password" description="Enter current password to make changes">
                    <div className="relative w-64">
                      <input
                        type={showPassword ? "text" : "password"}
                        defaultValue="••••••••••"
                        className="w-full h-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] px-3 pr-9 focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10"
                      />
                      <button
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </SettingRow>
                  <SettingRow label="New Password">
                    <Input type="password" placeholder="Enter new password" className="w-64" />
                  </SettingRow>
                  <SettingRow label="Two-Factor Authentication" description="Require 2FA for all admin logins">
                    <Toggle enabled={true} onChange={() => {}} />
                  </SettingRow>
                  <SettingRow label="Session Timeout (minutes)" description="Auto logout idle admins after this time">
                    <Select
                      value="30"
                      onChange={() => {}}
                      options={[
                        { value: "15", label: "15 minutes" },
                        { value: "30", label: "30 minutes" },
                        { value: "60", label: "1 hour" },
                        { value: "240", label: "4 hours" },
                      ]}
                      className="w-40"
                    />
                  </SettingRow>
                  <SettingRow label="IP Whitelist" description="Restrict admin access to specific IPs">
                    <Button variant="outline" size="sm">Configure</Button>
                  </SettingRow>
                  <div className="py-4">
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-red-700">Danger Zone</p>
                        <p className="text-xs text-red-500 mt-0.5">Irreversible actions — proceed with caution</p>
                      </div>
                      <Button variant="destructive" size="sm">Reset Platform</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      <Modal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        title="Add Admin User"
        description="Grant admin access to a new team member."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setAddUserOpen(false)}>Add Admin</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full Name" placeholder="e.g. Preethi Rajagopal" />
          <Input label="Email Address" placeholder="preethi@rivo.app" />
          <Select
            label="Role"
            value=""
            onChange={() => {}}
            options={[
              { value: "super_admin", label: "Super Admin" },
              { value: "support_lead", label: "Support Lead" },
              { value: "operations", label: "Operations" },
              { value: "finance", label: "Finance" },
            ]}
            placeholder="Select role"
          />
        </div>
      </Modal>
    </div>
  );
}
