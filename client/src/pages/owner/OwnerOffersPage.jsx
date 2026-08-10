import { Eye, Plus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { fetchOffers, toggleOfferActive } from "../../store/slices/offerSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import OfferForm from "../../components/offer/OfferForm.jsx";
import { OfferStatusBadge } from "../../components/offer/OfferBadge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import {
  getOfferStatus,
  OFFER_STATUS_FILTER_OPTIONS,
  formatOfferDiscount,
} from "../../constants/offer.js";
import { formatDate } from "../../utils/formatDate.js";
import { ROUTES } from "../../routes/routeConstants.js";

function OwnerOffersPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const offers = useSelector((state) => state.offer.offers);
  const offerLoading = useSelector((state) => state.offer.isLoading);
  const offerError = useSelector((state) => state.offer.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const restaurantLoading = useSelector((state) => state.restaurant.isLoading);
  const restaurantError = useSelector((state) => state.restaurant.error);

  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const isLoading = offerLoading || restaurantLoading;
  const error = offerError || restaurantError;

  useEffect(() => {
    Promise.all([
      dispatch(fetchOffers({ page: 1, limit: 100 })),
      dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })),
    ]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleOffers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return offers.filter((offer) => {
      if (
        selectedRestaurant &&
        String(offer.restaurantId?._id || offer.restaurantId) !== selectedRestaurant
      ) {
        return false;
      }
      const status = getOfferStatus(offer);
      if (statusFilter && status !== statusFilter) return false;
      if (term) {
        const haystack = `${offer.title} ${offer.offerCode} ${offer.description || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [offers, selectedRestaurant, statusFilter, search]);

  const handleToggleActive = async (offer) => {
    setTogglingId(offer._id);
    try {
      await dispatch(toggleOfferActive(offer._id, !offer.isActive));
      toast.success(
        offer.isActive ? "Offer deactivated." : "Offer activated."
      );
      await dispatch(fetchOffers({ page: 1, limit: 100 }));
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to update offer."
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={3} />
              <Skeleton className="mt-3 h-24 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load offers"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          title="Create a restaurant first"
          description="You need at least one restaurant before you can create offers."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Offers</h1>
          <p className="mt-1 text-sm text-muted">
            Create discounts to attract customers.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Create Offer
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Restaurant"
          value={selectedRestaurant}
          onChange={(e) => setSelectedRestaurant(e.target.value)}
        >
          <option value="">All restaurants ({offers.length})</option>
          {restaurants.map((r) => (
            <option key={r._id} value={r._id}>
              {r.restaurantName}
              {r.city ? ` - ${r.city}` : ""}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {OFFER_STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Input
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, code or description"
        />
      </div>

      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Create Offer"
          size="xl"
        >
          <OfferForm
            restaurants={restaurants}
            defaultRestaurantId={selectedRestaurant}
            onSuccess={() => {
              setShowCreate(false);
              dispatch(fetchOffers({ page: 1, limit: 100 })).catch(() => {});
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {visibleOffers.length === 0 ? (
        <EmptyState
          title={offers.length === 0 ? "No offers yet" : "No matching offers"}
          description={
            offers.length === 0
              ? "Create your first offer to attract more customers."
              : "Try adjusting your filters or search."
          }
          action={
            offers.length === 0 ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus size={16} />
                Create Offer
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleOffers.map((offer) => {
            const restaurant = offer.restaurantId;
            return (
              <Card key={offer._id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold tracking-wide text-primary">
                      {offer.offerCode}
                    </p>
                    <h3 className="mt-1 font-semibold text-text">{offer.title}</h3>
                  </div>
                  <OfferStatusBadge offer={offer} />
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-primary">
                  {formatOfferDiscount(offer)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>
                    {typeof restaurant === "string"
                      ? "Restaurant"
                      : restaurant?.restaurantName}
                    {typeof restaurant !== "string" && restaurant?.city
                      ? ` · ${restaurant.city}`
                      : ""}
                  </p>
                  {offer.validityStart && offer.validityEnd && (
                    <p>
                      {formatDate(offer.validityStart + "T00:00:00")} –{" "}
                      {formatDate(offer.validityEnd + "T00:00:00")}
                    </p>
                  )}
                  <p>
                    Used {offer.stats?.totalRedemptions || 0} ·{" "}
                    {offer.targeting === "ALL"
                      ? "All customers"
                      : offer.targeting === "SELECTED"
                        ? "Selected customers"
                        : "Customer segment"}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${ROUTES.OWNER_OFFERS}/${offer._id}`)}
                  >
                    <Eye size={14} />
                    View
                  </Button>
                  <Button
                    variant={offer.isActive ? "secondary" : "outline"}
                    size="sm"
                    isLoading={togglingId === offer._id}
                    onClick={() => handleToggleActive(offer)}
                  >
                    <Power size={14} />
                    {offer.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OwnerOffersPage;
