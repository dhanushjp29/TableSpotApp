import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Clock, Users, UtensilsCrossed, CreditCard, Ticket } from "lucide-react";

import { tableApi } from "../../api/table.api.js";
import { bookingApi } from "../../api/booking.api.js";
import {
  fetchRestaurantById,
} from "../../store/slices/restaurantSlice.js";
import { fetchFoodsByRestaurant } from "../../store/slices/foodSlice.js";
import { fetchAvailableOffers } from "../../store/slices/offerSlice.js";
import { computeOfferDiscount } from "../../constants/offer.js";

import { useAuth } from "../../hooks/useAuth.js";
import { useBookingAdvancePayment } from "../../hooks/useBookingAdvancePayment.js";
import TableSelector from "../../components/restaurant/TableSelector.jsx";
import PreOrderFoods from "../../components/restaurant/PreOrderFoods.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import InvoiceDatePicker from "../../components/common/InvoiceDatePicker.jsx";
import TimePicker from "../../components/ui/TimePicker.jsx";
import OfferCard from "../../components/offer/OfferCard.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Card from "../../components/ui/Card.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

const getLocalDateString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Date is required."),
  bookingTime: z.string().min(1, "Time is required."),
  numberOfGuests: z.number().int().min(1, "At least 1 guest is required."),
  tableId: z.string().min(1, "Please select a table."),
  specialRequest: z.string().max(500).optional(),
});

function BookingPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { payAdvance } = useBookingAdvancePayment();
  const restaurant = useSelector((state) => state.restaurant.currentRestaurant);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);
  const allFoods = useSelector((state) => state.food.foods);
  const foodsLoading = useSelector((state) => state.food.isLoading);
  const foodsError = useSelector((state) => state.food.error);
  const availableOffers = useSelector((state) => state.offer.availableOffers);
  const offersLoading = useSelector((state) => state.offer.isLoading);
  const [availability, setAvailability] = useState([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seatSelections, setSeatSelections] = useState({});
  const [fullTableSelections, setFullTableSelections] = useState({});
  const [preOrder, setPreOrder] = useState({});
  const [selectedOfferId, setSelectedOfferId] = useState("");

  const foods = useMemo(
    () =>
      allFoods.filter(
        (food) => food.isAvailable !== false && food.isActive !== false
      ),
    [allFoods]
  );
  const isLoading = restaurantLoading || foodsLoading;
  const error = restaurantError || foodsError;

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      numberOfGuests: 2,
      bookingDate: getLocalDateString(),
      bookingTime: "19:00",
      specialRequest: "",
      tableId: "",
    },
  });

  const numberOfGuests = useWatch({ control, name: "numberOfGuests", defaultValue: 2 });
  const bookingDate = useWatch({ control, name: "bookingDate", defaultValue: getLocalDateString() });
  const bookingTime = useWatch({ control, name: "bookingTime", defaultValue: "19:00" });

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId)).catch(() => {});
    dispatch(fetchFoodsByRestaurant(restaurantId)).catch(() => {});
  }, [dispatch, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    dispatch(
      fetchAvailableOffers({ restaurantId, page: 1, limit: 50 })
    ).catch(() => {});
  }, [dispatch, restaurantId]);

  useEffect(() => {
    if (!restaurantId || !bookingDate || !bookingTime) {
      return;
    }
    const [year, month, day] = bookingDate.split("-").map(Number);
    const [hour, minute] = bookingTime.split(":").map(Number);
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return;
    }
    const datetime = new Date(year, month - 1, day, hour, minute, 0).toISOString();
    const guestCount = Number(numberOfGuests);
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsAvailabilityLoading(true);
      setSeatSelections({});
      setFullTableSelections({});
      setValue("tableId", "");

      try {
        const res = await tableApi.getAvailability(restaurantId, {
          datetime,
          duration: 120,
          guests: guestCount,
        });
        if (!cancelled) {
          setAvailability(res.data?.tables || []);
        }
      } catch {
        if (!cancelled) {
          setAvailability([]);
        }
      } finally {
        if (!cancelled) {
          setIsAvailabilityLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [restaurantId, bookingDate, bookingTime, numberOfGuests, setValue]);

  const selectedSeatCount = Object.values(seatSelections).reduce(
    (sum, seats) => sum + (seats?.length || 0),
    0
  );
  const selectedFullTables = availability.filter(
    (item) => fullTableSelections[String(item.table?._id)]
  );
  const selectedFullCapacity = selectedFullTables.reduce(
    (sum, item) => sum + Number(item.table?.capacity || 0),
    0
  );
  const reservedSeatCount = selectedSeatCount + selectedFullCapacity;
  const hasSelection = selectedSeatCount > 0 || selectedFullTables.length > 0;

  useEffect(() => {
    const seatTableIds = Object.entries(seatSelections)
      .filter(([, seats]) => seats.length > 0)
      .map(([tableId]) => tableId);
    const fullTableIds = Object.keys(fullTableSelections);
    const primaryTableId = seatTableIds[0] || fullTableIds[0] || "";
    setValue("tableId", primaryTableId, { shouldValidate: false });
  }, [seatSelections, fullTableSelections, setValue]);

  const bookingPolicy = (restaurant && restaurant.bookingPaymentPolicy) || {};
  const policyNotice = (() => {
    if (bookingPolicy.type !== "PAY_TO_BOOK") {
      return "No advance is required. Pay at the restaurant.";
    }
    if (bookingPolicy.paymentType === "FULL_PREORDER") {
      return "The full pre-order amount is charged in advance to confirm your booking.";
    }
    if (bookingPolicy.paymentType === "PERCENTAGE") {
      return `An advance of ${bookingPolicy.percentage}% of your pre-order value is charged to confirm (up to ${formatCurrency(bookingPolicy.maximumAmount)}).`;
    }
    return `An advance of ${formatCurrency(bookingPolicy.fixedAmount)} is charged to confirm your booking.`;
  })();
  const preOrderTotal = useMemo(
    () =>
      Object.entries(preOrder).reduce((sum, [key, quantity]) => {
        const idx = key.indexOf("::");
        const foodId = key.slice(0, idx);
        const variantName = key.slice(idx + 2);
        const food = foods.find((f) => String(f._id) === foodId);
        const variant =
          food?.variants?.find(
            (v) => String(v.variantName).toLowerCase() === variantName.toLowerCase()
          ) || food?.variants?.[0];
        const price = variant?.offerPrice > 0 ? variant.offerPrice : variant?.price || 0;
        return sum + price * quantity;
      }, 0),
    [foods, preOrder]
  );

  const eligibleOffers = useMemo(() => {
    // Keep all server-eligible offers visible. A minimum-order requirement
    // should explain why an offer cannot be selected, not hide the offer.
    return availableOffers;
  }, [availableOffers]);
  const offerPages = useMemo(
    () => Array.from({ length: Math.ceil(eligibleOffers.length / 4) }, (_, index) =>
      eligibleOffers.slice(index * 4, index * 4 + 4)
    ),
    [eligibleOffers]
  );

  const summary = useMemo(() => {
    const selectedOffer = availableOffers.find(
      (offer) => String(offer._id) === String(selectedOfferId)
    );
    const offerDiscount = selectedOffer
      ? computeOfferDiscount(selectedOffer, preOrderTotal)
      : 0;
    const advance = bookingPolicy.type === "PAY_TO_BOOK" ? preOrderTotal : 0;
    const totalNow =
      bookingPolicy.type === "PAY_TO_BOOK" &&
      bookingPolicy.paymentType === "FULL_PREORDER"
        ? Math.max(advance - offerDiscount, 0)
        : advance;
    return {
      preOrderTotal,
      offerDiscount,
      advance,
      totalNow,
      remaining: bookingPolicy.type === "PAY_TO_BOOK" ? 0 : 0,
    };
  }, [bookingPolicy.type, bookingPolicy.paymentType, preOrderTotal, availableOffers, selectedOfferId]);

  const onSubmit = async (data) => {
    if (!hasSelection) {
      toast.error("Please select at least one table.");
      return;
    }
    if (selectedSeatCount > data.numberOfGuests) {
      toast.error(
        `You selected ${selectedSeatCount} seat(s) but have ${data.numberOfGuests} guest(s). Remove extra seats.`
      );
      return;
    }
    if (reservedSeatCount < data.numberOfGuests) {
      toast.error(
        "The selected tables do not have enough seats for your guests."
      );
      return;
    }
    const selectedOffer = availableOffers.find(
      (offer) => String(offer._id) === String(selectedOfferId)
    );
    if (
      selectedOffer &&
      Number(selectedOffer.minOrderAmount || 0) > preOrderTotal
    ) {
      toast.error(
        `This offer requires a minimum order of ${formatCurrency(selectedOffer.minOrderAmount)}.`
      );
      return;
    }
    setIsSubmitting(true);
    let createdBooking = null;
    try {
      const [year, month, day] = data.bookingDate.split("-").map(Number);
      const [hour, minute] = data.bookingTime.split(":").map(Number);
      const bookingDate = new Date(year, month - 1, day, hour, minute, 0);
      const bookingDateTime = bookingDate.toISOString();
      const preOrderedFoods = Object.entries(preOrder).map(([key, quantity]) => {
        const idx = key.indexOf("::");
        const foodId = key.slice(0, idx);
        const variantName = key.slice(idx + 2);
        const food = foods.find((f) => String(f._id) === foodId);
        const variants =
          food?.hasVariants && food?.variants?.length
            ? food.variants
            : [
                food?.variants?.[0] || {
                  variantName: "Regular",
                  price: 0,
                  offerPrice: 0,
                },
              ];
        const variant =
          variants.find(
            (v) =>
              String(v.variantName).toLowerCase() ===
              variantName.toLowerCase()
          ) || variants[0];
        const price =
          variant?.offerPrice > 0 ? variant?.offerPrice : variant?.price || 0;
        return { foodId, variantName, quantity, price };
      });
      const tables = [];
      for (const item of availability) {
        const tableId = item.table?._id;
        const key = String(tableId);
        const seatIds = seatSelections[key] || [];
        if (seatIds.length > 0) {
          tables.push({ tableId, seatIds });
        } else if (fullTableSelections[key]) {
          tables.push({ tableId, seatIds: [] });
        }
      }

      // Payment-first: for PAY_TO_BOOK restaurants a booking only exists once
      // the advance is captured — never call bookingApi.create here (the
      // server rejects direct customer bookings for these restaurants).
      if (bookingPolicy.type === "PAY_TO_BOOK") {
        await payAdvance({
          bookingData: {
            restaurantId,
            tables,
            bookingDateTime,
            expectedDuration: 120,
            numberOfGuests: data.numberOfGuests,
            specialRequest: data.specialRequest || "",
            preOrderedFoods,
            offerId: selectedOfferId || null,
          },
          prefill: {
            name: user?.fullName,
            email: user?.email,
            contact: user?.phoneNumber,
          },
          onSuccess: (result) => {
            if (result?.bookingId) {
              navigate("/booking/" + result.bookingId + "/confirmation");
            } else {
              toast.success(
                "Payment successful! Your booking is being confirmed."
              );
              navigate("/restaurants/" + restaurantId);
            }
          },
          onDismiss: () => {},
          onFailure: () => {},
        });
        return;
      }

      const response = await bookingApi.create({
        restaurantId,
        tables,
        bookingDateTime,
        numberOfGuests: data.numberOfGuests,
        specialRequest: data.specialRequest,
        bookingType: "Online",
        preOrderedFoods,
        offerId: selectedOfferId || null,
      });
      createdBooking = response.data?.booking || response.data || {};
      const bookingId = createdBooking._id;
      if (!bookingId) {
        throw new Error("Booking could not be created.");
      }
      toast.success(response?.data?.message || "Booking created successfully!");

      if (Number(createdBooking.advanceAmount) > 0) {
        const navigateToConfirmation = () =>
          navigate("/booking/" + bookingId + "/confirmation");
        await payAdvance({
          bookingId,
          prefill: {
            name: user?.fullName,
            email: user?.email,
            contact: user?.phoneNumber,
          },
          onSuccess: navigateToConfirmation,
          onDismiss: navigateToConfirmation,
          onFailure: navigateToConfirmation,
        });
        return;
      }

      navigate("/booking/" + bookingId + "/confirmation");
    } catch (err) {
      if (createdBooking?._id) {
        navigate("/booking/" + createdBooking._id + "/confirmation");
        return;
      }
      toast.error(err?.response?.data?.message || "Failed to create booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="p-6">
          <SkeletonText lines={6} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Unable to load restaurant" description={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Restaurant not found" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to={"/restaurants/" + restaurantId} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        &larr; Back to Restaurant
      </Link>
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            Reserve a Table at {restaurant.restaurantName}
          </h1>
          {restaurant.restaurantCode && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
              {restaurant.restaurantCode}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-muted">
          <span>{restaurant.city}, {restaurant.state}</span>
          {restaurant.averageRating > 0 && (
            <>
              <span>&#8226;</span>
              <span>&#9733; {Number(restaurant.averageRating).toFixed(1)}</span>
            </>
          )}
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Choose your date, time, table, and any pre-order items. We’ll confirm
          the booking based on the restaurant’s payment policy.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">When & How Many</h2>
            <span className="text-xs font-medium text-muted">Required</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Controller
              name="bookingDate"
              control={control}
              render={({ field, fieldState }) => (
                <InvoiceDatePicker
                  label="Date"
                  hint="Available from today onward."
                  value={field.value}
                  onChange={field.onChange}
                  min={getLocalDateString()}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="bookingTime"
              control={control}
              render={({ field, fieldState }) => (
                <TimePicker
                  label="Time"
                  hint="Pick the time for your reservation."
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                  ref={field.ref}
                  error={fieldState.error?.message}
                  icon={<Clock size={16} />}
                />
              )}
            />
            <Input
              label="Guests"
              hint="Minimum 1, maximum 20."
              type="number"
              min={1}
              max={20}
              error={errors.numberOfGuests?.message}
              icon={<Users size={16} />}
              {...register("numberOfGuests", { valueAsNumber: true })}
            />
          </div>
          {bookingDate && bookingTime && (
            <p className="mt-3 rounded-xl border border-border bg-surface-secondary/60 px-3 py-2 text-xs text-muted">
              Selected: {formatDate(bookingDate)} at {formatTime(bookingTime)}
            </p>
          )}
        </Card>
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text">Select Table / Seats</h2>
            <p className="mt-1 text-xs text-muted">
              Available and unavailable seating is based on live restaurant availability.
            </p>
          </div>
          {isAvailabilityLoading ? (
            <div className="space-y-2">
              <SkeletonText lines={3} />
            </div>
          ) : (
            <>
              <TableSelector
                tables={availability}
                seatSelections={seatSelections}
                fullTableSelections={fullTableSelections}
                onToggleSeat={(tableId, seatIds) => {
                  setSeatSelections((prev) => ({
                    ...prev,
                    [String(tableId)]: seatIds,
                  }));
                }}
                onToggleFullTable={(tableId) => {
                  setFullTableSelections((prev) => {
                    const key = String(tableId);
                    const next = { ...prev };
                    if (next[key]) {
                      delete next[key];
                    } else {
                      next[key] = true;
                    }
                    return next;
                  });
                }}
                guestCount={numberOfGuests}
              />
              {hasSelection && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="primary">
                    {selectedSeatCount} seat(s){" "}
                    {selectedFullTables.length > 0 &&
                      `+ ${selectedFullTables.length} whole table(s) (${selectedFullCapacity} seat(s)) `}
                    reserved for {numberOfGuests} guest(s)
                  </Badge>
                </div>
              )}
            </>
          )}
        </Card>
        {foods.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-text">
                Pre-Order Food (Optional)
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted">
              Choose dishes in advance and they will be ready when you arrive.
            </p>
            <div className="mt-4">
              <PreOrderFoods
                foods={foods}
                selection={preOrder}
                onChange={setPreOrder}
              />
            </div>
          </Card>
        )}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Ticket size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-text">
              Available Offers (Optional)
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Pick one of your eligible offers. For full pre-payment it reduces
            the amount charged now; otherwise it applies when the bill is
            settled.
          </p>
          {offersLoading && eligibleOffers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Loading offers...</p>
          ) : eligibleOffers.length === 0 ? (
            <p className="mt-4 rounded-xl border border-border bg-surface-secondary/60 px-3 py-2 text-xs text-muted">
              No offers are available for this restaurant right now. Pre-order
              above to unlock offers with a minimum order.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              <div className="flex gap-4">
                {offerPages.map((page, pageIndex) => (
                  <div key={pageIndex} className="grid w-[min(100%,42rem)] min-w-[calc(100vw-3rem)] shrink-0 grid-cols-2 grid-rows-2 gap-3 snap-start sm:min-w-0">
                    {page.map((offer) => {
                      const selected = String(offer._id) === String(selectedOfferId);
                      const minOrder = Number(offer.minOrderAmount || 0);
                      const minOrderMet = minOrder <= 0 || preOrderTotal >= minOrder;
                      return (
                        <OfferCard
                          key={offer._id}
                          item={offer}
                          compact
                          status=""
                          selected={selected}
                          onSelect={() => {
                            if (!minOrderMet) {
                              toast.error(`Pre-order at least ${formatCurrency(minOrder)} to use this offer.`);
                              return;
                            }
                            setSelectedOfferId(selected ? "" : String(offer._id));
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            {/* legacy offer layout removed
              {eligibleOffers.map((offer) => {
                const selected = String(offer._id) === String(selectedOfferId);
                const minOrder = Number(offer.minOrderAmount || 0);
                const minOrderMet = minOrder <= 0 || preOrderTotal >= minOrder;
                return (
                  <button
                    key={offer._id}
                    type="button"
                    onClick={() =>
                      minOrderMet
                        ? setSelectedOfferId(selected ? "" : String(offer._id))
                        : toast.error(
                            `Pre-order at least ${formatCurrency(minOrder)} to use this offer.`
                          )
                    }
                    className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-surface hover:border-primary/50 dark:bg-surface-secondary/70"
                    }`}
                  >
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                          {formatOfferDiscount(offer)}
                        </span>
                        <span className="text-sm font-semibold text-text">
                          {offer.title || "Special offer"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {offer.offerCode}
                        {minOrder > 0
                          ? ` · Min order ${formatCurrency(minOrder)}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {selected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  </button>
                );
              })}
            */}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">Special Request</h2>
            <span className="text-xs font-medium text-muted">Optional • 500 chars</span>
          </div>
          <textarea
            placeholder="Any special requests..."
            maxLength={500}
            className="mt-4 min-h-[96px] w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-surface-secondary/70"
            {...register("specialRequest")}
          />
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-primary" />
            <div className="flex-1">
            <p className="text-sm font-semibold text-text">Booking summary</p>
            <p className="mt-0.5 text-xs text-muted">{policyNotice}</p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted">Pre-order total</span>
                <span className="font-semibold text-text">{formatCurrency(summary.preOrderTotal)}</span>
              </div>
              {summary.offerDiscount > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">Offer discount</span>
                  <span className="font-semibold text-success">
                    -{formatCurrency(summary.offerDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted">Pay now</span>
                <span className="font-semibold text-text">{bookingPolicy.type === "PAY_TO_BOOK" ? formatCurrency(summary.totalNow) : "No online payment"}</span>
              </div>
              {bookingPolicy.type === "PAY_ON_SPOT" ? (
                <p className="rounded-xl border border-border bg-surface-secondary/60 px-3 py-2 text-xs text-muted">
                  Payment will be handled at the restaurant after you arrive.
                </p>
              ) : (
                <p className="rounded-xl border border-border bg-surface-secondary/60 px-3 py-2 text-xs text-muted">
                  Pay and confirm your booking now.
                </p>
              )}
            </div>
            </div>
          </div>
        </Card>
        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Confirming Booking..." disabled={isSubmitting}>
          {bookingPolicy.type === "PAY_TO_BOOK" ? "Pay & Confirm Booking" : "Confirm Booking"}
        </Button>
      </form>
    </div>
  );
}

export default BookingPage;
