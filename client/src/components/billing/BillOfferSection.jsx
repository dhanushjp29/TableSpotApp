import { Ticket } from "lucide-react";

import {
  computeOfferDiscount,
  formatOfferDiscount,
  getOfferStatus,
} from "../../constants/offer.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDate } from "../../utils/formatDate.js";
import Button from "../ui/Button.jsx";

const isOfferLive = (offer) =>
  !offer?.isDeleted && getOfferStatus(offer) === "active";

function AppliedOfferRow({ bill }) {
  const offer = bill?.offer || {};
  if (!offer?.offerCode) return null;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-xs font-bold text-white">
            <Ticket size={12} />
            {offer.offerCode}
          </span>
          <span className="text-sm font-semibold text-text">
            {offer.title || "Offer applied"}
          </span>
        </div>
        {Number(bill?.offerDiscountAmount || 0) > 0 && (
          <span className="text-sm font-bold text-primary">
            −{formatCurrency(bill.offerDiscountAmount)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BillOfferSection({
  bill = null,
  draft = {},
  offers = [],
  subtotal = 0,
  editable = true,
  onChange,
  onApplyOffer,
  applying = false,
}) {
  const existingOffer = bill?.offer?.offerCode;

  if (existingOffer) {
    return (
      <section className="rounded-2xl border border-border bg-surface-secondary/40 p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
          <Ticket size={16} className="text-primary" />
          Offer Applied
        </h3>
        <AppliedOfferRow bill={bill} />
      </section>
    );
  }

  if (!editable) return null;

  const code = String(draft.offerCode || "").trim().toUpperCase();
  const matchedOffer = offers.find(
    (offer) => String(offer.offerCode || "").toUpperCase() === code
  );
  const previewDiscount =
    matchedOffer && code
      ? Math.min(
          computeOfferDiscount(matchedOffer, subtotal),
          subtotal
        )
      : 0;
  const live = matchedOffer ? isOfferLive(matchedOffer) : false;

  const canApplyToExisting = Boolean(bill && bill.billType === "WALK_IN");

  return (
    <section className="rounded-2xl border border-border bg-surface-secondary/40 p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
        <Ticket size={16} className="text-primary" />
        Offer / Coupon
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="input-label">Offer code</label>
          <input
            className="input-field w-full uppercase"
            value={draft.offerCode || ""}
            onChange={(event) => onChange("offerCode", event.target.value)}
            placeholder="e.g. WEEKEND20"
          />
          {matchedOffer ? (
            <p className="mt-1 text-xs">
              {live ? (
                <span className="text-success">
                  {matchedOffer.title} · {formatOfferDiscount(matchedOffer)}
                  {previewDiscount > 0
                    ? ` · worth ${formatCurrency(previewDiscount)} on this bill`
                    : ""}
                </span>
              ) : (
                <span className="text-error">
                  {matchedOffer.title} is not currently valid.
                </span>
              )}
            </p>
          ) : (
            code && (
              <p className="mt-1 text-xs text-muted">
                Applied when the bill is created. Please double-check the code.
              </p>
            )
          )}
        </div>
        <div>
          <label className="input-label">Customer email</label>
          <input
            className="input-field w-full"
            value={draft.customerEmail || ""}
            onChange={(event) => onChange("customerEmail", event.target.value)}
            placeholder="Required for invite/segment offers"
            type="email"
          />
          <p className="mt-1 text-xs text-muted">
            Required for selected-customer and segment offers. The offer is
            validated when the bill is created.
          </p>
        </div>
      </div>

      {previewDiscount > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted">
            Estimated offer discount
            {matchedOffer?.validityEnd
              ? ` · valid till ${formatDate(matchedOffer.validityEnd + "T00:00:00")}`
              : ""}
          </span>
          <span className="font-bold text-primary">
            −{formatCurrency(previewDiscount)}
          </span>
        </div>
      )}

      {canApplyToExisting && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            Applies the offer to the most recent open walk-in bill at this
            restaurant.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!code || !live}
            isLoading={applying}
            onClick={() => onApplyOffer({ offerCode: code })}
          >
            Apply Offer to Bill
          </Button>
        </div>
      )}

      {code && !matchedOffer && (
        <div className="mt-3 rounded-lg border border-dashed border-border p-2 text-center text-xs text-muted">
          No matching active offer for this code at the selected restaurant.
          Unknown codes are validated by the server at bill creation.
        </div>
      )}
    </section>
  );
}
