import RefundsPanel from "../../components/payment/RefundsPanel.jsx";

function CustomerRefundsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <RefundsPanel
        role="customer"
        title="My Refunds"
        subtitle="Track your refunds. Confirm receipt of cash refunds or report a problem."
      />
    </div>
  );
}

export default CustomerRefundsPage;
