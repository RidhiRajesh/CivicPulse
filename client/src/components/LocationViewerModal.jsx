import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X, Calendar, AlertTriangle } from 'lucide-react';

const createViewerPin = () =>
  L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="width: 28px; height: 28px; background: #e11d48; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

export default function LocationViewerModal({ report, onClose }) {
  if (!report) return null;

  const lat = parseFloat(report.latitude) || 12.9716;
  const lng = parseFloat(report.longitude) || 77.5946;
  const position = [lat, lng];
  const pinIcon = useMemo(() => createViewerPin(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 text-slate-900">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{report.title}</h3>
              <p className="text-xs text-slate-500 font-medium">
                Category: <span className="text-blue-700 font-bold">{report.category}</span> | Severity: <span className="text-amber-700 font-bold">{report.incident?.severity || 'MEDIUM'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div className="px-4 sm:px-6">
          <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
            <MapContainer center={position} zoom={15} scrollWheelZoom={true} className="w-full h-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={position} icon={pinIcon}>
                <Popup>
                  <div className="font-bold text-xs text-slate-900">{report.title}</div>
                  <div className="text-[11px] text-slate-600 font-mono font-medium">{lat}, {lng}</div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>

        {/* Modal Footer Info */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="space-y-0.5">
            <span className="text-slate-500 font-medium block">Address / Location</span>
            <span className="text-slate-900 font-bold">{report.address || `GPS (${lat}, ${lng})`}</span>
          </div>

          <div className="text-right font-mono text-xs text-slate-600 font-semibold">
            <span>Coordinates: {lat}, {lng}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
