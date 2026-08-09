import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button.jsx";
import BillInformation from "./BillInformation.jsx";
import BillItems from "./BillItems.jsx";
import BillDiscountTax from "./BillDiscountTax.jsx";
import BillPayments from "./BillPayments.jsx";
import BillSummary from "./BillSummary.jsx";

const emptyDraft = {
  restaurantId: "", tableId: "", customerName: "", customerPhone: "", customerEmail: "",
  items: [], discountType: "amount", discountValue: "", taxPercentage: "0", notes: "",
  payments: [],
};

const idOf = (value) => (value && typeof value === "object" ? value._id : value) || "";

export default function BillEditor({
  bill = null,
  billType = "WALK_IN",
  restaurants = [],
  tables = [],
  foods = [],
  loading = false,
  onRestaurantChange,
  onSubmit,
  onClose,
  submitting = false,
}) {
  const isOnline = billType === "ONLINE";
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentEntries, setPaymentEntries] = useState([]);
  const [existingPaymentCount, setExistingPaymentCount] = useState(0);

  useEffect(() => {
    const booking = bill?.bookingId || {};
    // This synchronizes the editor draft when a different bill is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      restaurantId: idOf(bill?.restaurantId || booking.restaurantId),
      tableId: idOf(bill?.tableId || booking.tableId),
      customerName: bill?.customerName || booking.userId?.fullName || "",
      customerPhone: bill?.customerPhone || booking.userId?.phoneNumber || "",
      customerEmail: bill?.customerEmail || booking.userId?.email || "",
      items: (bill?.orderedItems || []).map((item) => ({
        foodId: idOf(item.foodId), foodName: item.foodName, variantName: item.variantName || "Regular",
        quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice || 0), totalPrice: Number(item.totalPrice || 0),
      })),
      discountType: bill?.discount?.type || "amount",
      discountValue: bill?.discount?.value !== undefined ? String(bill.discount.value) : "",
      taxPercentage: String(bill?.taxPercentage ?? 0), notes: bill?.notes || "",
      payments: bill?.payment?.payments || [],
    });
    setPaymentEntries(bill?.payment?.payments || []);
    setExistingPaymentCount((bill?.payment?.payments || []).length);
  }, [bill]);

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const selectedFood = foods.find((food) => food._id === selectedFoodId);
  const variants = selectedFood?.variants || [];
  const effectiveVariant = selectedFood?.hasVariants ? selectedVariant || variants[0]?.variantName : "Regular";

  const addItem = () => {
    if (!selectedFood) return;
    const variant = variants.find((item) => item.variantName === effectiveVariant) || variants[0];
    const unitPrice = Number(variant?.offerPrice > 0 ? variant.offerPrice : variant?.price || 0);
    const qty = Math.max(1, Number(quantity) || 1);
    const existing = draft.items.findIndex((item) => item.foodId === selectedFood._id && item.variantName === effectiveVariant);
    const items = existing >= 0
      ? draft.items.map((item, index) => index === existing ? { ...item, quantity: item.quantity + qty } : item)
      : [...draft.items, { foodId: selectedFood._id, foodName: selectedFood.foodName, variantName: effectiveVariant, quantity: qty, unitPrice }];
    update("items", items);
    setSelectedFoodId(""); setSelectedVariant(""); setQuantity(1);
  };

  const allPayments = paymentEntries;
  const totalPaid = allPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const subtotal = useMemo(() => draft.items.reduce((sum, item) => sum + Number(item.totalPrice || (item.unitPrice || 0) * (item.quantity || 0)), 0), [draft.items]);
  const discount = draft.discountType === "percentage" ? Math.min(subtotal, subtotal * (Number(draft.discountValue) || 0) / 100) : Math.min(subtotal, Number(draft.discountValue) || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (Number(draft.taxPercentage) || 0) / 100;
  const grandTotal = taxable + tax + Number(bill?.serviceCharge || 0) + Number(bill?.deliveryCharge || 0);

  const addPayment = () => {
    const amount = Number(paymentAmount);
    if (!paymentMethod || !amount || amount <= 0) return;
    setPaymentEntries((current) => [...current, { paymentMethod, amount, transactionId: paymentReference, notes: paymentNotes }]);
    setPaymentAmount(""); setPaymentReference(""); setPaymentNotes("");
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      billType, restaurantId: draft.restaurantId, tableId: draft.tableId,
      customerName: draft.customerName, customerPhone: draft.customerPhone, customerEmail: draft.customerEmail,
      orderedItems: draft.items.map(({ foodId, foodName, variantName, quantity }) => ({ foodId, foodName, variantName, quantity })),
      discount: { type: draft.discountType, value: Number(draft.discountValue) || 0 },
      taxPercentage: Number(draft.taxPercentage) || 0, notes: draft.notes,
      payment: {
        replacePayments: Boolean(bill),
        payments: allPayments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount) || 0,
        })),
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5 pt-1">
      <BillInformation bill={bill} billType={billType} draft={draft} restaurants={restaurants} tables={tables} editable={!isOnline} onChange={update} onRestaurantChange={onRestaurantChange} />
      <BillItems items={draft.items} taxPercentage={draft.taxPercentage} foods={foods} loading={loading} selectedFoodId={selectedFoodId} selectedVariant={selectedVariant} quantity={quantity} onFoodChange={(value) => { setSelectedFoodId(value); setSelectedVariant(foods.find((food) => food._id === value)?.variants?.[0]?.variantName || ""); }} onVariantChange={setSelectedVariant} onQuantityChange={setQuantity} onAdd={addItem} onChange={(items) => update("items", items)} />
      <BillDiscountTax draft={draft} onChange={update} />
      <BillPayments payments={paymentEntries} existingPaymentCount={existingPaymentCount} paymentMethod={paymentMethod} amount={paymentAmount} reference={paymentReference} notes={paymentNotes} onPaymentChange={(index, field, value) => setPaymentEntries((current) => current.map((payment, paymentIndex) => paymentIndex === index ? { ...payment, [field]: value } : payment))} onMethodChange={setPaymentMethod} onAmountChange={setPaymentAmount} onReferenceChange={setPaymentReference} onNotesChange={setPaymentNotes} onAdd={addPayment} onRemove={(index) => setPaymentEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
      <BillSummary subtotal={subtotal} discount={discount} taxableAmount={taxable} tax={tax} taxPercentage={draft.taxPercentage} serviceCharge={bill?.serviceCharge || 0} deliveryCharge={bill?.deliveryCharge || 0} grandTotal={grandTotal} totalPaid={totalPaid} balanceDue={Math.max(0, grandTotal - totalPaid)} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" isLoading={submitting}>{bill ? "Update Bill" : "Create Walk-in Bill"}</Button>
      </div>
    </form>
  );
}
