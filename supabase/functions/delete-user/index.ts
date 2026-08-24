import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY"
);

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "Required Supabase environment variables are missing."
  );
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const supabaseAuth = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type AccountType =
  | "customer"
  | "rider"
  | "vendor"
  | "admin";

interface DeleteRequest {
  account_type: AccountType;
  account_id: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Only POST requests are allowed.",
      },
      405
    );
  }

  try {
    /*
     * ==========================================================
     * AUTHENTICATE REQUEST
     * ==========================================================
     */

    const authorization =
      req.headers.get("Authorization") ||
      req.headers.get("authorization");

    if (!authorization) {
      return jsonResponse(
        {
          success: false,
          error: "Authorization header is required.",
        },
        401
      );
    }

    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid authorization header.",
        },
        401
      );
    }

    const accessToken = authorization
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          error: "Access token is required.",
        },
        401
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or expired authentication session.",
        },
        401
      );
    }

    const callerAuthUserId = user.id;

    /*
     * ==========================================================
     * VERIFY SUPER ADMIN
     * ==========================================================
     */

    const {
      data: callerAdmin,
      error: callerAdminError,
    } = await supabaseAdmin
      .from("admin_users")
      .select("id, auth_user_id, email, role")
      .eq("auth_user_id", callerAuthUserId)
      .maybeSingle();

    if (callerAdminError) {
      console.error(
        "Caller admin lookup failed:",
        callerAdminError
      );

      return jsonResponse(
        {
          success: false,
          error: "Unable to verify administrator authority.",
        },
        500
      );
    }

    if (!callerAdmin || callerAdmin.role !== "super_admin") {
      return jsonResponse(
        {
          success: false,
          error:
            "Super admin authority is required for account deletion.",
        },
        403
      );
    }

    /*
     * ==========================================================
     * VALIDATE REQUEST
     * ==========================================================
     */

    let payload: DeleteRequest;

    try {
      payload = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        400
      );
    }

    const accountType = payload?.account_type;
    const accountId = payload?.account_id;

    if (
      accountType !== "customer" &&
      accountType !== "rider" &&
      accountType !== "vendor" &&
      accountType !== "admin"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "account_type must be customer, rider, vendor, or admin.",
        },
        400
      );
    }

    if (!isValidUuid(accountId)) {
      return jsonResponse(
        {
          success: false,
          error: "A valid account_id is required.",
        },
        400
      );
    }

    /*
     * ==========================================================
     * RESOLVE TARGET AUTH USER
     * ==========================================================
     */

    let targetAuthUserId: string | null = null;

    if (accountType === "customer") {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("id, auth_user_id")
        .eq("id", accountId)
        .maybeSingle();

      if (error) {
        console.error(
          "Customer lookup failed:",
          error
        );

        return jsonResponse(
          {
            success: false,
            error: "Unable to find customer account.",
          },
          500
        );
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Customer account not found.",
          },
          404
        );
      }

      targetAuthUserId = data.auth_user_id;
    }

    if (accountType === "rider") {
      const { data, error } = await supabaseAdmin
        .from("riders")
        .select("id, auth_user_id")
        .eq("id", accountId)
        .maybeSingle();

      if (error) {
        console.error(
          "Rider lookup failed:",
          error
        );

        return jsonResponse(
          {
            success: false,
            error: "Unable to find rider account.",
          },
          500
        );
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Rider account not found.",
          },
          404
        );
      }

      targetAuthUserId = data.auth_user_id;
    }

    if (accountType === "vendor") {
      const { data, error } = await supabaseAdmin
        .from("vendors")
        .select("id, auth_user_id")
        .eq("id", accountId)
        .maybeSingle();

      if (error) {
        console.error(
          "Vendor lookup failed:",
          error
        );

        return jsonResponse(
          {
            success: false,
            error: "Unable to find vendor account.",
          },
          500
        );
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Vendor account not found.",
          },
          404
        );
      }

      targetAuthUserId = data.auth_user_id;
    }

    if (accountType === "admin") {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .select("id, auth_user_id, email, role")
        .eq("id", accountId)
        .maybeSingle();

      if (error) {
        console.error(
          "Admin lookup failed:",
          error
        );

        return jsonResponse(
          {
            success: false,
            error: "Unable to find admin account.",
          },
          500
        );
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Admin account not found.",
          },
          404
        );
      }

      /*
       * Never allow the root/super-admin account to be deleted.
       */
      if (data.role === "super_admin") {
        return jsonResponse(
          {
            success: false,
            error:
              "Super admin accounts are protected and cannot be deleted.",
          },
          403
        );
      }

      targetAuthUserId = data.auth_user_id;
    }

    /*
     * ==========================================================
     * PREVENT SELF-DELETION
     * ==========================================================
     */

    if (
      targetAuthUserId &&
      targetAuthUserId === callerAuthUserId
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "You cannot delete the currently authenticated super-admin account.",
        },
        403
      );
    }

    /*
     * ==========================================================
     * CUSTOMER / RIDER / VENDOR PREPARATION
     * ==========================================================
     */

    if (
      accountType === "customer" ||
      accountType === "rider" ||
      accountType === "vendor"
    ) {
      const {
        data: preparationResult,
        error: preparationError,
      } = await supabaseAdmin.rpc(
        "prepare_account_deletion",
        {
          p_account_type: accountType,
          p_account_id: accountId,
          p_auth_user_id: targetAuthUserId,
        }
      );

      if (preparationError) {
        console.error(
          "Account deletion preparation failed:",
          preparationError
        );

        return jsonResponse(
          {
            success: false,
            error:
              preparationError.message ||
              "Unable to prepare account deletion.",
          },
          500
        );
      }

      /*
       * Delete the Auth account if one exists.
       */
      if (targetAuthUserId) {
        const { error: deleteAuthError } =
          await supabaseAdmin.auth.admin.deleteUser(
            targetAuthUserId
          );

        if (deleteAuthError) {
          console.error(
            "Supabase Auth deletion failed:",
            deleteAuthError
          );

          return jsonResponse(
            {
              success: false,
              error:
                "Account data was prepared, but the authentication account could not be deleted.",
            },
            500
          );
        }
      }

      return jsonResponse({
        success: true,
        message: `${accountType} account deleted successfully.`,
        account_type: accountType,
        account_id: accountId,
        deleted_auth_user_id: targetAuthUserId,
        preparation: preparationResult,
      });
    }

    /*
     * ==========================================================
     * ADMIN DELETION
     * ==========================================================
     */

    if (accountType === "admin") {
      /*
       * Delete the admin profile first.
       */
      const { error: adminDeleteError } =
        await supabaseAdmin
          .from("admin_users")
          .delete()
          .eq("id", accountId);

      if (adminDeleteError) {
        console.error(
          "Admin profile deletion failed:",
          adminDeleteError
        );

        return jsonResponse(
          {
            success: false,
            error:
              adminDeleteError.message ||
              "Unable to delete admin profile.",
          },
          500
        );
      }

      /*
       * Delete the corresponding Auth account.
       */
      if (targetAuthUserId) {
        const { error: deleteAuthError } =
          await supabaseAdmin.auth.admin.deleteUser(
            targetAuthUserId
          );

        if (deleteAuthError) {
          console.error(
            "Admin Auth deletion failed:",
            deleteAuthError
          );

          return jsonResponse(
            {
              success: false,
              error:
                "Admin profile was deleted, but the authentication account could not be deleted. Manual cleanup may be required.",
            },
            500
          );
        }
      }

      return jsonResponse({
        success: true,
        message: "Admin account deleted successfully.",
        account_type: "admin",
        account_id: accountId,
        deleted_auth_user_id: targetAuthUserId,
      });
    }

    return jsonResponse(
      {
        success: false,
        error: "Unsupported account type.",
      },
      400
    );
  } catch (error) {
    console.error(
      "Unexpected delete-user error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
});