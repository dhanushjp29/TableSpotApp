import { memo } from "react";
import { Minus, Plus } from "lucide-react";

import Button from "../ui/Button.jsx";
import Select from "../ui/Select.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

const MAX_QUANTITY = 20;

const splitKey = (key) => {
  const idx = key.indexOf("::");
  return [key.slice(0, idx), key.slice(idx + 2)];
};

const getVariants = (food) => {
  if (!food) return [];
  if (food.hasVariants && food.variants?.length) return food.variants;
  return [
    food.variants?.[0] || {
      variantName: "Regular",
      price: 0,
      offerPrice: 0,
    },
  ];
};

const getVariant = (food, variantName) => {
  const variants = getVariants(food);
  return (
    variants.find(
      (v) =>
        String(v.variantName).toLowerCase() === String(variantName).toLowerCase()
    ) ||
    variants[0] ||
    { variantName: "Regular", price: 0, offerPrice: 0 }
  );
};

const getPrice = (variant) =>
  variant?.offerPrice > 0 ? variant?.offerPrice : variant?.price || 0;

function PreOrderFoods({ foods = [], selection = {}, onChange }) {
  const items = Object.entries(selection)
    .map(([key, quantity]) => {
      const [foodId, variantName] = splitKey(key);
      const food = foods.find((f) => String(f._id) === foodId);
      const variant = getVariant(food, variantName);
      return {
        key,
        food,
        quantity,
        price: getPrice(variant),
      };
    })
    .filter((item) => item.food);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const setQuantity = (key, quantity) => {
    const next = { ...selection };
    if (quantity <= 0) {
      delete next[key];
    } else {
      next[key] = Math.min(quantity, MAX_QUANTITY);
    }
    onChange(next);
  };

  const handleVariantChange = (food, oldKey, variantName) => {
    const next = { ...selection };
    const quantity = next[oldKey] || 1;
    delete next[oldKey];
    next[`${food._id}::${variantName}`] = quantity;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {foods.map((food) => {
          const variants = getVariants(food);
          const defaultVariant = variants[0]?.variantName || "Regular";
          const foodKey = Object.keys(selection).find(
            (k) => splitKey(k)[0] === String(food._id)
          );
          const currentKey = foodKey || `${food._id}::${defaultVariant}`;
          const currentVariantName = splitKey(currentKey)[1] || defaultVariant;
          const currentVariant = getVariant(food, currentVariantName);
          const quantity = selection[currentKey] || 0;

          return (
            <div
              key={food._id}
              className="flex gap-3 rounded-2xl border border-border bg-surface/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-surface-secondary/70">
                {food.coverImage && (
                  <img
                    src={food.coverImage}
                    alt={food.foodName}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text">
                  {food.foodName}
                </h3>
                <p className="text-xs text-muted">
                  {food.category} • {food.foodType}
                </p>
                {variants.length > 1 ? (
                  <Select
                    name="variant"
                    value={currentVariantName}
                    onChange={(e) =>
                      handleVariantChange(food, foodKey, e.target.value)
                    }
                    className="mt-2 w-40"
                  >
                    {variants.map((variant) => (
                      <option key={variant.variantName} value={variant.variantName}>
                        {variant.variantName} - {formatCurrency(getPrice(variant))}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="mt-1 text-xs font-medium text-muted">
                    {variants[0]?.variantName || "Regular"}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(getPrice(currentVariant))}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => setQuantity(currentKey, quantity - 1)}
                      disabled={quantity === 0}
                      aria-label={`Decrease ${food.foodName}`}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium text-text">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => setQuantity(currentKey, quantity + 1)}
                      disabled={quantity >= MAX_QUANTITY}
                      aria-label={`Increase ${food.foodName}`}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-text">
            {totalCount} item{totalCount > 1 ? "s" : ""} selected
          </p>
          <p className="text-sm font-semibold text-primary">
            Total: {formatCurrency(total)}
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(PreOrderFoods);
