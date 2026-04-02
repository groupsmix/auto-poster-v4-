// ============================================================
// Email/SMS Notification Service
// Sends notifications via external APIs (Mailgun/Resend/SendGrid for email,
// Twilio-compatible for SMS). Falls back to webhook-based notifications
// if API keys are not configured.
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

export interface NotificationConfig {
  id: string;
  type: "email" | "sms";
  name: string;
  recipient: string;
  events: string[];
  is_active: boolean;
  provider?: string;
  api_key_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  config_id: string;
  event_type: string;
  recipient: string;
  subject?: string;
  status: "sent" | "failed";
  error?: string;
  sent_at: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SMSPayload {
  to: string;
  body: string;
}

// --- Email sending via fetch (generic HTTP API) ---

async function sendEmailViaResend(
  apiKey: string,
  payload: EmailPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "NEXUS <notifications@nexus.app>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (resp.ok) {
      return { success: true };
    }
    const errorText = await resp.text();
    return { success: false, error: `Resend API error: ${resp.status} - ${errorText}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendEmailViaMailgun(
  apiKey: string,
  domain: string,
  payload: EmailPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("from", `NEXUS <notifications@${domain}>`);
    formData.append("to", payload.to);
    formData.append("subject", payload.subject);
    formData.append("html", payload.html);
    if (payload.text) formData.append("text", payload.text);

    const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      },
      body: formData,
    });

    if (resp.ok) {
      return { success: true };
    }
    const errorText = await resp.text();
    return { success: false, error: `Mailgun API error: ${resp.status} - ${errorText}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- SMS sending via Twilio-compatible API ---

async function sendSMS(
  accountSid: string,
  authToken: string,
  from: string,
  payload: SMSPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({
          To: payload.to,
          From: from,
          Body: payload.body,
        }),
      }
    );

    if (resp.ok) {
      return { success: true };
    }
    const errorText = await resp.text();
    return { success: false, error: `Twilio API error: ${resp.status} - ${errorText}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Notification building ---

function buildEmailContent(event: string, data: Record<string, unknown>): EmailPayload {
  const eventLabels: Record<string, string> = {
    product_approved: "Product Approved",
    product_published: "Product Published",
    publish_failed: "Publish Failed",
    daily_summary: "Daily Summary",
    schedule_completed: "Schedule Run Completed",
    revenue_milestone: "Revenue Milestone",
    system_error: "System Error",
  };

  const title = eventLabels[event] ?? event;
  const message = String(data.message ?? JSON.stringify(data));

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">NEXUS: ${title}</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; line-height: 1.6;">${message}</p>
        ${Object.entries(data)
          .filter(([k]) => k !== "message")
          .map(([k, v]) => `<p style="color: #6b7280; margin: 4px 0;"><strong>${k}:</strong> ${String(v)}</p>`)
          .join("")}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Sent by NEXUS Automation System</p>
      </div>
    </div>
  `;

  const text = `NEXUS: ${title}\n\n${message}\n\n${Object.entries(data)
    .filter(([k]) => k !== "message")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n")}`;

  return {
    to: "", // filled in by caller
    subject: `NEXUS: ${title}`,
    html,
    text,
  };
}

function buildSMSContent(event: string, data: Record<string, unknown>): string {
  const eventLabels: Record<string, string> = {
    product_approved: "Approved",
    product_published: "Published",
    publish_failed: "FAILED",
    daily_summary: "Daily Summary",
    system_error: "ERROR",
  };

  const title = eventLabels[event] ?? event;
  const message = String(data.message ?? "").slice(0, 100);
  return `NEXUS ${title}: ${message}`;
}

// --- Main notification functions ---

/**
 * Send notifications for an event to all matching configs.
 */
export async function fireNotifications(
  event: string,
  data: Record<string, unknown>,
  env: RouterEnv
): Promise<Array<{ config_id: string; success: boolean; error?: string }>> {
  const configs = (await storageQuery<Array<{
    id: string;
    type: string;
    recipient: string;
    events: string;
    provider: string | null;
  }>>(
    env,
    `SELECT id, type, recipient, events, provider FROM notification_configs WHERE is_active = 1`
  )) ?? [];

  const results: Array<{ config_id: string; success: boolean; error?: string }> = [];

  for (const config of configs) {
    const events: string[] = typeof config.events === "string"
      ? JSON.parse(config.events)
      : [];

    if (!events.includes(event)) continue;

    let result: { success: boolean; error?: string };

    if (config.type === "email") {
      const emailPayload = buildEmailContent(event, data);
      emailPayload.to = config.recipient;

      // Try Resend first, then Mailgun
      const resendKey = env.RESEND_API_KEY as string | undefined;
      const mailgunKey = env.MAILGUN_API_KEY as string | undefined;
      const mailgunDomain = env.MAILGUN_DOMAIN as string | undefined;

      if (resendKey) {
        result = await sendEmailViaResend(resendKey, emailPayload);
      } else if (mailgunKey && mailgunDomain) {
        result = await sendEmailViaMailgun(mailgunKey, mailgunDomain, emailPayload);
      } else {
        result = { success: false, error: "No email provider configured (set RESEND_API_KEY or MAILGUN_API_KEY)" };
      }
    } else if (config.type === "sms") {
      const smsBody = buildSMSContent(event, data);
      const twilioSid = env.TWILIO_ACCOUNT_SID as string | undefined;
      const twilioToken = env.TWILIO_AUTH_TOKEN as string | undefined;
      const twilioFrom = env.TWILIO_FROM_NUMBER as string | undefined;

      if (twilioSid && twilioToken && twilioFrom) {
        result = await sendSMS(twilioSid, twilioToken, twilioFrom, {
          to: config.recipient,
          body: smsBody,
        });
      } else {
        result = { success: false, error: "No SMS provider configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)" };
      }
    } else {
      result = { success: false, error: `Unknown notification type: ${config.type}` };
    }

    // Log the notification
    const logId = generateId();
    await storageQuery(
      env,
      `INSERT INTO notification_logs (id, config_id, event_type, recipient, subject, status, error, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        config.id,
        event,
        config.recipient,
        config.type === "email" ? `NEXUS: ${event}` : null,
        result.success ? "sent" : "failed",
        result.error ?? null,
        now(),
      ]
    );

    results.push({ config_id: config.id, ...result });
  }

  return results;
}

/**
 * Generate and send a daily email digest.
 */
export async function sendDailyDigest(env: RouterEnv): Promise<{
  sent: number;
  failed: number;
}> {
  // Gather stats for the digest
  const stats = (await storageQuery<Array<{
    total_products: number;
    approved_today: number;
    published_today: number;
    failed_today: number;
    revenue_today: number;
  }>>(
    env,
    `SELECT
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT COUNT(*) FROM products WHERE status = 'approved' AND updated_at > date('now', '-1 day')) as approved_today,
      (SELECT COUNT(*) FROM products WHERE status = 'published' AND updated_at > date('now', '-1 day')) as published_today,
      (SELECT COUNT(*) FROM products WHERE status = 'failed' AND updated_at > date('now', '-1 day')) as failed_today,
      (SELECT COALESCE(SUM(revenue), 0) FROM revenue_records WHERE order_date > date('now', '-1 day')) as revenue_today`
  )) ?? [];

  const s = stats[0] ?? { total_products: 0, approved_today: 0, published_today: 0, failed_today: 0, revenue_today: 0 };

  const digestData: Record<string, unknown> = {
    message: `Daily Summary: ${s.approved_today} approved, ${s.published_today} published, ${s.failed_today} failed. Revenue: $${(s.revenue_today ?? 0).toFixed(2)}`,
    total_products: s.total_products,
    approved_today: s.approved_today,
    published_today: s.published_today,
    failed_today: s.failed_today,
    revenue_today: `$${(s.revenue_today ?? 0).toFixed(2)}`,
  };

  const results = await fireNotifications("daily_summary", digestData, env);
  return {
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}
