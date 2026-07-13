export function getEmailEnv() {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    returnResendApiKey: process.env.RETURN_RESEND_API_KEY,
    orderNotificationEmail: process.env.ORDER_NOTIFICATION_EMAIL,
    storeFromEmail: process.env.STORE_FROM_EMAIL,
    returnFromEmail: process.env.RETURN_FROM_EMAIL,
  };
}

export function hasEmailEnv() {
  const { resendApiKey, orderNotificationEmail, storeFromEmail } = getEmailEnv();

  return Boolean(resendApiKey && orderNotificationEmail && storeFromEmail);
}

export function getReturnEmailConfig() {
  const { resendApiKey, returnFromEmail, returnResendApiKey, storeFromEmail } =
    getEmailEnv();

  return {
    resendApiKey: returnResendApiKey || resendApiKey,
    fromEmail: returnFromEmail || storeFromEmail,
  };
}

export function hasReturnEmailEnv() {
  const { fromEmail, resendApiKey } = getReturnEmailConfig();

  return Boolean(resendApiKey && fromEmail);
}
