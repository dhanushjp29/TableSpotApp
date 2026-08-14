import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import asyncHandler from "../utils/asyncHandler.js";
import * as receiptController from "../controllers/receipt.controller.js";

const router = Router();
router.use(authenticate);
router.get("/booking/:id.pdf", asyncHandler(receiptController.booking));
router.get("/bill/:id.pdf", asyncHandler(receiptController.bill));
router.get("/payment/:id.pdf", asyncHandler(receiptController.payment));
router.get("/refund/:id.pdf", asyncHandler(receiptController.refund));
export default router;
