import { Router } from "express";
import express from "express";
import * as paymentWebhookController from "../controllers/payment.webhook.controller.js";

const router = Router();

// Razorpay webhook - must receive the raw body for signature verification.
// This route is mounted in app.js BEFORE express.json().
router.post(
    "/razorpay",
    express.raw({ type: "application/json" }),
    paymentWebhookController.handleWebhook
);

export default router;
