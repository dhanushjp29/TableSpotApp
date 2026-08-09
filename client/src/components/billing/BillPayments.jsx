import { CreditCard, Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import Select from "../ui/Select.jsx";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Net Banking", "Wallet"];

export default function BillPayments({
  payments,
  existingPaymentCount,
  paymentMethod,
  amount,
  reference,
  notes,
  onPaymentChange,
  onMethodChange,
  onAmountChange,
  onReferenceChange,
  onNotesChange,
  onAdd,
  onRemove,
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-secondary/40 p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text"><CreditCard size={16} className="text-primary" />Payments</h3>
      <div className="hidden grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
        <span>Payment Method</span><span>Amount</span><span>Transaction / Reference</span><span>Notes</span><span />
      </div>
      <div className="space-y-3">
        {payments.map((payment, index) => {
          const isExisting = index < existingPaymentCount;
          return (
            <div key={`${payment.transactionId || "payment"}-${index}`} className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{isExisting ? `Payment ${index + 1}` : "New payment"}</span>
                {!isExisting && <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => onRemove(index)}><Trash2 size={14} /></Button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_auto] sm:items-end">
                <Select value={payment.paymentMethod || "Cash"} onChange={(event) => onPaymentChange(index, "paymentMethod", event.target.value)}>
                  {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </Select>
                <Input type="number" min="0" step="0.01" value={payment.amount ?? ""} onChange={(event) => onPaymentChange(index, "amount", event.target.value)} />
                <Input value={payment.transactionId || ""} onChange={(event) => onPaymentChange(index, "transactionId", event.target.value)} />
                <Input value={payment.notes || ""} onChange={(event) => onPaymentChange(index, "notes", event.target.value)} />
                <span className="sm:block" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr_1.2fr_1.2fr_auto] sm:items-end">
        <Select value={paymentMethod} onChange={(event) => onMethodChange(event.target.value)}>
          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        </Select>
        <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => onAmountChange(event.target.value)} />
        <Input value={reference} onChange={(event) => onReferenceChange(event.target.value)} />
        <Input value={notes} onChange={(event) => onNotesChange(event.target.value)} />
        <Button type="button" variant="secondary" onClick={onAdd}><Plus size={15} /></Button>
      </div>
    </section>
  );
}
