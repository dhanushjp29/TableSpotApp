import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";

import { foodApi } from "../../api/food.api.js";
import { restaurantApi } from "../../api/restaurant.api.js";
import { uploadApi } from "../../api/upload.api.js";

import ImageUploader from "../../components/form/ImageUploader.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Select from "../../components/ui/Select.jsx";
import TimePicker from "../../components/ui/TimePicker.jsx";
import Skeleton, { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import {
  FOOD_CATEGORY_VALUES,
  FOOD_SPICE_LEVEL_VALUES,
  FOOD_TYPE_VALUES,
} from "../../constants/food.js";

const WEEKDAY_VALUES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const inputClass = "input-field w-full";
const checkboxClass =
  "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary";

function FoodForm({ food = null, restaurants, onSuccess, onCancel }) {
  const isEdit = Boolean(food);
  const [coverItems, setCoverItems] = useState(
    food?.coverImage ? [{ file: null, preview: food.coverImage }] : []
  );
  const [galleryItems, setGalleryItems] = useState(
    (food?.galleryImages || []).map((url) => ({ file: null, preview: url }))
  );
  const [availableDays, setAvailableDays] = useState(
    food?.availability?.availableDays?.length
      ? food.availability.availableDays
      : [...WEEKDAY_VALUES]
  );
  const [availStart, setAvailStart] = useState(
    food?.availability?.startTime || "00:00"
  );
  const [availEnd, setAvailEnd] = useState(
    food?.availability?.endTime || "23:59"
  );
  const [specialEnabled, setSpecialEnabled] = useState(
    food?.specialSchedule?.isEnabled || false
  );
  const [schedules, setSchedules] = useState(
    food?.specialSchedule?.schedules?.length
      ? food.specialSchedule.schedules
      : [{ day: "Monday", startTime: "12:00", endTime: "14:00" }]
  );

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      restaurantId: food?.restaurantId?._id || restaurants[0]?._id || "",
      foodName: food?.foodName || "",
      category: food?.category || "Starters",
      otherCategory: food?.otherCategory || "",
      foodType: food?.foodType || "Veg",
      spiceLevel: food?.spiceLevel || "Medium",
      description: food?.description || "",
      preparationTime: food?.preparationTime ?? 0,
      displayOrder: food?.displayOrder ?? 1,
      isAvailable: food?.isAvailable ?? true,
      isRecommended: food?.isRecommended ?? false,
      isPopular: food?.isPopular ?? false,
      isActive: food?.isActive ?? true,
      variants: food?.variants?.length
        ? food.variants
        : [{ variantName: "Regular", price: "", offerPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });
  const category = watch("category");

  const resolveImage = async (item) => {
    if (item.file) {
      const result = await uploadApi.image(item.file);
      return result?.url || result?.secure_url || "";
    }
    return item.preview;
  };

  const updateSchedule = (index, field, value) => {
    setSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addSchedule = () =>
    setSchedules((prev) => [
      ...prev,
      { day: "Monday", startTime: "12:00", endTime: "14:00" },
    ]);

  const removeSchedule = (index) =>
    setSchedules((prev) => prev.filter((_, i) => i !== index));

  const onSubmit = async (data) => {
    try {
      if (!data.restaurantId) {
        toast.error("Please select a restaurant.");
        return;
      }
      if (coverItems.length === 0) {
        toast.error("Please upload a cover image.");
        return;
      }

      const rawVariants = data.variants || [];
      if (
        rawVariants.length === 0 ||
        rawVariants.some(
          (v) =>
            v.price === "" ||
            v.price === undefined ||
            v.price === null ||
            Number(v.price) < 0
        )
      ) {
        toast.error("Please enter a valid price for every variant.");
        return;
      }

      const coverImage = await resolveImage(coverItems[0]);
      if (!coverImage) {
        toast.error("Cover image upload failed.");
        return;
      }

      const galleryImages = await Promise.all(
        galleryItems.map(resolveImage)
      );

      const variants = rawVariants.map((v) => ({
        variantName: (v.variantName || "").trim() || "Regular",
        price: Number(v.price),
        offerPrice: v.offerPrice ? Number(v.offerPrice) : 0,
      }));

      const validSchedules = schedules
        .filter((s) => s.day && s.startTime && s.endTime)
        .map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime }));

      const payload = {
        restaurantId: data.restaurantId,
        foodName: data.foodName.trim(),
        description: (data.description || "").trim(),
        category: data.category,
        otherCategory:
          data.category === "Other" ? (data.otherCategory || "").trim() : "",
        foodType: data.foodType,
        spiceLevel: data.spiceLevel,
        preparationTime: Number(data.preparationTime) || 0,
        displayOrder: Number(data.displayOrder) || 1,
        coverImage,
        galleryImages,
        availability: {
          availableDays,
          startTime: availStart || "00:00",
          endTime: availEnd || "23:59",
        },
        specialSchedule: {
          isEnabled: specialEnabled,
          schedules: specialEnabled ? validSchedules : [],
        },
        hasVariants: variants.length > 1,
        variants,
        isAvailable: Boolean(data.isAvailable),
        isRecommended: Boolean(data.isRecommended),
        isPopular: Boolean(data.isPopular),
        isActive: Boolean(data.isActive),
      };

      if (isEdit) {
        await foodApi.update(food._id, payload);
        toast.success("Food item updated successfully!");
      } else {
        await foodApi.create(payload);
        toast.success("Food item created successfully!");
      }
      onSuccess();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to save food item."
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Restaurant *"
        error={errors.restaurantId?.message}
        {...register("restaurantId", { required: "Restaurant is required." })}
      >
        <option value="">Select a restaurant</option>
        {restaurants.map((r) => (
          <option key={r._id} value={r._id}>
            {r.restaurantCode} - {r.restaurantName} - {r.city}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Food Name *"
            error={errors.foodName?.message}
            {...register("foodName", {
              required: "Food name is required.",
              minLength: {
                value: 2,
                message: "Name must be at least 2 characters.",
              },
            })}
            placeholder="e.g. Butter Chicken"
          />
        </div>
        <Select label="Category *" {...register("category")}>
          {FOOD_CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {category === "Other" && (
          <Input label="Other Category" {...register("otherCategory")} />
        )}
        <Select label="Food Type *" {...register("foodType")}>
          {FOOD_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="Spice Level" {...register("spiceLevel")}>
          {FOOD_SPICE_LEVEL_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          label="Preparation Time (minutes)"
          type="number"
          min={0}
          {...register("preparationTime")}
        />
        <Input
          label="Display Order"
          type="number"
          min={1}
          {...register("displayOrder")}
        />
      </div>

      <div>
        <label className="input-label">Description</label>
        <textarea {...register("description")} rows={3} className={inputClass} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="input-label mb-1">Pricing</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-2"
            onClick={() => append({ variantName: "", price: "", offerPrice: 0 })}
          >
            <Plus size={14} />
            Add Variant
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                {...register(`variants.${index}.variantName`)}
                className="input-field flex-1"
                placeholder="Variant name (e.g. Half / Full)"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                {...register(`variants.${index}.price`)}
                className="input-field w-28"
                placeholder="Price"
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => remove(index)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ImageUploader
        label="Cover Image *"
        single
        max={1}
        value={coverItems}
        onChange={setCoverItems}
        description="JPG, PNG or WebP · shows as the food item's photo"
        error={coverItems.length === 0 ? "Cover image is required." : ""}
      />

      <ImageUploader
        label="Gallery Images"
        max={10}
        value={galleryItems}
        onChange={setGalleryItems}
        description="Optional additional photos of this food item"
      />

      <div className="rounded-xl border border-gray-200 p-4">
        <label className="input-label">Availability Days</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_VALUES.map((day) => {
            const selected = availableDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() =>
                  setAvailableDays((prev) =>
                    selected
                      ? prev.filter((d) => d !== day)
                      : [...prev, day]
                  )
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 bg-surface text-text hover:border-primary/60"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="input-label">Start Time</label>
            <TimePicker
              value={availStart}
              onChange={(e) => setAvailStart(e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">End Time</label>
            <TimePicker
              value={availEnd}
              onChange={(e) => setAvailEnd(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            checked={specialEnabled}
            onChange={(e) => setSpecialEnabled(e.target.checked)}
            className={checkboxClass}
          />
          Enable Special Schedule
        </label>
        {specialEnabled && (
          <>
            <div className="mt-3 space-y-2">
              {schedules.map((schedule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={schedule.day}
                    onChange={(e) => updateSchedule(index, "day", e.target.value)}
                    className="w-36 shrink-0"
                  >
                    {WEEKDAY_VALUES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                  <TimePicker
                    value={schedule.startTime}
                    onChange={(e) =>
                      updateSchedule(index, "startTime", e.target.value)
                    }
                    className="w-36"
                  />
                  <TimePicker
                    value={schedule.endTime}
                    onChange={(e) =>
                      updateSchedule(index, "endTime", e.target.value)
                    }
                    className="w-36"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeSchedule(index)}
                    aria-label={`Remove schedule ${index + 1}`}
                    title="Remove schedule"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={addSchedule}
            >
              <Plus size={14} />
              Add Schedule
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isAvailable")}
            className={checkboxClass}
          />
          Available
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isRecommended")}
            className={checkboxClass}
          />
          Recommended
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isPopular")}
            className={checkboxClass}
          />
          Popular
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            {...register("isActive")}
            className={checkboxClass}
          />
          Active
        </label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          loadingText={isEdit ? "Saving..." : "Creating..."}
        >
          {isEdit ? "Save Changes" : "Create Food Item"}
        </Button>
      </div>
    </form>
  );
}

function OwnerFoodsPage() {
  const user = useSelector((state) => state.auth.user);
  const [foods, setFoods] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editFood, setEditFood] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [foodsResponse, restaurantsResponse] = await Promise.all([
        foodApi.getAll(),
        restaurantApi.getAll({ ownerId: user?.id, isActive: true }),
      ]);
      setFoods(foodsResponse?.data?.foods || []);
      setRestaurants(restaurantsResponse?.data?.restaurants || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load food items.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadFoods = async () => {
      try {
        const [foodsResponse, restaurantsResponse] = await Promise.all([
          foodApi.getAll(),
          restaurantApi.getAll({ ownerId: user?.id, isActive: true }),
        ]);
        if (isMounted) {
          setFoods(foodsResponse?.data?.foods || []);
          setRestaurants(restaurantsResponse?.data?.restaurants || []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || "Failed to load food items.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFoods();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await foodApi.remove(deleteTarget._id);
      toast.success("Food item deleted successfully!");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete food item."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <SkeletonText lines={2} />
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
          title="Unable to load menu items"
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
          description="You need at least one restaurant before you can add food items to it."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Menu Items</h1>
          <p className="mt-1 text-sm text-muted">Manage your food menu.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Add Food Item
        </Button>
      </div>

      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add Food Item"
          size="lg"
        >
          <FoodForm
            restaurants={restaurants}
            onSuccess={() => {
              setShowCreate(false);
              fetchData();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editFood && (
        <Modal
          isOpen={Boolean(editFood)}
          onClose={() => setEditFood(null)}
          title="Edit Food Item"
          size="lg"
        >
          <FoodForm
            food={editFood}
            restaurants={restaurants}
            onSuccess={() => {
              setEditFood(null);
              fetchData();
            }}
            onCancel={() => setEditFood(null)}
          />
        </Modal>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Food Item"
        description={`Are you sure you want to delete "${deleteTarget?.foodName || "this item"}"? This action cannot be undone.`}
        confirmText="Delete"
      />

      {foods.length === 0 ? (
        <EmptyState
          title="No menu items yet"
          description="Add food items to your restaurant menu."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Add Food Item
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {foods.map((food) => (
            <Card key={food._id} className="overflow-hidden">
              <div className="relative h-32 overflow-hidden bg-gray-100">
                {food.coverImage ? (
                  <img
                    src={food.coverImage}
                    alt={food.foodName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl">
                    🍕
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant={food.isAvailable ? "success" : "neutral"}>
                    {food.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text">{food.foodName}</h3>
                  {food.foodCode && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                      {food.foodCode}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {food.category} • {food.foodType}
                </p>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {formatCurrency(food.variants?.[0]?.price || 0)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFood(food)}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget(food)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default OwnerFoodsPage;
