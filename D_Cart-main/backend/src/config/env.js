const required = ["DATABASE_URL", "JWT_SECRET"];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  appName: process.env.APP_NAME || "D'Cart",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  frontendUrls: (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "no-reply@dcart.local",
  smtpSecure: process.env.SMTP_SECURE === "true",
  paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY || "",
  paymongoPublicKey: process.env.PAYMONGO_PUBLIC_KEY || "",
  paymongoWebhookSecret: process.env.PAYMONGO_WEBHOOK_SECRET || "",
  paymongoApiBaseUrl: process.env.PAYMONGO_API_BASE_URL || "https://api.paymongo.com",
  checkoutSuccessUrl:
    process.env.CHECKOUT_SUCCESS_URL || "http://localhost:5173/payment/success",
  checkoutCancelUrl:
    process.env.CHECKOUT_CANCEL_URL || "http://localhost:5173/payment/cancelled"
};
