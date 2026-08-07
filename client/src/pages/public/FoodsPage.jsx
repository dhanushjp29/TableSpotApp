import { ArrowLeft, List, Map as MapIcon, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { foodApi } from "../../api/food.api.js";
import { userApi } from "../../api/user.api.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { useAuth } from "../../hooks/useAuth.js";

import RestaurantDiscoveryMap from "../../components/map/RestaurantDiscoveryMap.jsx";
import FoodCard from "../../components/food/FoodCard.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import Select from "../../components/ui/Select.jsx";
import { SkeletonCard } from "../../components/ui/Skeleton.jsx";
import { ROUTES } from "../../routes/routeConstants.js";
import {
  FOOD_CATEGORY_VALUES,
  FOOD_TYPE_VALUES,
} from "../../constants/food.js";

const SORT_OPTIONS = [
  { value: "", label: "Recommended" },
  { value: "rating", label: "Top Rated" },
  { value: "popular", label: "Most Popular" },
  { value: "new", label: "Newest" },
];

function FoodsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [foods, setFoods] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [mobileView, setMobileView] = useState("list");

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [foodType, setFoodType] = useState("");
  const [sortBy, setSortBy] = useState("");

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    let isMounted = true;
    const params = {
      page,
      limit: 12,
      search: debouncedSearch || undefined,
      category: category || undefined,
      foodType: foodType || undefined,
      sortBy: sortBy || undefined,
      isAvailable: true,
    };

    foodApi
      .getAll(params)
      .then((response) => {
        if (isMounted) {
          setFoods(response.data?.foods || []);
          setMeta(response.data?.meta || null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err?.response?.data?.message || "Failed to load food items."
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page, debouncedSearch, category, foodType, sortBy]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    userApi
      .getFavoriteFoods()
      .then((res) => {
        const ids = res?.data?.favoriteFoodIds || res?.favoriteFoodIds || [];
        if (isMounted) setFavoriteIds(new Set(ids.map(String)));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleToggleFavorite = async (foodId) => {
    if (!isAuthenticated) {
      toast.error("Please log in to save favorite dishes.");
      navigate("/login");
      return;
    }
    try {
      const res = await userApi.toggleFavoriteFood(foodId);
      const isFavorite = res?.data?.isFavorite;
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(String(foodId))) {
          next.delete(String(foodId));
        } else {
          next.add(String(foodId));
        }
        return next;
      });
      toast.success(
        isFavorite ? "Added to favorites." : "Removed from favorites."
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update favorites.");
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(ROUTES.HOME);
    }
  };

  const handleRestaurantSelect = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    if (mobileView === "list") {
      setMobileView("map");
    }
  };

  // Unique restaurants behind the currently displayed dishes (for the map)
  const mapRestaurants = foods
    .map((food) => food.restaurantId)
    .filter((r) => r && r._id)
    .filter(
      (r, i, arr) =>
        arr.findIndex((x) => String(x._id) === String(r._id)) === i
    );

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setFoodType("");
    setSortBy("");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-text">Explore Food</h1>
        <p className="mt-1 text-sm text-muted">
          Discover delicious dishes across verified restaurants and save your
          favorites.
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
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="sm:w-40"
          >
            <option value="">All Categories</option>
            {FOOD_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={foodType}
            onChange={(e) => {
              setFoodType(e.target.value);
              setPage(1);
            }}
            className="sm:w-32"
          >
            <option value="">All Types</option>
            {FOOD_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="sm:w-40"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        {(search || category || foodType || sortBy) && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <SlidersHorizontal size={14} />
            <span>Filters applied.</span>
            <button
              onClick={resetFilters}
              className="font-semibold text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Mobile View Toggle */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          onClick={() => setMobileView("list")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
            mobileView === "list"
              ? "bg-primary text-white"
              : "bg-surface text-text border border-gray-200"
          }`}
        >
          <List size={16} />
          List
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
            mobileView === "map"
              ? "bg-primary text-white"
              : "bg-surface text-text border border-gray-200"
          }`}
        >
          <MapIcon size={16} />
          Map
        </button>
      </div>

      {/* Content: Dish List + Map */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Dish List */}
        <div
          className={`${
            mobileView === "list" ? "block" : "hidden"
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
              title="Unable to load food items"
              description={error}
              onRetry={() => setPage(1)}
            />
          ) : foods.length === 0 ? (
            <EmptyState
              title="No dishes found"
              description="Try adjusting your search or filters to discover more dishes."
              action={
                <button
                  onClick={resetFilters}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {foods.map((food) => (
                  <FoodCard
                    key={food._id}
                    food={food}
                    isFavorite={favoriteIds.has(String(food._id))}
                    onToggleFavorite={handleToggleFavorite}
                    isSelected={
                      selectedRestaurantId === food.restaurantId?._id
                    }
                    onSelect={handleRestaurantSelect}
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
          className={`${
            mobileView === "map" ? "block" : "hidden"
          } lg:block lg:w-1/2 lg:sticky lg:top-20 lg:self-start`}
          style={{ minHeight: "650px" }}
        >
          {isLoading ? (
            <div className="h-full min-h-[650px] animate-pulse rounded-xl bg-gray-100" />
          ) : error ? (
            <div className="flex h-full min-h-[650px] items-center justify-center rounded-xl bg-gray-50">
              <p className="text-sm text-muted">Map unavailable</p>
            </div>
          ) : (
            <RestaurantDiscoveryMap
              restaurants={mapRestaurants}
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

export default FoodsPage;
