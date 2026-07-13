import { Resend } from "resend";
import { getEmailEnv } from "@/lib/email/env";

let resendClient: Resend | null = null;
const keyedResendClients = new Map<string, Resend>();

export function getResendClient(apiKey?: string) {
  const { resendApiKey } = getEmailEnv();
  const resolvedApiKey = apiKey || resendApiKey;

  if (!resolvedApiKey) {
    throw new Error("Brak RESEND_API_KEY w konfiguracji.");
  }

  if (apiKey) {
    const existingClient = keyedResendClients.get(resolvedApiKey);

    if (existingClient) {
      return existingClient;
    }

    const nextClient = new Resend(resolvedApiKey);
    keyedResendClients.set(resolvedApiKey, nextClient);

    return nextClient;
  }

  resendClient ??= new Resend(resolvedApiKey);

  return resendClient;
}
