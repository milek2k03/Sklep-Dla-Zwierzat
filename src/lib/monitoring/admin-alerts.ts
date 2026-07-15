import { getEmailEnv, hasEmailEnv } from "@/lib/email/env";
import { getResendClient } from "@/lib/email/server";

type AlertContext = Record<string, unknown>;

const maxSerializedLength = 4000;

export async function notifyAdminError({
  context,
  error,
  source,
  title,
}: {
  context?: AlertContext;
  error?: unknown;
  source: string;
  title: string;
}) {
  if (!hasEmailEnv()) {
    return false;
  }

  const { orderNotificationEmail, storeFromEmail } = getEmailEnv();

  if (!orderNotificationEmail || !storeFromEmail) {
    return false;
  }

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: storeFromEmail,
      to: orderNotificationEmail,
      subject: `[Pawly Alert] ${title}`,
      html: renderAdminErrorEmail({ context, error, source, title }),
      text: renderAdminErrorText({ context, error, source, title }),
    });

    return true;
  } catch (alertError) {
    console.error("Failed to send admin error alert", alertError);
    return false;
  }
}

function renderAdminErrorEmail({
  context,
  error,
  source,
  title,
}: {
  context?: AlertContext;
  error?: unknown;
  source: string;
  title: string;
}) {
  const errorText = serializeUnknown(error);
  const contextText = context ? serializeUnknown(context) : "";

  return `
    <div style="margin:0;padding:24px;background:#f7f2ea;font-family:Arial,sans-serif;color:#1f1f1f;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e8ddce;border-radius:12px;overflow:hidden;">
        <div style="padding:20px 24px;background:#1f1f1f;color:#fff;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#f6a056;">Pawly Alert</div>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f5a53;">
            W sklepie wystąpił błąd wymagający sprawdzenia.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:14px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee7db;color:#8a8176;">Źródło</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee7db;font-weight:700;text-align:right;">${escapeHtml(source)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee7db;color:#8a8176;">Czas</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee7db;font-weight:700;text-align:right;">${escapeHtml(new Date().toISOString())}</td>
            </tr>
          </table>
          ${
            errorText
              ? `<h2 style="font-size:16px;margin:0 0 8px;">Błąd</h2><pre style="white-space:pre-wrap;background:#fbf7ef;border:1px solid #eee1d2;border-radius:8px;padding:12px;font-size:12px;line-height:1.5;color:#2a2723;">${escapeHtml(errorText)}</pre>`
              : ""
          }
          ${
            contextText
              ? `<h2 style="font-size:16px;margin:18px 0 8px;">Kontekst</h2><pre style="white-space:pre-wrap;background:#fbf7ef;border:1px solid #eee1d2;border-radius:8px;padding:12px;font-size:12px;line-height:1.5;color:#2a2723;">${escapeHtml(contextText)}</pre>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function renderAdminErrorText({
  context,
  error,
  source,
  title,
}: {
  context?: AlertContext;
  error?: unknown;
  source: string;
  title: string;
}) {
  return [
    `Pawly Alert: ${title}`,
    `Źródło: ${source}`,
    `Czas: ${new Date().toISOString()}`,
    error ? `Błąd:\n${serializeUnknown(error)}` : "",
    context ? `Kontekst:\n${serializeUnknown(context)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function serializeUnknown(value: unknown) {
  let serialized: string;

  if (value instanceof Error) {
    serialized = JSON.stringify(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      null,
      2,
    );
  } else if (typeof value === "string") {
    serialized = value;
  } else {
    try {
      serialized = JSON.stringify(value, null, 2);
    } catch {
      serialized = String(value);
    }
  }

  if (serialized.length <= maxSerializedLength) {
    return serialized;
  }

  return `${serialized.slice(0, maxSerializedLength)}\n...`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
