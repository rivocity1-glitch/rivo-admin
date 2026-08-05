// supabase/functions/delete-user/index.ts
import { withSupabase } from "../_shared/withSupabase.ts";

export default withSupabase(async (req, ctx) => {
  try {
    // 1. Keep existing authorization check
    if (!ctx.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Authentication required.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: adminUser, error: adminError } = await ctx.supabase
      .from("admin_users")
      .select("role")
      .eq("auth_user_id", ctx.user.id)
      .maybesingle();

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Admin profile not found.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (adminUser.role !== "super_admin") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Super Admin privilege required.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse Input Body
    const body = await req.json();
    const { user_type, user_id } = body;

    if (!user_type || !user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Bad Request: Missing user_type or user_id.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Helper: Delete all files in a storage bucket for a specific user folder prefix
    const deleteFolderInBucket = async (bucketName: string, folderPrefix: string) => {
      const { data: fileList, error: listError } = await ctx.supabase.storage
        .from(bucketName)
        .list(folderPrefix);

      if (listError) {
        // If bucket doesn't exist or listing fails, handle gracefully
        return;
      }

      if (fileList && fileList.length > 0) {
        const filesToRemove = fileList.map((file) => `${folderPrefix}/${file.name}`);
        const { error: removeError } = await ctx.supabase.storage
          .from(bucketName)
          .remove(filesToRemove);

        if (removeError) {
          throw new Error(`Failed to delete files in bucket ${bucketName}: ${removeError.message}`);
        }
      }
    };

    // Helper: Delete database records safely with immediate error stopping
    const deleteTableRecords = async (tableName: string, filterColumn: string, filterValue: string) => {
      const { error } = await ctx.supabase
        .from(tableName)
        .delete()
        .eq(filterColumn, filterValue);

      if (error) {
        throw new Error(`Failed to delete records from ${tableName}: ${error.message}`);
      }
    };

    // 2. Execute deletion according to user_type
    if (user_type === "rider") {
      // Storage Cleanup
      await deleteFolderInBucket("rider-profiles", user_id);
      await deleteFolderInBucket("rider-documents", user_id);
      await deleteFolderInBucket("rider-sos", user_id);

      // Database Record Cleanup in Safe Order
      await deleteTableRecords("rider_profiles", "rider_id", user_id);
      await deleteTableRecords("rider_vendor_assignments", "rider_id", user_id);
      await deleteTableRecords("rider_support_tickets", "rider_id", user_id);
      await deleteTableRecords("rider_emergency_reports", "rider_id", user_id);
      await deleteTableRecords("rider_shifts", "rider_id", user_id);
      await deleteTableRecords("rider_settlements", "rider_id", user_id);
      await deleteTableRecords("notifications", "user_id", user_id);
      await deleteTableRecords("wallets", "user_id", user_id);
      await deleteTableRecords("riders", "id", user_id);

    } else if (user_type === "vendor") {
      // Storage Cleanup
      await deleteFolderInBucket("vendor-avatars", user_id);
      await deleteFolderInBucket("vendor-store-images", user_id);
      await deleteFolderInBucket("vendor-QR", user_id);

      // Database Record Cleanup in Safe Order
      await deleteTableRecords("vendor_profile_banners", "vendor_id", user_id);
      await deleteTableRecords("vendor_store_images", "vendor_id", user_id);
      await deleteTableRecords("subscriptions", "vendor_id", user_id);
      await deleteTableRecords("products", "vendor_id", user_id);
      await deleteTableRecords("offers", "vendor_id", user_id);
      await deleteTableRecords("vendor_profiles", "vendor_id", user_id);
      await deleteTableRecords("vendor_support_tickets", "vendor_id", user_id);
      await deleteTableRecords("vendor_settlements", "vendor_id", user_id);
      await deleteTableRecords("notifications", "user_id", user_id);
      await deleteTableRecords("wallets", "user_id", user_id);
      await deleteTableRecords("vendors", "id", user_id);

    } else if (user_type === "customer") {
      // Database Record Cleanup in Safe Order
      await deleteTableRecords("customer_addresses", "customer_id", user_id);
      await deleteTableRecords("customer_support_tickets", "customer_id", user_id);
      await deleteTableRecords("notifications", "user_id", user_id);
      await deleteTableRecords("wallets", "user_id", user_id);
      await deleteTableRecords("customers", "id", user_id);

    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Bad Request: Invalid user_type.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 3. Return completion success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Database cleanup completed.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred during database cleanup.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});