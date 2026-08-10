import * as offerService from "../services/offer.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { USER_ROLE } from "../utils/constants.js";

const assertOwner = (req) => {
  if (req.user.role !== USER_ROLE.OWNER) {
    throw new ApiError(403, "Only restaurant owners can manage offers.");
  }
};

const assertCustomer = (req) => {
  if (req.user.role !== USER_ROLE.CUSTOMER) {
    throw new ApiError(403, "Only customers can claim offers.");
  }
};

const assertOwnerOrAdmin = (req) => {
  if (
    req.user.role !== USER_ROLE.OWNER &&
    req.user.role !== USER_ROLE.ADMIN
  ) {
    throw new ApiError(403, "You do not have permission to view this resource.");
  }
};

export const create = async (req, res) => {
  assertOwner(req);

  const result = await offerService.createOffer({
    ownerId: req.user._id,
    data: req.validatedData,
  });

  res.status(201).json(new ApiResponse(201, result.message, result));
};

export const getAll = async (req, res) => {
  assertOwnerOrAdmin(req);

  const admin = req.user.role === USER_ROLE.ADMIN;

  const result = await offerService.getOffers({
    ownerId: admin ? null : req.user._id,
    restaurantId: req.query.restaurantId || null,
    page: req.query.page,
    limit: req.query.limit,
    excludeClaimed: req.query.excludeClaimed,
    search: req.query.search,
    status: req.query.status,
    admin,
  });

  res.status(200).json(new ApiResponse(200, "Offers retrieved successfully.", result));
};

export const getAvailable = async (req, res) => {
  assertCustomer(req);

  // restaurantId is optional (validated on the route). When omitted, live
  // offers across every active restaurant are returned.
  const result = await offerService.getAvailableOffers({
    customerId: req.user._id,
    restaurantId: req.query.restaurantId,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.status(200).json(new ApiResponse(200, "Available offers retrieved successfully.", result));
};

export const getMy = async (req, res) => {
  assertCustomer(req);

  const result = await offerService.getMyOffers({
    customerId: req.user._id,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });

  res.status(200).json(new ApiResponse(200, "Your offers retrieved successfully.", result));
};

export const getById = async (req, res) => {
  const { offerId } = req.params;

  const result = await offerService.getOfferById({ offerId });

  // Customers should not see internal targeting/ownership fields.
  if (req.user.role === USER_ROLE.CUSTOMER && result.offer) {
    const offer = result.offer.toObject ? result.offer.toObject() : result.offer;
    delete offer.segmentRules;
    delete offer.targetUserIds;
    delete offer.createdBy;
    delete offer.stats;

    res
      .status(200)
      .json(new ApiResponse(200, "Offer retrieved successfully.", { offer }));
    return;
  }

  res.status(200).json(new ApiResponse(200, "Offer retrieved successfully.", result));
};

export const update = async (req, res) => {
  assertOwner(req);

  const result = await offerService.updateOffer({
    ownerId: req.user._id,
    offerId: req.params.offerId,
    updates: req.validatedData,
  });

  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const remove = async (req, res) => {
  assertOwner(req);

  const result = await offerService.deleteOffer({
    ownerId: req.user._id,
    offerId: req.params.offerId,
  });

  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const toggleActive = async (req, res) => {
  assertOwner(req);

  const result = await offerService.setOfferActive({
    ownerId: req.user._id,
    offerId: req.params.offerId,
    isActive: req.validatedData.isActive,
  });

  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const claim = async (req, res) => {
  assertCustomer(req);

  const result = await offerService.claimOffer({
    customerId: req.user._id,
    offerId: req.params.offerId,
  });

  res.status(200).json(new ApiResponse(200, result.message, result));
};

export const getStats = async (req, res) => {
  assertOwnerOrAdmin(req);

  const result = await offerService.getOfferStats({
    offerId: req.params.offerId,
    ownerId: req.user.role === USER_ROLE.OWNER ? req.user._id : null,
  });

  res.status(200).json(new ApiResponse(200, "Offer statistics retrieved successfully.", result));
};

export const getRecipients = async (req, res) => {
  assertOwnerOrAdmin(req);

  const result = await offerService.getOfferRecipients({
    offerId: req.params.offerId,
    ownerId: req.user.role === USER_ROLE.OWNER ? req.user._id : null,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });

  res.status(200).json(new ApiResponse(200, "Offer recipients retrieved successfully.", result));
};
