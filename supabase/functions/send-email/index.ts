import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const {
    type,
    to,
    ownerName,
    shopName,
    shopCode,
    riderName,
    riderCode,
    subject,
    html,
  } = await req.json();

  const apiKey = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER");

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  if (!apiKey || !sender) {
    return new Response(
      JSON.stringify({
        error: "Missing BREVO_API_KEY or BREVO_SENDER",
      }),
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }

  let emailSubject = subject;
  let emailHtml = html;

  // ==========================
  // Vendor Approved Email
  // ==========================
  if (type === "vendor-approved") {
    emailSubject =
      "🎉 Welcome to Rivo City - Your Store Has Been Approved";

    emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;padding:30px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <h1 style="color:#16a34a;">Welcome to Rivo City! 🎉</h1>

        <p>Hello <strong>${ownerName}</strong>,</p>

        <p>Your store has been successfully approved and is now active on Rivo City.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr>
            <td style="padding:10px;border:1px solid #ddd;"><strong>Shop Name</strong></td>
            <td style="padding:10px;border:1px solid #ddd;">${shopName}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd;"><strong>Vendor ID</strong></td>
            <td style="padding:10px;border:1px solid #ddd;">${shopCode}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd;"><strong>Login Email</strong></td>
            <td style="padding:10px;border:1px solid #ddd;">${to}</td>
          </tr>
        </table>

        <p>You can now log in using the password you created during registration.</p>

        <p>Thank you for joining <strong>Rivo City</strong>.</p>

        <hr>

        <p style="font-size:12px;color:#666;">
          © ${new Date().getFullYear()} Rivo City. All rights reserved.
        </p>
      </div>
    `;
  }

  // ==========================
  // Rider Approved Email
  // ==========================
  if (type === "rider-approved") {
    emailSubject =
      "🎉 Welcome to Rivo City - Your Rider Account Has Been Approved";

    emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;padding:30px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <h1 style="color:#16a34a;">Welcome to Rivo City! 🛵</h1>

        <p>Hello <strong>${riderName}</strong>,</p>

        <p>Your rider account has been approved and is now active.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr>
            <td style="padding:10px;border:1px solid #ddd;"><strong>Rider ID</strong></td>
            <td style="padding:10px;border:1px solid #ddd;">${riderCode}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd;"><strong>Login Email</strong></td>
            <td style="padding:10px;border:1px solid #ddd;">${to}</td>
          </tr>
        </table>

        <p>You can now log in using the password you created during registration.</p>

        <p>We're excited to have you as part of the Rivo City delivery network.</p>

        <hr>

        <p style="font-size:12px;color:#666;">
          © ${new Date().getFullYear()} Rivo City. All rights reserved.
        </p>
      </div>
    `;
  }

  if (!emailSubject || !emailHtml) {
    return new Response(
      JSON.stringify({
        error: "Unknown email type or missing subject/html.",
      }),
      {
        status: 400,
        headers: responseHeaders,
      }
    );
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        email: sender,
        name: "Rivo City",
      },
      to: [
        {
          email: to,
        },
      ],
      subject: emailSubject,
      htmlContent: emailHtml,
    }),
  });

  const result = await response.text();

  return new Response(result, {
    status: response.status,
    headers: responseHeaders,
  });
});