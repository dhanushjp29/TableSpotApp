import { List, Map as MapIcon, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { restaurantApi } from "../../api/restaurant.api.js";
import { userApi } from "../../api/user.api.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { useAuth } from "../../hooks/useAuth.js";

import RestaurantDiscoveryMap from "../../components/map/RestaurantDiscoveryMap.jsx";
import RestaurantCard from "../../components/restaurant/RestaurantCard.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonCard } from "../../components/ui/Skeleton.jsx";

const PRICE_RANGE_OPTIONS = ["₹", "₹₹", "₹₹₹", "₹₹₹₹"];
const RATING_OPTIONS = [
  { value: "", label: "All Ratings" },
  { value: "4", label: "4.0+" },
  { value: "3", label: "3.0+" },
  { value: "2", label: "2.0+" },
];

function RestaurantsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [mobileView, setMobileView] = useState("list");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [minRating, setMinRating] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    let isMounted = true;
    const params = {
      page,
      limit: 12,
      search: debouncedSearch || undefined,
      city: city || undefined,
      verificationStatus: "Verified",
      isActive: true,
    };

    restaurantApi
      .getAll(params)
      .then((response) => {
        if (isMounted) {
          setRestaurants(response.data?.restaurants || []);
          setMeta(response.data?.meta || null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load restaurants.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page, debouncedSearch, city]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    userApi
      .getFavoriteRestaurants()
      .then((res) => {
        const ids = res?.data?.favoriteRestaurantIds || res?.favoriteRestaurantIds || [];
        if (isMounted) setFavoriteIds(new Set(ids.map(String)));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleToggleFavorite = async (restaurantId) => {
    if (!isAuthenticated) {
      toast.error("Please log in to save favorite restaurants.");
      navigate("/login");
      return;
    }
    try {
      await userApi.toggleFavorite(restaurantId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(String(restaurantId))) {
          next.delete(String(restaurantId));
          toast.success("Removed from favorites.");
        } else {
          next.add(String(restaurantId));
          toast.success("Added to favorites.");
        }
        return next;
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update favorites.");
    }
  };

  // Client-side filtering for cuisine, rating, price (backend may not support all)
  const filteredRestaurants = restaurants.filter((r) => {
    if (cuisine && !r.cuisineTypes?.includes(cuisine)) return false;
    if (minRating && Number(r.averageRating || 0) < Number(minRating))
      return false;
    if (priceRange && r.priceRange !== priceRange) return false;
    return true;
  });

  const handleRestaurantSelect = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    if (mobileView === "list") {
      setMobileView("map");
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Get unique cuisines from all restaurants
  const allCuisines = [
    ...new Set(restaurants.flatMap((r) => r.cuisineTypes || [])),
  ].sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Explore Restaurants</h1>
        <p className="mt-1 text-sm text-muted">
          Discover and reserve tables at the best restaurants near you.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search restaurants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <Select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="sm:w-40"
          >
            <option value="">All Cities</option>
          </Select>
          <Select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="sm:w-40"
          >
            <option value="">All Cuisines</option>
            {allCuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="sm:w-32"
          >
            {RATING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className="sm:w-32"
          >
            <option value="">All Prices</option>
            {PRICE_RANGE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Mobile View Toggle */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          onClick={() => setMobileView("list")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${mobileView === "list"
            ? "bg-primary text-white"
            : "bg-surface text-text border border-gray-200"
            }`}
        >
          <List size={16} />
          List
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${mobileView === "map"
            ? "bg-primary text-white"
            : "bg-surface text-text border border-gray-200"
            }`}
        >
          <MapIcon size={16} />
          Map
        </button>
      </div>

      {/* Content: List + Map */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Restaurant List */}
        <div
          className={`${mobileView === "list" ? "block" : "hidden"
            } lg:block lg:w-1/2`}
        >
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Unable to load restaurants"
              description={error}
              onRetry={() => setPage(1)}
            />
          ) : filteredRestaurants.length === 0 ? (
            <EmptyState
              title="No restaurants found"
              description="Try adjusting your search or filters to find more restaurants."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredRestaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant._id}
                    restaurant={restaurant}
                    isSelected={selectedRestaurantId === restaurant._id}
                    onSelect={handleRestaurantSelect}
                    isFavorite={favoriteIds.has(String(restaurant._id))}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
              {meta && meta.totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    page={meta.page}
                    totalPages={meta.totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Map */}
        <div
          className={`${mobileView === "map" ? "block" : "hidden"
            } lg:block lg:w-1/2 lg:sticky lg:top-20 lg:self-start`}
          style={{ minHeight: "500px" }}
        >
          {isLoading ? (
            <div className="h-full min-h-[500px] animate-pulse rounded-xl bg-gray-100" />
          ) : error ? (
            <div className="flex h-full min-h-[500px] items-center justify-center rounded-xl bg-gray-50">
              <p className="text-sm text-muted">Map unavailable</p>
            </div>
          ) : (
            <RestaurantDiscoveryMap
              restaurants={filteredRestaurants}
              selectedRestaurantId={selectedRestaurantId}
              onRestaurantSelect={handleRestaurantSelect}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default RestaurantsPage;
