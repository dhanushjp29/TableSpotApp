import { useEffect, useState } from "react";
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
} from "lucide-react";
import toast from "react-hot-toast";

import { billApi } from "../../api/bill.api.js";
import { bookingApi } from "../../api/booking.api.js";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate } from "../../utils/formatDate.js";

export default function OwnerBillingPage() {
  const [bills, setBills] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // Create Bill (Convert) Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage Bill Modal State (spot payments)
  const [manageBill, setManageBill] = useState(null);
  const [spotPaymentMethod, setSpotPaymentMethod] = useState("Cash");
  const [spotAmount, setSpotAmount] = useState("");
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  // Print / View Receipt Modal State
  const [activeReceiptBill, setActiveReceiptBill] = useState(null);

  const fetchData = async () => {
    try {
      const [billsRes, bookingsRes] = await Promise.all([
        billApi.getAll(),
        bookingApi.getAll(),
      ]);
      setBills(billsRes?.data?.bills || billsRes?.bills || []);
      setBookings(bookingsRes?.data?.bookings || bookingsRes?.bookings || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load billing records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([billApi.getAll(), bookingApi.getAll()])
      .then(([billsRes, bookingsRes]) => {
        if (isMounted) {
          setBills(billsRes?.data?.bills || billsRes?.bills || []);
          setBookings(bookingsRes?.data?.bookings || bookingsRes?.bookings || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load billing records.");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConvertBooking = async (e) => {
    e.preventDefault();
    if (!selectedBookingId) {
      toast.error("Please select a reservation.");
      return;
    }
    setIsSubmitting(true);
    try {
      await billApi.convertToBill(selectedBookingId);
      toast.success("Bill created from reservation successfully!");
      setIsCreateModalOpen(false);
      setSelectedBookingId("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpotPayment = async (e) => {
    e.preventDefault();
    if (!manageBill) return;
    const amount = Number(spotAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    setIsPaymentSubmitting(true);
    try {
      await billApi.addPayment(manageBill._id, {
        paymentMethod: spotPaymentMethod,
        amount,
        notes: "Spot payment",
      });
      toast.success("Spot payment recorded!");
      setManageBill(null);
      setSpotAmount("");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to record payment.");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleMarkAsPaid = async (billId) => {
    try {
      await billApi.markStatus(billId, { paymentStatus: "Paid" });
      toast.success("Bill marked as Paid!");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update bill status.");
    }
  };

  const filteredBills = bills.filter((b) => {
    if (!search) return true;
    const billId = b._id?.toLowerCase() || "";
    return billId.includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Receipt className="text-primary" size={24} />
            Billing & Invoices
          </h1>
          <p className="text-sm text-muted">Generate bills and track customer payment status</p>
        </div>

        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={18} className="mr-1.5" />
          Generate New Bill
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search bill by ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 w-full"
        />
      </div>

      {/* Bills Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={2} />
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load bills" description={error} onRetry={fetchData} />
      ) : filteredBills.length === 0 ? (
        <EmptyState title="No billing records" description="Click 'Generate New Bill' to create an invoice." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-surface shadow-sm">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-muted border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Bill ID</th>
                <th className="px-5 py-3">Booking Ref</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Grand Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredBills.map((bill) => (
                <tr key={bill._id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-primary">
                    {bill.billCode || `#${bill._id.slice(-6)}`}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">
                    {typeof bill.bookingId === "object"
                      ? bill.bookingId?.bookingCode || bill.bookingId?._id?.slice(-6)
                      : bill.bookingId?.slice(-6) || "N/A"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {bill.createdAt ? formatDate(new Date(bill.createdAt)) : "Today"}
                  </td>
                  <td className="px-5 py-4 font-bold text-text">
                    ₹{bill.grandTotal || bill.subtotal || 0}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={bill.paymentStatus === "Paid" ? "success" : "warning"}>
                      {bill.paymentStatus || "Pending"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setManageBill(bill)}
                      >
                        <CreditCard size={14} className="mr-1" />
                        Manage
                      </Button>
                      {bill.paymentStatus !== "Paid" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkAsPaid(bill._id)}
                        >
                          <CreditCard size={14} className="mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveReceiptBill(bill)}
                      >
                        <Printer size={14} className="mr-1" />
                        Receipt
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Convert Booking to Bill Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate Reservation Bill"
      >
        <form onSubmit={handleConvertBooking} className="space-y-4 pt-2">
          <Select
            label="Select Customer Reservation"
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
          >
            <option value="">-- Choose Reservation --</option>
            {bookings
              .filter((b) => !b.billId)
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.bookingCode || "Booking"} - {b.userId?.fullName || "Guest"} - {formatDate(new Date(b.bookingDateTime))} ({b.numberOfGuests} guests)
                </option>
              ))}
          </Select>

          <p className="rounded-lg bg-gray-50 p-3 text-xs text-muted">
            The bill is created from the reservation's pre-ordered items and any
            online advance is carried into the bill ledger.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Generate Bill
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Bill Modal */}
      {manageBill && (
        <Modal
          isOpen={!!manageBill}
          onClose={() => setManageBill(null)}
          title={`Manage Bill ${manageBill.billCode || `#${manageBill._id.slice(-6)}`}`}
        >
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-text">
              <div className="flex justify-between">
                <span>Grand Total</span>
                <span className="font-bold">₹{manageBill.grandTotal || manageBill.subtotal || 0}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Balance Due</span>
                <span className="font-bold text-primary">
                  ₹{manageBill.payment?.balanceDue ?? (manageBill.paymentStatus === "Paid" ? 0 : manageBill.grandTotal || 0)}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddSpotPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Payment Method"
                  value={spotPaymentMethod}
                  onChange={(e) => setSpotPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="NetBanking">Net Banking</option>
                </Select>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Amount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={spotAmount}
                    onChange={(e) => setSpotAmount(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setManageBill(null)}>
                  Close
                </Button>
                <Button type="submit" isLoading={isPaymentSubmitting}>
                  Add Spot Payment
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Printable Receipt Modal */}
      {activeReceiptBill && (
        <Modal
          isOpen={!!activeReceiptBill}
          onClose={() => setActiveReceiptBill(null)}
          title={`Invoice Receipt ${activeReceiptBill.billCode || `#${activeReceiptBill._id.slice(-6)}`}`}
        >
          <div className="space-y-4 p-2 font-mono text-sm border-y border-dashed border-gray-300 py-4 my-2">
            <div className="text-center pb-2 border-b border-gray-200">
              <h3 className="text-lg font-bold text-text font-sans">TABLESPOT RECEIPT</h3>
              <p className="text-xs text-muted">Thank you for dining with us!</p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Invoice ID:</span>
                <span>{activeReceiptBill.billCode || activeReceiptBill._id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{activeReceiptBill.createdAt ? formatDate(new Date(activeReceiptBill.createdAt)) : "Today"}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{activeReceiptBill.paymentStatus || "Pending"}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs border-t border-gray-200 pt-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{activeReceiptBill.subtotal || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>₹{activeReceiptBill.taxAmount || 0}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-₹{activeReceiptBill.discountAmount || 0}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-text pt-2 border-t border-gray-300">
                <span>Grand Total:</span>
                <span>₹{activeReceiptBill.grandTotal || activeReceiptBill.subtotal || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={16} className="mr-1" /> Print
            </Button>
            <Button variant="primary" onClick={() => setActiveReceiptBill(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
