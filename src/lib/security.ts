import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 32 * 1024;

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function getServerRequestClientIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return headerStore.get("x-real-ip") ?? "unknown";
}

export function rejectCrossOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  try {
    const originUrl = new URL(origin);

    if (originUrl.host === request.nextUrl.host) {
      return null;
    }
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_ORIGIN",
        message: "Niepoprawne źródło żądania.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: "INVALID_ORIGIN",
      message: "Niepoprawne źródło żądania.",
    },
    { status: 403 },
  );
}

export function rejectLargeRequest(
  request: NextRequest,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
) {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    return null;
  }

  const bytes = Number(contentLength);

  if (!Number.isFinite(bytes) || bytes <= maxBytes) {
    return null;
  }

  return NextResponse.json(
    {
      error: "PAYLOAD_TOO_LARGE",
      message: "Żądanie jest za duże.",
    },
    { status: 413 },
  );
}
