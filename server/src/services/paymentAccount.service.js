import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import {
  RAZORPAY_ACCOUNT_STATUS,
} from "../utils/constants.js";
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
 * Connect the owner's Razorpay payout account (creates the linked account and
 * returns the onboarding/KYC link). Never stores secrets — only the Linked
 * Account ID and its activation status are persisted.
 */
export const connectPaymentAccount = async ({ ownerId }) => {
  const owner = await getOwnerOrThrow(ownerId);

  if (!owner.razorpayAccountId) {
    const account = await createPaymentAccount({
      email: owner.email,
      contact: owner.phoneNumber || "9999999999",
      legalBusinessName: owner.fullName,
    });

    owner.razorpayAccountId = account.id;
    owner.razorpayAccountStatus = mapStatus(account.active);
    await owner.save();
  }

  const onboardingLink = await createPaymentAccountOnboardingLink({
    accountId: owner.razorpayAccountId,
    email: owner.email,
    contact: owner.phoneNumber || "9999999999",
    businessName: owner.fullName,
  });

  return {
    accountId: owner.razorpayAccountId,
    status: owner.razorpayAccountStatus,
    onboardingLink: onboardingLink.url,
  };
};

/**
 * Refresh the owner's Razorpay payout account status from the gateway.
 */
export const refreshPaymentAccountStatus = async ({ ownerId }) => {
  const owner = await getOwnerOrThrow(ownerId);

  if (!owner.razorpayAccountId) {
    return {
      accountId: "",
      status: RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED,
    };
  }

  const account = await getPaymentAccountStatus(owner.razorpayAccountId);

  owner.razorpayAccountStatus = mapStatus(account.active);
  await owner.save();

  return {
    accountId: owner.razorpayAccountId,
    status: owner.razorpayAccountStatus,
  };
};
