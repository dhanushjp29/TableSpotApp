import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  addBillPayment,
  convertBookingToBill,
  fetchBills,
  markBillStatus,
  updateBill,
} from "../../store/slices/billSlice.js";
import { fetchBookings } from "../../store/slices/reservationSlice.js";
import { fetchFoodsByRestaurant } from "../../store/slices/foodSlice.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate } from "../../utils/formatDate.js";

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
  const { foods: spotFoods, isLoading: foodsLoading } = useSelector(
    (state) => state.food
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const isLoading = billsLoading || bookingsLoading;
  const error = billError || bookingError;

  // Create Bill (Convert) Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [isItemsSubmitting, setIsItemsSubmitting] = useState(false);

  // Print / View Receipt Modal State
  const [activeReceiptBill, setActiveReceiptBill] = useState(null);

  // Re-armed "now" so the Convert-to-Bill time gate stays pure (no Date.now
  // during render) while still auto-unlocking when the booking time arrives.
  const [now, setNow] = useState(0);

  const fetchData = async () => {
    await Promise.all([
      dispatch(fetchBills({ limit: 100 })),
      dispatch(fetchBookings({ limit: 100 })),
    ]).catch(() => {});
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

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
      await dispatch(convertBookingToBill(selectedBookingId));
      toast.success("Bill created from reservation successfully!");
      setIsCreateModalOpen(false);
      setSelectedBookingId("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate bill.");
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
      await dispatch(
        addBillPayment(manageBill._id, {
          paymentMethod: spotPaymentMethod,
          amount,
          notes: "Spot payment",
        })
      );
      toast.success("Spot payment recorded!");
      setManageBill(null);
      setSpotAmount("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to record payment.");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const billPayStatus = (bill) => bill?.payment?.paymentStatus || bill?.paymentStatus;

  const handleMarkAsPaid = async (billId) => {
    try {
      // markBillStatusSchema is strict { billStatus } — a { paymentStatus }
      // payload is always rejected with 400. Reconciliation happens
      // server-side: the bill only becomes Paid when recorded payments cover
      // the grand total.
      await dispatch(markBillStatus(billId, { billStatus: "Paid" }));
      toast.success("Bill marked as Paid!");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update bill status.");
    }
  };

  const openManageBill = async (bill) => {
    setManageBill(bill);
    setBillItems(
      (bill.orderedItems || []).map((item) => ({
        foodId: typeof item.foodId === "object" ? item.foodId?._id : item.foodId,
        foodName: item.foodName,
        variantName: item.variantName || "Regular",
        quantity: Number(item.quantity) || 1,
      }))
    );
    setDiscountType(bill.discount?.type || "amount");
    setDiscountValue(bill.discount?.value ? String(bill.discount.value) : "");
    setSelectedFoodId("");
    setSelectedVariant("Regular");
    setSpotQuantity(1);

    // Load the restaurant menu for spot food additions. Prices are derived
    // server-side from the Food model — the client only supplies foodId,
    // variant and quantity.
    const restaurantId = bill.restaurantId || bill.bookingId?.restaurantId;
    if (restaurantId) {
      try {
        await dispatch(
          fetchFoodsByRestaurant(restaurantId, { page: 1, limit: 100 })
        );
      } catch {
        // Keep the current menu if the load fails.
      }
    }
  };

  const addSpotFood = () => {
    if (!selectedFoodId) {
      toast.error("Select a food item to add.");
      return;
    }
    const food = spotFoods.find((f) => f._id === selectedFoodId);
    const qty = Math.max(1, Number(spotQuantity) || 1);
    const variant =
      food?.hasVariants && selectedVariant ? selectedVariant : "Regular";

    const existingIndex = billItems.findIndex(
      (item) =>
        item.foodId === selectedFoodId &&
        (item.variantName || "Regular") === variant
    );

    if (existingIndex >= 0) {
      const next = [...billItems];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: Number(next[existingIndex].quantity) + qty,
      };
      setBillItems(next);
    } else {
      setBillItems([
        ...billItems,
        {
          foodId: selectedFoodId,
          foodName: food?.foodName || "Item",
          variantName: variant,
          quantity: qty,
        },
      ]);
    }
    setSelectedFoodId("");
    setSelectedVariant("Regular");
    setSpotQuantity(1);
  };

  const removeBillItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleSaveItems = async (e) => {
    e.preventDefault();
    if (!manageBill) return;
    if (billItems.length === 0) {
      toast.error("A bill needs at least one item.");
      return;
    }
    setIsItemsSubmitting(true);
    try {
      // updateBill recomputes all totals server-side and rejects any bill
      // that is already Paid/Cancelled (terminal-state guard).
      await dispatch(
        updateBill(manageBill._id, {
          orderedItems: billItems,
          discount: {
            type: discountType,
            value: Number(discountValue) || 0,
          },
        })
      );
      toast.success("Bill items updated!");
      setManageBill(null);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update bill.");
    } finally {
      setIsItemsSubmitting(false);
    }
  };

  const filteredBills = bills.filter((b) => {
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

        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={18} className="mr-1.5" />
          Generate New Bill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total invoices</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paid</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.paid}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Partially paid</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.partiallyPaid}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pending</p>
          <p className="mt-2 text-2xl font-bold text-text">{billingStats.pending}</p>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-gray-100 shadow-sm">
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
          {["ALL", "Paid", "Partially Paid", "Pending"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
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
            <Card key={i} className="p-4">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load bills" description={error} onRetry={fetchData} />
      ) : filteredBills.length === 0 ? (
        <EmptyState title="No billing records" description="Click 'Generate New Bill' to create an invoice." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface shadow-sm">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-muted border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Bill ID</th>
                <th className="px-5 py-3">Booking Ref</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Grand Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredBills.map((bill) => (
                <tr key={bill._id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-primary">
                    {bill.billCode || `#${bill._id.slice(-6)}`}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">
                    {typeof bill.bookingId === "object"
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
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openManageBill(bill)}
                      >
                        <CreditCard size={14} className="mr-1" />
                        Manage
                      </Button>
                      {billPayStatus(bill) !== "Paid" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkAsPaid(bill._id)}
                        >
                          <CreditCard size={14} className="mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveReceiptBill(bill)}
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

          <p className="rounded-lg bg-gray-50 p-3 text-xs text-muted">
            A bill can only be raised once the booking time has arrived. The bill
            is created from the reservation's pre-ordered items and any online
            advance is carried into the bill ledger.
          </p>

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

      {/* Manage Bill Modal */}
      {manageBill && (
        <Modal
          isOpen={!!manageBill}
          onClose={() => setManageBill(null)}
          title={`Manage Bill ${manageBill.billCode || `#${manageBill._id.slice(-6)}`}`}
          size="lg"
        >
          <div className="space-y-5 pt-2">
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-text">
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

            {billPayStatus(manageBill) === "Paid" ? (
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                This bill is already paid and closed. Items, discounts and
                payments can no longer be changed.
              </div>
            ) : (
              <form onSubmit={handleSaveItems} className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-text">Bill items</label>
                    <span className="text-xs text-muted">Prices are re-derived server-side</span>
                  </div>
                  {billItems.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-muted">
                      No items on this bill yet. Add spot food below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {billItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2.5 text-sm"
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

                <div className="rounded-lg border border-gray-200 p-3">
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
                      disabled={foodsLoading}
                    >
                      <Plus size={15} className="mr-1" />
                      {foodsLoading ? "Loading menu..." : "Add item"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setManageBill(null)}>
                    Close
                  </Button>
                  <Button type="submit" isLoading={isItemsSubmitting}>
                    Save Items & Discount
                  </Button>
                </div>
              </form>
            )}

            {billPayStatus(manageBill) !== "Paid" && (
              <div className="border-t border-gray-100 pt-4">
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
                    <Button type="submit" variant="secondary" isLoading={isPaymentSubmitting}>
                      Add Spot Payment
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Printable Receipt Modal */}
      {activeReceiptBill && (
        <Modal
          isOpen={!!activeReceiptBill}
          onClose={() => setActiveReceiptBill(null)}
          title={`Invoice Receipt ${activeReceiptBill.billCode || `#${activeReceiptBill._id.slice(-6)}`}`}
        >
          <div className="space-y-4 p-2 font-mono text-sm border-y border-dashed border-gray-300 py-4 my-2">
            <div className="text-center pb-2 border-b border-gray-200">
              <h3 className="text-lg font-bold text-text font-sans">TABLESPOT RECEIPT</h3>
              <p className="text-xs text-muted">Thank you for dining with us!</p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Invoice ID:</span>
                <span>{activeReceiptBill.billCode || activeReceiptBill._id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{activeReceiptBill.createdAt ? formatDate(new Date(activeReceiptBill.createdAt)) : "Today"}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{billPayStatus(activeReceiptBill) || "Pending"}</span>
              </div>
            </div>

            {(activeReceiptBill.orderedItems?.length > 0) && (
              <div className="space-y-1 text-xs border-t border-gray-200 pt-2">
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

            <div className="space-y-1 text-xs border-t border-gray-200 pt-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{activeReceiptBill.subTotal ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>₹{activeReceiptBill.taxAmount ?? 0}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-₹{activeReceiptBill.discount?.value ?? 0}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-text pt-2 border-t border-gray-300">
                <span>Grand Total:</span>
                <span>₹{activeReceiptBill.grandTotal ?? activeReceiptBill.subTotal ?? 0}</span>
              </div>
            </div>

            {(activeReceiptBill.payment?.payments?.length > 0) && (
              <div className="space-y-1 text-xs border-t border-gray-200 pt-2">
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
