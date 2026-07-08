import { getDeliveryOption } from "@/lib/delivery";
import { storeBrandName } from "@/lib/brand";
import { hasEmailEnv, getEmailEnv } from "@/lib/email/env";
import { getResendClient } from "@/lib/email/server";
import { formatPrice } from "@/lib/format";
import {
  getReturnAddressLines,
  getReturnShipmentInstructionLines,
} from "@/lib/returns";
import type { Database } from "@/types/supabase";

type PaidOrder = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items: Database["public"]["Tables"]["order_items"]["Row"][];
};
type ReturnCaseEmail = Database["public"]["Tables"]["return_cases"]["Row"] & {
  orders: Pick<
    Database["public"]["Tables"]["orders"]["Row"],
    "customer_email" | "customer_full_name" | "order_number"
  > | null;
  return_case_items: Pick<
    Database["public"]["Tables"]["return_case_items"]["Row"],
    "product_name" | "quantity"
  >[];
};

const returnCaseTypeLabels: Record<ReturnCaseEmail["case_type"], string> = {
  return: "Zwrot",
  claim: "Reklamacja",
  exchange: "Wymiana",
};

const returnCaseStatusLabels: Record<ReturnCaseEmail["status"], string> = {
  reported: "Zgłoszone",
  awaiting_package: "Oczekuje na paczkę",
  package_received: "Paczka odebrana",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  closed: "Zamknięte",
};

export async function sendPaidOrderEmails(order: PaidOrder) {
  if (!hasEmailEnv()) {
    return {
      customerEmailSent: false,
      adminEmailSent: false,
    };
  }

  const { orderNotificationEmail, storeFromEmail } = getEmailEnv();

  if (!orderNotificationEmail || !storeFromEmail) {
    return {
      customerEmailSent: false,
      adminEmailSent: false,
    };
  }

  const resend = getResendClient();
  const [customerEmailSent, adminEmailSent] = await Promise.all([
    order.customer_email_sent_at
      ? Promise.resolve(false)
      : resend.emails
          .send({
            from: storeFromEmail,
            to: order.customer_email,
            subject: `Potwierdzenie zamówienia ${order.order_number}`,
            html: renderCustomerPaidOrderHtml(order),
            text: renderCustomerPaidOrderText(order),
          })
          .then(() => true),
    order.admin_email_sent_at
      ? Promise.resolve(false)
      : resend.emails
          .send({
            from: storeFromEmail,
            to: orderNotificationEmail,
            subject: `Nowe opłacone zamówienie ${order.order_number}`,
            html: renderAdminPaidOrderHtml(order),
            text: renderAdminPaidOrderText(order),
          })
          .then(() => true),
  ]);

  return {
    customerEmailSent,
    adminEmailSent,
  };
}

export async function sendShippedOrderEmail(order: PaidOrder) {
  if (!hasEmailEnv() || order.shipping_email_sent_at) {
    return false;
  }

  const { storeFromEmail } = getEmailEnv();

  if (!storeFromEmail) {
    return false;
  }

  const resend = getResendClient();

  await resend.emails.send({
    from: storeFromEmail,
    to: order.customer_email,
    subject: `Zamówienie ${order.order_number} zostało wysłane`,
    html: renderCustomerShippedOrderHtml(order),
    text: renderCustomerShippedOrderText(order),
  });

  return true;
}

export async function sendRefundedOrderEmail(order: PaidOrder) {
  if (!hasEmailEnv() || order.refund_email_sent_at) {
    return false;
  }

  const { storeFromEmail } = getEmailEnv();

  if (!storeFromEmail) {
    return false;
  }

  const resend = getResendClient();

  await resend.emails.send({
    from: storeFromEmail,
    to: order.customer_email,
    subject: `Zamówienie ${order.order_number} zostało anulowane`,
    html: renderCustomerRefundedOrderHtml(order),
    text: renderCustomerRefundedOrderText(order),
  });

  return true;
}

export async function sendReturnCaseCreatedEmail(returnCase: ReturnCaseEmail) {
  return sendReturnCaseEmail({
    returnCase,
    subject: `Przyjęliśmy zgłoszenie ${returnCase.case_number}`,
    title: "Zgłoszenie zostało przyjęte",
    intro: `Przyjęliśmy Twoje zgłoszenie ${returnCase.case_number}. Będziemy informować o zmianach statusu.`,
  });
}

export async function sendReturnCaseStatusEmail(returnCase: ReturnCaseEmail) {
  return sendReturnCaseEmail({
    returnCase,
    subject: `Status zgłoszenia ${returnCase.case_number}: ${returnCaseStatusLabels[returnCase.status]}`,
    title: "Status zgłoszenia został zmieniony",
    intro: `Aktualny status zgłoszenia ${returnCase.case_number}: ${returnCaseStatusLabels[returnCase.status]}.`,
  });
}

export async function sendReturnCaseClosedEmail(returnCase: ReturnCaseEmail) {
  const refundMessage =
    returnCase.approved_refund_amount > 0
      ? `Zatwierdzona kwota zwrotu: ${formatPrice(Number(returnCase.approved_refund_amount))}.`
      : "Sprawa została zamknięta bez zwrotu środków.";

  return sendReturnCaseEmail({
    returnCase,
    subject: `Zgłoszenie ${returnCase.case_number} zostało zamknięte`,
    title: "Zgłoszenie zostało zamknięte",
    intro: `${refundMessage} Status końcowy: ${returnCaseStatusLabels[returnCase.status]}.`,
  });
}

async function sendReturnCaseEmail({
  intro,
  returnCase,
  subject,
  title,
}: {
  intro: string;
  returnCase: ReturnCaseEmail;
  subject: string;
  title: string;
}) {
  if (!hasEmailEnv() || !returnCase.orders?.customer_email) {
    return false;
  }

  const { storeFromEmail } = getEmailEnv();

  if (!storeFromEmail) {
    return false;
  }

  const resend = getResendClient();

  await resend.emails.send({
    from: storeFromEmail,
    to: returnCase.orders.customer_email,
    subject,
    html: renderReturnCaseHtml({ intro, returnCase, title }),
    text: renderReturnCaseText({ intro, returnCase, title }),
  });

  return true;
}

function renderCustomerPaidOrderText(order: PaidOrder) {
  return [
    `Dziękujemy za zamówienie ${order.order_number}.`,
    "",
    "Płatność została potwierdzona.",
    "",
    "Produkty:",
    ...order.order_items.map(
      (item) =>
        `- ${item.product_name} x ${item.quantity}: ${formatPrice(Number(item.line_total))}`,
    ),
    "",
    `Dostawa: ${getDeliveryName(order.delivery_method)} (${formatPrice(Number(order.delivery_cost))})`,
    `Razem: ${formatPrice(Number(order.total))}`,
    "",
    "Adres dostawy:",
    order.delivery_address,
    order.pickup_point ? `Punkt odbioru: ${order.pickup_point}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderReturnCaseText({
  intro,
  returnCase,
  title,
}: {
  intro: string;
  returnCase: ReturnCaseEmail;
  title: string;
}) {
  return [
    title,
    "",
    intro,
    "",
    `Zamówienie: ${returnCase.orders?.order_number ?? "-"}`,
    `Typ sprawy: ${returnCaseTypeLabels[returnCase.case_type]}`,
    `Status: ${returnCaseStatusLabels[returnCase.status]}`,
    "",
    "Produkty:",
    ...returnCase.return_case_items.map(
      (item) => `- ${item.product_name} x ${item.quantity}`,
    ),
    returnCase.customer_message
      ? ["", `Twoja notatka: ${returnCase.customer_message}`].join("\n")
      : null,
    Number(returnCase.approved_refund_amount) > 0
      ? `Zatwierdzona kwota zwrotu: ${formatPrice(Number(returnCase.approved_refund_amount))}`
      : null,
    shouldShowReturnAddress(returnCase)
      ? [
          "",
          "Adres do wysyłki zwrotu/reklamacji:",
          ...getReturnAddressLines(),
          "",
          "Instrukcja odesłania:",
          ...getReturnShipmentInstructionLines(returnCase.case_number),
        ].join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderReturnCaseHtml({
  intro,
  returnCase,
  title,
}: {
  intro: string;
  returnCase: ReturnCaseEmail;
  title: string;
}) {
  const returnAddressLines = getReturnAddressLines();
  const shipmentInstructionLines = getReturnShipmentInstructionLines(
    returnCase.case_number,
  );
  const refundAmount = Number(returnCase.approved_refund_amount);
  const returnAddressHtml =
    shouldShowReturnAddress(returnCase) && returnAddressLines.length > 0
      ? renderSectionCard({
          title: "Jak odesłać paczkę",
          content: `
            ${renderAddressBlock("Adres wysyłki", returnAddressLines)}
            ${renderBulletList(shipmentInstructionLines)}
          `,
          tone: "warm",
        })
      : "";
  const statusUrl = returnCase.orders
    ? getOrderStatusUrl(returnCase.orders.order_number, returnCase.orders.customer_email)
    : "";

  return renderEmailLayout({
    eyebrow: "Sprawa posprzedażowa",
    title,
    intro,
    badge: returnCaseStatusLabels[returnCase.status],
    children: `
      ${renderInfoGrid([
        ["Numer sprawy", returnCase.case_number],
        ["Zamówienie", returnCase.orders?.order_number ?? "-"],
        ["Typ sprawy", returnCaseTypeLabels[returnCase.case_type]],
        ["Status", returnCaseStatusLabels[returnCase.status]],
      ])}
      ${renderSectionCard({
        title: "Produkty objęte zgłoszeniem",
        content: renderReturnItemsTable(returnCase.return_case_items),
      })}
      ${
        returnCase.customer_message
          ? renderSectionCard({
              title: "Twoja notatka",
              content: `<p style="margin:0;color:#5f5a52;font-size:14px;line-height:22px;">${escapeHtml(returnCase.customer_message)}</p>`,
            })
          : ""
      }
      ${
        refundAmount > 0
          ? renderHighlightMetric("Zatwierdzona kwota zwrotu", formatPrice(refundAmount))
          : ""
      }
      ${returnAddressHtml}
      ${statusUrl ? renderButton("Sprawdź status sprawy", statusUrl) : ""}
    `,
  });
}

function shouldShowReturnAddress(returnCase: ReturnCaseEmail) {
  return (
    returnCase.status === "reported" ||
    returnCase.status === "awaiting_package" ||
    returnCase.status === "accepted"
  );
}

function renderAdminPaidOrderText(order: PaidOrder) {
  return [
    `Nowe opłacone zamówienie ${order.order_number}.`,
    "",
    `Klient: ${order.customer_full_name}`,
    `E-mail: ${order.customer_email}`,
    `Telefon: ${order.customer_phone}`,
    "",
    "Produkty:",
    ...order.order_items.map(
      (item) =>
        `- ${item.product_name} x ${item.quantity}: ${formatPrice(Number(item.line_total))}`,
    ),
    "",
    `Dostawa: ${getDeliveryName(order.delivery_method)} (${formatPrice(Number(order.delivery_cost))})`,
    `Razem: ${formatPrice(Number(order.total))}`,
    "",
    "Adres dostawy:",
    order.delivery_address,
    order.pickup_point ? `Punkt odbioru: ${order.pickup_point}` : null,
    order.notes ? `Uwagi: ${order.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderCustomerPaidOrderHtml(order: PaidOrder) {
  return renderOrderHtml({
    title: "Dziękujemy za zamówienie",
    intro: `Płatność za zamówienie ${order.order_number} została potwierdzona.`,
    order,
    includeCustomerDetails: false,
  });
}

function renderAdminPaidOrderHtml(order: PaidOrder) {
  return renderOrderHtml({
    title: "Nowe opłacone zamówienie",
    intro: `Zamówienie ${order.order_number} jest opłacone i gotowe do obsługi.`,
    order,
    includeCustomerDetails: true,
  });
}

function renderCustomerShippedOrderText(order: PaidOrder) {
  return [
    `Twoje zamówienie ${order.order_number} zostało wysłane.`,
    "",
    `Przewoźnik: ${order.shipping_carrier ?? "-"}`,
    `Numer śledzenia: ${order.tracking_number ?? "-"}`,
    order.tracking_url ? `Link śledzenia: ${order.tracking_url}` : null,
    "",
    "Produkty:",
    ...order.order_items.map(
      (item) => `- ${item.product_name} x ${item.quantity}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderCustomerRefundedOrderText(order: PaidOrder) {
  return [
    `Twoje zamówienie ${order.order_number} zostało anulowane.`,
    "",
    "Zwrot płatności został zlecony przez Stripe. Czas zaksięgowania zależy od banku lub metody płatności.",
    order.refund_reason ? `Powód: ${order.refund_reason}` : null,
    order.stripe_refund_id ? `ID zwrotu: ${order.stripe_refund_id}` : null,
    "",
    `Kwota zamówienia: ${formatPrice(Number(order.total))}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderCustomerShippedOrderHtml(order: PaidOrder) {
  return renderEmailLayout({
    eyebrow: "Wysyłka",
    title: "Zamówienie wysłane",
    intro: `Twoje zamówienie ${order.order_number} zostało przekazane do wysyłki.`,
    badge: "Wysłane",
    children: `
      ${renderInfoGrid([
        ["Numer zamówienia", order.order_number],
        ["Przewoźnik", order.shipping_carrier ?? "-"],
        ["Numer śledzenia", order.tracking_number ?? "-"],
      ])}
      ${
        order.tracking_url
          ? renderButton("Śledź przesyłkę", order.tracking_url)
          : ""
      }
      ${renderSectionCard({
        title: "Produkty w paczce",
        content: renderReturnItemsTable(order.order_items),
      })}
      ${renderButton(
        "Sprawdź status zamówienia",
        getOrderStatusUrl(order.order_number, order.customer_email),
        "secondary",
      )}
    `,
  });
}

function renderCustomerRefundedOrderHtml(order: PaidOrder) {
  return renderEmailLayout({
    eyebrow: "Płatność",
    title: "Zamówienie anulowane",
    intro: `Zamówienie ${order.order_number} zostało anulowane. Zwrot płatności został zlecony przez Stripe.`,
    badge: "Zwrot zlecony",
    children: `
      ${renderSectionCard({
        title: "Informacja o zwrocie",
        content: `
          <p style="margin:0;color:#5f5a52;font-size:14px;line-height:22px;">
            Czas zaksięgowania zwrotu zależy od banku lub metody płatności.
          </p>
        `,
        tone: "warm",
      })}
      ${renderInfoGrid([
        ["Numer zamówienia", order.order_number],
        ["Kwota zamówienia", formatPrice(Number(order.total))],
        ["Powód", order.refund_reason ?? "-"],
        ["ID zwrotu", order.stripe_refund_id ?? "-"],
      ])}
      ${renderButton(
        "Sprawdź status zamówienia",
        getOrderStatusUrl(order.order_number, order.customer_email),
      )}
    `,
  });
}

function renderOrderHtml({
  title,
  intro,
  order,
  includeCustomerDetails,
}: {
  title: string;
  intro: string;
  order: PaidOrder;
  includeCustomerDetails: boolean;
}) {
  const summaryRows: Array<[string, string, "strong"?]> = [
    ["Produkty", formatPrice(Number(order.subtotal))],
  ];

  if (Number(order.discount_total) > 0) {
    summaryRows.push(["Rabat", `-${formatPrice(Number(order.discount_total))}`]);
  }

  summaryRows.push(
    [
      `Dostawa (${getDeliveryName(order.delivery_method)})`,
      formatPrice(Number(order.delivery_cost)),
    ],
    ["Razem", formatPrice(Number(order.total)), "strong"],
  );

  return renderEmailLayout({
    eyebrow: includeCustomerDetails ? "Panel admina" : "Zamówienie",
    title,
    intro,
    badge: includeCustomerDetails ? "Opłacone" : "Płatność potwierdzona",
    children: `
      ${
        includeCustomerDetails
          ? renderInfoGrid([
              ["Klient", order.customer_full_name],
              ["E-mail", order.customer_email],
              ["Telefon", order.customer_phone],
            ])
          : ""
      }
      ${renderSectionCard({
        title: "Produkty",
        content: renderOrderItemsTable(order.order_items),
      })}
      ${renderSectionCard({
        title: "Podsumowanie",
        content: renderSummaryRows(summaryRows),
      })}
      ${renderSectionCard({
        title: "Dostawa",
        content: `
          ${renderAddressBlock("Adres dostawy", [
            order.delivery_address,
            order.pickup_point ? `Punkt odbioru: ${order.pickup_point}` : "",
          ].filter(Boolean))}
          ${
            order.notes
              ? `<p style="margin:14px 0 0;color:#5f5a52;font-size:14px;line-height:22px;"><strong>Uwagi:</strong> ${escapeHtml(order.notes)}</p>`
              : ""
          }
        `,
      })}
      ${
        includeCustomerDetails
          ? ""
          : renderButton(
              "Sprawdź status zamówienia",
              getOrderStatusUrl(order.order_number, order.customer_email),
            )
      }
    `,
  });
}

function renderEmailLayout({
  badge,
  children,
  eyebrow,
  intro,
  title,
}: {
  badge: string;
  children: string;
  eyebrow: string;
  intro: string;
  title: string;
}) {
  return `
    <div style="margin:0;padding:0;background:#f7f1e8;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(intro)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f7f1e8;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;">
                        <span style="display:inline-block;width:36px;height:36px;border-radius:999px;background:#1f1f1f;color:#ffffff;text-align:center;line-height:36px;font-size:16px;font-weight:700;">P</span>
                        <span style="display:inline-block;margin-left:10px;font-size:17px;font-weight:700;color:#1f1f1f;vertical-align:middle;">${escapeHtml(storeBrandName)}</span>
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <span style="display:inline-block;border-radius:999px;background:#fff4e8;color:#b65320;border:1px solid #f1dcc8;padding:7px 11px;font-size:12px;font-weight:700;">
                          ${escapeHtml(badge)}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #eadfce;border-radius:18px;background:#fffdf8;box-shadow:0 8px 28px rgba(31,31,31,0.06);overflow:hidden;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:28px 28px 10px;">
                        <p style="margin:0 0 10px;color:#9b6f39;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                          ${escapeHtml(eyebrow)}
                        </p>
                        <h1 style="margin:0;color:#1f1f1f;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.02em;">
                          ${escapeHtml(title)}
                        </h1>
                        <p style="margin:14px 0 0;color:#5f5a52;font-size:15px;line-height:24px;">
                          ${escapeHtml(intro)}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 28px 30px;">
                        ${children}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:18px 8px 0;color:#8a8177;font-size:12px;line-height:18px;">
                  To automatyczna wiadomość ze sklepu ${escapeHtml(storeBrandName)}.<br />
                  W razie pytań odpowiedz na tego maila.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderInfoGrid(rows: Array<[string, string | number]>) {
  const tableRows: string[] = [];

  for (let index = 0; index < rows.length; index += 2) {
    const firstCell = renderInfoCell(rows[index]);
    const secondCell = rows[index + 1]
      ? renderInfoCell(rows[index + 1])
      : '<td style="width:50%;padding:10px 12px;border-bottom:1px solid #eee7db;">&nbsp;</td>';

    tableRows.push(`<tr>${firstCell}${secondCell}</tr>`);
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;border:1px solid #eee7db;border-radius:12px;overflow:hidden;background:#ffffff;">
      ${tableRows.join("")}
    </table>
  `;
}

function renderInfoCell([label, value]: [string, string | number]) {
  return `
    <td style="width:50%;padding:10px 12px;border-bottom:1px solid #eee7db;vertical-align:top;">
      <p style="margin:0 0 4px;color:#8a8177;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:0;color:#1f1f1f;font-size:14px;line-height:20px;font-weight:700;">
        ${escapeHtml(String(value))}
      </p>
    </td>
  `;
}

function renderSectionCard({
  content,
  title,
  tone = "plain",
}: {
  content: string;
  title: string;
  tone?: "plain" | "warm";
}) {
  const background = tone === "warm" ? "#fff7ed" : "#ffffff";

  return `
    <div style="margin:0 0 16px;padding:18px;border:1px solid #eee7db;border-radius:14px;background:${background};">
      <h2 style="margin:0 0 12px;color:#1f1f1f;font-size:17px;line-height:22px;font-weight:800;">
        ${escapeHtml(title)}
      </h2>
      ${content}
    </div>
  `;
}

function renderOrderItemsTable(
  items: Array<Pick<Database["public"]["Tables"]["order_items"]["Row"], "product_name" | "quantity" | "line_total">>,
) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee7db;vertical-align:top;">
            <p style="margin:0;color:#1f1f1f;font-size:14px;line-height:20px;font-weight:700;">
              ${escapeHtml(item.product_name)}
            </p>
            <p style="margin:4px 0 0;color:#6d675f;font-size:13px;">Ilość: ${item.quantity}</p>
          </td>
          <td align="right" style="padding:12px 0;border-bottom:1px solid #eee7db;vertical-align:top;color:#1f1f1f;font-size:14px;font-weight:700;">
            ${formatPrice(Number(item.line_total))}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
  `;
}

function renderReturnItemsTable(
  items: Array<{ product_name: string; quantity: number }>,
) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee7db;color:#1f1f1f;font-size:14px;line-height:20px;font-weight:700;">
            ${escapeHtml(item.product_name)}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eee7db;color:#5f5a52;font-size:14px;white-space:nowrap;">
            x ${item.quantity}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
  `;
}

function renderSummaryRows(rows: Array<[string, string, "strong"?]>) {
  return rows
    .map(([label, value, variant]) => {
      const isStrong = variant === "strong";

      return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:7px 0;color:${isStrong ? "#1f1f1f" : "#5f5a52"};font-size:${isStrong ? "16px" : "14px"};font-weight:${isStrong ? "800" : "400"};">
              ${escapeHtml(label)}
            </td>
            <td align="right" style="padding:7px 0;color:#1f1f1f;font-size:${isStrong ? "18px" : "14px"};font-weight:800;white-space:nowrap;">
              ${escapeHtml(value)}
            </td>
          </tr>
        </table>
      `;
    })
    .join("");
}

function renderAddressBlock(title: string, lines: string[]) {
  return `
    <div style="margin:0;color:#5f5a52;font-size:14px;line-height:22px;">
      <p style="margin:0 0 4px;color:#1f1f1f;font-weight:800;">${escapeHtml(title)}</p>
      <p style="margin:0;">${lines.map((line) => escapeHtml(line)).join("<br />")}</p>
    </div>
  `;
}

function renderBulletList(lines: string[]) {
  return `
    <ul style="margin:14px 0 0;padding:0;list-style:none;color:#5f5a52;font-size:14px;line-height:22px;">
      ${lines
        .map(
          (line) => `
            <li style="margin:0 0 8px;padding:0;">
              <span style="display:inline-block;width:20px;height:20px;margin-right:8px;border-radius:999px;background:#fff;border:1px solid #eadfce;color:#b65320;text-align:center;line-height:18px;font-size:12px;font-weight:800;">✓</span>
              ${escapeHtml(line)}
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderHighlightMetric(label: string, value: string) {
  return `
    <div style="margin:0 0 16px;padding:18px;border-radius:14px;background:#1f1f1f;color:#ffffff;">
      <p style="margin:0 0 4px;color:#ffffff99;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
        ${escapeHtml(label)}
      </p>
      <p style="margin:0;color:#ffffff;font-size:26px;line-height:32px;font-weight:800;">
        ${escapeHtml(value)}
      </p>
    </div>
  `;
}

function renderButton(label: string, href: string, variant: "primary" | "secondary" = "primary") {
  const isPrimary = variant === "primary";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0 0;border-collapse:collapse;">
      <tr>
        <td style="border-radius:999px;background:${isPrimary ? "#1f1f1f" : "#fffdf8"};border:1px solid ${isPrimary ? "#1f1f1f" : "#d7cab9"};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;color:${isPrimary ? "#ffffff" : "#1f1f1f"};font-size:14px;font-weight:800;text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function getOrderStatusUrl(orderNumber: string, email: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://www.pawlypetshop.pl";

  return `${appUrl}/zamowienie/status?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`;
}

function getDeliveryName(deliveryMethod: string) {
  try {
    return getDeliveryOption(deliveryMethod as never).name;
  } catch {
    return deliveryMethod;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
