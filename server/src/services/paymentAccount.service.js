import crypto from "node:crypto";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import {
  RAZORPAY_ACCOUNT_STATUS,
  RAZORPAY_ACCOUNT_CREATION_STATUS,
} from "../utils/constants.js";
import {
  getTestRazorpayAccountId,
  isRazorpayMockEnabled,
} from "../config/razorpay.js";
import {
  createPaymentAccount,
  createPaymentAccountOnboardingLink,
  getPaymentAccountStatus,
} from "./razorpay.service.js";

const getOwnerOrThrow = async (ownerId) => {
  const owner = await User.findById(ownerId);

  if (!owner || owner.isDeleted || !owner.isActive) {
    throw new ApiError(404, "Owner account not found.");
  }

  return owner;
};

const mapStatus = (active) =>
  active
    ? RAZORPAY_ACCOUNT_STATUS.CONNECTED
    : RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING;

/**
 * Detect a leftover mock account id persisted while RAZORPAY_ONBOARDING_MOCK
 * was enabled. In real gateway mode these ids are invalid — the owner must be
 * re-onboarded with a genuine linked account. In mock mode they are valid and
 * must be preserved.
 */
const isStaleMockAccountId = (value) =>
  !isRazorpayMockEnabled("RAZORPAY_ONBOARDING_MOCK") &&
  String(value || "").startsWith("acc_mock_");

const CREATION_LEASE_MS = 5 * 60 * 1000;
const CREATION_WAIT_TIMEOUT_MS = 30 * 1000;
const CREATION_POLL_MS = 50;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const claimAccountCreation = async (ownerId) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - CREATION_LEASE_MS);
  const attemptId = crypto.randomUUID();

  return User.findOneAndUpdate(
    {
      _id: ownerId,
      $or: [
        {
          razorpayAccountId: { $in: ["", null] },
          razorpayAccountCreationStatus: {
            $ne: RAZORPAY_ACCOUNT_CREATION_STATUS.PROCESSING,
          },
        },
        {
          razorpayAccountId: { $in: ["", null] },
          razorpayAccountCreationStatus:
            RAZORPAY_ACCOUNT_CREATION_STATUS.PROCESSING,
          razorpayAccountCreationStartedAt: { $lte: staleBefore },
        },
      ],
    },
    {
      $set: {
        razorpayAccountCreationStatus:
          RAZORPAY_ACCOUNT_CREATION_STATUS.PROCESSING,
        razorpayAccountCreationAttemptId: attemptId,
        razorpayAccountCreationStartedAt: now,
      },
    },
    { new: true }
  ).select("+razorpayAccountCreationAttemptId +razorpayAccountCreationStartedAt");
};

const clearAccountCreationClaim = async (ownerId, attemptId) => {
  await User.updateOne(
    {
      _id: ownerId,
      razorpayAccountCreationStatus:
        RAZORPAY_ACCOUNT_CREATION_STATUS.PROCESSING,
      razorpayAccountCreationAttemptId: attemptId,
    },
    {
      $set: {
        razorpayAccountCreationStatus: RAZORPAY_ACCOUNT_CREATION_STATUS.IDLE,
        razorpayAccountCreationAttemptId: "",
        razorpayAccountCreationStartedAt: null,
      },
    }
  );
};

const storeCreatedAccount = async ({ ownerId, attemptId, account }) => {
  const updated = await User.findOneAndUpdate(
    {
      _id: ownerId,
      razorpayAccountId: { $in: ["", null] },
      razorpayAccountCreationStatus:
        RAZORPAY_ACCOUNT_CREATION_STATUS.PROCESSING,
      razorpayAccountCreationAttemptId: attemptId,
    },
    {
      $set: {
        razorpayAccountId: account.id,
        razorpayAccountStatus: mapStatus(account.active),
        razorpayAccountCreationStatus: RAZORPAY_ACCOUNT_CREATION_STATUS.IDLE,
        razorpayAccountCreationAttemptId: "",
        razorpayAccountCreationStartedAt: null,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new ApiError(409, "Razorpay account creation could not be finalized.");
  }

  return updated;
};

/**
 * Connect the owner's Razorpay payout account (creates the linked account and
 * returns the onboarding/KYC link). Never stores secrets — only the Linked
 * Account ID and its activation status are persisted.
 */
export const connectPaymentAccount = async ({ ownerId }) => {
  const startedAt = Date.now();
  let owner = await getOwnerOrThrow(ownerId);
  const testRazorpayAccountId = getTestRazorpayAccountId();

  if (testRazorpayAccountId) {
    return {
      accountId: testRazorpayAccountId,
      status: RAZORPAY_ACCOUNT_STATUS.CONNECTED,
      onboardingLink: "",
      activationStatus: "activated",
      testMode: true,
    };
  }

  // Clear stale mock linked accounts so a real account is created instead of
  // sending an acc_mock_ id to the live gateway (400 "not a valid id").
  if (isStaleMockAccountId(owner.razorpayAccountId)) {
    owner.razorpayAccountId = "";
    owner.razorpayProductId = "";
    owner.razorpayAccountStatus = RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED;
    await owner.save();
  }

  while (!owner.razorpayAccountId) {
    const claimed = await claimAccountCreation(ownerId);

    if (claimed) {
      const attemptId = claimed.razorpayAccountCreationAttemptId;
      try {
        const restaurant = await Restaurant.findOne({
          ownerId,
          isDeleted: false,
        })
          .select("address city state pincode country")
          .sort({ createdAt: 1 })
          .lean();

        const account = await createPaymentAccount({
          email: claimed.email,
          phone: claimed.phoneNumber || "9999999999",
          legalBusinessName: claimed.fullName,
          registeredAddress: restaurant
            ? {
                street1: restaurant.address,
                street2: "",
                city: restaurant.city,
                state: restaurant.state,
                postalCode: restaurant.pincode,
                country: restaurant.country,
              }
            : null,
        });
        owner = await storeCreatedAccount({ ownerId, attemptId, account });
      } catch (error) {
        await clearAccountCreationClaim(ownerId, attemptId);
        throw error;
      }
      break;
    }

    owner = await getOwnerOrThrow(ownerId);
    if (owner.razorpayAccountId) break;
    if (Date.now() - startedAt >= CREATION_WAIT_TIMEOUT_MS) {
      throw new ApiError(409, "Razorpay account creation is already in progress.");
    }
    await sleep(CREATION_POLL_MS);
  }

  const onboarding = await createPaymentAccountOnboardingLink({
    accountId: owner.razorpayAccountId,
  });

  if (onboarding.productId && onboarding.productId !== owner.razorpayProductId) {
    owner.razorpayProductId = onboarding.productId;
    owner.razorpayAccountStatus = mapStatus(
      onboarding.activationStatus === "activated"
    );
    await owner.save();
  }

  return {
    accountId: owner.razorpayAccountId,
    status: owner.razorpayAccountStatus,
    onboardingLink: onboarding.url,
    activationStatus: onboarding.activationStatus,
  };
};

/**
 * Refresh the owner's Razorpay payout account status from the gateway.
 */
export const refreshPaymentAccountStatus = async ({ ownerId }) => {
  const owner = await getOwnerOrThrow(ownerId);
  const testRazorpayAccountId = getTestRazorpayAccountId();

  if (testRazorpayAccountId) {
    return {
      accountId: testRazorpayAccountId,
      status: RAZORPAY_ACCOUNT_STATUS.CONNECTED,
      activationStatus: "activated",
      testMode: true,
    };
  }

  // A stale mock account id must not be sent to the live gateway.
  if (isStaleMockAccountId(owner.razorpayAccountId)) {
    owner.razorpayAccountId = "";
    owner.razorpayProductId = "";
    owner.razorpayAccountStatus = RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED;
    await owner.save();
  }

  if (!owner.razorpayAccountId) {
    return {
      accountId: "",
      status: RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED,
    };
  }

  const account = await getPaymentAccountStatus(
    owner.razorpayAccountId,
    owner.razorpayProductId
  );

  owner.razorpayAccountStatus = mapStatus(account.active);
  if (account.productId && account.productId !== owner.razorpayProductId) {
    owner.razorpayProductId = account.productId;
  }
  await owner.save();

  return {
    accountId: owner.razorpayAccountId,
    status: owner.razorpayAccountStatus,
    activationStatus: account.activationStatus,
  };
};
