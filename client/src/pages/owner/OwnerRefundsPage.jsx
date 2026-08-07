import RefundsPanel from "../../components/payment/RefundsPanel.jsx";

function OwnerRefundsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <RefundsPanel
        role="owner"
        title="Refunds"
        subtitle="Process pending and overdue refunds. Unresolved refunds keep new bookings restricted until settled."
      />
    </div>
  );
}

export default OwnerRefundsPage;
