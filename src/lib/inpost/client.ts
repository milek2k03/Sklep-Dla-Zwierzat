import { getInpostShipXEnv } from "@/lib/inpost/env";

const REQUEST_TIMEOUT_MS = 15_000;

export class InpostApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "InpostApiError";
    this.status = status;
    this.details = details;
  }
}

export async function inpostShipXRequest<T>(
  path: string,
  init?: RequestInit,
) {
  const env = getInpostShipXEnv();

  if (!env.token || !env.organizationId) {
    throw new InpostApiError(
      "Brakuje INPOST_SHIPX_TOKEN lub INPOST_ORGANIZATION_ID.",
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Accept-Language": "pl_PL",
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
        "X-User-Agent": "Pawly",
        "X-User-Agent-Version": "1.0",
        ...init?.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await readResponseBody(response);
      throw new InpostApiError(
        getInpostErrorMessage(details) ??
          `InPost ShipX zwrócił błąd HTTP ${response.status}.`,
        response.status,
        details,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof InpostApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new InpostApiError(
        "Przekroczono czas oczekiwania na odpowiedź InPost.",
        504,
      );
    }

    throw new InpostApiError(
      error instanceof Error
        ? `Nie udało się połączyć z InPost: ${error.message}`
        : "Nie udało się połączyć z InPost.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function inpostShipXFileRequest(
  path: string,
  init?: RequestInit,
) {
  const env = getInpostShipXEnv();

  if (!env.token || !env.organizationId) {
    throw new InpostApiError(
      "Brakuje INPOST_SHIPX_TOKEN lub INPOST_ORGANIZATION_ID.",
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${env.token}`,
        "X-User-Agent": "Pawly",
        "X-User-Agent-Version": "1.0",
        ...init?.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await readResponseBody(response);
      throw new InpostApiError(
        getInpostErrorMessage(details) ??
          `InPost ShipX zwrócił błąd HTTP ${response.status}.`,
        response.status,
        details,
      );
    }

    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "application/pdf",
    };
  } catch (error) {
    if (error instanceof InpostApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new InpostApiError(
        "Przekroczono czas oczekiwania na etykietę InPost.",
        504,
      );
    }

    throw new InpostApiError(
      error instanceof Error
        ? `Nie udało się pobrać etykiety InPost: ${error.message}`
        : "Nie udało się pobrać etykiety InPost.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

function getInpostErrorMessage(details: unknown) {
  if (!details || typeof details !== "object") {
    return typeof details === "string" ? details : null;
  }

  const payload = details as Record<string, unknown>;

  for (const key of ["message", "description", "error"]) {
    if (typeof payload[key] === "string" && payload[key]) {
      return payload[key];
    }
  }

  return null;
}
