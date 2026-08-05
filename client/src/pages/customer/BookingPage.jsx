import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Calendar, Clock, Users } from "lucide-react";

import { restaurantApi } from "../../api/restaurant.api.js";
import { tableApi } from "../../api/table.api.js";
import { bookingApi } from "../../api/booking.api.js";

import TableSelector from "../../components/restaurant/TableSelector.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import DatePicker from "../../components/ui/DatePicker.jsx";
import TimePicker from "../../components/ui/TimePicker.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import { formatDate, formatTime } from "../../utils/formatDate.js";

const getLocalDateString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Date is required."),
  bookingTime: z.string().min(1, "Time is required."),
  numberOfGuests: z.number().int().min(1, "At least 1 guest is required."),
  tableId: z.string().min(1, "Please select a table."),
  specialRequest: z.string().max(500).optional(),
});

function BookingPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState("");

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      numberOfGuests: 2,
      bookingDate: getLocalDateString(),
      bookingTime: "19:00",
      specialRequest: "",
      tableId: "",
    },
  });

  const numberOfGuests = useWatch({ control, name: "numberOfGuests", defaultValue: 2 });
  const bookingDate = useWatch({ control, name: "bookingDate", defaultValue: getLocalDateString() });
  const bookingTime = useWatch({ control, name: "bookingTime", defaultValue: "19:00" });

  const selectionKey = `${bookingDate}|${bookingTime}|${numberOfGuests}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (lastSelectionKey !== selectionKey) {
    setLastSelectionKey(selectionKey);
    setSelectedTableId("");
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [restaurantRes, tablesRes] = await Promise.all([
          restaurantApi.getById(restaurantId),
          tableApi.getByRestaurant(restaurantId),
        ]);
        setRestaurant(restaurantRes.data?.restaurant || restaurantRes.data);
        setTables(tablesRes.data?.tables || []);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load restaurant data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [restaurantId]);

  const onSubmit = async (data) => {
    if (!selectedTableId) {
      toast.error("Please select a table.");
      return;
    }
    setIsSubmitting(true);
    try {
      const [year, month, day] = data.bookingDate.split("-").map(Number);
      const [hour, minute] = data.bookingTime.split(":").map(Number);
      const bookingDate = new Date(year, month - 1, day, hour, minute, 0);
      const bookingDateTime = bookingDate.toISOString();
      const response = await bookingApi.create({
        restaurantId,
        tableId: selectedTableId,
        bookingDateTime,
        numberOfGuests: data.numberOfGuests,
        specialRequest: data.specialRequest,
        bookingType: "Online",
      });
      const bookingId = response.data?.booking?._id || response.data?._id;
      toast.success(response?.data?.message || "Booking created successfully!");
      navigate("/booking/" + bookingId + "/confirmation");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="card p-6">
          <SkeletonText lines={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Unable to load restaurant" description={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorState title="Restaurant not found" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to={"/restaurants/" + restaurantId} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        &larr; Back to Restaurant
      </Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            Reserve a Table at {restaurant.restaurantName}
          </h1>
          {restaurant.restaurantCode && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
              {restaurant.restaurantCode}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-muted">
          <span>{restaurant.city}, {restaurant.state}</span>
          {restaurant.averageRating > 0 && (
            <>
              <span>&#8226;</span>
              <span>&#9733; {Number(restaurant.averageRating).toFixed(1)}</span>
            </>
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-text">When & How Many?</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DatePicker
              label="Date"
              value={bookingDate}
              min={getLocalDateString()}
              error={errors.bookingDate?.message}
              icon={<Calendar size={16} />}
              {...register("bookingDate")}
            />
            <TimePicker
              label="Time"
              value={bookingTime}
              error={errors.bookingTime?.message}
              icon={<Clock size={16} />}
              {...register("bookingTime")}
            />
            <Input label="Guests" type="number" min={1} max={20} error={errors.numberOfGuests?.message} icon={<Users size={16} />} {...register("numberOfGuests", { valueAsNumber: true })} />
          </div>
          {bookingDate && bookingTime && (
            <p className="mt-2 text-xs text-muted">Selected: {formatDate(bookingDate)} at {formatTime(bookingTime)}</p>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-text">Select a Table</h2>
          <TableSelector
            tables={tables}
            selectedTableId={selectedTableId}
            onSelect={(id) => {
              setSelectedTableId(id);
              setValue("tableId", id);
            }}
            guestCount={numberOfGuests}
          />
          {selectedTableId && (
            <div className="mt-4">
              <Badge variant="primary">Table selected for {numberOfGuests} guest(s)</Badge>
            </div>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-text">Special Request (Optional)</h2>
          <textarea placeholder="Any special requests..." maxLength={500} className="input-field min-h-[80px] resize-y" {...register("specialRequest")} />
        </div>
        <Button type="submit" className="w-full" isLoading={isSubmitting} loadingText="Confirming Booking...">
          Confirm Booking
        </Button>
      </form>
    </div>
  );
}

export default BookingPage;
