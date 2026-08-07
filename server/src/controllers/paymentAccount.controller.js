import * as paymentAccountService from "../services/paymentAccount.service.js";
import ApiResponse from "../utils/ApiResponse.js";

export const connect = async (req, res) => {
  const result = await paymentAccountService.connectPaymentAccount({
    ownerId: req.user._id,
  });

  res
    .status(200)
    .json(
      new ApiResponse(200, "Payment account connected successfully.", result)
    );
};

export const getStatus = async (req, res) => {
  const result = await paymentAccountService.refreshPaymentAccountStatus({
    ownerId: req.user._id,
  });

  res
    .status(200)
    .json(
      new ApiResponse(200, "Payment account status retrieved.", result)
    );
};
