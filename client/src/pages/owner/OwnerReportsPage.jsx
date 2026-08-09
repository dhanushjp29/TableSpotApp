import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  Award,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import { fetchRestaurants } from "../../store/slices/restaurantSlice.js";
import { fetchBills } from "../../store/slices/billSlice.js";
import { fetchBookings } from "../../store/slices/reservationSlice.js";
import RestaurantFilter from "../../components/owner/RestaurantFilter.jsx";
import Card from "../../components/ui/Card.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function OwnerReportsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const restaurants = useSelector((state) => state.restaurant.restaurants);
  const bookings = useSelector((state) => state.reservation.bookings);
  const bookingLoading = useSelector((state) => state.reservation.isLoading);
  const bills = useSelector((state) => state.bill.bills);
  const billLoading = useSelector((state) => state.bill.isLoading);
  const isLoading = bookingLoading || billLoading;
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (userId) {
      dispatch(fetchRestaurants({ ownerId: userId, isActive: true })).catch(() => {});
    }
    Promise.all([
      dispatch(fetchBookings({ ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}) })),
      dispatch(fetchBills({ ...(selectedRestaurant ? { restaurantId: selectedRestaurant } : {}) })),
    ]).catch(() => {});
  }, [dispatch, selectedRestaurant, user?._id, user?.id]);

  const totalRevenue = useMemo(
    () => bills.reduce((acc, b) => acc + (b.grandTotal || b.subTotal || 0), 0),
    [bills]
  );
  const completedBookingsCount = useMemo(
    () => bookings.filter((b) => b.bookingStatus === "Completed").length,
    [bookings]
  );
  const avgGuests =
    bookings.length > 0
      ? (bookings.reduce((acc, b) => acc + (b.numberOfGuests || 0), 0) / bookings.length).toFixed(1)
      : "0";

  // Chart Data: Bookings by Status
  const statusCounts = {
    Pending: bookings.filter((b) => b.bookingStatus === "Pending").length,
    Confirmed: bookings.filter((b) => b.bookingStatus === "Confirmed").length,
    Completed: completedBookingsCount,
    Cancelled: bookings.filter((b) => b.bookingStatus === "Cancelled").length,
  };

  const barChartData = {
    labels: ["Pending", "Confirmed", "Completed", "Cancelled"],
    datasets: [
      {
        label: "Bookings",
        data: [statusCounts.Pending, statusCounts.Confirmed, statusCounts.Completed, statusCounts.Cancelled],
        backgroundColor: [
          "rgba(245, 158, 11, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Reservations Breakdown by Status",
      },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <BarChart2 className="text-primary" size={24} />
          Analytics & Performance Reports
        </h1>
        <p className="text-sm text-muted">Insights into your restaurant reservations, revenue, and customer traffic</p>
      </div>

      <RestaurantFilter
        restaurants={restaurants}
        value={selectedRestaurant}
        onChange={setSelectedRestaurant}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Total Bookings</p>
            <p className="text-2xl font-bold text-text">{bookings.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Total Revenue</p>
            <p className="text-2xl font-bold text-text">₹{totalRevenue}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Completed</p>
            <p className="text-2xl font-bold text-text">{completedBookingsCount}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4 border-l-4 border-l-indigo-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs uppercase font-medium tracking-wider text-muted">Avg Party Size</p>
            <p className="text-2xl font-bold text-text">{avgGuests} Guests</p>
          </div>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          {isLoading ? (
            <SkeletonText lines={6} />
          ) : (
            <Bar data={barChartData} options={chartOptions} />
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-text text-base">Key Performance Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-muted">Booking Completion Rate</span>
              <span className="font-bold text-text">
                {bookings.length > 0
                  ? `${Math.round((completedBookingsCount / bookings.length) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-muted">Total Billing Transactions</span>
              <span className="font-bold text-text">{bills.length}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-muted">Average Bill Value</span>
              <span className="font-bold text-text">
                ₹{bills.length > 0 ? (totalRevenue / bills.length).toFixed(0) : "0"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
