import { Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  claimOffer,
  fetchAvailableOffers,
  fetchMyOffers,
} from "../../store/slices/offerSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import OfferCard from "../../components/offer/OfferCard.jsx";
import ScratchOfferCard from "../../components/offer/ScratchOfferCard.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import Select from "../../components/ui/Select.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { OFFER_RECIPIENT_STATUS_OPTIONS } from "../../constants/offer.js";
import { ROUTES } from "../../routes/routeConstants.js";

const STATUS_QUERY = {
  "": "",
  AVAILABLE: "AVAILABLE",
  CLAIMED: "CLAIMED",
  RESERVED: "RESERVED",
  USED: "USED",
  EXPIRED: "EXPIRED",
};

const AVAILABLE_LIMIT = 9;
function CustomerOffersPage() {
  const dispatch = useDispatch();
  const myOffers = useSelector((state) => state.offer.myOffers);
  const availableOffers = useSelector((state) => state.offer.availableOffers);
  const availableMeta = useSelector((state) => state.offer.availableMeta);
  const meta = useSelector((state) => state.offer.meta);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const isLoading = useSelector((state) => state.offer.isLoading);
  const availableLoading = useSelector((state) => state.offer.availableLoading);
  const isSubmitting = useSelector((state) => state.offer.isSubmitting);
  const error = useSelector((state) => state.offer.error);

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [restaurantId, setRestaurantId] = useState("");
  const [availablePage, setAvailablePage] = useState(1);
  const [claimingId, setClaimingId] = useState("");
  const [claimedRestaurantId, setClaimedRestaurantId] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

  const claimedRestaurants = useMemo(() => {
    const byId = new Map();
    myOffers.forEach((recipient) => {
      const offer = recipient.offerId?.offerCode ? recipient.offerId : recipient.offer;
      const restaurant = offer?.restaurantId || recipient.restaurantId;
      if (restaurant && typeof restaurant === "object" && restaurant._id) {
        byId.set(String(restaurant._id), restaurant);
      }
    });
    return [...byId.values()].sort((a, b) => (a.restaurantName || "").localeCompare(b.restaurantName || ""));
  }, [myOffers]);

  const filteredMyOffers = useMemo(() => {
    if (!claimedRestaurantId) return myOffers;
    return myOffers.filter((recipient) => {
      const offer = recipient.offerId?.offerCode ? recipient.offerId : recipient.offer;
      const restaurant = offer?.restaurantId || recipient.restaurantId;
      return String(restaurant?._id || restaurant || "") === String(claimedRestaurantId);
    });
  }, [claimedRestaurantId, myOffers]);

  useEffect(() => {
    dispatch(
      fetchMyOffers({
        page,
        limit: 9,
        status: STATUS_QUERY[status] || undefined,
      })
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    dispatch(fetchRestaurants({ page: 1, limit: 100 })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch(
      fetchAvailableOffers({
        restaurantId: restaurantId || undefined,
        excludeClaimed: true,
        page: availablePage,
        limit: AVAILABLE_LIMIT,
      })
    )
      .catch(() => {})
      .finally(() => setInitialLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, availablePage]);

  const handleClaim = async (offer) => {
    if (!offer?._id || claimingId) return false;
    setClaimingId(String(offer._id));
    try {
      const response = await dispatch(claimOffer(offer._id));
      toast.success(response?.data?.message || "Offer claimed successfully!");
      await Promise.all([
        dispatch(fetchMyOffers({
          page,
          limit: 9,
          status: STATUS_QUERY[status] || undefined,
        })).catch(() => {}),
        dispatch(
          fetchAvailableOffers({
            restaurantId: restaurantId || undefined,
            excludeClaimed: true,
            page: availablePage,
            limit: AVAILABLE_LIMIT,
          })
        ).catch(() => {}),
      ]);
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to claim offer."
      );
      return false;
    } finally {
      setClaimingId("");
    }
  };

  const showErrorState =
    error && myOffers.length === 0 && availableOffers.length === 0;

  if (
    initialLoading ||
    (isLoading && myOffers.length === 0 && availableOffers.length === 0)
  ) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-theme overflow-hidden rounded-2xl p-0">
              <Skeleton className="h-24 w-full rounded-none" />
              <Skeleton className="mx-4 my-4 h-4 w-3/4" />
            </div>
          ))}
        </div>
        <div className="mb-3">
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-theme overflow-hidden rounded-2xl p-0">
              <Skeleton className="h-24 w-full rounded-none" />
              <Skeleton className="mx-4 my-4 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showErrorState) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load your offers"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">My Offers</h1>
          <p className="mt-1 text-sm text-muted">
            Offers you've claimed and used across restaurants.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {OFFER_RECIPIENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section className="mb-10" aria-label="Available offers">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text">Available for you</h2>
            <p className="mt-1 text-sm text-muted">
              Browse live offers across every restaurant, or filter by one.
            </p>
          </div>
          <div className="w-full sm:max-w-xs">
            <Select
              aria-label="Restaurant"
              value={restaurantId}
              onChange={(e) => {
                setRestaurantId(e.target.value);
                setAvailablePage(1);
              }}
            >
              <option value="">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.restaurantName}
                  {r.city ? ` - ${r.city}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {availableLoading && availableOffers.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="card-theme overflow-hidden rounded-2xl p-0"
                >
                  <Skeleton className="h-24 w-full rounded-none" />
                  <Skeleton className="mx-4 my-4 h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : availableOffers.length === 0 ? (
            <EmptyState
              title="No offers available"
              description="There are no live offers you're eligible for right now."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableOffers.map((offer) => (
                  <ScratchOfferCard
                    key={offer._id}
                    offer={offer}
                    onClaim={handleClaim}
                    claiming={claimingId === String(offer._id)}
                  />
                ))}
              </div>
              <Pagination
                page={availablePage}
                totalPages={availableMeta?.totalPages || 1}
                onPageChange={setAvailablePage}
                className="mt-6"
              />
            </>
          )}
      </section>

      <section aria-label="My claimed offers">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text">Claimed offers</h2>
            <p className="mt-1 text-sm text-muted">Your unlocked rewards, ready when you are.</p>
          </div>
          <div className="w-full sm:max-w-xs">
            <Select aria-label="Filter claimed offers by restaurant" value={claimedRestaurantId} onChange={(e) => { setClaimedRestaurantId(e.target.value); setPage(1); }}>
              <option value="">All Restaurants</option>
              {claimedRestaurants.map((restaurant) => <option key={restaurant._id} value={restaurant._id}>{restaurant.restaurantName}</option>)}
            </Select>
          </div>
        </div>

        {isLoading && filteredMyOffers.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="card-theme overflow-hidden rounded-2xl p-0"
              >
                <Skeleton className="h-24 w-full rounded-none" />
                <Skeleton className="mx-4 my-4 h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredMyOffers.length === 0 ? (
          <EmptyState
            title={status ? "No offers in this state" : "No offers yet"}
            description={
              status
                ? "Try a different status filter."
                : "Claim an offer above to see it here."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMyOffers.map((recipient) => {
                const offerStatus = (recipient.status || "AVAILABLE").toLowerCase();
                return (
                  <Link
                    key={recipient._id}
                    to={`${ROUTES.CUSTOMER_OFFERS}/${recipient.offerId?._id || recipient.offerId}`}
                    className="block"
                  >
                    <OfferCard
                      item={recipient}
                      status={offerStatus}
                      claimed={recipient.status === "CLAIMED"}
                    />
                  </Link>
                );
              })}
            </div>
            <Pagination
              page={page}
              totalPages={meta?.totalPages || 1}
              onPageChange={setPage}
              className="mt-6"
            />
          </>
        )}
      </section>

      {myOffers.length === 0 && availableOffers.length === 0 && !isSubmitting && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Ticket size={16} />
          No live offers are available for you right now.
        </div>
      )}
    </div>
  );
}

export default CustomerOffersPage;
