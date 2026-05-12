import { Router } from "express";
import { createStaff, getDashboard } from "../controllers/admin.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createStaffSchema } from "../validators/admin.validator.js";

const router = Router();

router.get("/dashboard", authenticate, authorize("ADMIN"), asyncHandler(getDashboard));
router.post(
  "/staff",
  authenticate,
  authorize("ADMIN"),
  validateBody(createStaffSchema),
  asyncHandler(createStaff)
);

export default router;
