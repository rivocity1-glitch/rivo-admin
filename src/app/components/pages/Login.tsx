import React, { useState } from "react";
import { Lock, Mail, RefreshCcw } from "lucide-react";
// 🟢 FIXED: Corrected relative path to match Admin Panel file architecture (src/lib/supabase.ts)
import { supabase } from "../../../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      
      // 1. Authenticate using Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData?.user) {
        throw new Error("Authentication failed. No user profile returned.");
      }

      // 2. Query the admin_users table to fetch user metadata and authorization permissions
      const { data: adminData, error: dbError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("auth_user_id", authData.user.id)
        .single();

      if (dbError || !adminData) {
        throw new Error("Admin access configuration record not found.");
      }

      // Added debugging console logs
      console.log("Authenticated User:", authData.user.id);
      console.log("Admin Record:", adminData);

      // 3. Verify user has the required privileges
      if (adminData.role !== "super_admin") {
        // Log the user back out immediately to prevent dangling valid sessions
        await supabase.auth.signOut();
        throw new Error("Access denied. Authorized administrator clearance required.");
      }
      
      // 4. Cache authorization snapshot and refresh application frame
      localStorage.setItem("rivo_admin_session", JSON.stringify(adminData));
      window.location.reload();
    } catch (err: any) {
      console.error("Login authorization error:", err);
      setErrorMessage(err.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 w-full">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A]">Welcome to Rivo</h2>
          <p className="text-sm text-[#64748B] mt-1">Admin Control Panel</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@rivo.com"
                className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 mt-2 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : "Sign In to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}