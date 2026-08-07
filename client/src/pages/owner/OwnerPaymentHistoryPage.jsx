import PaymentHistoryPanel from "../../components/payment/PaymentHistoryPanel.jsx";

function OwnerPaymentHistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PaymentHistoryPanel
        role="owner"
        title="Payment History"
        subtitle="Track every payment received and refund issued across your restaurants"
      />
    </div>
  );
}

export default OwnerPaymentHistoryPage;
