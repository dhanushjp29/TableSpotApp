import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";

import { restaurantApi } from "../../api/restaurant.api.js";
import { uploadApi } from "../../api/upload.api.js";

import ImageUploader from "../../components/form/ImageUploader.jsx";
import LocationFields from "../../components/form/LocationFields.jsx";
import LocationPickerMap from "../../components/map/LocationPickerMap.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";

function CreateRestaurantForm({ restaurant = null, onSuccess, onCancel }) {
  const isEdit = Boolean(restaurant);
  const [location, setLocation] = useState(
    restaurant?.location
      ? { lat: restaurant.location.latitude, lng: restaurant.location.longitude }
      : null
  );
  const [locationValue, setLocationValue] = useState({
    country: restaurant?.country || "",
    state: restaurant?.state || "",
    city: restaurant?.city || "",
  });
  const [coverItems, setCoverItems] = useState(
    restaurant?.coverImage ? [{ file: null, preview: restaurant.coverImage }] : []
  );
  const [galleryItems, setGalleryItems] = useState(
    (restaurant?.galleryImages || []).map((url) => ({ file: null, preview: url }))
  );
  const [priceFrom, setPriceFrom] = useState(0);
  const [priceTo, setPriceTo] = useState(0);
  const [cuisineOptions, setCuisineOptions] = useState(["Veg", "Non-Veg", "Vegan", "Indian", "Chinese"]);
  const [selectedCuisines, setSelectedCuisines] = useState(restaurant?.cuisineTypes || []);
  const [newCuisine, setNewCuisine] = useState("");
  const [tables, setTables] = useState([
    { tableNumber: "", tableName: "", capacity: "" },
  ]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      restaurantName: restaurant?.restaurantName || "",
      description: restaurant?.description || "",
      contactPerson: restaurant?.contactPerson || "",
      phoneNumber: restaurant?.phoneNumber || "",
      email: restaurant?.email || "",
      address: restaurant?.address || "",
      pincode: restaurant?.pincode || "",
      cuisineTypes: "",
      priceRange: restaurant?.priceRange || "₹",
    },
  });

  const uploadToCloudinary = async (file) => {
    const result = await uploadApi.image(file);
    const url = result?.url || result?.secure_url || "";
    if (!url) throw new Error("Upload returned no image URL.");
    return url;
  };

  const resolveImage = async (item) => {
    if (item.file) return uploadToCloudinary(item.file);
    return item.preview;
  };

  const updateTable = (index, field, value) => {
    setTables((prev) =>
      prev.map((table, i) => (i === index ? { ...table, [field]: value } : table))
    );
  };

  const addTable = () => {
    setTables((prev) => [...prev, { tableNumber: "", tableName: "", capacity: "" }]);
  };

  const removeTable = (index) => {
    setTables((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    try {
      if (!locationValue.country || !locationValue.state || !locationValue.city) {
        toast.error("Please select Country, State and City.");
        return;
      }
      if (!location) {
        toast.error("Please select a location on the map.");
        return;
      }
      if (coverItems.length === 0) {
        toast.error("Please upload a cover image.");
        return;
      }
      if (galleryItems.length < 3) {
        toast.error("Please upload at least 3 gallery images.");
        return;
      }

      let validTables = [];
      if (!isEdit) {
        if (tables.length === 0 || tables.every((t) => t.tableNumber === "" || t.capacity === "")) {
          toast.error("Add at least one table with a table number and capacity.");
          return;
        }

        const isRowIncomplete = tables.some(
          (t) => t.tableNumber === "" || t.capacity === ""
        );
        if (isRowIncomplete) {
          toast.error("Every table needs a table number and capacity. Remove any empty rows.");
          return;
        }

        validTables = tables.map((t) => ({
          tableNumber: Number(t.tableNumber),
          tableName: (t.tableName || "").trim(),
          capacity: Number(t.capacity),
        }));

        const numbers = validTables.map((t) => t.tableNumber);
        if (new Set(numbers).size !== numbers.length) {
          toast.error("Table numbers must be unique.");
          return;
        }
        if (
          validTables.some(
            (t) => !Number.isInteger(t.tableNumber) || t.tableNumber < 1
          )
        ) {
          toast.error("Table numbers must be positive whole numbers.");
          return;
        }
        if (
          validTables.some(
            (t) => !Number.isInteger(t.capacity) || t.capacity < 1 || t.capacity > 100
          )
        ) {
          toast.error("Table capacity must be between 1 and 100.");
          return;
        }
      }

      const avgCost = (Number(priceFrom) && Number(priceTo))
        ? Math.round((Number(priceFrom) + Number(priceTo)) / 2)
        : undefined;

      const [coverImage, ...galleryImages] = await Promise.all([
        resolveImage(coverItems[0]),
        ...galleryItems.map(resolveImage),
      ]);

      const payload = {
        ...data,
        country: locationValue.country,
        state: locationValue.state,
        city: locationValue.city,
        cuisineTypes: selectedCuisines,
        location: {
          latitude: Number(location.lat),
          longitude: Number(location.lng),
        },
        galleryImages,
        coverImage,
        ...(avgCost !== undefined ? { averageCostForTwo: avgCost } : {}),
        ...(isEdit ? {} : { tables: validTables }),
      };

      if (isEdit) {
        await restaurantApi.update(restaurant._id, payload);
        toast.success("Restaurant updated successfully!");
      } else {
        await restaurantApi.create(payload);
        toast.success("Restaurant created successfully!");
        reset();
        setLocationValue({ country: "", state: "", city: "" });
        setGalleryItems([]);
        setCoverItems([]);
        setSelectedCuisines([]);
        setTables([{ tableNumber: "", tableName: "", capacity: "" }]);
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save restaurant.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Restaurant Name *</label>
          <input
            {...register("restaurantName", { required: "Name required" })}
            className="input-field w-full"
          />
          {errors.restaurantName && (
            <p className="text-xs text-red-600">{errors.restaurantName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact Person *</label>
          <input
            {...register("contactPerson", { required: "Contact person required" })}
            className="input-field w-full"
          />
          {errors.contactPerson && (
            <p className="text-xs text-red-600">{errors.contactPerson.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number *</label>
          <input
            {...register("phoneNumber", {
              required: "Phone required",
              pattern: {
                value: /^[6-9]\d{9}$/,
                message: "Enter a valid 10-digit phone number",
              },
            })}
            className="input-field w-full"
            placeholder="9876543210"
          />
          {errors.phoneNumber && (
            <p className="text-xs text-red-600">{errors.phoneNumber.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            {...register("email", { required: "Email required" })}
            className="input-field w-full"
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <LocationFields value={locationValue} onChange={setLocationValue} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address *</label>
          <input
            {...register("address", { required: "Address required" })}
            className="input-field w-full"
          />
          {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pincode *</label>
          <input
            {...register("pincode", { required: "Pincode required" })}
            className="input-field w-full"
          />
          {errors.pincode && <p className="text-xs text-red-600">{errors.pincode.message}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Location *</label>
        <LocationPickerMap
          position={location}
          onPositionChange={setLocation}
          height="300px"
        />
        {location ? (
          <p className="mt-1 text-xs text-muted">
            Selected: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-red-600">Please select a location on the map.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea {...register("description")} rows={3} className="input-field w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Cuisine Types</label>
          <div className="flex flex-wrap gap-2">
            {cuisineOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSelectedCuisines((prev) =>
                    prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                  );
                }}
                className={`px-3 py-1 rounded-full border ${selectedCuisines.includes(c) ? 'bg-primary text-white' : 'bg-white text-text'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newCuisine}
              onChange={(e) => setNewCuisine(e.target.value)}
              placeholder="Add cuisine"
              className="input-field w-full"
            />
            <Button
              type="button"
              onClick={() => {
                const val = (newCuisine || "").trim();
                if (!val) return;
                if (!cuisineOptions.includes(val)) {
                  setCuisineOptions((s) => [val, ...s]);
                }
                if (!selectedCuisines.includes(val)) {
                  setSelectedCuisines((s) => [val, ...s]);
                }
                setNewCuisine("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price Range (From - To)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
              placeholder="From"
              className="input-field w-1/2"
            />
            <input
              type="number"
              min={0}
              value={priceTo}
              onChange={(e) => setPriceTo(e.target.value)}
              placeholder="To"
              className="input-field w-1/2"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <ImageUploader
            label="Cover Image *"
            single
            max={1}
            value={coverItems}
            onChange={setCoverItems}
            description="JPG, PNG or WebP · shows as the restaurant's main photo"
            error={coverItems.length === 0 ? "Cover image is required." : ""}
          />
        </div>
        <div>
          <ImageUploader
            label="Gallery Images *"
            min={3}
            max={10}
            value={galleryItems}
            onChange={setGalleryItems}
            description="Select at least 3 photos to showcase your restaurant"
          />
        </div>
      </div>
      {!isEdit && (
        <div className="rounded-lg border border-gray-100 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Tables *</h3>
              <p className="mt-0.5 text-xs text-muted">
                Add at least one table. Your restaurant will be submitted for approval with these tables.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addTable}>
              <Plus size={14} className="mr-1" />
              Add Table
            </Button>
          </div>

          <div className="space-y-2">
            {tables.map((table, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="w-28">
                  <label className="mb-1 block text-xs font-medium text-text">
                    Table No. *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={table.tableNumber}
                    onChange={(e) => updateTable(index, "tableNumber", e.target.value)}
                    placeholder="1"
                    className="input-field w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-text">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={table.tableName}
                    onChange={(e) => updateTable(index, "tableName", e.target.value)}
                    placeholder="Window Table 1"
                    className="input-field w-full"
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-xs font-medium text-text">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={table.capacity}
                    onChange={(e) => updateTable(index, "capacity", e.target.value)}
                    placeholder="4"
                    className="input-field w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTable(index)}
                  disabled={tables.length === 1}
                  className="p-2 rounded-lg text-muted hover:text-error disabled:opacity-40"
                  aria-label={`Remove table ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          loadingText={isEdit ? "Saving..." : "Creating..."}
        >
          {isEdit ? "Save Changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function OwnerRestaurantPage() {
  const user = useSelector((state) => state.auth.user);
  const [showCreate, setShowCreate] = useState(false);
  const [editRestaurant, setEditRestaurant] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRestaurantsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await restaurantApi.getAll({
        ownerId: user?.id,
        isActive: true,
      });
      setRestaurants(response?.data?.restaurants || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load restaurants.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await restaurantApi.remove(deleteTarget._id);
      toast.success("Restaurant deleted successfully!");
      setDeleteTarget(null);
      fetchRestaurantsData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete restaurant.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      try {
        const response = await restaurantApi.getAll({
          ownerId: user?.id,
          isActive: true,
        });
        if (isMounted) {
          setRestaurants(response?.data?.restaurants || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load restaurants.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <SkeletonText lines={3} />
              </div>
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
          title="Unable to load restaurants"
          description={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">My Restaurants</h1>
          <p className="mt-1 text-sm text-muted">Manage your restaurant information and settings.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Add Restaurant
        </Button>
      </div>

      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Restaurant" size="lg">
          <CreateRestaurantForm
            onSuccess={() => { setShowCreate(false); fetchRestaurantsData(); }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editRestaurant && (
        <Modal isOpen={Boolean(editRestaurant)} onClose={() => setEditRestaurant(null)} title="Edit Restaurant" size="lg">
          <CreateRestaurantForm
            restaurant={editRestaurant}
            onSuccess={() => { setEditRestaurant(null); fetchRestaurantsData(); }}
            onCancel={() => setEditRestaurant(null)}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Restaurant"
        description={`Are you sure you want to delete "${deleteTarget?.restaurantName || "this restaurant"}"? This action cannot be undone.`}
        confirmText="Delete"
      />

      {restaurants.length === 0 ? (
        <EmptyState
          title="No restaurants yet"
          description="Create your first restaurant to start managing it here."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Create Restaurant
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <Card key={restaurant._id} className="overflow-hidden">
              <div className="relative h-40 overflow-hidden bg-gray-100">
                {restaurant.coverImage ? (
                  <img
                    src={restaurant.coverImage}
                    alt={restaurant.restaurantName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <span className="text-3xl">🍽️</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{restaurant.restaurantName}</h3>
                    {restaurant.restaurantCode && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {restaurant.restaurantCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-200">{restaurant.city}, {restaurant.state}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text">Status</p>
                    <p className="text-xs text-muted">{restaurant.verificationStatus || "Pending"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditRestaurant(restaurant)}>
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(restaurant)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default OwnerRestaurantPage;
