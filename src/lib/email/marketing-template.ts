export type MarketingProduct = {
  name: string;
  slug: string;
  category: string;
  price: number;
  image_url: string | null;
  image_urls: string[];
};

const categoryImages: Record<string, string> = {
  "Dla psa": "/images/categories/spacer.jpg",
  "Dla kota": "/images/categories/dom.jpg",
  "Spacer i podróż": "/images/categories/spacer.jpg",
  Dom: "/images/categories/dom.jpg",
  Auto: "/images/categories/auto.jpg",
  Zestawy: "/images/categories/zestawy.jpg",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function productImage(product: MarketingProduct, origin: string) {
  const candidate = product.image_urls?.[0] || product.image_url;
  if (candidate) {
    try {
      const url = new URL(candidate, origin);
      if (url.protocol === "https:") return { url: url.toString(), isFallback: false };
    } catch {
      // An invalid image URL should never break a campaign.
    }
  }
  return {
    url: new URL(categoryImages[product.category] ?? "/images/categories/zestawy.jpg", origin).toString(),
    isFallback: true,
  };
}

export function buildMarketingEmail({
  products,
  origin,
  unsubscribe,
  postalAddress,
  isTest = false,
}: {
  products: MarketingProduct[];
  origin: string;
  unsubscribe: string;
  postalAddress: string;
  isTest?: boolean;
}) {
  const catalogUrl = new URL("/produkty", origin).toString();
  const priceFormatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
  const items = products.map((product) => {
    const href = new URL(`/produkt/${encodeURIComponent(product.slug)}`, origin).toString();
    const image = productImage(product, origin);
    return {
      name: product.name,
      category: product.category,
      price: priceFormatter.format(Number(product.price)),
      href,
      image,
    };
  });

  const text = [
    ...(isTest ? ["WIADOMOŚĆ TESTOWA - nie zapisuje adresu na listę marketingową.", ""] : []),
    "Pawly | Praktyczne akcesoria dla psów i kotów",
    "Starannie wybrane produkty dla pupili: do domu, na spacer, do auta i w podróż.",
    "",
    ...items.flatMap((item) => [item.name, item.price, item.href, ""]),
    `Zobacz wszystkie produkty: ${catalogUrl}`,
    "",
    isTest ? `Sprawdź link wypisu: ${unsubscribe}` : `Wypisz się z maili promocyjnych: ${unsubscribe}`,
    postalAddress,
  ].join("\n");

  const productRows = items.map((item) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border:1px solid #e5e0d8;border-radius:6px;background:#ffffff;margin-bottom:14px;">
      <tr>
        <td width="38%" valign="top" style="padding:12px;width:38%;">
          <a href="${escapeHtml(item.href)}" style="text-decoration:none;">
            <img src="${escapeHtml(item.image.url)}" alt="${escapeHtml(item.image.isFallback ? `Zdjęcie kategorii ${item.category}` : `Zdjęcie produktu ${item.name}`)}" width="190" style="display:block;width:100%;max-width:190px;height:auto;border:0;border-radius:4px;" />
          </a>
          ${item.image.isFallback ? '<p style="margin:6px 0 0;font:11px/1.4 Arial,sans-serif;color:#77736d;">Zdjęcie kategorii</p>' : ""}
        </td>
        <td width="62%" valign="top" style="padding:16px 16px 16px 4px;width:62%;font-family:Arial,sans-serif;">
          <p style="margin:0 0 7px;color:#88735e;font-size:11px;line-height:16px;text-transform:uppercase;font-weight:700;">${escapeHtml(item.category)}</p>
          <h2 style="margin:0 0 10px;color:#202320;font-size:18px;line-height:24px;font-weight:700;">${escapeHtml(item.name)}</h2>
          <p style="margin:0 0 16px;color:#202320;font-size:18px;line-height:23px;font-weight:700;">${escapeHtml(item.price)}</p>
          <a href="${escapeHtml(item.href)}" style="display:inline-block;padding:11px 15px;border-radius:4px;background:#e96f32;color:#ffffff;font-size:13px;line-height:18px;font-weight:700;text-decoration:none;">Zobacz produkt</a>
        </td>
      </tr>
    </table>`).join("");

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pawly</title></head>
  <body style="margin:0;padding:0;background:#f3f4f0;color:#202320;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Akcesoria dla psa i kota, które przydają się na co dzień.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f0;"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;">
        <tr><td style="padding:20px 28px;background:#1f2522;color:#ffffff;font-family:Arial,sans-serif;">
          <span style="font-size:26px;line-height:32px;font-weight:800;">Pawly</span><span style="float:right;padding-top:8px;color:#d7e3d7;font-size:11px;font-weight:700;">DLA PSA I KOTA</span>
        </td></tr>
        ${isTest ? '<tr><td style="padding:12px 28px;background:#fff1e6;color:#8f421b;font:700 12px/18px Arial,sans-serif;">WIADOMOŚĆ TESTOWA - nie zapisuje adresu na listę marketingową</td></tr>' : ""}
        <tr><td style="padding:30px 28px 18px;font-family:Arial,sans-serif;">
          <p style="margin:0 0 10px;color:#b35122;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;">Wybrane dla pupili</p>
          <h1 style="margin:0 0 12px;color:#202320;font-size:30px;line-height:36px;font-weight:700;">Praktyczne akcesoria dla psów i kotów</h1>
          <p style="margin:0;color:#56605a;font-size:15px;line-height:24px;">Starannie wybrane produkty do domu, na spacer, do auta i w podróż. Prosto, wygodnie i bez bałaganu.</p>
        </td></tr>
        <tr><td style="padding:8px 28px 16px;">${productRows}</td></tr>
        <tr><td align="center" style="padding:0 28px 30px;font-family:Arial,sans-serif;">
          <a href="${escapeHtml(catalogUrl)}" style="display:inline-block;padding:13px 22px;border:1px solid #1f2522;border-radius:4px;color:#1f2522;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">Zobacz wszystkie produkty</a>
        </td></tr>
        <tr><td style="padding:23px 28px;background:#eef1ed;color:#58615b;font:12px/19px Arial,sans-serif;">
          ${isTest ? "To wiadomość testowa." : "Otrzymujesz tę wiadomość, ponieważ wyrażono zgodę na maile promocyjne Pawly."}<br>
          <a href="${escapeHtml(unsubscribe)}" style="color:#8a3d1a;text-decoration:underline;">Wypisz się z maili promocyjnych</a><br>
          ${escapeHtml(postalAddress)}
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  return { html, text };
}
