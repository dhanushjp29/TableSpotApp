import PaymentHistoryPanel from "../../components/payment/PaymentHistoryPanel.jsx";

function CustomerPaymentHistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PaymentHistoryPanel
        role="customer"
        title="Payment History"
        subtitle="A complete record of every payment and refund on your bookings"
      />
    </div>
  );
}

export default CustomerPaymentHistoryPage;
