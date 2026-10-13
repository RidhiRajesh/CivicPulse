import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, MapPin, Eye, Users, Shield, Clock } from 'lucide-react';

const createSeverityPin = (severity, status) => {
  let color = '#3b82f6'; // Low / default blue
  let glow = 'rgba(59, 130, 246, 0.4)';

  if (status === 'VERIFIED') {
    color = '#10b981'; // Emerald verified
    glow = 'rgba(16, 185, 129, 0.4)';
  }

  if (severity === 'CRITICAL') {
    color = '#ef4444'; // Red critical
    glow = 'rgba(239, 68, 68, 0.5)';
  } else if (severity === 'HIGH') {
    color = '#f97316'; // Orange high
    glow = 'rgba(249, 115, 22, 0.4)';
  } else if (severity === 'MEDIUM') {
    color = '#eab308'; // Amber medium
    glow = 'rgba(234, 179, 8, 0.4)';
  }

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 28px; height: 28px; background: ${glow}; border-radius: 50%;"></div>
        <div style="width: 24px; height: 24px; background: ${color}; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function IncidentsMap({ incidents = [], onSelectIncident }) {
  // Default map center: average of incident coordinates or Bangalore default
  const defaultCenter = useMemo(() => {
    if (incidents.length > 0 && incidents[0].latitude && incidents[0].longitude) {
      return [incidents[0].latitude, incidents[0].longitude];
    }
    return [12.9716, 77.5946];
  }, [incidents]);

  return (
    <div className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-slate-200 shadow-md">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {incidents.map((incident) => {
          const pinIcon = createSeverityPin(incident.severity, incident.status);
          const supportCount = incident._count?.supporters || incident.supportCount || 1;
          const reportCount = incident._count?.reports || incident.reports?.length || 1;

          return (
            <Marker
              key={incident.id}
              position={[incident.latitude, incident.longitude]}
              icon={pinIcon}
            >
              <Popup className="incident-leaflet-popup">
                <div className="p-1 space-y-2.5 min-w-[240px]">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-sm truncate">
                      {incident.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        incident.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : incident.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : incident.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {incident.description}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs pt-1 border-t border-slate-100 text-slate-700">
                    <div>
                      <span className="text-slate-400 font-medium">Score: </span>
                      <span className="font-bold text-purple-700">{incident.priorityScore ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Status: </span>
                      <span className="font-bold text-slate-900">{incident.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Reports: </span>
                      <span className="font-bold text-slate-900">{reportCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Supporters: </span>
                      <span className="font-bold text-slate-900">{supportCount}</span>
                    </div>
                  </div>

                  {/* SLA Info Row */}
                  <div className="text-xs pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">SLA: </span>
                    {incident.slaStatus === 'OVERDUE' ? (
                      <span className="font-bold text-rose-700 animate-pulse">
                        ⚠️ {incident.remainingFormatted || 'OVERDUE'}
                      </span>
                    ) : incident.slaStatus === 'WARNING' ? (
                      <span className="font-bold text-amber-700">
                        ⏳ {incident.remainingFormatted || 'WARNING'}
                      </span>
                    ) : incident.slaStatus === 'RESOLVED' ? (
                      <span className="font-bold text-emerald-700">
                        ✓ SLA Met
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-700">
                        ⏱️ {incident.remainingFormatted || 'ON TRACK'}
                      </span>
                    )}
                  </div>

                  {incident.address && (
                    <div className="text-[11px] text-slate-500 font-medium truncate pt-0.5">
                      📍 {incident.address}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectIncident && onSelectIncident(incident)}
                    className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Details</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
