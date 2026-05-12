import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { ROLES } from "../constants/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getPickerOrders,
  claimOrder,
  substituteItem,
  updatePickerNotes
} from "../controllers/picker.controller.js";

const router = Router();

// All picker routes require authentication + STAFF or ADMIN role
router.use(authenticate, authorize(ROLES.STAFF, ROLES.ADMIN));

router.get("/orders", asyncHandler(getPickerOrders));
router.patch("/orders/:orderId/claim", asyncHandler(claimOrder));
router.patch("/orders/:orderId/items/:itemId/substitute", asyncHandler(substituteItem));
router.patch("/orders/:orderId/notes", asyncHandler(updatePickerNotes));

export default router;
