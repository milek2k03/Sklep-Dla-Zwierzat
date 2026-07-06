import { normalizePickupPointCode } from "@/lib/delivery";

const INPOST_POINTS_API_URL = "https://api.inpost.pl/v1/points";
const REQUEST_TIMEOUT_MS = 10_000;

export type InpostPoint = {
  name: string;
  displayName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  type: string[];
};

type InpostPointsResponse = {
  items?: Array<{
    name?: string;
    display_name?: string;
    status?: string;
    type?: string[];
    functions?: string[];
    address?: {
      line1?: string;
      line2?: string;
    };
    address_details?: {
      city?: string;
      post_code?: string;
    };
  }>;
};

export async function getVerifiedInpostPoint(
  pointCode: string,
): Promise<InpostPoint | null> {
  const normalizedCode = normalizePickupPointCode(pointCode);

  if (!normalizedCode) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${INPOST_POINTS_API_URL}?name=${encodeURIComponent(normalizedCode)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`INPOST_POINTS_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as InpostPointsResponse;
    const point = payload.items?.find(
      (item) => normalizePickupPointCode(item.name ?? "") === normalizedCode,
    );

    if (
      !point?.name ||
      point.status !== "Operating" ||
      !point.functions?.includes("parcel_collect")
    ) {
      return null;
    }

    return {
      name: point.name,
      displayName: point.display_name ?? point.name,
      addressLine1: point.address?.line1 ?? "",
      addressLine2: point.address?.line2 ?? "",
      city: point.address_details?.city ?? "",
      postCode: point.address_details?.post_code ?? "",
      type: point.type ?? [],
    };
  } finally {
    clearTimeout(timeout);
  }
}
