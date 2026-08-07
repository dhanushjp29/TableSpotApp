import { CheckCircle2, ExternalLink, MapPin, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { restaurantApi } from "../../api/restaurant.api.js";
import { paymentApi } from "../../api/payment.api.js";
import { uploadApi } from "../../api/upload.api.js";

import ImageUploader from "../../components/form/ImageUploader.jsx";
import LocationFields from "../../components/form/LocationFields.jsx";
import LocationPickerMap from "../../components/map/LocationPickerMap.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import TimePicker from "../../components/ui/TimePicker.jsx";

import {
  BOOKING_PAYMENT_POLICY,
  BOOKING_PAYMENT_TYPE,
  MAX_BOOKING_ADVANCE_AMOUNT,
  PRICE_RANGE_VALUES,
  RAZORPAY_ACCOUNT_STATUS,
  WEEKDAY_VALUES,
} from "../../constants/restaurant.js";

const AMENITY_OPTIONS = [
  "Free Wi-Fi",
  "Parking",
  "Air Conditioning",
  "Outdoor Seating",
  "Rooftop Seating",
  "Private Dining",
  "Bar / Lounge",
  "Live Music",
  "Valet Parking",
  "Pet Friendly",
  "Wheelchair Accessible",
  "Kids' Play Area",
];

const SERVICE_OPTIONS = [
  "Table Service",
  "Takeaway",
  "Home Delivery",
  "Buffet",
  "Event Hosting",
  "Catering",
  "Reservations",
  "Happy Hours",
  "Live Sports Screening",
  "Online Booking",
  "Contactless Payment",
];

const DEFAULT_OPERATING_HOURS = WEEKDAY_VALUES.map((day) => ({
  day,
  isOpen: true,
  open: "10:00",
  close: "22:00",
}));

const PRICE_RANGE_LABELS = {
  "₹": "Affordable",
  "₹₹": "Moderate",
  "₹₹₹": "Premium",
  "₹₹₹₹": "Luxury",
};

const PAYMENT_TYPE_LABELS = {
  [BOOKING_PAYMENT_TYPE.FIXED_AMOUNT]: "Fixed amount (₹) at booking",
  [BOOKING_PAYMENT_TYPE.PERCENTAGE]: "Percentage of booking total",
  [BOOKING_PAYMENT_TYPE.FULL_PREORDER]: "Full pre-order total",
};

function SectionLabel({ children }) {
  return (
    <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

function TagPicker({ label, options, selected, onSelect, onAdd, placeholder }) {
  const [value, setValue] = useState("");

  const toggle = (item) => {
    onSelect(
      selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]
    );
  };

  const handleAdd = () => {
    const val = value.trim();
    if (!val) return;
    if (!options.includes(val)) onAdd([val, ...options]);
    if (!selected.includes(val)) onSelect([val, ...selected]);
    setValue("");
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`px-3 py-1 rounded-full border text-sm ${
              selected.includes(item)
                ? "bg-primary text-white border-primary"
                : "bg-white text-text border-gray-300"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="input-field w-full"
        />
        <Button type="button" onClick={handleAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function CreateRestaurantForm({ restaurant = null, onSuccess, onCancel }) {
  const isEdit = Boolean(restaurant);
  const [location, setLocation] = useState(
    restaurant?.location
      ? { lat: restaurant.location.latitude, lng: restaurant.location.longitude }
      : null
  );
  const [locationValue, setLocationValue] = useState({
    country: restaurant?.country || "",
    state: restaurant?.state || "",
    city: restaurant?.city || "",
  });
  const [coverItems, setCoverItems] = useState(
    restaurant?.coverImage ? [{ file: null, preview: restaurant.coverImage }] : []
  );
  const [galleryItems, setGalleryItems] = useState(
    (restaurant?.galleryImages || []).map((url) => ({ file: null, preview: url }))
  );
  const [priceFrom, setPriceFrom] = useState(0);
  const [priceTo, setPriceTo] = useState(0);
  const [priceRange, setPriceRange] = useState(restaurant?.priceRange || "₹");
  const [cuisineOptions, setCuisineOptions] = useState(["Veg", "Non-Veg", "Vegan", "Indian", "Chinese"]);
  const [selectedCuisines, setSelectedCuisines] = useState(restaurant?.cuisineTypes || []);
  const [serviceOptions, setServiceOptions] = useState(SERVICE_OPTIONS);
  const [selectedServices, setSelectedServices] = useState(restaurant?.services || []);
  const [amenityOptions, setAmenityOptions] = useState(AMENITY_OPTIONS);
  const [selectedAmenities, setSelectedAmenities] = useState(restaurant?.amenities || []);
  const [operatingHours, setOperatingHours] = useState(
    restaurant?.operatingHours?.length
      ? WEEKDAY_VALUES.map((day) => {
          const existing = restaurant.operatingHours.find((h) => h.day === day);
          return existing
            ? {
                day,
                isOpen: existing.isOpen ?? true,
                open: existing.open || "",
                close: existing.close || "",
              }
            : { day, isOpen: false, open: "", close: "" };
        })
      : DEFAULT_OPERATING_HOURS
  );
  const [table, setTable] = useState({
    tableNumber: restaurant?.tables?.[0]?.tableNumber ?? "",
    tableName: restaurant?.tables?.[0]?.tableName ?? "",
    capacity: restaurant?.tables?.[0]?.capacity ?? "",
  });
  const [tableErrors, setTableErrors] = useState({});
  const [policy, setPolicy] = useState(() => {
    const existing = restaurant?.bookingPaymentPolicy;
    return {
      type: existing?.type || BOOKING_PAYMENT_POLICY.PAY_ON_SPOT,
      paymentType: existing?.paymentType || BOOKING_PAYMENT_TYPE.FIXED_AMOUNT,
      fixedAmount: existing?.fixedAmount ?? 100,
      percentage: existing?.percentage ?? 20,
      maximumAmount:
        existing?.maximumAmount ?? MAX_BOOKING_ADVANCE_AMOUNT,
    };
  });
  const [account, setAccount] = useState({
    accountId: "",
    status: "",
    onboardingLink: "",
  });
  const [accountLoading, setAccountLoading] = useState(true);
  const [connectingAccount, setConnectingAccount] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      restaurantName: restaurant?.restaurantName || "",
      description: restaurant?.description || "",
      contactPerson: restaurant?.contactPerson || "",
      phoneNumber: restaurant?.phoneNumber || "",
      email: restaurant?.email || "",
      address: restaurant?.address || "",
      pincode: restaurant?.pincode || "",
      cuisineTypes: "",
    },
  });

  const uploadToCloudinary = async (file) => {
    const result = await uploadApi.image(file);
    const url = result?.url || result?.secure_url || "";
    if (!url) throw new Error("Upload returned no image URL.");
    return url;
  };

  const resolveImage = async (item) => {
    if (item.file) return uploadToCloudinary(item.file);
    return item.preview;
  };

  const updateTable = (field, value) => {
    setTable((prev) => ({ ...prev, [field]: value }));
    setTableErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const updateHour = (day, field, value) => {
    setOperatingHours((prev) =>
      prev.map((h) => (h.day === day ? { ...h, [field]: value } : h))
    );
  };

  const updatePolicy = (field, value) => {
    setPolicy((prev) => ({ ...prev, [field]: value }));
  };

  const refreshAccountStatus = async () => {
    try {
      const { data } = await paymentApi.getAccountStatus();
      setAccount((prev) => ({ ...prev, ...(data || {}) }));
    } catch {
      // Keep the current status if the request fails.
    } finally {
      setAccountLoading(false);
    }
  };

  const handleConnectAccount = async () => {
    setConnectingAccount(true);
    try {
      const { data } = await paymentApi.connectAccount();
      setAccount({
        accountId: data?.accountId || "",
        status: data?.status || "",
        onboardingLink: data?.onboardingLink || "",
      });
      toast.success(
        "Payment account connected. Complete the KYC form to activate payouts."
      );
      if (data?.onboardingLink) {
        window.open(data.onboardingLink, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to connect payment account."
      );
    } finally {
      setConnectingAccount(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAccountStatus();
  }, [account.status]);

  const onSubmit = async (data) => {
    try {
      if (!locationValue.country || !locationValue.state || !locationValue.city) {
        toast.error("Please select Country, State and City.");
        return;
      }
      if (!location) {
        toast.error("Please select a location on the map.");
        return;
      }
      if (coverItems.length === 0) {
        toast.error("Please upload a cover image.");
        return;
      }
      if (galleryItems.length < 3) {
        toast.error("Please upload at least 3 gallery images.");
        return;
      }

      if (!isEdit && account.status !== RAZORPAY_ACCOUNT_STATUS.CONNECTED) {
        toast.error(
          "Connect and verify your Razorpay payment account before creating a restaurant."
        );
        return;
      }

      let bookingPaymentPolicy;
      if (policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT) {
        bookingPaymentPolicy = { type: BOOKING_PAYMENT_POLICY.PAY_ON_SPOT };
      } else {
        if (!policy.paymentType) {
          toast.error("Select a payment type for Pay Amount to Book.");
          return;
        }
        if (policy.paymentType === BOOKING_PAYMENT_TYPE.FIXED_AMOUNT) {
          const fixedAmount = Number(policy.fixedAmount);
          if (
            !Number.isInteger(fixedAmount) ||
            fixedAmount < 1 ||
            fixedAmount > MAX_BOOKING_ADVANCE_AMOUNT
          ) {
            toast.error(
              `Fixed amount must be a whole number between ₹1 and ₹${MAX_BOOKING_ADVANCE_AMOUNT}.`
            );
            return;
          }
          bookingPaymentPolicy = {
            type: BOOKING_PAYMENT_POLICY.PAY_TO_BOOK,
            paymentType: BOOKING_PAYMENT_TYPE.FIXED_AMOUNT,
            fixedAmount,
          };
        } else if (policy.paymentType === BOOKING_PAYMENT_TYPE.PERCENTAGE) {
          const percentage = Number(policy.percentage);
          if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
            toast.error("Percentage must be a whole number between 1 and 100.");
            return;
          }
          const rawMaximum =
            policy.maximumAmount === "" ||
            policy.maximumAmount === null ||
            policy.maximumAmount === undefined
              ? ""
              : String(policy.maximumAmount).trim();
          const maximumAmount = rawMaximum === "" ? undefined : Number(rawMaximum);
          if (
            maximumAmount !== undefined &&
            (maximumAmount < 0 || maximumAmount > MAX_BOOKING_ADVANCE_AMOUNT)
          ) {
            toast.error(
              `Maximum amount cannot exceed ₹${MAX_BOOKING_ADVANCE_AMOUNT}.`
            );
            return;
          }
          bookingPaymentPolicy = {
            type: BOOKING_PAYMENT_POLICY.PAY_TO_BOOK,
            paymentType: BOOKING_PAYMENT_TYPE.PERCENTAGE,
            percentage,
            ...(maximumAmount !== undefined ? { maximumAmount } : {}),
          };
        } else {
          bookingPaymentPolicy = {
            type: BOOKING_PAYMENT_POLICY.PAY_TO_BOOK,
            paymentType: BOOKING_PAYMENT_TYPE.FULL_PREORDER,
          };
        }
      }

      let validTables = [];
      if (!isEdit) {
        const tableNumber = String(table.tableNumber || "").trim();
        const capacity = String(table.capacity || "").trim();

        const nextTableErrors = {};
        if (!tableNumber) {
          nextTableErrors.tableNumber = "Table number is required.";
        } else if (!Number.isInteger(Number(tableNumber)) || Number(tableNumber) < 1) {
          nextTableErrors.tableNumber = "Table number must be a positive whole number.";
        }

        if (!capacity) {
          nextTableErrors.capacity = "Capacity is required.";
        } else if (
          !Number.isInteger(Number(capacity)) ||
          Number(capacity) < 1 ||
          Number(capacity) > 100
        ) {
          nextTableErrors.capacity = "Capacity must be a whole number between 1 and 100.";
        }

        setTableErrors(nextTableErrors);
        if (Object.keys(nextTableErrors).length > 0) {
          toast.error("Please fill in the required table details.");
          return;
        }

        validTables = [
          {
            tableNumber: Number(tableNumber),
            tableName: String(table.tableName || "").trim(),
            capacity: Number(capacity),
          },
        ];
      }

      const avgCost = (Number(priceFrom) && Number(priceTo))
        ? Math.round((Number(priceFrom) + Number(priceTo)) / 2)
        : undefined;

      const [coverImage, ...galleryImages] = await Promise.all([
        resolveImage(coverItems[0]),
        ...galleryItems.map(resolveImage),
      ]);

      const payload = {
        ...data,
        country: locationValue.country,
        state: locationValue.state,
        city: locationValue.city,
        cuisineTypes: selectedCuisines,
        services: selectedServices,
        amenities: selectedAmenities,
        priceRange,
        operatingHours,
        location: {
          latitude: Number(location.lat),
          longitude: Number(location.lng),
        },
        galleryImages,
        coverImage,
        bookingPaymentPolicy,
        ...(avgCost !== undefined ? { averageCostForTwo: avgCost } : {}),
        ...(isEdit ? {} : { tables: validTables }),
      };

      if (isEdit) {
        await restaurantApi.update(restaurant._id, payload);
        toast.success("Restaurant updated successfully!");
      } else {
        await restaurantApi.create(payload);
        toast.success("Restaurant created successfully!");
        reset();
        setLocationValue({ country: "", state: "", city: "" });
        setGalleryItems([]);
        setCoverItems([]);
        setSelectedCuisines([]);
        setSelectedServices([]);
        setSelectedAmenities([]);
        setPriceRange("₹");
        setOperatingHours(DEFAULT_OPERATING_HOURS);
        setTable({ tableNumber: "", tableName: "", capacity: "" });
        setTableErrors({});
        setPolicy({
          type: BOOKING_PAYMENT_POLICY.PAY_ON_SPOT,
          paymentType: BOOKING_PAYMENT_TYPE.FIXED_AMOUNT,
          fixedAmount: 100,
          percentage: 20,
          maximumAmount: MAX_BOOKING_ADVANCE_AMOUNT,
        });
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save restaurant.");
    }
  };

  const isAccountReady =
    account.status === RAZORPAY_ACCOUNT_STATUS.CONNECTED;
  const isCreateBlocked = !isEdit && !accountLoading && !isAccountReady;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <SectionLabel>Payment Account</SectionLabel>
      <div
        className={`rounded-lg border p-4 ${
          isCreateBlocked ? "border-error/30 bg-error/5" : "border-gray-100"
        }`}
      >
        <p className="text-xs text-muted">
          Connect a Razorpay payment account to receive booking advances.
          All Razorpay details stay server-side.
        </p>
        {accountLoading ? (
          <div className="mt-3">
            <SkeletonText lines={2} />
          </div>
        ) : isAccountReady ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5">
            <ShieldCheck size={20} className="shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-success">
                {RAZORPAY_ACCOUNT_STATUS.CONNECTED}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted">
                {account.accountId || "Linked account"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={refreshAccountStatus}
            >
              <RefreshCw size={14} className="mr-1" />
              Refresh Status
            </Button>
          </div>
        ) : (
          <div
            className={`mt-3 rounded-lg border px-3.5 py-2.5 ${
              account.status === RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING
                ? "border-amber-200 bg-amber-50"
                : "border-error/30 bg-error/5"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <ShieldAlert
                size={20}
                className={`shrink-0 ${
                  account.status ===
                  RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING
                    ? "text-accent"
                    : "text-error"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {account.status || RAZORPAY_ACCOUNT_STATUS.NOT_CONNECTED}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {account.status ===
                  RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING
                    ? "Complete the KYC form to activate payouts."
                    : "Connect your Razorpay payment account to create restaurants."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                isLoading={connectingAccount}
                onClick={handleConnectAccount}
              >
                <Wallet size={14} className="mr-1" />
                {account.status ===
                RAZORPAY_ACCOUNT_STATUS.VERIFICATION_PENDING
                  ? "Open KYC Form"
                  : "Connect Payment Account"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={refreshAccountStatus}
              >
                <RefreshCw size={14} className="mr-1" />
                Refresh Status
              </Button>
            </div>
            {account.onboardingLink && !isAccountReady && (
              <button
                type="button"
                onClick={() =>
                  window.open(account.onboardingLink, "_blank", "noopener,noreferrer")
                }
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink size={13} />
                Reopen the KYC / onboarding form
              </button>
            )}
          </div>
        )}
        {isCreateBlocked && (
          <p className="mt-2 text-xs font-medium text-error">
            You must connect and verify your payment account before creating a
            restaurant.
          </p>
        )}
      </div>

      <SectionLabel>Basic Details</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Restaurant Name *</label>
          <input
            {...register("restaurantName", { required: "Name required" })}
            className="input-field w-full"
          />
          {errors.restaurantName && (
            <p className="text-xs text-red-600">{errors.restaurantName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact Person *</label>
          <input
            {...register("contactPerson", { required: "Contact person required" })}
            className="input-field w-full"
          />
          {errors.contactPerson && (
            <p className="text-xs text-red-600">{errors.contactPerson.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number *</label>
          <input
            {...register("phoneNumber", {
              required: "Phone required",
              pattern: {
                value: /^[6-9]\d{9}$/,
                message: "Enter a valid 10-digit phone number",
              },
            })}
            className="input-field w-full"
            placeholder="9876543210"
          />
          {errors.phoneNumber && (
            <p className="text-xs text-red-600">{errors.phoneNumber.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            {...register("email", { required: "Email required" })}
            className="input-field w-full"
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address *</label>
          <input
            {...register("address", { required: "Address required" })}
            className="input-field w-full"
          />
          {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pincode *</label>
          <input
            {...register("pincode", { required: "Pincode required" })}
            className="input-field w-full"
          />
          {errors.pincode && <p className="text-xs text-red-600">{errors.pincode.message}</p>}
        </div>
      </div>

      <SectionLabel>Location</SectionLabel>
      <LocationFields value={locationValue} onChange={setLocationValue} />
      <div>
        <label className="block text-sm font-medium mb-1">Pick Location on Map *</label>
        <LocationPickerMap
          position={location}
          onPositionChange={setLocation}
          height="300px"
        />
        {location ? (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5">
            <CheckCircle2 size={22} className="shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-success">Location Selected</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-text">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Coordinates captured from the map — click the map to adjust the pin.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-error/30 bg-error/10 px-3.5 py-2.5">
            <MapPin size={18} className="shrink-0 text-error" />
            <p className="text-sm font-medium text-error">
              Please select a location on the map.
            </p>
          </div>
        )}
      </div>

      <SectionLabel>About</SectionLabel>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea {...register("description")} rows={3} className="input-field w-full" />
      </div>
      <SectionLabel>Cuisine, Services & Pricing</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TagPicker
          label="Cuisine Types"
          options={cuisineOptions}
          selected={selectedCuisines}
          onSelect={setSelectedCuisines}
          onAdd={setCuisineOptions}
          placeholder="Add cuisine"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Price Range</label>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGE_VALUES.map((p) => (
              <button
                key={p}
                type="button"
                title={`${PRICE_RANGE_LABELS[p]}`}
                onClick={() => setPriceRange(p)}
                className={`px-3 py-1 rounded-full border text-sm ${
                  priceRange === p
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-text border-gray-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Cost level: <span className="font-semibold text-text">{PRICE_RANGE_LABELS[priceRange]}</span>{" "}
            (₹ affordable · ₹₹₹₹ luxury)
          </p>
          <div className="mt-2">
            <span className="block text-xs font-medium text-text">
              Average cost for two (optional)
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                placeholder="From (₹)"
                className="input-field w-1/2"
              />
              <input
                type="number"
                min={0}
                value={priceTo}
                onChange={(e) => setPriceTo(e.target.value)}
                placeholder="To (₹)"
                className="input-field w-1/2"
              />
            </div>
          </div>
        </div>
        <TagPicker
          label="Services"
          options={serviceOptions}
          selected={selectedServices}
          onSelect={setSelectedServices}
          onAdd={setServiceOptions}
          placeholder="Add service"
        />
        <TagPicker
          label="Amenities"
          options={amenityOptions}
          selected={selectedAmenities}
          onSelect={setSelectedAmenities}
          onAdd={setAmenityOptions}
          placeholder="Add amenity"
        />
      </div>

      <SectionLabel>Booking Payment</SectionLabel>
      <div className="rounded-lg border border-gray-100 p-4">
        <p className="mb-3 text-xs text-muted">
          Choose how customers pay when reserving a table.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-medium text-text">
              Payment policy *
            </span>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                  policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT
                    ? "border-primary"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="bookingPaymentPolicyType"
                  value={BOOKING_PAYMENT_POLICY.PAY_ON_SPOT}
                  checked={policy.type === BOOKING_PAYMENT_POLICY.PAY_ON_SPOT}
                  onChange={() =>
                    updatePolicy("type", BOOKING_PAYMENT_POLICY.PAY_ON_SPOT)
                  }
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-sm font-medium text-text">
                    Pay on Spot
                  </span>
                  <span className="block text-xs text-muted">
                    No advance — customers pay at the restaurant.
                  </span>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                  policy.type === BOOKING_PAYMENT_POLICY.PAY_TO_BOOK
                    ? "border-primary"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="bookingPaymentPolicyType"
                  value={BOOKING_PAYMENT_POLICY.PAY_TO_BOOK}
                  checked={policy.type === BOOKING_PAYMENT_POLICY.PAY_TO_BOOK}
                  onChange={() =>
                    updatePolicy("type", BOOKING_PAYMENT_POLICY.PAY_TO_BOOK)
                  }
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-sm font-medium text-text">
                    Pay Amount to Book
                  </span>
                  <span className="block text-xs text-muted">
                    Collect an advance to confirm the booking.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {policy.type === BOOKING_PAYMENT_POLICY.PAY_TO_BOOK && (
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-text">
                  Payment type *
                </span>
                <select
                  value={policy.paymentType}
                  onChange={(e) => updatePolicy("paymentType", e.target.value)}
                  className="input-field w-full"
                >
                  {Object.values(BOOKING_PAYMENT_TYPE).map((value) => (
                    <option key={value} value={value}>
                      {PAYMENT_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              {policy.paymentType === BOOKING_PAYMENT_TYPE.FIXED_AMOUNT && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">
                    Fixed advance amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_BOOKING_ADVANCE_AMOUNT}
                    value={policy.fixedAmount}
                    onChange={(e) => updatePolicy("fixedAmount", e.target.value)}
                    className="input-field w-full"
                    placeholder={`₹1 - ₹${MAX_BOOKING_ADVANCE_AMOUNT}`}
                  />
                  <p className="mt-1 text-xs text-muted">
                    Advance per booking, capped at ₹{MAX_BOOKING_ADVANCE_AMOUNT}.
                  </p>
                </div>
              )}

              {policy.paymentType === BOOKING_PAYMENT_TYPE.PERCENTAGE && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">
                      Percentage of total (%) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={policy.percentage}
                      onChange={(e) => updatePolicy("percentage", e.target.value)}
                      className="input-field w-full"
                      placeholder="e.g. 20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text">
                      Maximum amount (₹, optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={MAX_BOOKING_ADVANCE_AMOUNT}
                      value={policy.maximumAmount}
                      onChange={(e) =>
                        updatePolicy("maximumAmount", e.target.value)
                      }
                      className="input-field w-full"
                      placeholder={`Up to ₹${MAX_BOOKING_ADVANCE_AMOUNT}`}
                    />
                    <p className="mt-1 text-xs text-muted">
                      Cap the computed advance at this amount (≤ ₹
                      {MAX_BOOKING_ADVANCE_AMOUNT}).
                    </p>
                  </div>
                </>
              )}

              {policy.paymentType === BOOKING_PAYMENT_TYPE.FULL_PREORDER && (
                <p className="text-xs text-muted">
                  Customers pay the full pre-order total to confirm their
                  booking.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <SectionLabel>Operating Hours</SectionLabel>
      <div className="rounded-lg border border-gray-100 p-4">
        <div className="space-y-1.5">
          {operatingHours.map((hour) => (
            <div key={hour.day} className="flex items-center gap-2">
              <label className="flex w-32 shrink-0 items-center gap-1.5 text-xs font-medium text-text">
                <input
                  type="checkbox"
                  checked={hour.isOpen}
                  onChange={(e) => updateHour(hour.day, "isOpen", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className={hour.isOpen ? "" : "text-muted"}>
                  {hour.day}
                </span>
              </label>
              <TimePicker
                value={hour.open}
                disabled={!hour.isOpen}
                onChange={(e) => updateHour(hour.day, "open", e.target.value)}
                className="w-36"
                placeholder="Open"
              />
              <span className="text-xs text-muted">to</span>
              <TimePicker
                value={hour.close}
                disabled={!hour.isOpen}
                onChange={(e) => updateHour(hour.day, "close", e.target.value)}
                className="w-36"
                placeholder="Close"
              />
            </div>
          ))}
        </div>
      </div>

      <SectionLabel>Media</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <ImageUploader
            label="Cover Image *"
            single
            max={1}
            value={coverItems}
            onChange={setCoverItems}
            description="JPG, PNG or WebP · shows as the restaurant's main photo"
            error={coverItems.length === 0 ? "Cover image is required." : ""}
          />
        </div>
        <div>
          <ImageUploader
            label="Gallery Images *"
            min={3}
            max={10}
            value={galleryItems}
            onChange={setGalleryItems}
            description="Select at least 3 photos to showcase your restaurant"
          />
        </div>
      </div>
      {!isEdit && (
        <div className="rounded-lg border border-gray-100 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-text">Table *</h3>
            <p className="mt-0.5 text-xs text-muted">
              Add the starting table for your restaurant. You can add more tables later from the Tables page.
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-text">
                Table No. *
              </label>
              <input
                type="number"
                min={1}
                value={table.tableNumber}
                onChange={(e) => updateTable("tableNumber", e.target.value)}
                placeholder="1"
                className={`input-field w-full ${tableErrors.tableNumber ? "border-error" : ""}`}
              />
              {tableErrors.tableNumber && (
                <p className="mt-1 text-xs text-red-600">{tableErrors.tableNumber}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-text">
                Table Name
              </label>
              <input
                type="text"
                value={table.tableName}
                onChange={(e) => updateTable("tableName", e.target.value)}
                placeholder="Window Table 1"
                className="input-field w-full"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-text">
                Capacity *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={table.capacity}
                onChange={(e) => updateTable("capacity", e.target.value)}
                placeholder="4"
                className={`input-field w-full ${tableErrors.capacity ? "border-error" : ""}`}
              />
              {tableErrors.capacity && (
                <p className="mt-1 text-xs text-red-600">{tableErrors.capacity}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          disabled={isSubmitting || isCreateBlocked}
          isLoading={isSubmitting}
          loadingText={isEdit ? "Saving..." : "Creating..."}
        >
          {isEdit ? "Save Changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function OwnerRestaurantPage() {
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchRestaurantsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await restaurantApi.getAll({
        ownerId: user?.id,
        isActive: true,
      });
      setRestaurants(response?.data?.restaurants || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load restaurants.");
    } finally {
      setIsLoading(false);
    }
  };

  const query = searchTerm.trim().toLowerCase();
  const visibleRestaurants = query
    ? restaurants.filter((restaurant) =>
        [restaurant.restaurantName, restaurant.restaurantCode, restaurant.city, restaurant.state]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
    : restaurants;

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      try {
        const response = await restaurantApi.getAll({
          ownerId: user?.id,
          isActive: true,
        });
        if (isMounted) {
          setRestaurants(response?.data?.restaurants || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load restaurants.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <SkeletonText lines={3} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load restaurants"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">My Restaurants</h1>
          <p className="mt-1 text-sm text-muted">Manage your restaurant information and settings.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Add Restaurant
        </Button>
      </div>

      {restaurants.length > 0 && (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              placeholder="Search by name, code, city or state"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted">
            Showing {visibleRestaurants.length} of {restaurants.length} restaurant
            {restaurants.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Restaurant" size="lg">
          <CreateRestaurantForm
            onSuccess={() => { setShowCreate(false); fetchRestaurantsData(); }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {visibleRestaurants.length === 0 ? (
        <EmptyState
          title={query ? "No matching restaurants" : "No restaurants yet"}
          description={
            query
              ? "No restaurants match your search. Try a different term."
              : "Create your first restaurant to start managing it here."
          }
          action={
            !query && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus size={16} />
                Create Restaurant
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRestaurants.map((restaurant) => (
            <Card
              key={restaurant._id}
              className="cursor-pointer overflow-hidden transition-all hover:shadow-md"
              onClick={() => navigate(`/owner/restaurant/${restaurant._id}`)}
            >
              <div className="relative h-40 overflow-hidden bg-gray-100">
                {restaurant.coverImage ? (
                  <img
                    src={restaurant.coverImage}
                    alt={restaurant.restaurantName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <span className="text-3xl">🍽️</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{restaurant.restaurantName}</h3>
                    {restaurant.restaurantCode && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {restaurant.restaurantCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-200">{restaurant.city}, {restaurant.state}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">Status</p>
                    <p className="text-xs text-muted">{restaurant.verificationStatus || "Pending"}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default OwnerRestaurantPage;
