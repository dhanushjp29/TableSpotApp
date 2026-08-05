import L from "leaflet";
import { LocateFixed, MapPin, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Link } from "react-router-dom";

// Fix default marker icon for Leaflet in bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const tablespotIcon = L.divIcon({
  className: "tablespot-marker",
  html: '<div class="tablespot-pin"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -30],
});

const selectedTablespotIcon = L.divIcon({
  className: "tablespot-marker",
  html: '<div class="tablespot-pin tablespot-pin--selected"></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -42],
});

const userLocationIcon = L.divIcon({
  className: "tablespot-marker",
  html: '<div class="user-location"><div class="user-location__dot"></div><div class="user-location__pulse"></div></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const isValidLocation = (r) =>
  r.location?.latitude &&
  r.location?.longitude &&
  !Number.isNaN(Number(r.location.latitude)) &&
  !Number.isNaN(Number(r.location.longitude));

// Auto-fit / center map on restaurants or the selected one
function FitBounds({ restaurants, selectedRestaurantId }) {
  const map = useMap();

  useEffect(() => {
    const validRestaurants = restaurants.filter(isValidLocation);
    if (validRestaurants.length === 0) return;

    if (selectedRestaurantId) {
      const selected = validRestaurants.find(
        (r) => String(r._id) === String(selectedRestaurantId)
      );
      if (selected) {
        map.setView(
          [Number(selected.location.latitude), Number(selected.location.longitude)],
          15,
          { animate: true }
        );
        return;
      }
    }

    if (validRestaurants.length === 1) {
      map.setView(
        [
          Number(validRestaurants[0].location.latitude),
          Number(validRestaurants[0].location.longitude),
        ],
        14
      );
    } else {
      const bounds = L.latLngBounds(
        validRestaurants.map((r) => [
          Number(r.location.latitude),
          Number(r.location.longitude),
        ])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [restaurants, selectedRestaurantId, map]);

  return null;
}

// Open the popup of the selected restaurant so the map card updates instantly
function SelectedPopupController({ markerRefs, selectedRestaurantId }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedRestaurantId) return;
    const marker = markerRefs.current[String(selectedRestaurantId)];
    if (marker && typeof marker.openPopup === "function") {
      marker.openPopup();
    }
  }, [selectedRestaurantId, markerRefs, map]);

  return null;
}

// Blue pulsing marker for the user's current location
function UserLocationMarker({ position }) {
  if (!position) return null;
  return <Marker position={position} icon={userLocationIcon} interactive={false} />;
}

// "Locate me" control button
function LocateControl({ userLocation }) {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-bar leaflet-control">
        <a
          href="#"
          role="button"
          title={userLocation ? "Show my location" : "Location unavailable"}
          aria-label="Show my location"
          onClick={(e) => {
            e.preventDefault();
            if (userLocation) {
              map.flyTo(userLocation, 15, { animate: true, duration: 1 });
            }
          }}
          className="locate-control-btn"
        >
          <LocateFixed size={18} />
        </a>
      </div>
    </div>
  );
}

function RestaurantDiscoveryMap({
  restaurants = [],
  selectedRestaurantId = null,
  onRestaurantSelect = () => {},
  className = "",
}) {
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const [userLocation, setUserLocation] = useState(null);

  const validRestaurants = restaurants.filter(isValidLocation);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        if (cancelled) return;
        setUserLocation(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const setMarkerRef = useCallback((marker, restaurantId) => {
    if (marker) {
      markerRefs.current[String(restaurantId)] = marker;
    } else {
      delete markerRefs.current[String(restaurantId)];
    }
  }, []);

  const handleMarkerClick = useCallback(
    (restaurantId) => {
      onRestaurantSelect(restaurantId);
    },
    [onRestaurantSelect]
  );

  if (validRestaurants.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-xl ${className}`}
        style={{ minHeight: "400px" }}
      >
        <div className="text-center">
          <MapPin size={32} className="mx-auto text-muted" />
          <p className="mt-2 text-sm text-muted">
            No restaurants available in this area.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{ minHeight: "400px" }}
    >
      <MapContainer
        center={[13.0827, 80.2707]}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        ref={mapRef}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FitBounds
          restaurants={validRestaurants}
          selectedRestaurantId={selectedRestaurantId}
        />

        <SelectedPopupController
          markerRefs={markerRefs}
          selectedRestaurantId={selectedRestaurantId}
        />

        <UserLocationMarker position={userLocation} />
        <LocateControl userLocation={userLocation} />

        {validRestaurants.map((restaurant) => {
          const isSelected =
            String(restaurant._id) === String(selectedRestaurantId);

          return (
            <Marker
              key={restaurant._id}
              ref={(marker) => setMarkerRef(marker, restaurant._id)}
              position={[
                Number(restaurant.location.latitude),
                Number(restaurant.location.longitude),
              ]}
              icon={isSelected ? selectedTablespotIcon : tablespotIcon}
              eventHandlers={{
                click: () => handleMarkerClick(restaurant._id),
              }}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup maxWidth={340} className="tablespot-popup">
                <div className="w-[310px]">
                  <div className="relative h-28 overflow-hidden bg-gray-100">
                    {restaurant.coverImage ? (
                      <img
                        src={restaurant.coverImage}
                        alt={restaurant.restaurantName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <MapPin size={28} />
                      </div>
                    )}
                    {restaurant.isFeatured && (
                      <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                        Featured
                      </span>
                    )}
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {Number(restaurant.averageRating || 0).toFixed(1)}
                      <span className="font-normal text-white/80">
                        ({restaurant.totalReviews || 0})
                      </span>
                    </span>
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-bold text-text">
                        {restaurant.restaurantName}
                      </h3>
                      {restaurant.priceRange && (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                          {restaurant.priceRange}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {restaurant.cuisineTypes?.slice(0, 3).join(" • ") || "Restaurant"}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <MapPin size={12} className="shrink-0 text-primary" />
                      <span className="line-clamp-1">
                        {restaurant.city}, {restaurant.state}
                      </span>
                    </p>

                    {restaurant.currentOffers?.[0]?.title && (
                      <p className="mt-2 rounded-lg bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent line-clamp-1">
                        🏷️ {restaurant.currentOffers[0].title}
                      </p>
                    )}

                    <Link
                      to={`/restaurants/${restaurant._id}`}
                      className="mt-3 block w-full rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                    >
                      Book a Table →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default RestaurantDiscoveryMap;
