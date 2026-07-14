import React, { useState, useEffect } from "react";
import {
  Globe,
  UserCog,
  Shield,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  Search,
  Sun,
  Moon,
  Laptop,
  Upload,
  X
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageHeader } from "../ui/PageHeader";
import { Modal } from "../ui/Modal";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type SettingsTab = "platform" | "admin_users" | "security";

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { id: "platform", label: "Platform", icon: <Globe className="w-3.5 h-3.5" /> },
  { id: "admin_users", label: "Admin Users", icon: <UserCog className="w-3.5 h-3.5" /> },
  { id: "security", label: "Security", icon: <Shield className="w-3.5 h-3.5" /> },
];

const PUNE_TALUKAS = [
  { value: "Indapur", label: "Indapur" },
  { value: "Baramati", label: "Baramati" },
  { value: "Bhor", label: "Bhor" },
  { value: "Rajgad", label: "Rajgad" },
  { value: "Purandar", label: "Purandar" },
  { value: "Daund", label: "Daund" },
  { value: "Pune City", label: "Pune City" },
  { value: "Haveli", label: "Haveli" },
  { value: "Mulshi", label: "Mulshi" },
  { value: "Maval", label: "Maval" },
  { value: "Khed", label: "Khed" },
  { value: "Shirur", label: "Shirur" },
  { value: "Ambegaon", label: "Ambegaon" },
  { value: "Junnar", label: "Junnar" }
];

interface ToastMessage {
  type: "success" | "error";
  text: string;
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0 disabled:opacity-40 focus:outline-none",
        enabled ? "bg-[#22C55E]" : "bg-[#CBD5E1] dark:bg-slate-700"
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

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
      enabled ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
    )}>
      <span className={cn("w-1.5 h-1.5 mr-1.5 rounded-full", enabled ? "bg-green-500" : "bg-red-500")} />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-[#F1F5F9] dark:border-slate-800 last:border-0 gap-2">
      <div className="mr-8">
        <p className="text-sm font-medium text-[#0F172A] dark:text-slate-200">{label}</p>
        {description && <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 flex items-center gap-3">{children}</div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-5/6" />
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-2/3" />
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("platform");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newArea, setNewArea] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ full_name: "", email: "", role: "Operations" });
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [adminToDelete, setAdminToDelete] = useState<any>(null);
  const [currentAdminProfile, setCurrentAdminProfile] = useState<any>(null);

  const [platformSettings, setPlatformSettings] = useState({
    platformName: "",
    companyName: "",
    appName: "",
    supportEmail: "",
    supportPhone: "",
    gstNumber: "",
    panNumber: "",
    address: "",
    district: "",
    taluka: "",
    maxDeliveryRadius: "",
    deliveryAreas: [] as string[],
    maintenanceMode: false,
    allowVendorRegistration: false,
    allowRiderRegistration: false,
    allowCustomerRegistration: false,
    platformLogo: ""
  });

  const [systemMeta, setSystemMeta] = useState({
    created_at: "",
    updated_at: ""
  });

  const [appTheme, setAppTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("rivo-theme") as "light" | "dark" | "system") || "system";
  });

  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleThemeChange = (targetTheme: "light" | "dark" | "system") => {
    setAppTheme(targetTheme);
    localStorage.setItem("rivo-theme", targetTheme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (targetTheme === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(systemDark ? "dark" : "light");
    } else {
      root.classList.add(targetTheme);
    }
  };

  async function loadSettings() {
    try {
      setIsLoading(true);
      
      const { data: configData, error: configErr } = await supabase.from("platform_settings").select("*");
      if (configErr) throw configErr;

      if (configData && configData.length > 0) {
        const platformObj = configData.find(r => r.key === "platform_config");
        if (platformObj?.value) {
          setPlatformSettings(prev => ({
            ...prev,
            ...platformObj.value,
            deliveryAreas: Array.isArray(platformObj.value.deliveryAreas) ? platformObj.value.deliveryAreas : []
          }));
        }
        if (platformObj) {
          setSystemMeta({
            created_at: platformObj.created_at || "",
            updated_at: platformObj.updated_at || ""
          });
        }
      }

      const { data: adminData, error: adminErr } = await supabase
        .from("admin_users") 
        .select("*")
        .order("created_at", { ascending: true });

      if (adminErr) throw adminErr;
      setAdminsList(adminData || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const match = (adminData || []).find(a => a.auth_user_id === user.id);
        if (match) setCurrentAdminProfile(match);
      }
    } catch (err: any) {
      triggerToast("Failed to load settings.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSaveConfig() {
    try {
      setIsSaving(true);
      if (Number(platformSettings.maxDeliveryRadius) < 0) {
        throw new Error("Delivery radius cannot be negative.");
      }

      const { error } = await supabase
        .from("platform_settings")
        .upsert({ 
          key: "platform_config", 
          value: platformSettings, 
          updated_at: new Date().toISOString() 
        });

      if (error) throw error;
      triggerToast("Settings saved successfully.");
      await loadSettings();
    } catch (err: any) {
      triggerToast(err.message || "Failed to save settings.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const handleAddArea = () => {
    if (!newArea.trim()) return;
    if (platformSettings.deliveryAreas.includes(newArea.trim())) {
      triggerToast("Area already exists.", "error");
      return;
    }
    setPlatformSettings(prev => ({
      ...prev,
      deliveryAreas: [...prev.deliveryAreas, newArea.trim()]
    }));
    setNewArea("");
  };

  const handleRemoveArea = (areaToRemove: string) => {
    setPlatformSettings(prev => ({
      ...prev,
      deliveryAreas: prev.deliveryAreas.filter(area => area !== areaToRemove)
    }));
  };

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `platform-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("platform-assets").getPublicUrl(filePath);
      
      setPlatformSettings(prev => ({ ...prev, platformLogo: data.publicUrl }));
      triggerToast("Logo uploaded successfully.");
    } catch (err: any) {
      triggerToast("Failed to upload logo.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  // PLACEHOLDER: Auth user creation is handled securely via backend environment.
  async function handleCreateAdminNodePlaceholder() {
    triggerToast("Backend authorization endpoint required.", "error");
  }

  async function handleSaveEditAdmin() {
    if (!editingAdmin?.full_name) {
      triggerToast("Full Name is required.", "error");
      return;
    }
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("admin_users")
        .update({ full_name: editingAdmin.full_name, role: editingAdmin.role })
        .eq("id", editingAdmin.id);

      if (error) throw error;
      setEditUserOpen(false);
      await loadSettings();
      triggerToast("Admin profile updated.");
    } catch (err: any) {
      triggerToast("Failed to update admin.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAdminExecute() {
    if (!adminToDelete) return;
    if (adminsList.length <= 1) {
      triggerToast("Cannot delete the only remaining admin account.", "error");
      setDeleteConfirmOpen(false);
      return;
    }
    try {
      setIsSaving(true);
      const { error } = await supabase.from("admin_users").delete().eq("id", adminToDelete.id);
      if (error) throw error;
      setDeleteConfirmOpen(false);
      setAdminToDelete(null);
      await loadSettings();
      triggerToast("Admin deleted.");
    } catch (err: any) {
      triggerToast("Failed to delete admin.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProfileOnly() {
    if (!currentAdminProfile?.full_name?.trim()) {
      triggerToast("Full name cannot be empty.", "error");
      return;
    }
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("admin_users") 
        .update({ full_name: currentAdminProfile.full_name.trim() })
        .eq("id", currentAdminProfile.id);

      if (error) throw error;
      triggerToast("Profile updated.");
      await loadSettings();
    } catch (err: any) {
      triggerToast("Failed to update profile.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordResetTrigger() {
    if (!currentAdminProfile?.email) return;
    try {
      setIsSaving(true);
      const { error } = await supabase.auth.resetPasswordForEmail(currentAdminProfile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      triggerToast("Password reset email sent.");
    } catch (err: any) {
      triggerToast("Failed to send reset email.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshSessionTrigger() {
    try {
      setIsSaving(true);
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
      triggerToast("Session refreshed.");
    } catch (err: any) {
      triggerToast("Failed to refresh session.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOutTrigger() {
    try {
      setIsSaving(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      triggerToast("Signed out successfully.");
    } catch (err: any) {
      triggerToast("Failed to sign out.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const filteredAdmins = adminsList.filter(admin => 
    admin.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    admin.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const supabaseUrl = (supabase as any).supabaseUrl || "Connected Cloud Instance";

  return (
    <div className="transition-colors duration-200 min-h-screen pb-12 relative">
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-xl text-xs font-semibold shadow-lg border",
          toast.type === "success" ? "bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]" : "bg-red-50 text-red-700 border-red-200"
        )}>
          {toast.text}
        </div>
      )}

      <PageHeader title="Settings" description="Manage system configurations, service parameters, and administrative accounts." />

      <div className="flex flex-col md:flex-row gap-6 mt-6">
        <div className="w-full md:w-56 flex-shrink-0">
          <nav className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-2 space-y-0.5 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 text-left focus:outline-none",
                  activeTab === tab.id
                    ? "bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#16A34A] dark:text-[#22C55E]"
                    : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#0F172A] dark:hover:text-slate-200"
                )}
              >
                <span className={activeTab === tab.id ? "text-[#22C55E]" : "text-[#94A3B8] dark:text-slate-500"}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-900/40 rounded-t-xl">
              <h2 className="text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider">
                {tabs.find((t) => t.id === activeTab)?.label} Settings
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading || isSaving}
                  leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
                  onClick={loadSettings}
                >
                  Refresh
                </Button>
                {activeTab === "platform" && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isLoading || isSaving}
                    leftIcon={isSaving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    onClick={handleSaveConfig}
                  >
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                )}
              </div>
            </div>

            <div className="px-6 py-4 min-h-[380px]">
              {isLoading ? (
                <SkeletonLoader />
              ) : (
                <>
                  {activeTab === "platform" && (
                    <div className="space-y-6 divide-y divide-[#F1F5F9] dark:divide-slate-800">
                      
                      {/* Theme Row */}
                      <SettingRow label="Theme Setup" description="Manage visual layout modes across the application dashboard interface.">
                        <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-slate-800 p-1.5 border border-[#E2E8F0] dark:border-slate-700 rounded-xl shadow-inner">
                          {(["light", "dark", "system"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleThemeChange(t)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 capitalize focus:outline-none",
                                appTheme === t
                                  ? "bg-white dark:bg-slate-700 text-[#16A34A] dark:text-[#22C55E] shadow-md"
                                  : "text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200"
                              )}
                            >
                              {t === "light" && <Sun className="w-4 h-4 text-amber-500" />}
                              {t === "dark" && <Moon className="w-4 h-4 text-indigo-400" />}
                              {t === "system" && <Laptop className="w-4 h-4 text-slate-400" />}
                              {t}
                            </button>
                          ))}
                        </div>
                      </SettingRow>

                      {/* 1. Platform Information */}
                      <div className="pt-4 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Information</h3>
                        <SettingRow label="Platform Name"><Input value={platformSettings.platformName} onChange={(e) => setPlatformSettings((p) => ({ ...p, platformName: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Company Name"><Input value={platformSettings.companyName} onChange={(e) => setPlatformSettings((p) => ({ ...p, companyName: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="App Name"><Input value={platformSettings.appName} onChange={(e) => setPlatformSettings((p) => ({ ...p, appName: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Support Email"><Input value={platformSettings.supportEmail} onChange={(e) => setPlatformSettings((p) => ({ ...p, supportEmail: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Support Phone"><Input value={platformSettings.supportPhone} onChange={(e) => setPlatformSettings((p) => ({ ...p, supportPhone: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="GST Number"><Input value={platformSettings.gstNumber} onChange={(e) => setPlatformSettings((p) => ({ ...p, gstNumber: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="PAN Number"><Input value={platformSettings.panNumber} onChange={(e) => setPlatformSettings((p) => ({ ...p, panNumber: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Registered Address"><Input value={platformSettings.address} onChange={(e) => setPlatformSettings((p) => ({ ...p, address: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                      </div>

                      {/* 2. Service Area */}
                      <div className="pt-4 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Service Area</h3>
                        <SettingRow label="District"><Input value={platformSettings.district} onChange={(e) => setPlatformSettings((p) => ({ ...p, district: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Taluka Scope"><Select value={platformSettings.taluka} onChange={(v) => setPlatformSettings((p) => ({ ...p, taluka: v }))} options={PUNE_TALUKAS} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        <SettingRow label="Maximum Delivery Radius (KM)"><Input type="number" value={platformSettings.maxDeliveryRadius} onChange={(e) => setPlatformSettings((p) => ({ ...p, maxDeliveryRadius: e.target.value }))} className="w-64 text-xs dark:bg-slate-800" /></SettingRow>
                        
                        <div className="py-4 border-b border-[#F1F5F9] dark:border-slate-800 last:border-0">
                          <p className="text-sm font-medium text-[#0F172A] dark:text-slate-200 mb-2">Delivery Areas</p>
                          <div className="flex gap-2 max-w-md mb-3">
                            <Input placeholder="Enter pincode or location tag" value={newArea} onChange={(e) => setNewArea(e.target.value)} className="text-xs dark:bg-slate-800" />
                            <Button variant="secondary" size="sm" onClick={handleAddArea}><Plus className="w-4 h-4 mr-1" />Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {platformSettings.deliveryAreas.length === 0 ? (
                              <p className="text-xs text-slate-400">No active delivery areas specified.</p>
                            ) : (
                              platformSettings.deliveryAreas.map((area) => (
                                <span key={area} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                                  {area}
                                  <button type="button" onClick={() => handleRemoveArea(area)} className="text-slate-400 hover:text-red-500 rounded focus:outline-none"><X className="w-3 h-3" /></button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 3. Platform Controls */}
                      <div className="pt-4 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Controls</h3>
                        <SettingRow label="Maintenance Mode"><StatusBadge enabled={platformSettings.maintenanceMode} /><Toggle enabled={platformSettings.maintenanceMode} onChange={(v) => setPlatformSettings((p) => ({ ...p, maintenanceMode: v }))} /></SettingRow>
                        <SettingRow label="Allow Vendor Registration"><StatusBadge enabled={platformSettings.allowVendorRegistration} /><Toggle enabled={platformSettings.allowVendorRegistration} onChange={(v) => setPlatformSettings((p) => ({ ...p, allowVendorRegistration: v }))} /></SettingRow>
                        <SettingRow label="Allow Rider Registration"><StatusBadge enabled={platformSettings.allowRiderRegistration} /><Toggle enabled={platformSettings.allowRiderRegistration} onChange={(v) => setPlatformSettings((p) => ({ ...p, allowRiderRegistration: v }))} /></SettingRow>
                        <SettingRow label="Allow Customer Registration"><StatusBadge enabled={platformSettings.allowCustomerRegistration} /><Toggle enabled={platformSettings.allowCustomerRegistration} onChange={(v) => setPlatformSettings((p) => ({ ...p, allowCustomerRegistration: v }))} /></SettingRow>
                      </div>

                      {/* 4. Branding */}
                      <div className="pt-4 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Branding</h3>
                        <div className="py-4 border-b border-[#F1F5F9] dark:border-slate-800 last:border-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <p className="text-sm font-medium text-[#0F172A] dark:text-slate-200">Upload Platform Logo</p>
                            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Recommended format: transparent PNG asset.</p>
                          </div>
                          <div className="flex items-center gap-4">
                            {platformSettings.platformLogo && (
                              <div className="w-14 h-14 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-1 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
                                <img src={platformSettings.platformLogo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                              </div>
                            )}
                            <label className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm border-dashed">
                              <Upload className="w-3.5 h-3.5 text-slate-400" />
                              Choose File
                              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* 5. System Information */}
                      <div className="pt-4 space-y-4 border-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-[#64748B] dark:text-slate-400 font-medium">Current Admin</p>
                            <p className="text-slate-900 dark:text-slate-200 font-bold mt-1 truncate">{currentAdminProfile?.full_name || currentAdminProfile?.email || "N/A"}</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-[#64748B] dark:text-slate-400 font-medium">Current Theme</p>
                            <p className="text-slate-900 dark:text-slate-200 font-bold mt-1 capitalize">{appTheme}</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-[#64748B] dark:text-slate-400 font-medium">Supabase Project URL</p>
                            <p className="text-slate-900 dark:text-slate-200 font-mono mt-1 truncate">{supabaseUrl}</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-[#64748B] dark:text-slate-400 font-medium">Created Date</p>
                            <p className="text-slate-900 dark:text-slate-200 font-mono mt-1">
                              {systemMeta.created_at ? new Date(systemMeta.created_at).toLocaleString() : "N/A"}
                            </p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl sm:col-span-2">
                            <p className="text-[#64748B] dark:text-slate-400 font-medium">Last Updated</p>
                            <p className="text-slate-900 dark:text-slate-200 font-mono mt-1">
                              {systemMeta.updated_at ? new Date(systemMeta.updated_at).toLocaleString() : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {activeTab === "admin_users" && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <input
                            type="text"
                            placeholder="Search admin users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 h-9 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs font-medium text-[#0F172A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#22C55E]"
                          />
                        </div>
                        <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddUserOpen(true)}>
                          Create Admin
                        </Button>
                      </div>

                      {filteredAdmins.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-[#E2E8F0] dark:border-slate-800 rounded-xl">
                          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">No admin accounts matched your criteria.</p>
                        </div>
                      ) : (
                        <div className="border border-[#E2E8F0] dark:border-slate-800 rounded-xl overflow-x-auto">
                          <table className="w-full text-xs min-w-[600px]">
                            <thead>
                              <tr className="bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-[#E2E8F0] dark:border-slate-800">
                                <th className="text-left px-5 py-3.5 font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">Name</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">Email</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">Role</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">Status</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wide">Created Date</th>
                                <th className="px-5 py-3.5 w-24" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9] dark:divide-slate-800 text-[#334155] dark:text-slate-300 font-medium">
                              {filteredAdmins.map((user) => (
                                <tr key={user.id} className="hover:bg-[#FAFAFA] dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="px-5 py-3.5 flex items-center gap-2.5">
                                    <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                      {user.full_name ? user.full_name[0].toUpperCase() : "A"}
                                    </div>
                                    <span className="font-bold text-[#0F172A] dark:text-slate-200">{user.full_name}</span>
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-slate-500 dark:text-slate-400">{user.email}</td>
                                  <td className="px-5 py-3.5">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">Active</span>
                                  </td>
                                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                                  </td>
                                  <td className="px-5 py-3.5 text-right space-x-3">
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => {
                                        setEditingAdmin(user);
                                        setEditUserOpen(true);
                                      }}
                                      className="text-slate-400 hover:text-emerald-500 transition-colors text-xs font-semibold focus:outline-none inline-block"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => {
                                        setAdminToDelete(user);
                                        setDeleteConfirmOpen(true);
                                      }}
                                      className="text-slate-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50 focus:outline-none inline-block vertical-align-middle"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "security" && currentAdminProfile && (
                    <div className="space-y-4">
                      <div className="p-5 border border-[#E2E8F0] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl space-y-4 max-w-2xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="text-slate-400 font-medium">Email Address</label>
                            <p className="text-slate-900 dark:text-slate-200 font-mono mt-0.5 font-semibold">{currentAdminProfile.email}</p>
                          </div>
                          <div>
                            <label className="text-slate-400 font-medium">Access Role</label>
                            <p className="mt-0.5"><span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#22C55E] border border-emerald-100 dark:border-emerald-900/30 font-bold text-[10px] uppercase">{currentAdminProfile.role}</span></p>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-slate-400 font-medium">Created Date</label>
                            <p className="text-slate-900 dark:text-slate-200 font-mono mt-0.5">{currentAdminProfile.created_at ? new Date(currentAdminProfile.created_at).toLocaleString() : "N/A"}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                          <Input
                            value={currentAdminProfile.full_name || ""}
                            onChange={(e) => setCurrentAdminProfile((prev: any) => ({ ...prev, full_name: e.target.value }))}
                            className="max-w-md text-xs dark:bg-slate-800"
                          />
                        </div>
                      </div>

                      <div className="py-4 flex flex-wrap gap-2 justify-start">
                        <Button variant="primary" size="sm" disabled={isSaving} leftIcon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveProfileOnly}>
                          Save Profile
                        </Button>
                        <Button variant="outline" size="sm" disabled={isSaving} onClick={handlePasswordResetTrigger}>
                          Send Password Reset Email
                        </Button>
                        <Button variant="outline" size="sm" disabled={isSaving} onClick={handleRefreshSessionTrigger}>
                          Refresh Session
                        </Button>
                        <Button variant="secondary" size="sm" disabled={isSaving} onClick={handleSignOutTrigger}>
                          Sign Out
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

      {/* CREATE ADMIN MODAL */}
      <Modal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        title="Create New Admin User"
        description="Configure dynamic mapping settings parameters."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddUserOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateAdminNodePlaceholder} disabled={isSaving}>
              Create Admin
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-left">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            Admin creation requires a secure backend endpoint or Supabase Edge Function.
          </div>
          <Input label="Full Name" placeholder="John Doe" value={newAdmin.full_name} onChange={(e) => setNewAdmin(p => ({ ...p, full_name: e.target.value }))} className="dark:bg-slate-800" />
          <Input label="Email Address" placeholder="john@company.com" value={newAdmin.email} onChange={(e) => setNewAdmin(p => ({ ...p, email: e.target.value }))} className="dark:bg-slate-800" />
          <Select
            label="System Permissions Role"
            value={newAdmin.role}
            onChange={(v) => setNewAdmin(p => ({ ...p, role: v }))}
            options={[
              { value: "Super Admin", label: "Super Admin" },
              { value: "Support Lead", label: "Support Lead" },
              { value: "Operations", label: "Operations" }
            ]}
            className="dark:bg-slate-800"
          />
        </div>
      </Modal>

      {/* EDIT ADMIN MODAL */}
      <Modal
        open={editUserOpen}
        onClose={() => setEditUserOpen(false)}
        title="Edit Admin User"
        description="Update allocation attributes parameters context details."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUserOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditAdmin} disabled={isSaving}>
              Save Changes
            </Button>
          </>
        }
      >
        {editingAdmin && (
          <div className="space-y-4 text-left">
            <Input label="Full Name" value={editingAdmin.full_name} onChange={(e) => setEditingAdmin((p: any) => ({ ...p, full_name: e.target.value }))} className="dark:bg-slate-800" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Email Address (Read Only)</label>
              <Input value={editingAdmin.email} disabled className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" />
            </div>
            <Select
              label="System Permissions Role"
              value={editingAdmin.role}
              onChange={(v) => setEditingAdmin((p: any) => ({ ...p, role: v }))}
              options={[
                { value: "Super Admin", label: "Super Admin" },
                { value: "Support Lead", label: "Support Lead" },
                { value: "Operations", label: "Operations" }
              ]}
              className="dark:bg-slate-800"
            />
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Removal Action"
        description="Are you sure you want to delete this admin account? This action cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              variant="secondary" 
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={handleDeleteAdminExecute} 
              disabled={isSaving}
            >
              Delete Admin
            </Button>
          </>
        }
      >
        {adminToDelete && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{adminToDelete.full_name}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">{adminToDelete.email}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}