import Select from "../ui/Select.jsx";

function RestaurantFilter({ restaurants = [], value = "", onChange, className }) {
  return (
    <Select
      className={className}
      label="Restaurant"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All Restaurants</option>
      {restaurants.map((restaurant) => (
        <option key={restaurant._id} value={restaurant._id}>
          {restaurant.restaurantName}
          {restaurant.city ? ` - ${restaurant.city}` : ""}
        </option>
      ))}
    </Select>
  );
}

export default RestaurantFilter;
