import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

import { cancelBooking, fetchBookingById, setCurrentBooking } from "../../store/slices/reservationSlice.js";
import { clearCurrentRefund, confirmRefundReceipt, disputeRefund, fetchRefundById } from "../../store/slices/refundSlice.js";
import { subscribeToBookingUpdates } from "../../services/socket/socketService.js";
import { useBookingAdvancePayment } from "../../hooks/useBookingAdvancePayment.js";
import BookingDetailsSummary from "../../components/booking/BookingDetailsSummary.jsx";
import BookingPdf from "../../components/pdf/BookingPdf.jsx";
import PdfDownloadButton from "../../components/pdf/PdfDownloadButton.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { bookingReceiptFilename } from "../../utils/pdf/pdfData.js";

const REFUND_LABELS = {
  REFUND_AWAITING_CUSTOMER_CONFIRMATION: "Awaiting your confirmation",
  REFUNDED: "Refunded",
  REFUND_FAILED: "Failed",
  REFUND_DISPUTED: "Disputed",
};

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const dispatch = useDispatch();
  const booking = useSelector((state) => state.reservation.currentBooking);
  const isLoading = useSelector((state) => state.reservation.isLoading);
  const error = useSelector((state) => state.reservation.error);
  const refund = useSelector((state) => state.refund.currentRefund);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRefundAction, setIsRefundAction] = useState(false);
  const { isPaying, payAdvance } = useBookingAdvancePayment();
  const fetchBooking = useCallback(() => dispatch(fetchBookingById(bookingId)).catch(() => {}), [dispatch, bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);
  useEffect(() => {
    if (!booking?.refundId || !booking.refundStatus || booking.refundStatus === "NOT_REQUIRED") { dispatch(clearCurrentRefund()); return; }
    dispatch(fetchRefundById(booking.refundId)).catch(() => {});
  }, [dispatch, booking?.refundId, booking?.refundStatus]);
  useEffect(() => subscribeToBookingUpdates("all", (updated) => { if (String(updated._id) === String(bookingId)) dispatch(setCurrentBooking(updated)); }, fetchBooking), [dispatch, bookingId, fetchBooking]);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-8"><div className="card p-6"><SkeletonText lines={10} /></div></div>;
  if (error) return <div className="mx-auto max-w-5xl px-4 py-8"><ErrorState title="Unable to load booking" description={error} onRetry={fetchBooking} /></div>;
  if (!booking) return <div className="mx-auto max-w-5xl px-4 py-8"><EmptyState title="Booking not found" /></div>;

  const status = booking.bookingStatus || "Pending";
  const canCancel = !["Cancelled", "Completed", "No Show"].includes(status);
  const paymentActive = canCancel && ["Pending", "Partially Paid"].includes(booking.paymentStatus);
  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setIsCancelling(true);
    try { await dispatch(cancelBooking(bookingId)); toast.success("Booking cancelled."); fetchBooking(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to cancel booking."); }
    finally { setIsCancelling(false); }
  };
  const handleConfirmRefund = async () => {
    if (!window.confirm("I received the refund in cash. Confirm receipt?")) return;
    setIsRefundAction(true);
    try { await dispatch(confirmRefundReceipt(booking.refundId)); toast.success("Refund receipt confirmed."); fetchBooking(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to confirm refund."); }
    finally { setIsRefundAction(false); }
  };
  const handleDisputeRefund = async () => {
    const reason = window.prompt("Why did you not receive this refund? (minimum 5 characters)");
    if (!reason || reason.trim().length < 5) { toast.error("Please provide at least 5 characters."); return; }
    setIsRefundAction(true);
    try { await dispatch(disputeRefund(booking.refundId, reason.trim())); toast.success("Refund disputed."); fetchBooking(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to dispute refund."); }
    finally { setIsRefundAction(false); }
  };

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Link to="/customer/bookings" className="mb-5 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"><ChevronLeft size={16} /> Back to my bookings</Link>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-text">Booking details</h1><div className="flex flex-wrap gap-2"><PdfDownloadButton size="sm" filename={bookingReceiptFilename} fetchData={async () => ({ booking })} renderDocument={({ booking: data }) => <BookingPdf booking={data} view="customer" />} />{booking.bookingCode && <Badge variant="primary">{booking.bookingCode}</Badge>}</div></div>
    <BookingDetailsSummary booking={booking} offerRecipient={booking.offerRecipient} />
    {paymentActive && Number(booking.advanceAmount) > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><span className="text-sm font-medium text-text">Advance payment is pending.</span><Button isLoading={isPaying} onClick={() => payAdvance({ bookingId, onSuccess: fetchBooking, onDismiss: fetchBooking })}>Pay advance</Button></div>}
    {booking.refundStatus && booking.refundStatus !== "NOT_REQUIRED" && <div className="mt-5 rounded-2xl border border-border p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-text">Refund</h2><Badge variant="warning">{REFUND_LABELS[booking.refundStatus] || booking.refundStatus}</Badge></div>{refund?.refundAmount > 0 && <p className="mt-3 text-sm text-muted">Amount: {refund.refundAmount}</p>}{booking.refundStatus === "REFUND_AWAITING_CUSTOMER_CONFIRMATION" && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" isLoading={isRefundAction} onClick={handleConfirmRefund}>I received it</Button><Button size="sm" variant="outline" onClick={handleDisputeRefund}>I did not receive it</Button></div>}</div>}
    <div className="mt-6 flex flex-wrap gap-3">{canCancel && <Button variant="outline" className="text-error" isLoading={isCancelling} onClick={handleCancel}>Cancel booking</Button>}{booking.restaurantId?._id && <Link to={`/restaurants/${booking.restaurantId._id}`}><Button>View restaurant</Button></Link>}</div>
  </div>;
}
