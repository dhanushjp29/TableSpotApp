import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

import {
  createOffer,
  updateOffer,
} from "../../store/slices/offerSlice.js";

import {
  OFFER_DISCOUNT_TYPE,
  OFFER_DISCOUNT_TYPE_OPTIONS,
  OFFER_TARGETING,
  OFFER_TARGETING_OPTIONS,
} from "../../constants/offer.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import InvoiceDatePicker from "../common/InvoiceDatePicker.jsx";
import Input from "../ui/Input.jsx";
import Select from "../ui/Select.jsx";
import CustomerPicker from "./CustomerPicker.jsx";
import OfferPreview from "./OfferPreview.jsx";
import SegmentRulesBuilder from "./SegmentRulesBuilder.jsx";

const OFFER_CODE_REGEX = /^[a-zA-Z0-9_-]+$/;

const buildSegmentRulesPayload = (rules) => ({
  minBookings: Number(rules?.minBookings || 0),
  minTotalSpent: Number(rules?.minTotalSpent || 0),
  hasCompletedBooking: Boolean(rules?.hasCompletedBooking),
  recentWithinDays: Number(rules?.recentWithinDays || 0),
  inactiveSinceDays: Number(rules?.inactiveSinceDays || 0),
});

const hasAnySegmentRule = (rules) => {
  if (rules?.hasCompletedBooking) return true;
  return ["minBookings", "minTotalSpent", "recentWithinDays", "inactiveSinceDays"]
    .map((key) => Number(rules?.[key] || 0))
    .some((value) => value > 0);
};

function OfferForm({
  offer = null,
  restaurants = [],
  defaultRestaurantId = "",
  onSuccess,
  onCancel,
}) {
  const isEdit = Boolean(offer);
  const dispatch = useDispatch();
  const isSubmitting = useSelector((state) => state.offer.isSubmitting);
  const [targetUserIds, setTargetUserIds] = useState(
    (offer?.targetUserIds || []).map((id) => String(id))
  );
  const [segmentRules, setSegmentRules] = useState(offer?.segmentRules || {});
  const [pickerRestaurantId, setPickerRestaurantId] = useState(
    offer?.restaurantId?._id || defaultRestaurantId || ""
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      restaurantId:
        offer?.restaurantId?._id ||
        defaultRestaurantId ||
        (restaurants.length === 1 ? restaurants[0]?._id || "" : ""),
      offerCode: offer?.offerCode || "",
      title: offer?.title || "",
      description: offer?.description || "",
      discountType: offer?.discountType || OFFER_DISCOUNT_TYPE.PERCENTAGE,
      discountValue: offer?.discountValue ?? "",
      minOrderAmount: offer?.minOrderAmount ?? 0,
      maxDiscountAmount: offer?.maxDiscountAmount ?? 0,
      maxRedemptions: offer?.maxRedemptions ?? 0,
      perUserRedemptionLimit: offer?.perUserRedemptionLimit ?? 1,
      validityStart: offer?.validityStart
        ? String(offer.validityStart).slice(0, 10)
        : "",
      validityEnd: offer?.validityEnd
        ? String(offer.validityEnd).slice(0, 10)
        : "",
      targeting: offer?.targeting || OFFER_TARGETING.ALL,
      isStackable: Boolean(offer?.isStackable),
    },
  });

  const discountType = useWatch({ control, name: "discountType" });
  const targeting = useWatch({ control, name: "targeting" });
  const validityStart = useWatch({ control, name: "validityStart" });
  const validityEnd = useWatch({ control, name: "validityEnd" });
  const watchedOfferCode = useWatch({ control, name: "offerCode" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedDescription = useWatch({ control, name: "description" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" });
  const watchedMinOrderAmount = useWatch({ control, name: "minOrderAmount" });
  const watchedMaxDiscountAmount = useWatch({
    control,
    name: "maxDiscountAmount",
  });

  const previewOffer = {
    offerCode: (watchedOfferCode || "").toUpperCase(),
    title: watchedTitle,
    description: watchedDescription,
    discountType,
    discountValue: watchedDiscountValue,
    minOrderAmount: watchedMinOrderAmount,
    maxDiscountAmount: watchedMaxDiscountAmount,
    validityStart,
    validityEnd,
    targeting,
    isActive: offer?.isActive ?? true,
  };

  const handleTargetingChange = (event) => {
    setValue("targeting", event.target.value, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    try {
      if (!data.restaurantId) {
        toast.error("Please select a restaurant.");
        return;
      }
      if (!OFFER_CODE_REGEX.test(data.offerCode)) {
        toast.error(
          "Offer code can only contain letters, numbers, underscore or dash."
        );
        return;
      }
      const discountValue = Number(data.discountValue);
      if (!discountValue || discountValue <= 0) {
        toast.error("Discount value must be greater than zero.");
        return;
      }
      if (
        data.discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE &&
        discountValue > 100
      ) {
        toast.error("Percentage discount cannot exceed 100%.");
        return;
      }
      if (!data.validityStart || !data.validityEnd) {
        toast.error("Offer validity start and end dates are required.");
        return;
      }
      if (data.validityEnd <= data.validityStart) {
        toast.error("Validity end must be after validity start.");
        return;
      }
      if (data.targeting === OFFER_TARGETING.SELECTED && targetUserIds.length === 0) {
        toast.error("Selected targeting requires at least one customer.");
        return;
      }
      if (
        data.targeting === OFFER_TARGETING.SEGMENT &&
        !hasAnySegmentRule(segmentRules)
      ) {
        toast.error("Segment targeting requires at least one rule.");
        return;
      }

      const payload = {
        restaurantId: data.restaurantId,
        offerCode: String(data.offerCode).trim().toUpperCase(),
        title: data.title.trim(),
        description: (data.description || "").trim(),
        discountType: data.discountType,
        discountValue,
        minOrderAmount: Number(data.minOrderAmount) || 0,
        maxDiscountAmount: Number(data.maxDiscountAmount) || 0,
        maxRedemptions: Number(data.maxRedemptions) || 0,
        perUserRedemptionLimit: Number(data.perUserRedemptionLimit) || 1,
        validityStart: data.validityStart,
        validityEnd: data.validityEnd,
        targeting: data.targeting,
        isStackable: Boolean(data.isStackable),
      };

      if (data.targeting === OFFER_TARGETING.SELECTED) {
        payload.targetUserIds = targetUserIds;
      }
      if (data.targeting === OFFER_TARGETING.SEGMENT) {
        payload.segmentRules = buildSegmentRulesPayload(segmentRules);
      }

      if (isEdit) {
        await dispatch(updateOffer(offer._id, payload));
        toast.success("Offer updated successfully!");
      } else {
        await dispatch(createOffer(payload));
        toast.success("Offer created successfully!");
      }
      onSuccess();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to save offer."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <OfferPreview offer={previewOffer} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Restaurant *"
          disabled={isEdit}
          error={errors.restaurantId?.message}
          {...register("restaurantId", {
            required: "Restaurant is required.",
          })}
        >
          <option value="">Select a restaurant</option>
          {restaurants.map((r) => (
            <option key={r._id} value={r._id}>
              {r.restaurantName}
              {r.city ? ` - ${r.city}` : ""}
            </option>
          ))}
        </Select>
        <Input
          label="Offer Code *"
          disabled={isEdit}
          error={errors.offerCode?.message}
          hint="3-30 chars, A-Z, 0-9, _ or -. Saved in uppercase."
          {...register("offerCode", {
            required: "Offer code is required.",
            minLength: {
              value: 3,
              message: "Offer code must be at least 3 characters.",
            },
            maxLength: {
              value: 30,
              message: "Offer code cannot exceed 30 characters.",
            },
            pattern: {
              value: OFFER_CODE_REGEX,
              message: "Only letters, numbers, underscore or dash allowed.",
            },
          })}
          placeholder="e.g. WEEKEND20"
        />
      </div>

      <Input
        label="Offer Title *"
        error={errors.title?.message}
        {...register("title", {
          required: "Offer title is required.",
          minLength: {
            value: 3,
            message: "Title must be at least 3 characters.",
          },
        })}
        placeholder="e.g. Weekend Feast"
      />

      <div>
        <label className="input-label">Description</label>
        <textarea
          {...register("description")}
          rows={3}
          className="input-field w-full"
          placeholder="What makes this offer great?"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Discount Type *" {...register("discountType")}>
          {OFFER_DISCOUNT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Input
          label="Discount Value *"
          type="number"
          min={0}
          step="0.01"
          error={errors.discountValue?.message}
          hint={
            discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE
              ? "Percentage off the bill subtotal (max 100)."
              : "Flat amount off the bill subtotal."
          }
          {...register("discountValue", {
            required: "Discount value is required.",
            validate: (value) =>
              Number(value) > 0 || "Discount value must be greater than zero.",
          })}
          placeholder={discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE ? "e.g. 20" : "e.g. 200"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Minimum Order Amount (₹)"
          type="number"
          min={0}
          hint="0 = no minimum."
          {...register("minOrderAmount")}
        />
        {discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE && (
          <Input
            label="Max Discount Amount (₹)"
            type="number"
            min={0}
            hint="0 = no cap."
            {...register("maxDiscountAmount")}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Max Redemptions"
          type="number"
          min={0}
          hint="0 = unlimited."
          {...register("maxRedemptions")}
        />
        <Input
          label="Per-User Redemption Limit"
          type="number"
          min={1}
          hint="How many times one customer can use it."
          {...register("perUserRedemptionLimit")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InvoiceDatePicker
          label="Validity Start *"
          value={validityStart}
          max={validityEnd || undefined}
          onChange={(iso) =>
            setValue("validityStart", iso, { shouldValidate: true })
          }
          error={errors.validityStart?.message}
        />
        <InvoiceDatePicker
          label="Validity End *"
          value={validityEnd}
          min={validityStart || undefined}
          onChange={(iso) =>
            setValue("validityEnd", iso, { shouldValidate: true })
          }
          error={errors.validityEnd?.message}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Targeting *"
          onChange={handleTargetingChange}
          value={targeting}
        >
          {OFFER_TARGETING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isStackable")}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Stackable with other discounts
        </label>
      </div>

      {targeting === OFFER_TARGETING.SELECTED && (
        <Card className="p-4">
          <h4 className="mb-3 text-sm font-bold text-text">
            Select customers ({targetUserIds.length} selected)
          </h4>
          <CustomerPicker
            restaurants={restaurants}
            restaurantId={pickerRestaurantId}
            onRestaurantChange={setPickerRestaurantId}
            selectedIds={targetUserIds}
            onChange={setTargetUserIds}
          />
        </Card>
      )}

      {targeting === OFFER_TARGETING.SEGMENT && (
        <Card className="p-4">
          <h4 className="mb-3 text-sm font-bold text-text">
            Segment rules
          </h4>
          <SegmentRulesBuilder value={segmentRules} onChange={setSegmentRules} />
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          loadingText={isEdit ? "Saving..." : "Creating..."}
        >
          {isEdit ? "Save Changes" : "Create Offer"}
        </Button>
      </div>
    </form>
  );
}

export default OfferForm;
