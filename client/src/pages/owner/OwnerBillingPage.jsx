import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  Filter,
  Minus,
  Trash2,
  Banknote,
  Smartphone,
  Landmark,
  UtensilsCrossed,
  Percent,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  addBillPayment,
  createBill,
  convertBookingToBill,
  fetchBills,
  fetchBillById,
  updateBill,
} from "../../store/slices/billSlice.js";
import { fetchBookings } from "../../store/slices/reservationSlice.js";
import { fetchFoodsByRestaurant } from "../../store/slices/foodSlice.js";
import { fetchTablesByRestaurant } from "../../store/slices/tableSlice.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonCard } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate } from "../../utils/formatDate.js";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import BillEditor from "../../components/billing/BillEditor.jsx";

const WALK_IN_PAY_METHODS = [
  { value: "Cash", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "Card", label: "Card", icon: CreditCard },
  { value: "Net Banking", label: "Net Banking", icon: Landmark },
];

const WALK_IN_DISCOUNT_TYPES = [
  { value: "amount", label: "Flat amount (₹)" },
  { value: "percentage", label: "Percentage (%)" },
];

function WalkInSection({ icon: Icon, title, action, children }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-secondary/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Icon size={16} className="text-primary" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function WalkInField({ label, error, hint, children }) {
  return (
    <div className="w-full">
      {label && <label className="input-label">{label}</label>}
      {children}
      {error ? (
        <p className="input-error" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export default function OwnerBillingPage() {
  const dispatch = useDispatch();
  const {
    bills,
    isLoading: billsLoading,
    error: billError,
  } = useSelector((state) => state.bill);
  const {
    bookings,
    isLoading: bookingsLoading,
    error: bookingError,
  } = useSelector((state) => state.reservation);
  const user = useSelector((state) => state.auth.user);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantsLoading = useSelector((state) => state.restaurant.isLoading);
  const { foods: spotFoods, isLoading: foodsLoading } = useSelector(
    (state) => state.food
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [billTypeFilter, setBillTypeFilter] = useState("ALL");
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const isLoading = billsLoading || bookingsLoading;
  const error = billError || bookingError;

  // Create Bill (Convert) Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [onlineCreateTaxPercentage, setOnlineCreateTaxPercentage] = useState("0");
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [editingWalkInBill, setEditingWalkInBill] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walkInRestaurantId, setWalkInRestaurantId] = useState("");
  const [walkInTableId, setWalkInTableId] = useState("");
  const [walkInCustomerName, setWalkInCustomerName] = useState("");
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState("");
  const [walkInCustomerEmail, setWalkInCustomerEmail] = useState("");

  // Manage Bill Modal State (spot payments)
  const [manageBill, setManageBill] = useState(null);
  const [spotPaymentMethod, setSpotPaymentMethod] = useState("Cash");
  const [spotAmount, setSpotAmount] = useState("");
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  // Manage Bill — spot food & discount editing
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("Regular");
  const [spotQuantity, setSpotQuantity] = useState(1);
  const [billItems, setBillItems] = useState([]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [onlineTaxPercentage, setOnlineTaxPercentage] = useState("");
  const [isItemsSubmitting, setIsItemsSubmitting] = useState(false);
  const [walkInBillItems, setWalkInBillItems] = useState([]);
  const [walkInDiscountType, setWalkInDiscountType] = useState("amount");
  const [walkInDiscountValue, setWalkInDiscountValue] = useState("");
  const [walkInTaxPercentage, setWalkInTaxPercentage] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [walkInPayments, setWalkInPayments] = useState([]);
  const [walkInTableOptions, setWalkInTableOptions] = useState([]);
  const [walkInFoods, setWalkInFoods] = useState([]);
  const [walkInTablesLoading, setWalkInTablesLoading] = useState(false);
  const [walkInFoodsLoading, setWalkInFoodsLoading] = useState(false);
  const [walkInFoodId, setWalkInFoodId] = useState("");
  const [walkInVariant, setWalkInVariant] = useState("");
  const [walkInQty, setWalkInQty] = useState(1);
  const [walkInPayMethod, setWalkInPayMethod] = useState("Cash");
  const [walkInPayAmount, setWalkInPayAmount] = useState("");
  const [walkInErrors, setWalkInErrors] = useState({});

  // Print / View Receipt Modal State
  const [activeReceiptBill, setActiveReceiptBill] = useState(null);

  // Re-armed "now" so the Convert-to-Bill time gate stays pure (no Date.now
  // during render) while still auto-unlocking when the booking time arrives.
  const [now, setNow] = useState(0);

  const fetchData = async () => {
    await Promise.all([
      dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })),
      dispatch(fetchBills({ limit: 100, ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}) })),
      dispatch(fetchBookings({ limit: 100, ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}) })),
    ]).catch(() => {});
  };

  const loadWalkInContext = async (restaurantId) => {
    setWalkInRestaurantId(restaurantId);
    setWalkInTableId("");
    setWalkInBillItems([]);
    setWalkInFoods([]);
    setWalkInPayments([]);
    setWalkInFoodId("");
    setWalkInVariant("");
    setWalkInQty(1);
    setWalkInErrors({});
    if (!restaurantId) {
      setWalkInTableOptions([]);
      setWalkInTablesLoading(false);
      setWalkInFoodsLoading(false);
      return;
    }
    setWalkInTablesLoading(true);
    setWalkInFoodsLoading(true);
    const [tablesRes, foodsRes] = await Promise.allSettled([
      dispatch(fetchTablesByRestaurant(restaurantId, { limit: 100 })),
      dispatch(fetchFoodsByRestaurant(restaurantId, { page: 1, limit: 100 })),
    ]);
    setWalkInTableOptions(tablesRes.status === "fulfilled" ? (tablesRes.value?.data?.tables || []) : []);
    setWalkInFoods(foodsRes.status === "fulfilled" ? (foodsRes.value?.data?.foods || []) : []);
    setWalkInTablesLoading(false);
    setWalkInFoodsLoading(false);
  };

  const resetWalkInForm = () => {
    setWalkInRestaurantId("");
    setWalkInTableId("");
    setWalkInCustomerName("");
    setWalkInCustomerPhone("");
    setWalkInCustomerEmail("");
    setWalkInBillItems([]);
    setWalkInDiscountType("amount");
    setWalkInDiscountValue("");
    setWalkInTaxPercentage("");
    setWalkInNotes("");
    setWalkInPayments([]);
    setWalkInFoodId("");
    setWalkInVariant("");
    setWalkInQty(1);
    setWalkInPayMethod("Cash");
    setWalkInPayAmount("");
    setWalkInTableOptions([]);
    setWalkInFoods([]);
    setWalkInErrors({});
  };

  const openWalkInModal = () => {
    setEditingWalkInBill(null);
    resetWalkInForm();
    setIsWalkInModalOpen(true);
  };

  const closeWalkInModal = () => {
    setIsWalkInModalOpen(false);
    setEditingWalkInBill(null);
    resetWalkInForm();
  };

  const clearWalkInError = (key) => {
    setWalkInErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleWalkInRestaurantChange = (value) => {
    loadWalkInContext(value);
    clearWalkInError("restaurant");
    clearWalkInError("table");
  };

  const handleWalkInFoodChange = (value) => {
    setWalkInFoodId(value);
    setWalkInVariant("");
    const food = walkInFoods.find((f) => f._id === value);
    if (food?.hasVariants && (food.variants || []).length > 0) {
      setWalkInVariant(food.variants[0].variantName);
    }
    clearWalkInError("food");
  };

  const getWalkInFoodUnitPrice = (food, variantName) => {
    if (!food) return 0;
    const variants = food.variants || [];
    const variant =
      !food.hasVariants || variants.length === 0
        ? variants[0]
        : variants.find((v) => v.variantName === variantName) || variants[0];
    return Number(variant?.offerPrice > 0 ? variant.offerPrice : variant?.price || 0);
  };

  const removeBillItem = (index) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addSpotFood = () => {
    if (!selectedFoodId) {
      toast.error("Select a food item.");
      return;
    }

    const food = spotFoods.find((item) => item._id === selectedFoodId);
    if (!food) {
      toast.error("Selected food is no longer available.");
      return;
    }

    const hasVariants = food.hasVariants && (food.variants || []).length > 0;
    const variantName = hasVariants ? selectedVariant || food.variants[0]?.variantName : "Regular";
    const variant = hasVariants
      ? (food.variants || []).find((v) => v.variantName === variantName) || food.variants[0]
      : (food.variants || [])[0];

    if (hasVariants && !variant) {
      toast.error("Select a valid variant.");
      return;
    }

    const unitPrice = Number(variant?.offerPrice > 0 ? variant.offerPrice : variant?.price || 0);
    const quantity = Math.max(1, Number(spotQuantity) || 1);

    setBillItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.foodId === food._id && item.variantName === variantName
      );

      if (existingIndex >= 0) {
        return prev.map((item, i) =>
          i === existingIndex
            ? { ...item, quantity: Number(item.quantity) + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          foodId: food._id,
          foodName: food.foodName,
          variantName,
          quantity,
          unitPrice,
        },
      ];
    });

    setSelectedFoodId("");
    setSelectedVariant("Regular");
    setSpotQuantity(1);
  };

  const addWalkInItem = () => {
    if (!walkInFoodId) {
      setWalkInErrors((prev) => ({ ...prev, food: "Select a food item." }));
      return;
    }

    const food = walkInFoods.find((f) => f._id === walkInFoodId);
    const hasVariants = food?.hasVariants && (food.variants || []).length > 0;
    const variantName = hasVariants ? walkInVariant || food.variants[0].variantName : "Regular";
    const unitPrice = getWalkInFoodUnitPrice(food, variantName);
    const qty = Math.max(1, Number(walkInQty) || 1);

    setWalkInBillItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.foodId === walkInFoodId && item.variantName === variantName
      );
      if (existingIndex >= 0) {
        return prev.map((item, i) =>
          i === existingIndex
            ? { ...item, quantity: Number(item.quantity) + qty }
            : item
        );
      }
      return [
        ...prev,
        {
          foodId: food._id,
          foodName: food.foodName,
          variantName,
          quantity: qty,
          unitPrice,
        },
      ];
    });

    setWalkInFoodId("");
    setWalkInVariant("");
    setWalkInQty(1);
    setWalkInErrors((prev) => ({ ...prev, food: "", items: "" }));
  };

  const updateWalkInItemQty = (index, delta) => {
    setWalkInBillItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.max(1, Number(item.quantity) + delta) }
          : item
      )
    );
  };

  const removeWalkInItem = (index) => {
    setWalkInBillItems((prev) => prev.filter((_, i) => i !== index));
    setWalkInErrors((prev) => ({ ...prev, items: "" }));
  };

  const addWalkInPayment = () => {
    const amount = Number(walkInPayAmount);
    if (!walkInPayMethod) {
      setWalkInErrors((prev) => ({ ...prev, payments: "Select a payment method." }));
      return;
    }
    if (!walkInPayAmount || Number.isNaN(amount) || amount <= 0) {
      setWalkInErrors((prev) => ({ ...prev, payments: "Enter an amount greater than 0." }));
      return;
    }
    setWalkInPayments((prev) => [
      ...prev,
      { paymentMethod: walkInPayMethod, amount: walkInPayAmount, notes: "Walk-in payment" },
    ]);
    setWalkInPayAmount("");
    setWalkInErrors((prev) => ({ ...prev, payments: "" }));
  };

  const removeWalkInPayment = (index) => {
    setWalkInPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const walkInFoodLabel = (food) => {
    if (!food) return "";
    const variants = food.variants || [];
    const price =
      variants.length > 0
        ? Math.min(
            ...variants.map((v) => Number(v?.offerPrice > 0 ? v.offerPrice : v?.price || 0))
          )
        : 0;
    return price > 0 ? `${food.foodName} â€” â‚¹${price}` : food.foodName;
  };

  const walkInVariantLabel = (variant) => {
    const price = Number(variant?.offerPrice > 0 ? variant.offerPrice : variant?.price || 0);
    return price > 0 ? `${variant.variantName} â€” â‚¹${price}` : variant.variantName;
  };

  const walkInSubtotal = walkInBillItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0),
    0
  );
  const walkInDiscountAmount = (() => {
    const value = Math.max(0, Number(walkInDiscountValue) || 0);
    if (walkInDiscountType === "percentage") return Math.min(walkInSubtotal, (walkInSubtotal * value) / 100);
    return Math.min(walkInSubtotal, value);
  })();
  const walkInTaxableAmount = Math.max(0, walkInSubtotal - walkInDiscountAmount);
  const walkInTaxAmount = Math.max(0, (walkInTaxableAmount * (Number(walkInTaxPercentage) || 0)) / 100);
  const walkInGrandTotal = Math.max(0, walkInTaxableAmount + walkInTaxAmount);
  const walkInExistingTotalPaid = Number(editingWalkInBill?.payment?.totalPaid || 0);
  const walkInDraftTotalPaid = walkInPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const walkInTotalPaid = walkInExistingTotalPaid + walkInDraftTotalPaid;
  const walkInBalanceDue = Math.max(0, walkInGrandTotal - walkInTotalPaid);
  const walkInPaymentStatus =
    walkInTotalPaid <= 0 ? "UNPAID" : walkInBalanceDue <= 0 ? "PAID" : "PARTIAL";

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, selectedRestaurant]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConvertBooking = async (e) => {
    e.preventDefault();
    if (!selectedBookingId) {
      toast.error("Please select a reservation.");
      return;
    }
    setIsSubmitting(true);
    try {
      await dispatch(convertBookingToBill(selectedBookingId, {
        taxPercentage: Number(onlineCreateTaxPercentage) || 0,
      }));
      toast.success("Bill created from reservation successfully!");
      setIsCreateModalOpen(false);
      setSelectedBookingId("");
      setOnlineCreateTaxPercentage("0");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWalkInBill = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!walkInRestaurantId) errors.restaurant = "Restaurant is required.";
    if (!walkInTableId) errors.table = "Table is required.";
    if (walkInBillItems.length === 0) errors.items = "Add at least one item to the bill.";

    const discountNum = walkInDiscountValue === "" ? null : Number(walkInDiscountValue);
    if (discountNum !== null) {
      if (Number.isNaN(discountNum) || discountNum < 0) {
        errors.discount = "Discount cannot be negative.";
      } else if (walkInDiscountType === "percentage" && discountNum > 100) {
        errors.discount = "Percentage discount cannot exceed 100%.";
      } else if (walkInDiscountType === "amount" && discountNum > walkInSubtotal) {
        errors.discount = "Discount amount cannot exceed the subtotal.";
      }
    }

    const taxNum = walkInTaxPercentage === "" ? null : Number(walkInTaxPercentage);
    if (taxNum !== null && (Number.isNaN(taxNum) || taxNum < 0 || taxNum > 100)) {
      errors.tax = "Tax percentage must be between 0 and 100.";
    }

    if (walkInCustomerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(walkInCustomerEmail)) {
      errors.email = "Enter a valid email address.";
    }

    const activePayments = walkInPayments.filter((p) => Number(p.amount) > 0);
    if (activePayments.length > 0) {
      if (activePayments.some((p) => !p.paymentMethod)) {
        errors.payments = "Select a payment method for each payment entry.";
      }
      const existingPaid = Number(editingWalkInBill?.payment?.totalPaid || 0);
      const totalPaid =
        existingPaid + activePayments.reduce((s, p) => s + Number(p.amount), 0);
      if (totalPaid > walkInGrandTotal) {
        errors.payments = "Total payments (?" + totalPaid.toFixed(2) + ") cannot exceed the grand total (?" + walkInGrandTotal.toFixed(2) + ").";
      }
    }

    if (Object.keys(errors).length > 0) {
      setWalkInErrors(errors);
      toast.error(Object.values(errors)[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        billType: "WALK_IN",
        restaurantId: walkInRestaurantId,
        tableId: walkInTableId,
        orderedItems: walkInBillItems.map((item) => ({
          foodId: item.foodId,
          foodName: item.foodName || "",
          variantName: item.variantName || "Regular",
          quantity: Number(item.quantity) || 1,
        })),
        discount: { type: walkInDiscountType, value: Number(walkInDiscountValue) || 0 },
        customerName: walkInCustomerName,
        customerPhone: walkInCustomerPhone,
        customerEmail: walkInCustomerEmail,
        taxPercentage: Number(walkInTaxPercentage) || 0,
        payment: {
          payments: activePayments.map((p) => ({
            paymentMethod: p.paymentMethod,
            amount: Number(p.amount),
            notes: p.notes || "Walk-in payment",
          })),
        },
        notes: walkInNotes,
      };

      if (editingWalkInBill) {
        await dispatch(updateBill(editingWalkInBill._id, payload));
        toast.success("Walk-in bill updated!");
      } else {
        await dispatch(createBill(payload));
        toast.success("Walk-in bill created!");
      }

      setIsWalkInModalOpen(false);
      setEditingWalkInBill(null);
      resetWalkInForm();
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save walk-in bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpotPayment = async (e) => {
    e.preventDefault();
    if (!manageBill) return;
    const amount = Number(spotAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    setIsPaymentSubmitting(true);
    try {
      const response = await dispatch(
        addBillPayment(manageBill._id, {
          paymentMethod: spotPaymentMethod,
          amount,
          notes: "Spot payment",
        })
      );
      const updatedBill = extractBillFromResponse(response);
      if (updatedBill) {
        setManageBill(updatedBill);
      }
      toast.success("Spot payment recorded!");
      setSpotAmount("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to record payment.");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const billPayStatus = (bill) => bill?.payment?.paymentStatus || bill?.paymentStatus;
  const isBillEditable = (bill) =>
    !!bill?.createdAt &&
    now <= new Date(bill.createdAt).getTime() + 24 * 60 * 60 * 1000 &&
    bill?.billStatus !== "Cancelled";
  const isWithinBillEditWindow = (bill) =>
    !!bill?.createdAt &&
    now <= new Date(bill.createdAt).getTime() + 24 * 60 * 60 * 1000;

  const extractBillFromResponse = (response) =>
    response?.data?.data?.bill ||
    response?.data?.bill ||
    response?.data?.data ||
    response?.data ||
    null;

  const loadWalkInBillDraft = async (bill) => {
    const restaurantId =
      bill?.restaurantId?._id ||
      bill?.restaurantId ||
      bill?.bookingId?.restaurantId?._id ||
      bill?.bookingId?.restaurantId ||
      "";

    setWalkInRestaurantId(restaurantId);
    setWalkInTableId(
      bill?.tableId?._id ||
        bill?.tableId ||
        bill?.bookingId?.tableId?._id ||
        bill?.bookingId?.tableId ||
        ""
    );
    setWalkInCustomerName(bill?.customerName || "");
    setWalkInCustomerPhone(bill?.customerPhone || "");
    setWalkInCustomerEmail(bill?.customerEmail || "");
    setWalkInBillItems(
      (bill?.orderedItems || []).map((item) => ({
        foodId: typeof item.foodId === "object" ? item.foodId?._id : item.foodId,
        foodName: item.foodName,
        variantName: item.variantName || "Regular",
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice || 0),
      }))
    );
    setWalkInDiscountType(bill?.discount?.type || "amount");
    setWalkInDiscountValue(
      bill?.discount?.value !== undefined ? String(bill.discount.value) : ""
    );
    setWalkInTaxPercentage(String(bill?.taxPercentage ?? 0));
    setWalkInNotes(bill?.notes || "");
    setWalkInFoodId("");
    setWalkInVariant("");
    setWalkInQty(1);
    setWalkInPayMethod("Cash");
    setWalkInPayAmount("");
    setWalkInErrors({});

    if (!restaurantId) {
      setWalkInTableOptions([]);
      setWalkInFoods([]);
      return;
    }

    setWalkInTablesLoading(true);
    setWalkInFoodsLoading(true);
    const [tablesRes, foodsRes] = await Promise.allSettled([
      dispatch(fetchTablesByRestaurant(restaurantId, { limit: 100 })),
      dispatch(fetchFoodsByRestaurant(restaurantId, { page: 1, limit: 100 })),
    ]);
    setWalkInTableOptions(
      tablesRes.status === "fulfilled" ? (tablesRes.value?.data?.tables || []) : []
    );
    setWalkInFoods(
      foodsRes.status === "fulfilled" ? (foodsRes.value?.data?.foods || []) : []
    );
    setWalkInTablesLoading(false);
    setWalkInFoodsLoading(false);
  };

  const openManageBill = async (bill) => {
    let response;
    try {
      response = await dispatch(fetchBillById(bill._id));
    } catch {
      toast.error("Unable to load the complete bill details.");
      return;
    }
    const detailedBill = extractBillFromResponse(response) || bill;

    if (detailedBill?.billType === "WALK_IN") {
      setEditingWalkInBill(detailedBill);
      await loadWalkInBillDraft(detailedBill);
      setIsWalkInModalOpen(true);
      return;
    }

    setManageBill(detailedBill);

    setBillItems(
      (detailedBill.orderedItems || []).map((item) => ({
        foodId: typeof item.foodId === "object" ? item.foodId?._id : item.foodId,
        foodName: item.foodName,
        variantName: item.variantName || "Regular",
        quantity: Number(item.quantity) || 1,
      }))
    );
    setDiscountType(detailedBill.discount?.type || "amount");
    setDiscountValue(detailedBill.discount?.value ? String(detailedBill.discount.value) : "");
    setOnlineTaxPercentage(String(detailedBill.taxPercentage ?? 0));
    setSelectedFoodId("");
    setSelectedVariant("Regular");
    setSpotQuantity(1);

    const restaurantId = detailedBill.restaurantId?._id || detailedBill.restaurantId || detailedBill.bookingId?.restaurantId?._id || detailedBill.bookingId?.restaurantId;
    if (restaurantId) {
      try {
        await dispatch(fetchFoodsByRestaurant(restaurantId, { page: 1, limit: 100 }));
      } catch {
        // Keep the current menu if the load fails.
      }
    }
  };

  const openReceipt = async (bill) => {
    try {
      const response = await dispatch(fetchBillById(bill._id));
      setActiveReceiptBill(extractBillFromResponse(response) || bill);
    } catch {
      toast.error("Unable to load the complete receipt.");
    }
  };

  const handleSaveItems = async (e) => {
    e.preventDefault();
    if (!manageBill) return;

    const isWalkInEdit = manageBill.billType === "WALK_IN";
    const hasItems = isWalkInEdit ? walkInBillItems.length > 0 : billItems.length > 0;

    if (!hasItems) {
      toast.error("A bill needs at least one item.");
      return;
    }

    setIsItemsSubmitting(true);
    try {
      const response = await dispatch(
        updateBill(
          manageBill._id,
          isWalkInEdit
            ? {
                restaurantId: walkInRestaurantId,
                tableId: walkInTableId,
                customerName: walkInCustomerName,
                customerPhone: walkInCustomerPhone,
                customerEmail: walkInCustomerEmail,
                orderedItems: walkInBillItems.map((item) => ({
                  foodId: item.foodId,
                  foodName: item.foodName || "",
                  variantName: item.variantName || "Regular",
                  quantity: Number(item.quantity) || 1,
                })),
                discount: {
                  type: walkInDiscountType,
                  value: Number(walkInDiscountValue) || 0,
                },
                taxPercentage: Number(walkInTaxPercentage) || 0,
                notes: walkInNotes,
              }
            : {
                orderedItems: billItems,
                discount: {
                  type: discountType,
                  value: Number(discountValue) || 0,
                },
                taxPercentage: Number(onlineTaxPercentage) || 0,
              }
        )
      );
      const updatedBill = extractBillFromResponse(response);
      if (updatedBill) {
        setManageBill(updatedBill);
      }
      toast.success(isWalkInEdit ? "Walk-in bill updated!" : "Bill items updated!");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update bill.");
    } finally {
      setIsItemsSubmitting(false);
    }
  };

  const filteredBills = bills.filter((b) => {
    if (billTypeFilter !== "ALL" && (b.billType || "ONLINE") !== billTypeFilter) {
      return false;
    }
    if (statusFilter !== "ALL" && (billPayStatus(b) || "Pending") !== statusFilter) {
      return false;
    }
    if (!search) return true;
    const billId = b._id?.toLowerCase() || "";
    return billId.includes(search.toLowerCase());
  });

  const billingStats = {
    total: bills.length,
    paid: bills.filter((b) => billPayStatus(b) === "Paid").length,
    partiallyPaid: bills.filter((b) => billPayStatus(b) === "Partially Paid").length,
    pending: bills.filter((b) => (billPayStatus(b) || "Pending") === "Pending").length,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Receipt className="text-primary" size={24} />
            Billing & Invoices
          </h1>
          <p className="text-sm text-muted">Generate bills and track customer payment status</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} className="mr-1.5" />
            Online Bill
          </Button>
          <Button variant="secondary" onClick={openWalkInModal}>
            <Plus size={18} className="mr-1.5" />
            Create Walk-in Bill
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total invoices</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paid</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.paid}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Partially paid</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.partiallyPaid}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pending</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.pending}</p>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col items-center sm:flex-row sm:items-end justify-between gap-4 rounded-2xl border border-border bg-surface/90 p-4 shadow-sm">
        <div className="w-full sm:max-w-xs">
          <RestaurantFilter restaurants={restaurants} value={selectedRestaurant} onChange={setSelectedRestaurant} />
        </div>
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search bill by ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter size={16} className="text-muted shrink-0 ml-1" />
          {["ALL", "ONLINE", "WALK_IN"].map((st) => (
            <button
              key={st}
              onClick={() => setBillTypeFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                billTypeFilter === st
                  ? "bg-secondary text-white"
                  : "border border-border bg-surface-secondary/70 text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              {st === "ALL" ? "All Types" : st === "ONLINE" ? "Online" : "Walk-in"}
            </button>
          ))}
          {["ALL", "Paid", "Partially Paid", "Pending"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "border border-border bg-surface-secondary/70 text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load bills" description={error} onRetry={fetchData} />
      ) : filteredBills.length === 0 ? (
            <EmptyState title="No billing records" description="Click 'Online Bill' or 'Create Walk-in Bill' to create an invoice." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-surface-secondary/60 text-xs uppercase font-semibold text-muted border-b border-border">
              <tr>
                <th className="px-5 py-3">Bill ID</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Restaurant</th>
                <th className="px-5 py-3">Table</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Booking Ref</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Grand Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 font-medium">
              {filteredBills.map((bill) => (
                <tr key={bill._id} className="transition-colors hover:bg-primary/[0.04] dark:hover:bg-white/[0.03]">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-primary">
                    {bill.billCode || `#${bill._id.slice(-6)}`}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted">
                    <Badge className="whitespace-nowrap" variant={bill.billType === "WALK_IN" ? "secondary" : "default"}>
                      {bill.billType === "WALK_IN" ? "Walk-in" : "Online"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {bill.restaurantId?.restaurantName || bill.restaurantId?.restaurantCode || bill.bookingId?.restaurantId?.restaurantName || bill.bookingId?.restaurantId?.restaurantCode || bill.restaurantName || "N/A"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {bill.tableId?.tableCode || bill.tableId?.tableNumber || bill.bookingId?.tableId?.tableCode || bill.bookingId?.tableId?.tableNumber || bill.tableNumber || "N/A"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {bill.customerName || bill.bookingId?.userId?.fullName || bill.bookingId?.customerName || bill.customer?.fullName || "Walk-in / Guest"}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">
                    {bill.billType === "WALK_IN"
                      ? "Walk-in / —"
                      : typeof bill.bookingId === "object"
                        ? bill.bookingId?.bookingCode || bill.bookingId?._id?.slice(-6)
                        : bill.bookingId?.slice(-6) || "N/A"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {bill.createdAt ? formatDate(new Date(bill.createdAt)) : "Today"}
                  </td>
                  <td className="px-5 py-4 font-bold text-text">
                    ₹{bill.grandTotal ?? bill.subTotal ?? 0}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={billPayStatus(bill) === "Paid" ? "success" : "warning"}>
                      {billPayStatus(bill) || "Pending"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openManageBill(bill)}
                      >
                        <CreditCard size={14} className="mr-1" />
                        {isBillEditable(bill) ? "Edit Bill" : "View Bill"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openReceipt(bill)}
                      >
                        <Printer size={14} className="mr-1" />
                        Receipt
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Convert Booking to Bill Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate Reservation Bill"
      >
        <form onSubmit={handleConvertBooking} className="space-y-4 pt-2">
          <Select
            label="Select Customer Reservation"
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
          >
            <option value="">-- Choose Reservation --</option>
            {bookings
              .filter(
                (b) =>
                  !b.billId &&
                  b.bookingStatus === "Confirmed" &&
                  new Date(b.bookingDateTime).getTime() <= now
              )
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.bookingCode || "Booking"} - {b.userId?.fullName || "Guest"} - {formatDate(new Date(b.bookingDateTime))} ({b.numberOfGuests} guests)
                </option>
              ))}
          </Select>

          <p className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-xs text-muted">
            A bill can only be raised once the booking time has arrived. The bill
            is created from the reservation's pre-ordered items and any online
            advance is carried into the bill ledger.
          </p>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Tax Percentage (%)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={onlineCreateTaxPercentage}
              onChange={(e) => setOnlineCreateTaxPercentage(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">Applied to the bill taxable amount; item GST rates are reference-only.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Generate Bill
            </Button>
          </div>
        </form>
      </Modal>

      {isWalkInModalOpen && typeof window === "undefined" && <Modal
        isOpen={isWalkInModalOpen}
        onClose={closeWalkInModal}
        title={editingWalkInBill ? "Edit Walk-in Bill" : "Create Walk-in Bill"}
        size="xl"
      >
        <form onSubmit={handleCreateWalkInBill} className="space-y-5 pt-1">
          {/* 1. Bill Information */}
          <WalkInSection icon={Receipt} title="Bill Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Restaurant *"
                value={walkInRestaurantId}
                onChange={(e) => handleWalkInRestaurantChange(e.target.value)}
                error={walkInErrors.restaurant}
              >
                {restaurantsLoading ? (
                  <option value="" disabled>Loading restaurants...</option>
                ) : restaurants.length === 0 ? (
                  <option value="" disabled>No restaurants available</option>
                ) : (
                  <>
                    <option value="">-- Select Restaurant --</option>
                    {restaurants.map((r) => (
                      <option key={r._id} value={r._id}>{r.restaurantName}</option>
                    ))}
                  </>
                )}
              </Select>

              <Select
                label="Table *"
                value={walkInTableId}
                onChange={(e) => {
                  setWalkInTableId(e.target.value);
                  clearWalkInError("table");
                }}
                disabled={!walkInRestaurantId}
                error={walkInErrors.table}
                hint={!walkInRestaurantId ? "Select a restaurant first" : undefined}
              >
                {!walkInRestaurantId ? (
                  <option value="">-- Select Table --</option>
                ) : walkInTablesLoading ? (
                  <option value="" disabled>Loading tables...</option>
                ) : walkInTableOptions.length === 0 ? (
                  <option value="" disabled>No tables available</option>
                ) : (
                  <>
                    <option value="">-- Select Table --</option>
                    {walkInTableOptions.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.tableName
                          ? `${t.tableCode || `Table ${t.tableNumber}`} — ${t.tableName} — ${t.capacity || "-"} seats`
                          : `${t.tableCode || `Table ${t.tableNumber}`} — ${t.capacity || "-"} seats`}
                      </option>
                    ))}
                  </>
                )}
              </Select>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <WalkInField label="Customer Name">
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Optional"
                  value={walkInCustomerName}
                  onChange={(e) => setWalkInCustomerName(e.target.value)}
                />
              </WalkInField>
              <WalkInField label="Phone">
                <input
                  type="tel"
                  className="input-field w-full"
                  placeholder="Optional"
                  value={walkInCustomerPhone}
                  onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                />
              </WalkInField>
              <WalkInField label="Email" error={walkInErrors.email}>
                <input
                  type="email"
                  className={`input-field w-full ${walkInErrors.email ? "border-error focus:border-error focus:ring-error" : ""}`}
                  placeholder="Optional"
                  value={walkInCustomerEmail}
                  onChange={(e) => {
                    setWalkInCustomerEmail(e.target.value);
                    clearWalkInError("email");
                  }}
                />
              </WalkInField>
            </div>
          </WalkInSection>

          {/* 2. Items */}
          <WalkInSection
            icon={UtensilsCrossed}
            title="Items"
            action={
              <span className="text-xs font-medium text-muted">
                {walkInBillItems.length > 0
                  ? `${walkInBillItems.length} item${walkInBillItems.length > 1 ? "s" : ""} added`
                  : "No items yet"}
              </span>
            }
          >
            <div className="rounded-xl border border-border bg-surface/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add Food Item</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Food *"
                  value={walkInFoodId}
                  onChange={(e) => handleWalkInFoodChange(e.target.value)}
                  disabled={!walkInRestaurantId}
                  error={walkInErrors.food}
                  hint={!walkInRestaurantId ? "Select a restaurant first" : undefined}
                >
                  {!walkInRestaurantId ? (
                    <option value="">-- Select Food --</option>
                  ) : walkInFoodsLoading ? (
                    <option value="" disabled>Loading foods...</option>
                  ) : walkInFoods.length === 0 ? (
                    <option value="" disabled>No foods available</option>
                  ) : (
                    <>
                      <option value="">-- Select Food --</option>
                      {walkInFoods.map((foodItem) => (
                        <option key={foodItem._id} value={foodItem._id}>
                          {walkInFoodLabel(foodItem)}
                        </option>
                      ))}
                    </>
                  )}
                </Select>

                <Select
                  label="Variant"
                  value={walkInVariant}
                  onChange={(e) => {
                    setWalkInVariant(e.target.value);
                  }}
                  disabled={
                    !walkInFoodId ||
                    walkInFoodsLoading ||
                    (() => {
                      const food = walkInFoods.find((f) => f._id === walkInFoodId);
                      return food && !(food.hasVariants && (food.variants || []).length > 0);
                    })()
                  }
                  hint={
                    walkInFoodId && !walkInFoodsLoading
                      ? (() => {
                          const food = walkInFoods.find((f) => f._id === walkInFoodId);
                          return food?.hasVariants && (food.variants || []).length > 0
                            ? undefined
                            : "No variants";
                        })()
                      : undefined
                  }
                >
                  {(() => {
                    const food = walkInFoods.find((f) => f._id === walkInFoodId);
                    const hasVariants = food?.hasVariants && (food.variants || []).length > 0;
                    if (!food || !hasVariants) {
                      return <option value="">No variants</option>;
                    }
                    return (
                      <>
                        <option value="">-- Select Variant --</option>
                        {food.variants.map((variant) => (
                          <option key={variant.variantName} value={variant.variantName}>
                            {walkInVariantLabel(variant)}
                          </option>
                        ))}
                      </>
                    );
                  })()}
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <WalkInField label="Quantity">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setWalkInQty((q) => Math.max(1, Number(q) - 1))}
                      disabled={Number(walkInQty) <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={15} />
                    </Button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input-field w-20 text-center"
                      value={walkInQty}
                      onChange={(e) => setWalkInQty(Math.max(1, Number(e.target.value) || 1))}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setWalkInQty((q) => Number(q) + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={15} />
                    </Button>
                  </div>
                </WalkInField>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addWalkInItem}
                  disabled={!walkInFoodId}
                >
                  <Plus size={15} className="mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {walkInErrors.items && (
              <p className="input-error" role="alert">{walkInErrors.items}</p>
            )}

            {walkInBillItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {walkInBillItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {item.foodName}
                        {item.variantName && item.variantName !== "Regular" && (
                          <span className="ml-1 text-xs font-medium text-muted">({item.variantName})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        ₹{Number(item.unitPrice || 0).toFixed(2)} × {item.quantity} ={" "}
                        <span className="font-semibold text-text">
                          ₹{(Number(item.unitPrice || 0) * Number(item.quantity)).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateWalkInItemQty(idx, -1)}
                        disabled={Number(item.quantity) <= 1}
                        aria-label={`Decrease ${item.foodName} quantity`}
                      >
                        <Minus size={14} />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateWalkInItemQty(idx, 1)}
                        aria-label={`Increase ${item.foodName} quantity`}
                      >
                        <Plus size={14} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-1 text-red-600"
                        onClick={() => removeWalkInItem(idx)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WalkInSection>

          {/* 3. Discount & Tax */}
          <WalkInSection icon={Percent} title="Discount & Tax">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Discount Type"
                value={walkInDiscountType}
                onChange={(e) => {
                  setWalkInDiscountType(e.target.value);
                  clearWalkInError("discount");
                }}
              >
                {WALK_IN_DISCOUNT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <WalkInField label="Discount Value" error={walkInErrors.discount}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input-field w-full ${walkInErrors.discount ? "border-error focus:border-error focus:ring-error" : ""}`}
                  placeholder={walkInDiscountType === "percentage" ? "e.g. 10" : "e.g. 100"}
                  value={walkInDiscountValue}
                  onChange={(e) => {
                    setWalkInDiscountValue(e.target.value);
                    clearWalkInError("discount");
                  }}
                />
              </WalkInField>
              <WalkInField label="Tax Percentage (%)" error={walkInErrors.tax}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={`input-field w-full ${walkInErrors.tax ? "border-error focus:border-error focus:ring-error" : ""}`}
                  placeholder="e.g. 5"
                  value={walkInTaxPercentage}
                  onChange={(e) => {
                    setWalkInTaxPercentage(e.target.value);
                    clearWalkInError("tax");
                  }}
                />
              </WalkInField>
            </div>
          </WalkInSection>

          {/* 4. Payments */}
          <WalkInSection
            icon={CreditCard}
            title="Payments"
            action={
              <span className="text-xs font-medium text-muted">
                {walkInPayments.length > 0
                  ? `${walkInPayments.length} payment${walkInPayments.length > 1 ? "s" : ""} · ₹${walkInTotalPaid.toFixed(2)}`
                  : "No payments yet"}
              </span>
            }
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Payment Method *</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WALK_IN_PAY_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = walkInPayMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => {
                      setWalkInPayMethod(method.value);
                      clearWalkInError("payments");
                    }}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                        : "border-border bg-surface text-muted hover:border-gray-300 hover:bg-surface-hover"
                    }`}
                  >
                    <Icon size={16} />
                    {method.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <WalkInField label="Amount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-full sm:w-44"
                  placeholder="e.g. 1000"
                  value={walkInPayAmount}
                  onChange={(e) => setWalkInPayAmount(e.target.value)}
                />
              </WalkInField>
              <Button type="button" variant="secondary" onClick={addWalkInPayment}>
                <Plus size={15} className="mr-1" />
                Add Payment
              </Button>
            </div>

            {walkInErrors.payments && (
              <p className="input-error" role="alert">{walkInErrors.payments}</p>
            )}

            {walkInPayments.length > 0 && (
              <div className="mt-3 space-y-2">
                {walkInPayments.map((payment, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Payment {idx + 1}
                      </span>
                      <Badge variant="secondary">{payment.paymentMethod}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-text">
                        ₹{Number(payment.amount || 0).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => removeWalkInPayment(idx)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WalkInSection>

          {/* 5. Bill Summary */}
          <WalkInSection icon={Receipt} title="Bill Summary">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted">Subtotal</span><span className="font-medium">₹{walkInSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted">Discount</span><span className="font-medium text-green-600">-₹{walkInDiscountAmount.toFixed(2)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted">Taxable Amount</span><span className="font-medium">₹{walkInTaxableAmount.toFixed(2)}</span></div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Tax ({Number(walkInTaxPercentage) || 0}%)</span>
                <span className="font-medium">₹{walkInTaxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold text-text">
                <span>Grand Total</span>
                <span>₹{walkInGrandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4"><span className="text-muted">Total Paid</span><span className="font-medium">₹{walkInTotalPaid.toFixed(2)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted">Balance Due</span><span className="font-medium">₹{walkInBalanceDue.toFixed(2)}</span></div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Status</span>
                <Badge
                  variant={
                    walkInPaymentStatus === "PAID"
                      ? "success"
                      : walkInPaymentStatus === "PARTIAL"
                        ? "warning"
                        : "danger"
                  }
                >
                  {walkInPaymentStatus}
                </Badge>
              </div>
            </div>
          </WalkInSection>

          {/* 6. Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center">
            <span className="flex-1 text-xs text-muted">
              Bill is created as an unpaid invoice unless payments cover the grand total.
            </span>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeWalkInModal}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} loadingText={editingWalkInBill ? "Saving..." : "Creating..."}>
                {editingWalkInBill ? "Save Walk-in Bill" : "Create Walk-in Bill"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>}

      {/* Manage Bill Modal */}
      {manageBill && typeof window === "undefined" && (
        <Modal
          isOpen={!!manageBill}
          onClose={() => setManageBill(null)}
          title={`${
            isBillEditable(manageBill) ? "Update Bill" : "Manage Bill"
          } ${manageBill.billCode || `#${manageBill._id.slice(-6)}`}`}
          size="lg"
        >
          <div className="space-y-5 pt-2">
            <div className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-sm text-text">
              <div className="flex justify-between">
                <span>Grand Total</span>
                <span className="font-bold">₹{manageBill.grandTotal ?? manageBill.subTotal ?? 0}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Balance Due</span>
                <span className="font-bold text-primary">
                  ₹{manageBill.payment?.balanceDue ?? (billPayStatus(manageBill) === "Paid" ? 0 : manageBill.grandTotal ?? 0)}
                </span>
              </div>
            </div>

            {!isWithinBillEditWindow(manageBill) ? (
              <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">
                This bill can only be modified within 24 hours of creation.
              </div>
            ) : (
              <form onSubmit={handleSaveItems} className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-text">Bill items</label>
                    <span className="text-xs text-muted">Prices are re-derived server-side</span>
                  </div>
                  {billItems.length === 0 ? (
                    <p className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-sm text-muted">
                      No items on this bill yet. Add spot food below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {billItems.map((item, idx) => (
                        <div
                          key={idx}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary/40 p-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text">
                              {item.foodName}
                              {item.variantName && item.variantName !== "Regular" ? ` (${item.variantName})` : ""}
                            </p>
                            <p className="text-xs text-muted">{item.quantity} qty</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={item.quantity <= 1}
                              onClick={() => {
                                const next = [...billItems];
                                next[idx] = { ...item, quantity: Number(item.quantity) - 1 };
                                setBillItems(next);
                              }}
                            >
                              −
                            </Button>
                            <span className="w-6 text-center font-semibold">{item.quantity}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const next = [...billItems];
                                next[idx] = { ...item, quantity: Number(item.quantity) + 1 };
                                setBillItems(next);
                              }}
                            >
                              +
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => removeBillItem(idx)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-3">
                  <p className="mb-2 text-sm font-medium text-text">Add spot food</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                      label="Food item"
                      value={selectedFoodId}
                      onChange={(e) => {
                        setSelectedFoodId(e.target.value);
                        setSelectedVariant("Regular");
                      }}
                    >
                      <option value="">-- Choose item --</option>
                      {spotFoods.map((food) => (
                        <option key={food._id} value={food._id}>
                          {food.foodName} ({food.hasVariants ? "multi-variant" : "Regular"})
                        </option>
                      ))}
                    </Select>
                    {(() => {
                      const food = spotFoods.find((f) => f._id === selectedFoodId);
                      return food?.hasVariants ? (
                        <Select
                          label="Variant"
                          value={selectedVariant}
                          onChange={(e) => setSelectedVariant(e.target.value)}
                        >
                          {(food.variants || []).map((v) => (
                            <option key={v.variantName} value={v.variantName}>
                              {v.variantName} (₹{v.offerPrice > 0 ? v.offerPrice : v.price})
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-text mb-1">Variant</label>
                          <Input value="Regular" disabled />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="w-32">
                      <label className="block text-sm font-medium text-text mb-1">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={spotQuantity}
                        onChange={(e) => setSpotQuantity(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addSpotFood}
                      disabled={foodsLoading || !isWithinBillEditWindow(manageBill)}
                    >
                      <Plus size={15} className="mr-1" />
                      {foodsLoading ? "Loading menu..." : "Add item"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Discount type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="amount">Flat amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </Select>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Discount value
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 100"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-1">
                      Tax Percentage (%)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={onlineTaxPercentage}
                      onChange={(e) => setOnlineTaxPercentage(e.target.value)}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/60 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Taxable Amount</span><span className="font-medium">₹{Number(manageBill.taxableAmount || 0).toFixed(2)}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-muted">Tax ({Number(onlineTaxPercentage) || 0}%)</span><span className="font-medium">₹{Number(manageBill.taxAmount || 0).toFixed(2)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-text"><span>Grand Total</span><span>₹{Number(manageBill.grandTotal || 0).toFixed(2)}</span></div>
                  <p className="mt-2 text-xs text-muted">Totals are recalculated and returned by the server after saving.</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setManageBill(null)}>
                    Close
                  </Button>
                  <Button type="submit" isLoading={isItemsSubmitting} disabled={!isWithinBillEditWindow(manageBill)}>
                    Update Bill
                  </Button>
                </div>
              </form>
            )}

            {billPayStatus(manageBill) !== "Paid" && (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium text-text">Record a spot payment</p>
                <form onSubmit={handleAddSpotPayment} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Payment Method"
                      value={spotPaymentMethod}
                      onChange={(e) => setSpotPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="NetBanking">Net Banking</option>
                    </Select>
                    <div>
                      <label className="block text-sm font-medium text-text mb-1">Amount (₹)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={spotAmount}
                        onChange={(e) => setSpotAmount(e.target.value)}
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="submit" variant="secondary" isLoading={isPaymentSubmitting} disabled={!isWithinBillEditWindow(manageBill)}>
                      Add Spot Payment
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Modal>
      )}

      {(isWalkInModalOpen || manageBill) && (
        <Modal
          isOpen={isWalkInModalOpen || !!manageBill}
          onClose={() => { if (manageBill) setManageBill(null); else closeWalkInModal(); }}
          title={manageBill ? `Edit Bill ${manageBill.billCode || ""}` : "Create Walk-in Bill"}
          size="xl"
        >
          <BillEditor
            bill={manageBill || editingWalkInBill}
            billType={manageBill?.billType || editingWalkInBill?.billType || "WALK_IN"}
            restaurants={restaurants}
            tables={manageBill ? [] : walkInTableOptions}
            foods={manageBill ? spotFoods : walkInFoods}
            loading={manageBill ? foodsLoading : walkInFoodsLoading}
            onRestaurantChange={loadWalkInContext}
            submitting={isSubmitting}
            onClose={() => { if (manageBill) setManageBill(null); else closeWalkInModal(); }}
            onSubmit={async (payload) => {
              setIsSubmitting(true);
              try {
                if (manageBill || editingWalkInBill) {
                  await dispatch(updateBill((manageBill || editingWalkInBill)._id, payload));
                  toast.success("Bill updated successfully!");
                } else {
                  await dispatch(createBill(payload));
                  toast.success("Walk-in bill created!");
                }
                if (manageBill) setManageBill(null); else closeWalkInModal();
                fetchData();
              } catch (err) {
                toast.error(err?.response?.data?.message || "Failed to save bill.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          />
        </Modal>
      )}

      {/* Printable Receipt Modal */}
      {activeReceiptBill && (
        <Modal
          isOpen={!!activeReceiptBill}
          onClose={() => setActiveReceiptBill(null)}
          title={`Invoice Receipt ${activeReceiptBill.billCode || `#${activeReceiptBill._id.slice(-6)}`}`}
        >
          <div className="space-y-4 rounded-2xl border border-dashed border-border bg-surface-secondary/40 p-4 font-mono text-sm my-2">
            <div className="text-center pb-2 border-b border-border">
              <h3 className="text-lg font-bold text-text font-sans">TABLESPOT RECEIPT</h3>
              <p className="text-xs text-muted">Thank you for dining with us!</p>
            </div>

            <div className="space-y-1 text-xs border-b border-border pb-2">
              <div className="flex justify-between gap-2"><span>Bill Type:</span><span>{activeReceiptBill.billType === "WALK_IN" ? "Walk-in" : "Online Booking"}</span></div>
              <div className="flex justify-between gap-2"><span>Restaurant:</span><span>{activeReceiptBill.restaurantId?.restaurantName || "-"}</span></div>
              <div className="flex justify-between gap-2"><span>Table No:</span><span>{activeReceiptBill.tableId?.tableNumber ?? activeReceiptBill.tableId?.tableCode ?? activeReceiptBill.bookingId?.tableId?.tableNumber ?? activeReceiptBill.bookingId?.tableId?.tableCode ?? "-"}</span></div>
              <div className="flex justify-between gap-2"><span>Booking No:</span><span>{activeReceiptBill.billType === "WALK_IN" ? "Walk-in / -" : (activeReceiptBill.bookingId?.bookingCode || "-")}</span></div>
              <div className="flex justify-between gap-2"><span>Customer:</span><span>{activeReceiptBill.customerName || activeReceiptBill.bookingId?.userId?.fullName || "Guest"}</span></div>
              <div className="flex justify-between gap-2"><span>Phone:</span><span>{activeReceiptBill.customerPhone || activeReceiptBill.bookingId?.userId?.phoneNumber || "-"}</span></div>
              <div className="flex justify-between gap-2"><span>Email:</span><span>{activeReceiptBill.customerEmail || activeReceiptBill.bookingId?.userId?.email || "-"}</span></div>
              {activeReceiptBill.billType !== "WALK_IN" && <div className="flex justify-between gap-2"><span>Booking Date:</span><span>{activeReceiptBill.bookingId?.bookingDateTime ? formatDate(new Date(activeReceiptBill.bookingId.bookingDateTime)) : "-"}</span></div>}
              <div className="flex justify-between gap-2"><span>Bill No:</span><span>{activeReceiptBill.billCode || activeReceiptBill._id}</span></div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{activeReceiptBill.createdAt ? formatDate(new Date(activeReceiptBill.createdAt)) : "Today"}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{activeReceiptBill.createdAt ? new Date(activeReceiptBill.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{billPayStatus(activeReceiptBill) || "Pending"}</span>
              </div>
            </div>

            {(activeReceiptBill.orderedItems?.length > 0) && (
              <div className="space-y-1 border-t border-border pt-2 text-xs">
                {activeReceiptBill.orderedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.quantity} x {item.foodName} ({item.variantName || "Regular"})
                    </span>
                    <span>₹{item.totalPrice ?? item.unitPrice ?? 0}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1 border-t border-border pt-2 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{activeReceiptBill.subTotal ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable Amount:</span>
                <span>₹{activeReceiptBill.taxableAmount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({activeReceiptBill.taxPercentage ?? 0}%):</span>
                <span>₹{activeReceiptBill.taxAmount ?? 0}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-₹{activeReceiptBill.discount?.value ?? 0}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-text">
                <span>Grand Total:</span>
                <span>₹{activeReceiptBill.grandTotal ?? activeReceiptBill.subTotal ?? 0}</span>
              </div>
            </div>

            {(activeReceiptBill.payment?.payments?.length > 0) && (
              <div className="space-y-1 border-t border-border pt-2 text-xs">
                <p className="font-semibold text-text">Payments</p>
                {activeReceiptBill.payment.payments.map((pay, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="truncate">
                      {pay.paymentMethod || "Cash"}
                      {pay.transactionId ? ` (${pay.transactionId})` : ""}
                    </span>
                    <span>₹{pay.amount ?? 0}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-text pt-1">
                  <span>Total Paid</span>
                  <span>₹{activeReceiptBill.payment?.totalPaid ?? 0}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={16} className="mr-1" /> Print
            </Button>
            <Button variant="primary" onClick={() => setActiveReceiptBill(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}



