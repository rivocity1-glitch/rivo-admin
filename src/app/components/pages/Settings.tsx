import React, { useState, useEffect } from "react";
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
  RefreshCcw,
  RotateCcw,
  UserPlus
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageHeader } from "../ui/PageHeader";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

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
  { id: "subscription", label: "Subscription Rules", icon: <Crown className="w-3.5 h-3.5" /> },
  { id: "notification", label: "Notifications", icon: <Bell className="w-3.5 h-3.5" /> },
  { id: "admin_users", label: "Admin Users", icon: <UserCog className="w-3.5 h-3.5" /> },
  { id: "security", label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
];

// 🟢 All 14 Pune District Talukas compiled exactly from image_4477ce.png
const PUNE_TALUKAS = [
  { value: "Indapur", label: "Indapur Taluka" },
  { value: "Baramati", label: "Baramati Taluka" },
  { value: "Bhor", label: "Bhor Taluka" },
  { value: "Rajgad", label: "Rajgad Taluka" },
  { value: "Purandar", label: "Purandar Taluka" },
  { value: "Daund", label: "Daund Taluka" },
  { value: "Pune City", label: "Pune City Taluka" },
  { value: "Haveli", label: "Haveli Taluka" },
  { value: "Mulshi", label: "Mulshi Taluka" },
  { value: "Maval", label: "Maval Taluka" },
  { value: "Khed", label: "Khed Taluka" },
  { value: "Shirur", label: "Shirur District / Taluka" },
  { value: "Ambegaon", label: "Ambegaon Taluka" },
  { value: "Junnar", label: "Junnar Taluka" }
];

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0 disabled:opacity-40",
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

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("platform");
  const [showPassword, setShowPassword] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Administrative session nodes profiles
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "", role: "Operations" });
  const [currentAdminProfile, setCurrentAdminProfile] = useState<any>(null);

  // Platform configs state
  const [platformSettings, setPlatformSettings] = useState({
    platformName: "Rivo",
    supportEmail: "support@rivo.app",
    district: "Pune",
    taluka: "Baramati",
    maintenanceMode: false,
    allowRegistration: true,
  });

  // Delivery configuration state
  const [deliverySettings, setDeliverySettings] = useState({
    baseDeliveryFee: "25",
    perKmCharge: "5",
    freeDeliveryAbove: "500",
    maxDeliveryRadius: "10",
    otpVerification: true,
    autoAssignRider: true,
    allowScheduledDelivery: false,
  });

  // Master Notifications variables
  const [notifSettings, setNotifSettings] = useState({
    orderUpdates: true,
    promotionalEmails: false,
    smsAlerts: true,
    pushNotifications: true,
    adminAlerts: true,
  });

  // 🟢 Load settings and your user profile safely from the 'admins' table
  async function loadSystemSettings() {
    try {
      setIsLoading(true);
      
      // 1. Fetch settings key-value entries
      const { data: configData, error: configErr } = await supabase.from("platform_settings").select("*");
      if (configErr) throw configErr;

      if (configData && configData.length > 0) {
        const platformObj = configData.find(r => r.key === "platform_config");
        const deliveryObj = configData.find(r => r.key === "delivery_config");
        const notifObj = configData.find(r => r.key === "notif_config");

        if (platformObj) setPlatformSettings(platformObj.value);
        if (deliveryObj) setDeliverySettings(deliveryObj.value);
        if (notifObj) setNotifSettings(notifObj.value);
      }

      // 2. Fetch live database admin rows cleanly from the 'admins' table
      const { data: adminData, error: adminErr } = await supabase
        .from("admins") // 🟢 Wired cleanly to your exact 'admins' table name
        .select("*")
        .order("created_at", { ascending: true });

      if (adminErr) throw adminErr;
      setAdminsList(adminData || []);

      // 3. Match current login profile matching active web tokens context
      const storedSession = localStorage.getItem("rivo_admin_session");
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        const match = (adminData || []).find(a => a.email.toLowerCase() === (parsed.email || "").toLowerCase());
        if (match) setCurrentAdminProfile(match);
      } else if (adminData && adminData.length > 0) {
        setCurrentAdminProfile(adminData[0]);
      }

    } catch (err) {
      console.error("Settings schema parsing fault context:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSystemSettings();
  }, []);

  // 🟢 Save config selections directly into Supabase row parameters
  async function handleSaveConfig() {
    try {
      setIsSaving(true);
      let targetKey = "platform_config";
      let targetValue: any = platformSettings;

      if (activeTab === "delivery") {
        targetKey = "delivery_config";
        targetValue = deliverySettings;
      } else if (activeTab === "notification") {
        targetKey = "notif_config";
        targetValue = notifSettings;
      }

      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: targetKey, value: targetValue, updated_at: new Date().toISOString() });

      if (error) throw error;
      alert("Configuration changes synchronized to Supabase safely!");
    } catch (err) {
      console.error("Save config fault:", err);
      alert("Failed updating system parameters.");
    } finally {
      setIsSaving(false);
    }
  }

  // 🟢 Reset delivery bounds back to original factory rates constants
  function handleResetDeliveryDefaults() {
    const confirmation = window.confirm("Reset all delivery fees and parameters back to factory defaults?");
    if (!confirmation) return;

    setDeliverySettings({
      baseDeliveryFee: "25",
      perKmCharge: "5",
      freeDeliveryAbove: "500",
      maxDeliveryRadius: "10",
      otpVerification: true,
      autoAssignRider: true,
      allowScheduledDelivery: false,
    });
    alert("Delivery attributes reset locally. Click 'Save Config changes' to push changes live to Supabase!");
  }

  // 🟢 Provision fresh user profile admins inside the 'admins' table
  async function handleCreateAdminNode() {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      alert("Please provide complete credentials to instantiate the profile admin.");
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase.from("admins").insert([newAdmin]); // 🟢 Updated to 'admins'
      if (error) throw error;

      setNewAdmin({ name: "", email: "", password: "", role: "Operations" });
      setAddUserOpen(false);
      await loadSystemSettings();
      alert("Operational admin successfully whitelisted!");
    } catch (err) {
      console.error("Admin provision error context:", err);
    } finally {
      setIsSaving(false);
    }
  }

  // 🟢 Remove admin access node privileges
  async function handleDeleteAdmin(id: string, name: string) {
    if (adminsList.length <= 1) {
      alert("Cannot truncate the last remaining authorization personnel account.");
      return;
    }
    const confirmation = window.confirm(`Permanently remove dashboard privileges for "${name}"?`);
    if (!confirmation) return;

    try {
      const { error } = await supabase.from("admins").delete().eq("id", id); // 🟢 Updated to 'admins'
      if (error) throw error;
      await loadSystemSettings();
    } catch (err) {
      console.error("Admin cleanup truncation block failure:", err);
    }
  }

  // 🟢 Mutate security password tokens properties entries
  async function handleMutatePassword(newPass: string) {
    if (!currentAdminProfile || !newPass.trim()) return;
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("admins") // 🟢 Updated to 'admins'
        .update({ password: newPass.trim(), name: currentAdminProfile.name })
        .eq("id", currentAdminProfile.id);

      if (error) throw error;
      alert("Credentials tokens re-mapped successfully inside your Supabase 'admins' table!");
      await loadSystemSettings();
    } catch (err) {
      console.error("Security credentials rewrite error block:", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Configure global system variables, logistics fee formulas, and workspace permissions." />

      <div className="flex gap-6 relative z-10">
        {/* Navigation Tabs sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="bg-white border border-[#E2E8F0] rounded-xl p-2 space-y-0.5 shadow-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left",
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

        {/* Workspace Display panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] rounded-t-xl">
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                {tabs.find((t) => t.id === activeTab)?.label} Control Setup
              </h2>
              {activeTab !== "admin_users" && activeTab !== "subscription" && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isLoading || isSaving}
                  leftIcon={isSaving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveConfig}
                >
                  {isSaving ? "Saving..." : "Save Config changes"}
                </Button>
              )}
            </div>

            <div className="px-6 py-2 min-h-[380px]">
              {isLoading ? (
                <div className="text-center py-24 text-xs font-medium text-[#94A3B8]">Syncing structural configurations from table definitions...</div>
              ) : (
                <>
                  {/* Platform Tab */}
                  {activeTab === "platform" && (
                    <div className="divide-y divide-[#F1F5F9]">
                      <SettingRow label="Platform Brand Identity Name" description="Displayed across global customer and vendor checkout screens">
                        <Input value={platformSettings.platformName} onChange={(e) => setPlatformSettings((p) => ({ ...p, platformName: e.target.value }))} className="w-64 text-xs font-semibold" />
                      </SettingRow>
                      <SettingRow label="Gateway Support Helpdesk Email" description="Central mailbox receiving customer troubleshooting requests">
                        <Input value={platformSettings.supportEmail} onChange={(e) => setPlatformSettings((p) => ({ ...p, supportEmail: e.target.value }))} className="w-64 text-xs font-semibold" />
                      </SettingRow>
                      <SettingRow label="Operational State Region Assignment">
                        <Select value="MH" onChange={() => {}} options={[{ value: "MH", label: "Maharashtra (MH)" }]} className="w-64 text-xs font-semibold" disabled />
                      </SettingRow>
                      <SettingRow label="Target District Scope Profile (Jilha)">
                        <Select value={platformSettings.district} onChange={(v) => setPlatformSettings((p) => ({ ...p, district: v }))} options={[{ value: "Pune", label: "Pune District" }]} className="w-64 text-xs font-semibold" />
                      </SettingRow>
                      {/* 🟢 Select dropdown matching all 14 Pune Talukas sequentially from image_4477ce.png */}
                      <SettingRow label="Active Taluka Branch Area" description="Select the specific neighborhood sub-zone operational endpoint">
                        <Select 
                          value={platformSettings.taluka} 
                          onChange={(v) => setPlatformSettings((p) => ({ ...p, taluka: v }))} 
                          options={PUNE_TALUKAS} 
                          className="w-64 text-xs font-semibold" 
                        />
                      </SettingRow>
                      <SettingRow label="Emergency Maintenance Blockade Mode" description="Temporarily disconnects merchant checkout capabilities system-wide">
                        <Toggle enabled={platformSettings.maintenanceMode} onChange={(v) => setPlatformSettings((p) => ({ ...p, maintenanceMode: v }))} />
                      </SettingRow>
                      <SettingRow label="Allow Onboarding Registrations" description="Controls whether public customers and riders can register profiles from mobile endpoints">
                        <Toggle enabled={platformSettings.allowRegistration} onChange={(v) => setPlatformSettings((p) => ({ ...p, allowRegistration: v }))} />
                      </SettingRow>
                    </div>
                  )}

                  {/* Delivery Parameters Tab */}
                  {activeTab === "delivery" && (
                    <div>
                      <div className="divide-y divide-[#F1F5F9]">
                        <SettingRow label="Base Delivery Starting Fee (₹)" description="Baseline starting delivery fee charged on orders">
                          <Input value={deliverySettings.baseDeliveryFee} onChange={(e) => setDeliverySettings((p) => ({ ...p, baseDeliveryFee: e.target.value }))} type="number" className="w-32 text-xs font-semibold" />
                        </SettingRow>
                        <SettingRow label="Per Kilometer Distance Increment Charge (₹)" description="Additional fee accumulated per kilometer traveled from vendor location">
                          <Input value={deliverySettings.perKmCharge} onChange={(e) => setDeliverySettings((p) => ({ ...p, perKmCharge: e.target.value }))} type="number" className="w-32 text-xs font-semibold" />
                        </SettingRow>
                        <SettingRow label="Free Delivery Capital Cutoff Threshold (₹)" description="Order basket total that overrides delivery distance costs">
                          <Input value={deliverySettings.freeDeliveryAbove} onChange={(e) => setDeliverySettings((p) => ({ ...p, freeDeliveryAbove: e.target.value }))} type="number" className="w-32 text-xs font-semibold" />
                        </SettingRow>
                        <SettingRow label="Maximum Logistics Radius Constraint (km)" description="Hard limit circle cutoff for delivery availability search zones">
                          <Input value={deliverySettings.maxDeliveryRadius} onChange={(e) => setDeliverySettings((p) => ({ ...p, maxDeliveryRadius: e.target.value }))} type="number" className="w-32 text-xs font-semibold" />
                        </SettingRow>
                        <SettingRow label="Mandatory Secure OTP Checkpoint Handover" description="Requires a mobile verification token to confirm delivery completions">
                          <Toggle enabled={deliverySettings.otpVerification} onChange={(v) => setDeliverySettings((p) => ({ ...p, otpVerification: v }))} />
                        </SettingRow>
                        <SettingRow label="Automated Smart Rider Fulfillment Assignment" description="Instantly alerts the nearest available driver when a vendor packs an order">
                          <Toggle enabled={deliverySettings.autoAssignRider} onChange={(v) => setDeliverySettings((p) => ({ ...p, autoAssignRider: v }))} />
                        </SettingRow>
                      </div>
                      <div className="mt-4 pt-4 border-t border-[#E2E8F0] text-left">
                        <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleResetDeliveryDefaults}>
                          Reset to Factory Defaults
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Subscriptions Overview */}
                  {activeTab === "subscription" && (
                    <div>
                      {[
                        { plan: "Free Tier Plan Profile", price: "0", commission: "5", label: "Capped at standard 5% order commission cut framework." },
                        { plan: "Premium Membership Tier Plan", price: "499", commission: "0", label: "Fixed pricing framework — 0% platform commission constraints token rules." },
                      ].map((p, i) => (
                        <div key={i} className="py-5 border-b border-[#F1F5F9] last:border-0">
                          <p className="text-xs font-bold text-[#0F172A] mb-1">{p.plan}</p>
                          <p className="text-[11px] text-[#64748B] mb-3 font-medium">{p.label}</p>
                          <div className="grid grid-cols-3 gap-4">
                            <Input label="Monthly Rate Base (₹)" defaultValue={p.price} disabled className="text-xs font-semibold" />
                            <Input label="Order Volume Ceiling Limit" defaultValue="Unlimited Orders (No capping thresholds)" disabled className="text-xs font-semibold" />
                            <Input label="Commission Deduct Percentage %" defaultValue={p.commission} disabled className="text-xs font-semibold" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notifications Master Switches */}
                  {activeTab === "notification" && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl p-4 font-medium leading-relaxed">
                        💡 **Master Switch Controls Indicator:** Use these toggles to silence or allow systemic automatic dispatches (like automated SMS OTP vectors or customer push popups) globally.
                      </div>
                      <div className="divide-y divide-[#F1F5F9]">
                        <SettingRow label="Automated Order Lifecycle Updates" description="Dispatches system push alerts automatically when order state updates occur">
                          <Toggle enabled={notifSettings.orderUpdates} onChange={(v) => setNotifSettings((p) => ({ ...p, orderUpdates: v }))} />
                        </SettingRow>
                        <SettingRow label="Promotional Content Blasts Campaigning" description="Permits processing marketing newsletters and system blast messages safely">
                          <Toggle enabled={notifSettings.promotionalEmails} onChange={(v) => setNotifSettings((p) => ({ ...p, promotionalEmails: v }))} />
                        </SettingRow>
                        <SettingRow label="Cellular Telephony Carrier SMS Alerts" description="Sends out text alerts for critical path order dispatches and handshake OTP handshakes">
                          <Toggle enabled={notifSettings.smsAlerts} onChange={(v) => setNotifSettings((p) => ({ ...p, smsAlerts: v }))} />
                        </SettingRow>
                        <SettingRow label="High-Priority App Push Notification Streams" description="Triggers push banners directly to active connected mobile device trays">
                          <Toggle enabled={notifSettings.pushNotifications} onChange={(v) => setNotifSettings((p) => ({ ...p, pushNotifications: v }))} />
                        </SettingRow>
                      </div>
                    </div>
                  )}

                  {/* Admin Users Roster from 'admins' table */}
                  {activeTab === "admin_users" && (
                    <div className="py-2">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-[#64748B] font-medium">{adminsList.length} system administrator profiles loaded</p>
                        <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setAddUserOpen(true)}>Add New Operator</Button>
                      </div>
                      <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                              <th className="text-left px-4 py-3 font-medium text-[#64748B] uppercase tracking-wide">Name / Operator Account</th>
                              <th className="text-left px-4 py-3 font-medium text-[#64748B] uppercase tracking-wide">Email Reference</th>
                              <th className="text-left px-4 py-3 font-medium text-[#64748B] uppercase tracking-wide">Permission Role</th>
                              <th className="px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#334155]">
                            {adminsList.map((user) => (
                              <tr key={user.id} className="hover:bg-[#FAFAFA] transition-colors">
                                <td className="px-4 py-3.5 flex items-center gap-2.5">
                                  <div className="w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center text-white text-[10px] font-bold">{user.name ? user.name[0].toUpperCase() : "A"}</div>
                                  <span className="font-bold text-[#0F172A]">{user.name}</span>
                                </td>
                                <td className="px-4 py-3.5 text-[#64748B] font-mono">{user.email}</td>
                                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10px] text-slate-700 border border-slate-200">{user.role}</span></td>
                                <td className="px-4 py-3.5 text-right">
                                  <button onClick={() => handleDeleteAdmin(user.id, user.name)} className="text-[#94A3B8] hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Security Settings Manager Panel context view */}
                  {activeTab === "security" && currentAdminProfile && (
                    <div className="divide-y divide-[#F1F5F9]">
                      <SettingRow label="Logged In Username Identity Context">
                        <Input 
                          value={currentAdminProfile.name || ""} 
                          onChange={(e) => setCurrentAdminProfile((prev: any) => ({ ...prev, name: e.target.value }))}
                          className="w-64 text-xs font-bold" 
                        />
                      </SettingRow>
                      <SettingRow label="Account Access Permission Role Scope">
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase">{currentAdminProfile.role}</span>
                      </SettingRow>
                      <SettingRow label="Active Plaintext Password Token" description="Inspect or rewrite your profile database credentials code key string">
                        <div className="relative w-64">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            value={currentAdminProfile.password || ""} 
                            onChange={(e) => {
                              const updatedPass = e.target.value;
                              setCurrentAdminProfile((prev: any) => ({ ...prev, password: updatedPass }));
                            }}
                            className="w-full h-9 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] px-3 pr-9 focus:outline-none focus:border-[#22C55E]" 
                          />
                          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]">
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </SettingRow>
                      <div className="py-4 text-left">
                        <Button variant="primary" size="sm" disabled={isSaving} onClick={() => handleMutatePassword(currentAdminProfile.password)}>
                          Commit Password & Identity Reset
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Onboard Operator Modal overlay */}
      <Modal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        title="Onboard New Operational Admin Profile"
        description="Provision platform administration permissions tokens to team personnel nodes."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateAdminNode}>Onboard Admin User</Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <Input label="Full Name" placeholder="e.g. Aditya Menon" value={newAdmin.name} onChange={(e) => setNewAdmin(p => ({ ...p, name: e.target.value }))} />
          <Input label="Account Communication Email Address" placeholder="aditya@rivo.app" value={newAdmin.email} onChange={(e) => setNewAdmin(p => ({ ...p, email: e.target.value }))} />
          <Input label="Secret Account Password Entry" type="text" placeholder="Specify password..." value={newAdmin.password} onChange={(e) => setNewAdmin(p => ({ ...p, password: e.target.value }))} />
          <Select 
            label="Dashboard Permission Level Role" 
            value={newAdmin.role} 
            onChange={(v) => setNewAdmin(p => ({ ...p, role: v }))} 
            options={[{ value: "Super Admin", label: "Super Admin" }, { value: "Support Lead", label: "Support Lead" }, { value: "Operations", label: "Operations" }]} 
          />
        </div>
      </Modal>
    </div>
  );
}