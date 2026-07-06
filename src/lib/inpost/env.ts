const DEFAULT_SHIPX_API_URL = "https://api-shipx-pl.easypack24.net";

export type InpostParcelTemplate = "small" | "medium" | "large";

export function getInpostShipXEnv() {
  return {
    apiUrl: (
      process.env.INPOST_SHIPX_API_URL ?? DEFAULT_SHIPX_API_URL
    ).replace(/\/$/, ""),
    token: process.env.INPOST_SHIPX_TOKEN?.trim(),
    organizationId: process.env.INPOST_ORGANIZATION_ID?.trim(),
    lockerTemplate: normalizeParcelTemplate(
      process.env.INPOST_LOCKER_TEMPLATE,
    ),
    courierParcel: {
      length: parsePositiveNumber(process.env.INPOST_COURIER_LENGTH_MM),
      width: parsePositiveNumber(process.env.INPOST_COURIER_WIDTH_MM),
      height: parsePositiveNumber(process.env.INPOST_COURIER_HEIGHT_MM),
      weight: parsePositiveNumber(process.env.INPOST_COURIER_WEIGHT_KG),
    },
  };
}

export function hasInpostShipXEnv() {
  const env = getInpostShipXEnv();

  return Boolean(env.token && env.organizationId);
}

export function hasInpostCourierParcelEnv() {
  const { courierParcel } = getInpostShipXEnv();

  return Boolean(
    courierParcel.length &&
      courierParcel.width &&
      courierParcel.height &&
      courierParcel.weight,
  );
}

function normalizeParcelTemplate(
  value: string | undefined,
): InpostParcelTemplate {
  if (value === "medium" || value === "large") {
    return value;
  }

  return "small";
}

function parsePositiveNumber(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsedValue = Number(value.replace(",", "."));

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : null;
}
