import { formatDateTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import {
  OFFER_RECIPIENT_STATUS_META,
  OFFER_USAGE_SOURCE_LABEL,
} from "../../constants/offer.js";
import Badge from "../ui/Badge.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Pagination from "../ui/Pagination.jsx";

function OfferRecipientsTable({
  recipients = [],
  meta = null,
  page = 1,
  onPageChange,
  isLoading = false,
}) {
  if (isLoading && recipients.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <EmptyState
        title="No recipients yet"
        description="Customers will appear here once they claim or use this offer."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/50 text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Discount</th>
              <th className="px-4 py-3 font-semibold">Claimed</th>
              <th className="px-4 py-3 font-semibold">Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recipients.map((recipient) => {
              const statusMeta =
                OFFER_RECIPIENT_STATUS_META[recipient.status] || {
                  label: recipient.status || "Unknown",
                  variant: "neutral",
                };
              const customerName =
                recipient.user?.fullName ||
                recipient.user?.firstName ||
                recipient.user?.name ||
                (recipient.userId ? "Customer" : "Walk-in");
              return (
                <tr key={recipient._id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{customerName}</p>
                    <p className="text-xs text-muted">
                      {recipient.email || "No email"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {OFFER_USAGE_SOURCE_LABEL[recipient.usageSource] || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {recipient.discountAmount
                      ? formatCurrency(recipient.discountAmount)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {recipient.claimedAt ? formatDateTime(recipient.claimedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {recipient.usedAt ? formatDateTime(recipient.usedAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {meta?.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          onPageChange={onPageChange}
          className="mt-4"
        />
      )}
    </>
  );
}

export default OfferRecipientsTable;
