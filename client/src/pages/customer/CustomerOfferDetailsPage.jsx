import { ArrowLeft, CalendarClock, Info, MapPin, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

import { claimOffer, fetchMyOffers, fetchOfferById } from "../../store/slices/offerSlice.js";
import { OfferRecipientStatusBadge } from "../../components/offer/OfferBadge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card, { CardBody, CardHeader } from "../../components/ui/Card.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { getOfferStatus, formatOfferDiscount, OFFER_DISCOUNT_TYPE } from "../../constants/offer.js";
import { formatDate, formatTime } from "../../utils/formatDate.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { ROUTES } from "../../routes/routeConstants.js";

const dateTime = (value) => {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return `${formatDate(date.toISOString())} · ${formatTime(date.toISOString())}`;
};

function CustomerOfferDetailsPage() {
  const { offerId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const offer = useSelector((state) => state.offer.currentOffer);
  const myOffers = useSelector((state) => state.offer.myOffers);
  const isLoading = useSelector((state) => state.offer.isLoading);
  const isSubmitting = useSelector((state) => state.offer.isSubmitting);
  const error = useSelector((state) => state.offer.error);
  const [claimed, setClaimed] = useState(false);

  const myRecipient = myOffers.find((recipient) =>
    String(recipient.offerId?._id || recipient.offerId) === String(offerId)
  );

  useEffect(() => {
    Promise.all([
      dispatch(fetchOfferById(offerId)),
      dispatch(fetchMyOffers({ page: 1, limit: 100 })),
    ]).catch(() => {});
  }, [dispatch, offerId]);

  const handleClaim = async () => {
    try {
      const response = await dispatch(claimOffer(offerId));
      toast.success(response?.data?.message || "Offer claimed successfully!");
      setClaimed(true);
      await dispatch(fetchMyOffers({ page: 1, limit: 100 })).catch(() => {});
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to claim offer.");
    }
  };

  if (isLoading && !offer) return <div className="mx-auto max-w-4xl px-4 py-6"><Card className="p-6"><Skeleton className="h-8 w-64 rounded-lg" /><Skeleton className="mt-4 h-4 w-full rounded" /></Card></div>;
  if (error && !offer) return <div className="mx-auto max-w-4xl px-4 py-6"><ErrorState title="Unable to load offer" description={error} onRetry={() => window.location.reload()} /></div>;
  if (!offer) return null;

  const restaurant = offer.restaurantId;
  const restaurantId = typeof restaurant === "string" ? restaurant : restaurant?._id;
  const lifecycleStatus = myRecipient?.status || (claimed ? "CLAIMED" : null);
  const offerStatus = getOfferStatus(offer);
  const displayStatus = lifecycleStatus || (offerStatus === "expired" ? "EXPIRED" : "AVAILABLE");
  const targeting = String(offer.targeting || offer.targetType || "ALL").toUpperCase();
  const eligibility = targeting === "SELECTED"
    ? "Available to you as an invited customer"
    : targeting === "SEGMENT"
      ? "Available because you match this restaurant’s customer segment"
      : "Available to eligible customers at this restaurant";
  const canClaim = !lifecycleStatus && offerStatus === "active";
  const canUse = lifecycleStatus === "CLAIMED";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <button onClick={() => navigate(ROUTES.CUSTOMER_OFFERS)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft size={16} /> Back to my offers
      </button>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/70 px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2 py-1 font-mono text-xs font-bold text-white"><Ticket size={13} /> {offer.offerCode}</span>
            <OfferRecipientStatusBadge status={displayStatus} />
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{formatOfferDiscount(offer)}</p>
          <p className="mt-1 text-sm text-white/80">Your offer at {restaurant?.restaurantName || "this restaurant"}</p>
        </div>

        <CardHeader>
          <h1 className="text-2xl font-bold text-text">{offer.title || "Special offer"}</h1>
          {offer.description && <p className="mt-2 text-sm leading-6 text-muted">{offer.description}</p>}
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-secondary/60 p-3"><p className="text-xs text-muted">Discount</p><p className="mt-1 font-semibold text-text">{offer.discountType === OFFER_DISCOUNT_TYPE.PERCENTAGE ? `${offer.discountValue}% percentage discount` : `${formatCurrency(offer.discountValue)} flat discount`}</p></div>
            <div className="rounded-xl bg-surface-secondary/60 p-3"><p className="text-xs text-muted">Minimum order</p><p className="mt-1 font-semibold text-text">{Number(offer.minOrderAmount) > 0 ? formatCurrency(offer.minOrderAmount) : "No minimum order"}</p></div>
            <div className="rounded-xl bg-surface-secondary/60 p-3"><p className="text-xs text-muted">Maximum discount</p><p className="mt-1 font-semibold text-text">{Number(offer.maxDiscountAmount) > 0 ? formatCurrency(offer.maxDiscountAmount) : "No cap"}</p></div>
            <div className="rounded-xl bg-surface-secondary/60 p-3"><p className="text-xs text-muted">Usage limit</p><p className="mt-1 font-semibold text-text">{Number(offer.perUserRedemptionLimit) > 0 ? `${offer.perUserRedemptionLimit} use${offer.perUserRedemptionLimit === 1 ? "" : "s"} per customer` : "As permitted while available"}</p></div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <p className="inline-flex items-center gap-2"><CalendarClock size={16} /> Valid from {dateTime(offer.validityStart)}</p>
            <p className="inline-flex items-center gap-2"><CalendarClock size={16} /> Expires {dateTime(offer.validityEnd)}</p>
            <p className="inline-flex items-center gap-2"><MapPin size={16} /> {restaurant?.restaurantName || "Restaurant"}{restaurant?.city ? ` · ${restaurant.city}` : ""}</p>
            {restaurant?.address && <p className="inline-flex items-center gap-2"><MapPin size={16} /> {restaurant.address}</p>}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-surface-secondary/40 p-3 text-sm text-muted"><span className="inline-flex items-center gap-2 font-semibold text-text"><Info size={16} /> Eligibility</span><p className="mt-1">{eligibility}. The booking page will validate order total, validity and remaining redemption capacity.</p></div>

          <div className="mt-6 flex flex-wrap gap-3">
            {canClaim && <Button isLoading={isSubmitting} onClick={handleClaim}>Claim Offer</Button>}
            {canUse && restaurantId && <Button onClick={() => navigate(`/restaurants/${restaurantId}/book`)}>Use in a booking</Button>}
            {lifecycleStatus && !canUse && <Button variant="secondary" disabled>{displayStatus === "USED" ? "Already used" : displayStatus === "EXPIRED" ? "Offer expired" : displayStatus === "RESERVED" ? "Reserved for booking" : "Already claimed"}</Button>}
            {restaurantId && <Button variant="outline" onClick={() => navigate(`/restaurants/${restaurantId}`)}>Visit Restaurant</Button>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default CustomerOfferDetailsPage;
