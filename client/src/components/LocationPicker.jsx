import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Compass, Loader2, Check, AlertCircle } from 'lucide-react';

// Custom Colored Leaflet Pin Icon to fix default Vite image asset pathing
const createPinIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 32px; height: 32px; background: rgba(2, 132, 199, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 24px; height: 24px; background: #0284c7; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

/**
 * Child component to handle map click events
 */
function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Child component to smoothly pan map view when coordinates change
 */
function RecenterMap({ center, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  address,
  onChange,
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const parsedLat = parseFloat(latitude) || 12.9716;
  const parsedLng = parseFloat(longitude) || 77.5946;

  const currentCenter = useMemo(() => [parsedLat, parsedLng], [parsedLat, parsedLng]);
  const markerIcon = useMemo(() => createPinIcon(), []);

  // Handle map click or marker drag
  const handleLocationUpdate = (newLat, newLng) => {
    const formattedLat = parseFloat(newLat).toFixed(6);
    const formattedLng = parseFloat(newLng).toFixed(6);
    setLocationError('');
    onChange({
      latitude: formattedLat,
      longitude: formattedLng,
      address,
    });
  };

  // Drag handler for marker
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          handleLocationUpdate(latLng.lat, latLng.lng);
        }
      },
    }),
    [address]
  );

  // Browser Geolocation Detector
  const handleDetectLocation = () => {
    setIsLocating(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setIsLocating(false);
        onChange({
          latitude: lat,
          longitude: lng,
          address: address || `GPS Location (${lat}, ${lng})`,
        });
      },
      (err) => {
        setIsLocating(false);
        setLocationError('Unable to detect location. Please select a point on the map or enter coordinates.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-slate-800">
          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>Interactive Location Picker</span>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4" />
              <span>Use My Current Location</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {locationError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-800 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Leaflet Map Box */}
      <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <MapContainer
          center={currentCenter}
          zoom={14}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <RecenterMap center={currentCenter} zoom={15} />

          <MapClickHandler onSelect={handleLocationUpdate} />

          <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={currentCenter}
            ref={markerRef}
            icon={markerIcon}
          >
            <Popup className="text-xs">
              <div className="font-bold text-slate-900">Selected Incident Location</div>
              <div className="text-[11px] text-slate-600 font-mono font-medium">
                {parsedLat}, {parsedLng}
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Floating Instruction Overlay */}
        <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-xl text-xs text-slate-700 font-medium flex items-center justify-between pointer-events-none z-[400] shadow-md">
          <span className="truncate">Click map or drag marker to set exact location</span>
          <span className="font-mono text-blue-700 font-bold flex-shrink-0 ml-2">
            {parsedLat}, {parsedLng}
          </span>
        </div>
      </div>
    </div>
  );
}
