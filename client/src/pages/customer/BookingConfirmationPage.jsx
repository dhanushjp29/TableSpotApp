import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

import { fetchBookingById } from "../../store/slices/reservationSlice.js";
import { useBookingAdvancePayment } from "../../hooks/useBookingAdvancePayment.js";
import BookingDetailsSummary from "../../components/booking/BookingDetailsSummary.jsx";
import BookingPdf from "../../components/pdf/BookingPdf.jsx";
import PdfDownloadButton from "../../components/pdf/PdfDownloadButton.jsx";
import Button from "../../components/ui/Button.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { bookingReceiptFilename } from "../../utils/pdf/pdfData.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

export default function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const booking = useSelector((state) => state.reservation.currentBooking);
  const isLoading = useSelector((state) => state.reservation.isLoading);
  const error = useSelector((state) => state.reservation.error);
  const { isPaying, payAdvance } = useBookingAdvancePayment();
  const fetchBooking = useCallback(() => dispatch(fetchBookingById(bookingId)).catch(() => {}), [dispatch, bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-8"><div className="card p-6"><SkeletonText lines={10} /></div></div>;
  if (error) return <div className="mx-auto max-w-5xl px-4 py-8"><ErrorState title="Unable to load booking" description={error} onRetry={fetchBooking} /></div>;
  if (!booking) return <div className="mx-auto max-w-5xl px-4 py-8"><ErrorState title="Booking not found" /></div>;

  const paymentActive = !["Cancelled", "Completed", "No Show"].includes(booking.bookingStatus) && ["Pending", "Partially Paid"].includes(booking.paymentStatus);
  const advanceAmount = Number(booking.advanceAmount || 0);
  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "TableSpot Booking", text: `Booking ${booking.bookingCode || "confirmation"}`, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast.success("Booking link copied to clipboard!"); }
    } catch { /* share cancelled */ }
  };

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><CheckCircle className="text-success" size={28} /><div><h1 className="text-2xl font-bold text-text">Booking confirmation</h1><p className="text-sm text-muted">Your reservation details are below.</p></div></div>
      <div className="flex flex-wrap gap-2"><PdfDownloadButton size="sm" filename={bookingReceiptFilename} fetchData={async () => ({ booking })} renderDocument={({ booking: data }) => <BookingPdf booking={data} view="customer" />} /><Button size="sm" variant="outline" onClick={handleShare}><Share2 size={15} /> Share</Button></div>
    </div>
    <BookingDetailsSummary booking={booking} offerRecipient={booking.offerRecipient} />
    {advanceAmount > 0 && paymentActive && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-medium text-text">Advance payment required: {formatCurrency(advanceAmount)}</p><Button isLoading={isPaying} onClick={() => payAdvance({ bookingId, onSuccess: fetchBooking, onDismiss: fetchBooking })}>Pay advance</Button></div>}
    <div className="mt-6 flex flex-wrap gap-3"><Link to="/customer/bookings"><Button variant="secondary">View all bookings</Button></Link>{booking.restaurantId?._id && <Button onClick={() => navigate(`/restaurants/${booking.restaurantId._id}`)}>View restaurant</Button>}</div>
  </div>;
}
