import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import pickerRoutes from "./routes/picker.routes.js";
import geofencingRoutes from "./routes/geofencing.routes.js";
import deliverySlotRoutes from "./routes/deliverySlot.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { sanitizeRequest } from "./middlewares/sanitize.middleware.js";
import { handlePaymongoWebhook } from "./controllers/order.controller.js";
import { asyncHandler } from "./utils/asyncHandler.js";

const app = express();

app.post(
  "/api/payments/paymongo/webhook",
  express.raw({ type: "application/json", limit: "100kb" }),
  asyncHandler(handlePaymongoWebhook)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendUrls.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed."));
    }
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(sanitizeRequest);

// ── Rate Limiting ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." }
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many checkout attempts. Please wait a moment and try again." }
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." }
});

app.use(globalLimiter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "dcart-backend"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders/checkout", checkoutLimiter);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/picker", pickerRoutes);
app.use("/api/geofencing", geofencingRoutes);
app.use("/api/delivery-slots", deliverySlotRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
