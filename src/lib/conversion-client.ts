import type { ConversionEventType } from "@/lib/conversion";

const VISITOR_KEY = "pawly_conversion_visitor_id";
const SESSION_KEY = "pawly_conversion_session_id";
const SESSION_STARTED_KEY = "pawly_conversion_session_started_at";
const SESSION_TTL_MS = 30 * 60 * 1000;

type ConversionPayload = {
  eventType: ConversionEventType;
  pagePath?: string;
  pageTitle?: string;
  referrer?: string;
  productSlug?: string;
  productName?: string;
  productCategory?: string;
  orderNumber?: string;
  amount?: number;
  quantity?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export function trackConversionEvent(payload: ConversionPayload) {
  if (typeof window === "undefined" || isAdminPath(window.location.pathname)) {
    return;
  }

  const identity = getConversionIdentity();

  if (!identity) {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    pagePath:
      payload.pagePath ??
      `${window.location.pathname}${window.location.search}`.slice(0, 500),
    pageTitle: payload.pageTitle ?? document.title,
    referrer: payload.referrer ?? document.referrer,
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/conversion",
      new Blob([body], { type: "application/json" }),
    );

    if (sent) {
      return;
    }
  }

  void fetch("/api/conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should never interrupt shopping.
  });
}

export function getConversionIdentity() {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    visitorId: getOrCreateStorageId(VISITOR_KEY, window.localStorage),
    sessionId: getOrCreateSessionId(),
  };
}

function getOrCreateSessionId() {
  const startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_KEY));
  const isFresh = Number.isFinite(startedAt) && Date.now() - startedAt < SESSION_TTL_MS;

  if (isFresh) {
    const sessionId = window.sessionStorage.getItem(SESSION_KEY);

    if (sessionId) {
      return sessionId;
    }
  }

  const nextSessionId = createId("s");
  window.sessionStorage.setItem(SESSION_KEY, nextSessionId);
  window.sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));

  return nextSessionId;
}

function getOrCreateStorageId(key: string, storage: Storage) {
  const existing = storage.getItem(key);

  if (existing) {
    return existing;
  }

  const nextId = createId("v");
  storage.setItem(key, nextId);

  return nextId;
}

function createId(prefix: string) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
