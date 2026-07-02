export function getEmailEnv() {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    orderNotificationEmail: process.env.ORDER_NOTIFICATION_EMAIL,
    storeFromEmail: process.env.STORE_FROM_EMAIL,
  };
}

export function hasEmailEnv() {
  const { resendApiKey, orderNotificationEmail, storeFromEmail } = getEmailEnv();

  return Boolean(resendApiKey && orderNotificationEmail && storeFromEmail);
}
