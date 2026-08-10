import { Router } from "express";

import * as offerController from "../controllers/offer.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import validateRequest from "../middleware/validateRequest.js";
import authenticate from "../middleware/authenticate.js";

import {
  createOfferSchema,
  listAvailableOffersQuerySchema,
  updateOfferSchema,
  toggleOfferActiveSchema,
  offerIdSchema,
} from "../validators/offer.validator.js";

const router = Router();

// All offer routes require authentication.
router.use(authenticate);

router.post(
  "/",
  validateRequest(createOfferSchema),
  asyncHandler(offerController.create)
);

router.get("/", asyncHandler(offerController.getAll));

// Customer: offers claimable for a restaurant and the customer's own offers.
// Registered before "/:offerId" so they are not captured as an offer id.
router.get(
  "/available",
  validateRequest(listAvailableOffersQuerySchema, "query"),
  asyncHandler(offerController.getAvailable)
);
router.get("/mine", asyncHandler(offerController.getMy));

router.get(
  "/:offerId",
  validateRequest(offerIdSchema, "params"),
  asyncHandler(offerController.getById)
);

router.patch(
  "/:offerId",
  validateRequest(offerIdSchema, "params"),
  validateRequest(updateOfferSchema),
  asyncHandler(offerController.update)
);

router.delete(
  "/:offerId",
  validateRequest(offerIdSchema, "params"),
  asyncHandler(offerController.remove)
);

router.patch(
  "/:offerId/active",
  validateRequest(offerIdSchema, "params"),
  validateRequest(toggleOfferActiveSchema),
  asyncHandler(offerController.toggleActive)
);

router.post(
  "/:offerId/claim",
  validateRequest(offerIdSchema, "params"),
  asyncHandler(offerController.claim)
);

router.get(
  "/:offerId/stats",
  validateRequest(offerIdSchema, "params"),
  asyncHandler(offerController.getStats)
);

router.get(
  "/:offerId/recipients",
  validateRequest(offerIdSchema, "params"),
  asyncHandler(offerController.getRecipients)
);

export default router;
