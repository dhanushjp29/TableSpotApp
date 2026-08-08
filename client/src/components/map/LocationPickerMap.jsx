import L from "leaflet";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

// Fix default marker icon for Leaflet in bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom red marker icon for TableSpot brand
const tablespotIcon = L.divIcon({
  className: "tablespot-marker",
  html: `<div style="background:#C62828;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// Blue marker used to show the user's current location
const currentLocationIcon = L.divIcon({
  className: "tablespot-current-location",
  html: `<div style="background:#2563eb;width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb, 0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Component to sync the map view when the selected position changes externally
function MapViewSync({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], 15, { animate: true });
    }
  }, [position, map]);

  return null;
}

// Component to capture map clicks and update the selected position
function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function LocationPickerMap({
  position = null,
  onPositionChange = () => {},
  className = "",
  height = "320px",
}) {
  const mapRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const defaultCenter = position
    ? [position.lat, position.lng]
    : [13.0827, 80.2707];

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentLocation({ lat, lng });
        onPositionChange({ lat, lng });
        mapRef.current?.setView([lat, lng], 15, { animate: true });
        toast.success("Using your current location.");
      },
      (err) => {
        setLocating(false);
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied. Please allow location access in your browser."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your location is currently unavailable."
              : "Unable to retrieve your location. Please try again.";
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={position ? 15 : 12}
        scrollWheelZoom
        attributionControl={false}
        style={{ height, width: "100%" }}
        ref={mapRef}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <ClickHandler onSelect={onPositionChange} />

        {currentLocation && (
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={currentLocationIcon}
            zIndexOffset={500}
          />
        )}

        {position && (
          <Marker position={[position.lat, position.lng]} icon={tablespotIcon} />
        )}

        <MapViewSync position={position} />
      </MapContainer>

      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-text shadow-md transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-70"
        title="Use my current location"
      >
        {locating ? (
          <Loader2 size={15} className="animate-spin text-primary" />
        ) : (
          <LocateFixed size={15} className="text-primary" />
        )}
        {locating ? "Locating..." : "My Location"}
      </button>

      {!position && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-text shadow-md">
            <MapPin size={14} className="text-primary" />
            Click on the map to set your restaurant location
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationPickerMap;
