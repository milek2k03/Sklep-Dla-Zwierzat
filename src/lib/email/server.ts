import { Resend } from "resend";
import { getEmailEnv } from "@/lib/email/env";

let resendClient: Resend | null = null;

export function getResendClient() {
  const { resendApiKey } = getEmailEnv();

  if (!resendApiKey) {
    throw new Error("Brak RESEND_API_KEY w konfiguracji.");
  }

  resendClient ??= new Resend(resendApiKey);

  return resendClient;
}
