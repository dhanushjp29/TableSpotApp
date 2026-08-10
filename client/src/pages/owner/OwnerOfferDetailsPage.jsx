import { ArrowLeft, Edit2, Power, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteOffer,
  fetchOfferById,
  fetchOfferRecipients,
  fetchOfferStats,
  toggleOfferActive,
} from "../../store/slices/offerSlice.js";
import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";

import OfferForm from "../../components/offer/OfferForm.jsx";
import { OfferStatusBadge } from "../../components/offer/OfferBadge.jsx";
import OfferRecipientsTable from "../../components/offer/OfferRecipientsTable.jsx";
import Button from "../../components/ui/Button.jsx";
import Card, { CardBody, CardHeader } from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import {
  OFFER_RECIPIENT_STATUS_OPTIONS,
  formatOfferDiscount,
  getOfferStatus,
} from "../../constants/offer.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDate } from "../../utils/formatDate.js";
import { ROUTES } from "../../routes/routeConstants.js";

function StatCard({ label, value, highlight = false }) {
  return (
    <Card className="p-4">
      <p
        className={`text-2xl font-extrabold tracking-tight ${
          highlight ? "text-primary" : "text-text"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
    </Card>
  );
}

function OwnerOfferDetailsPage() {
  const { offerId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const offer = useSelector((state) => state.offer.currentOffer);
  const offerStats = useSelector((state) => state.offer.offerStats);
  const recipients = useSelector((state) => state.offer.recipients);
  const recipientsMeta = useSelector((state) => state.offer.recipientsMeta);
  const isLoading = useSelector((state) => state.offer.isLoading);
  const isSubmitting = useSelector((state) => state.offer.isSubmitting);
  const error = useSelector((state) => state.offer.error);
  const restaurants = useSelector((state) => state.restaurant.restaurants);

  const [showEdit, setShowEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    await Promise.all([
      dispatch(fetchOfferById(offerId)),
      dispatch(fetchOfferStats(offerId)),
      dispatch(fetchOfferRecipients(offerId, { page: 1, limit: 10 })),
      dispatch(fetchRestaurants({ ownerId: user?.id, isActive: true })).catch(
        () => {}
      ),
    ]).catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return;
    dispatch(
      fetchOfferRecipients(offerId, {
        page: recipientPage,
        limit: 10,
        status: statusFilter || undefined,
      })
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientPage, statusFilter]);

  const handleToggleActive = async () => {
    if (!offer) return;
    try {
      await dispatch(toggleOfferActive(offer._id, !offer.isActive));
      toast.success(offer.isActive ? "Offer deactivated." : "Offer activated.");
      await Promise.all([
        dispatch(fetchOfferById(offerId)),
        dispatch(fetchOfferStats(offerId)),
      ]);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to update offer."
      );
    }
  };

  const handleDelete = async () => {
    if (!offer) return;
    setDeleting(true);
    try {
      await dispatch(deleteOffer(offer._id));
      toast.success("Offer deleted successfully!");
      navigate(ROUTES.OWNER_OFFERS);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete offer."
      );
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading && !offer) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="p-6">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="mt-4 h-4 w-72 rounded" />
          <Skeleton className="mt-2 h-4 w-56 rounded" />
        </Card>
      </div>
    );
  }

  if (error && !offer) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState
          title="Unable to load offer"
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!offer) return null;

  const status = getOfferStatus(offer);
  const counts = offerStats?.counts || {};
  const restaurant = offer.restaurantId;
  const canEdit = getOfferStatus(offer) !== "expired";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <button
        onClick={() => navigate(ROUTES.OWNER_OFFERS)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft size={16} />
        Back to offers
      </button>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs font-bold tracking-wide text-primary">
                {offer.offerCode}
              </p>
              <OfferStatusBadge offer={offer} />
            </div>
            <h1 className="mt-1 text-2xl font-bold text-text">{offer.title}</h1>
            {offer.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted">
                {offer.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                <Edit2 size={15} />
                Edit
              </Button>
            )}
            <Button
              variant={offer.isActive ? "secondary" : "outline"}
              isLoading={isSubmitting}
              onClick={handleToggleActive}
            >
              <Power size={15} />
              {offer.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={15} />
              Delete
            </Button>
          </div>
        </CardHeader>

        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Discount
              </p>
              <p className="mt-1 text-lg font-extrabold text-primary">
                {formatOfferDiscount(offer)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Restaurant
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {typeof restaurant === "string"
                  ? "—"
                  : restaurant?.restaurantName}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Validity
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.validityStart && offer.validityEnd
                  ? `${formatDate(offer.validityStart + "T00:00:00")} – ${formatDate(offer.validityEnd + "T00:00:00")}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Targeting
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.targeting === "ALL"
                  ? "All customers"
                  : offer.targeting === "SELECTED"
                    ? `Selected customers (${offer.targetUserIds?.length || 0})`
                    : "Customer segment"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Min order
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.minOrderAmount > 0
                  ? formatCurrency(offer.minOrderAmount)
                  : "None"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Max discount
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.maxDiscountAmount > 0
                  ? formatCurrency(offer.maxDiscountAmount)
                  : "None"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Max redemptions
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.maxRedemptions > 0 ? offer.maxRedemptions : "Unlimited"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Per-user limit
              </p>
              <p className="mt-1 text-sm font-medium text-text">
                {offer.perUserRedemptionLimit || 1}
              </p>
            </div>
          </div>

          {offer.targeting === "SEGMENT" && offer.segmentRules && (
            <div className="mt-4 rounded-xl border border-border bg-surface-secondary/40 p-4 text-sm text-muted">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Segment rules
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                {offer.segmentRules.minBookings > 0 && (
                  <li>At least {offer.segmentRules.minBookings} bookings</li>
                )}
                {offer.segmentRules.minTotalSpent > 0 && (
                  <li>
                    Spent at least {formatCurrency(offer.segmentRules.minTotalSpent)}
                  </li>
                )}
                {offer.segmentRules.hasCompletedBooking && (
                  <li>Has a completed booking</li>
                )}
                {offer.segmentRules.recentWithinDays > 0 && (
                  <li>
                    Visited within the last {offer.segmentRules.recentWithinDays} days
                  </li>
                )}
                {offer.segmentRules.inactiveSinceDays > 0 && (
                  <li>Inactive for {offer.segmentRules.inactiveSinceDays}+ days</li>
                )}
                {status === "active" &&
                  !offer.segmentRules.minBookings &&
                  !offer.segmentRules.minTotalSpent &&
                  !offer.segmentRules.hasCompletedBooking &&
                  !offer.segmentRules.recentWithinDays &&
                  !offer.segmentRules.inactiveSinceDays && (
                    <li>No rules configured — offer is open to everyone</li>
                  )}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-bold text-text">
        <Users size={18} />
        Performance
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total recipients" value={counts.totalRecipients || 0} />
        <StatCard label="Available" value={counts.available || 0} />
        <StatCard label="Claimed" value={counts.claimed || 0} />
        <StatCard label="Used" value={counts.used || 0} highlight />
        <StatCard label="Expired" value={counts.expired || 0} />
        <StatCard label="Redemptions" value={counts.totalRedemptions || 0} />
        <StatCard
          label="Total discount"
          value={formatCurrency(counts.totalDiscountAmount || 0)}
          highlight
        />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-text">Recipients</h2>
        <div className="w-full sm:max-w-xs">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setRecipientPage(1);
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

      <div className="mt-3">
        <OfferRecipientsTable
          recipients={recipients}
          meta={recipientsMeta}
          page={recipientPage}
          onPageChange={setRecipientPage}
          isLoading={isLoading}
        />
      </div>

      {showEdit && (
        <Modal
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          title="Edit Offer"
          size="xl"
        >
          <OfferForm
            offer={offer}
            restaurants={restaurants}
            onSuccess={() => {
              setShowEdit(false);
              load();
            }}
            onCancel={() => setShowEdit(false)}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Offer"
        description={`Are you sure you want to delete "${offer.title}"? This cannot be undone. Offers with redemptions cannot be deleted.`}
        confirmText="Delete"
      />
    </div>
  );
}

export default OwnerOfferDetailsPage;
