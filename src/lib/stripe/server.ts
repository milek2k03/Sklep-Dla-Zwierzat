import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/stripe/env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  stripeClient ??= new Stripe(getStripeSecretKey());

  return stripeClient;
}
