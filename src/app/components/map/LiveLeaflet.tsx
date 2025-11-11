// src/components/map/LiveLeaflet.tsx
'use client';

import * as React from 'react';
import 'leaflet/dist/leaflet.css'; // ÖNEMLİ: haritanın takılmaması için
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';

type Marker = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
};

export default function LiveLeaflet({
  markers,
  selectedId,
  onSelect,
}: {
  markers: Marker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const defaultCenter: [number, number] = [41.015137, 28.97953]; // İstanbul

  const bounds = React.useMemo(() => {
    if (!markers.length) return null as null | [[number, number], [number, number]];
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    for (const m of markers) {
      minLat = Math.min(minLat, m.lat);
      minLng = Math.min(minLng, m.lng);
      maxLat = Math.max(maxLat, m.lat);
      maxLng = Math.max(maxLng, m.lng);
    }
    return [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]];
  }, [markers]);

  return (
    <div className="relative" style={{ height: 420 }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {bounds && <FitBounds bounds={bounds} />}

        {markers.map((m) => {
          const active = selectedId === m.id;
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={active ? 10 : 7}
              pathOptions={{ color: active ? '#f97316' : '#0ea5e9', weight: active ? 3 : 2, fillOpacity: 0.8 }}
              eventHandlers={{ click: () => onSelect(m.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>
                <div className="font-medium">{m.name}</div>
                <div className="text-[11px] text-neutral-700">{m.phone || '—'}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  React.useEffect(() => {
    try { map.fitBounds(bounds, { padding: [30, 30] }); } catch {}
  }, [map, bounds]);
  return null;
}
