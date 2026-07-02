export function getStripeEnv() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}

export function hasStripeCheckoutEnv() {
  return Boolean(getStripeEnv().secretKey);
}

export function getStripeSecretKey() {
  const { secretKey } = getStripeEnv();

  if (!secretKey) {
    throw new Error("Brak STRIPE_SECRET_KEY w konfiguracji.");
  }

  return secretKey;
}

export function getStripeWebhookSecret() {
  const { webhookSecret } = getStripeEnv();

  if (!webhookSecret) {
    throw new Error("Brak STRIPE_WEBHOOK_SECRET w konfiguracji.");
  }

  return webhookSecret;
}
