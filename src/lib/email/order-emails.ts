import { getDeliveryOption } from "@/lib/delivery";
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
  const items = returnCase.return_case_items
    .map(
      (item) => `
        <li style="margin:0 0 8px;">
          ${escapeHtml(item.product_name)} x ${item.quantity}
        </li>
      `,
    )
    .join("");
  const returnAddressLines = getReturnAddressLines();
  const shipmentInstructionLines = getReturnShipmentInstructionLines(
    returnCase.case_number,
  );
  const returnAddressHtml =
    shouldShowReturnAddress(returnCase) && returnAddressLines.length > 0
      ? `
        <div style="margin:24px 0 0;padding:16px;border:1px solid #eee7db;background:#fffaf2;border-radius:8px;">
          <h2 style="margin:0 0 10px;font-size:18px;">Adres do wysyłki zwrotu/reklamacji</h2>
          <p style="margin:0 0 12px;color:#5f5a52;">
            ${returnAddressLines.map((line) => escapeHtml(line)).join("<br />")}
          </p>
          <h3 style="margin:16px 0 8px;font-size:16px;">Instrukcja odesłania</h3>
          <ul style="margin:0;padding-left:20px;color:#5f5a52;">
            ${shipmentInstructionLines
              .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
              .join("")}
          </ul>
        </div>
      `
      : "";

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;color:#5f5a52;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 16px;color:#5f5a52;">
        <strong>Zamówienie:</strong> ${escapeHtml(returnCase.orders?.order_number ?? "-")}<br />
        <strong>Typ sprawy:</strong> ${returnCaseTypeLabels[returnCase.case_type]}<br />
        <strong>Status:</strong> ${returnCaseStatusLabels[returnCase.status]}
      </p>
      <h2 style="margin:24px 0 12px;font-size:18px;">Produkty</h2>
      <ul style="margin:0 0 20px;padding-left:20px;color:#5f5a52;">${items}</ul>
      ${
        returnCase.customer_message
          ? `<p style="margin:0 0 12px;color:#5f5a52;"><strong>Twoja notatka:</strong> ${escapeHtml(returnCase.customer_message)}</p>`
          : ""
      }
      ${
        Number(returnCase.approved_refund_amount) > 0
          ? `<p style="margin:16px 0 0;font-size:18px;"><strong>Zatwierdzona kwota zwrotu: ${formatPrice(Number(returnCase.approved_refund_amount))}</strong></p>`
          : ""
      }
      ${returnAddressHtml}
    </div>
  `;
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
  const trackingUrl = order.tracking_url
    ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(order.tracking_url)}" style="color:#1f1f1f;font-weight:700;">Śledź przesyłkę</a></p>`
    : "";
  const items = order.order_items
    .map(
      (item) => `
        <li style="margin:0 0 8px;">
          ${escapeHtml(item.product_name)} x ${item.quantity}
        </li>
      `,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">Zamówienie wysłane</h1>
      <p style="margin:0 0 20px;color:#5f5a52;">
        Twoje zamówienie ${escapeHtml(order.order_number)} zostało przekazane do wysyłki.
      </p>
      <p style="margin:0 0 8px;color:#5f5a52;">
        <strong>Przewoźnik:</strong> ${escapeHtml(order.shipping_carrier ?? "-")}<br />
        <strong>Numer śledzenia:</strong> ${escapeHtml(order.tracking_number ?? "-")}
      </p>
      ${trackingUrl}
      <h2 style="margin:24px 0 12px;font-size:18px;">Produkty</h2>
      <ul style="margin:0;padding-left:20px;color:#5f5a52;">${items}</ul>
    </div>
  `;
}

function renderCustomerRefundedOrderHtml(order: PaidOrder) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">Zamówienie anulowane</h1>
      <p style="margin:0 0 20px;color:#5f5a52;">
        Twoje zamówienie ${escapeHtml(order.order_number)} zostało anulowane, a zwrot płatności został zlecony przez Stripe.
      </p>
      <p style="margin:0 0 8px;color:#5f5a52;">
        Czas zaksięgowania zwrotu zależy od banku lub metody płatności.
      </p>
      ${
        order.refund_reason
          ? `<p style="margin:0 0 8px;color:#5f5a52;"><strong>Powód:</strong> ${escapeHtml(order.refund_reason)}</p>`
          : ""
      }
      ${
        order.stripe_refund_id
          ? `<p style="margin:0 0 8px;color:#5f5a52;"><strong>ID zwrotu:</strong> ${escapeHtml(order.stripe_refund_id)}</p>`
          : ""
      }
      <p style="margin:16px 0 0;font-size:18px;">
        <strong>Kwota zamówienia: ${formatPrice(Number(order.total))}</strong>
      </p>
    </div>
  `;
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
  const items = order.order_items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee7db;">
            <strong>${escapeHtml(item.product_name)}</strong><br />
            <span style="color:#6d675f;">Ilość: ${item.quantity}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #eee7db;text-align:right;">
            ${formatPrice(Number(item.line_total))}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;color:#5f5a52;">${escapeHtml(intro)}</p>
      ${
        includeCustomerDetails
          ? `<p style="margin:0 0 20px;color:#5f5a52;">
              <strong>Klient:</strong> ${escapeHtml(order.customer_full_name)}<br />
              <strong>E-mail:</strong> ${escapeHtml(order.customer_email)}<br />
              <strong>Telefon:</strong> ${escapeHtml(order.customer_phone)}
            </p>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tbody>${items}</tbody>
      </table>
      <p style="margin:0 0 8px;color:#5f5a52;">
        Dostawa: ${escapeHtml(getDeliveryName(order.delivery_method))}
        (${formatPrice(Number(order.delivery_cost))})
      </p>
      ${
        Number(order.discount_total) > 0
          ? `<p style="margin:0 0 8px;color:#2f6b3f;">Rabat: -${formatPrice(Number(order.discount_total))}</p>`
          : ""
      }
      <p style="margin:16px 0 24px;font-size:18px;">
        <strong>Razem: ${formatPrice(Number(order.total))}</strong>
      </p>
      <p style="margin:0;color:#5f5a52;">
        <strong>Adres dostawy:</strong><br />
        ${escapeHtml(order.delivery_address).replaceAll("\n", "<br />")}
        ${order.pickup_point ? `<br />Punkt odbioru: ${escapeHtml(order.pickup_point)}` : ""}
      </p>
      ${order.notes ? `<p style="margin:20px 0 0;color:#5f5a52;"><strong>Uwagi:</strong> ${escapeHtml(order.notes)}</p>` : ""}
    </div>
  `;
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
